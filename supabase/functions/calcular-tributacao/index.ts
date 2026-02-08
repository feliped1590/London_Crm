// =============================================================================
// MOTOR FISCAL CENTRALIZADO - Edge Function
// =============================================================================
// Calcula tributação automaticamente com base em regras configuradas.
// Implementa: matching por prioridade, fallback obrigatório, benefícios fiscais.
// 
// PERFORMANCE FUTURA (AJUSTE #5):
// - Implementar cache Redis/Memcached por contexto fiscal
// - Chave de cache: hash(tipo_operacao, uf_origem, uf_destino, regime_empresa, ncm_code)
// - Invalidação: ao alterar regras, invalidar chaves relacionadas
// - Para NF-e em lote: pré-carregar regras em memória por lote
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// -----------------------------------------------------------------------------
// TIPOS
// -----------------------------------------------------------------------------

interface ContextoFiscal {
  empresa: {
    id: string;
    uf: string;
    regime: string;
    contribuinte_icms: boolean;
    contribuinte_ipi: boolean;
    suframa?: string;
  };
  cliente: {
    id: string;
    uf: string;
    regime?: string;
    contribuinte_icms: boolean;
    suframa?: string;
  };
  produto: {
    id: string;
    ncm: string;
    origem_mercadoria: string;
    tipo_produto?: string;
    descricao?: string;
  };
  operacao: {
    tipo: string;
    cfop?: string;
    finalidade?: string;
  };
  valor_base: number;
}

interface RegraTributacao {
  id: string;
  nome: string;
  codigo_interno?: string;
  tipo_operacao?: string;
  uf_origem?: string;
  uf_destino?: string;
  regime_empresa?: string;
  regime_cliente?: string;
  ncm_code?: string;
  cfop?: string;
  cfop_resultante: string;
  origem_mercadoria: string;
  icms_cst?: string;
  icms_csosn?: string;
  icms_aliquota?: number;
  icms_reducao_base?: number;
  icms_mva?: number;
  icms_st_aliquota?: number;
  icms_st_reducao_base?: number;
  ipi_cst?: string;
  ipi_aliquota?: number;
  ipi_enquadramento?: string;
  pis_cst?: string;
  pis_aliquota?: number;
  cofins_cst?: string;
  cofins_aliquota?: number;
  difal_aliquota_destino?: number;
  difal_aliquota_origem?: number;
  fcp_aliquota?: number;
  prioridade: number;
  is_fallback: boolean;
}

interface BeneficioCliente {
  id: string;
  beneficio_id: string;
  valid_from: string;
  valid_until?: string;
  is_active: boolean;
  beneficio: {
    id: string;
    nome: string;
    tipo: string;
    tributo: string;
    percentual_reducao?: number;
    aliquota_resultante?: number;
    numero_documento: string;
    ncms_aplicaveis?: string[];
  };
}

// -----------------------------------------------------------------------------
// FUNÇÕES DE MATCHING
// -----------------------------------------------------------------------------

function calcularScoreRegra(regra: RegraTributacao, contexto: ContextoFiscal): number {
  let score = regra.prioridade;
  
  // Cada campo preenchido que dá match aumenta o score
  if (regra.tipo_operacao && regra.tipo_operacao === contexto.operacao.tipo) score += 100;
  if (regra.uf_origem && regra.uf_origem === contexto.empresa.uf) score += 50;
  if (regra.uf_destino && regra.uf_destino === contexto.cliente.uf) score += 50;
  if (regra.regime_empresa && regra.regime_empresa === contexto.empresa.regime) score += 40;
  if (regra.regime_cliente && regra.regime_cliente === contexto.cliente.regime) score += 30;
  if (regra.cfop && regra.cfop === contexto.operacao.cfop) score += 20;
  
  // NCM: match parcial (ex: regra "3923" match produto "39232110")
  if (regra.ncm_code) {
    if (contexto.produto.ncm.startsWith(regra.ncm_code)) {
      score += 10 * regra.ncm_code.length; // Quanto mais específico, maior o score
    } else {
      return -Infinity; // NCM não dá match, regra não se aplica
    }
  }
  
  return score;
}

function regraMatchContexto(regra: RegraTributacao, contexto: ContextoFiscal): boolean {
  // Verifica se a regra é aplicável ao contexto (campos vazios = wildcard)
  if (regra.tipo_operacao && regra.tipo_operacao !== contexto.operacao.tipo) return false;
  if (regra.uf_origem && regra.uf_origem !== contexto.empresa.uf) return false;
  if (regra.uf_destino && regra.uf_destino !== contexto.cliente.uf) return false;
  if (regra.regime_empresa && regra.regime_empresa !== contexto.empresa.regime) return false;
  if (regra.regime_cliente && regra.regime_cliente !== contexto.cliente.regime) return false;
  if (regra.cfop && regra.cfop !== contexto.operacao.cfop) return false;
  if (regra.ncm_code && !contexto.produto.ncm.startsWith(regra.ncm_code)) return false;
  
  return true;
}

// -----------------------------------------------------------------------------
// CÁLCULO DE TRIBUTOS
// -----------------------------------------------------------------------------

function calcularTributos(regra: RegraTributacao, contexto: ContextoFiscal, beneficios: BeneficioCliente[]) {
  const valorBase = contexto.valor_base;
  const observacoes: string[] = [];
  const warnings: string[] = [];
  const beneficiosAplicados: Array<{
    id: string;
    nome: string;
    tipo: string;
    tributo: string;
    numero_documento: string;
    efeito: string;
  }> = [];
  
  // ICMS
  let icmsAliquota = regra.icms_aliquota || 0;
  let icmsReducaoBase = regra.icms_reducao_base || 0;
  
  // Verificar benefícios de ICMS
  const beneficioIcms = beneficios.find(b => 
    b.beneficio.tributo === 'icms' || b.beneficio.tributo === 'todos'
  );
  if (beneficioIcms) {
    const bf = beneficioIcms.beneficio;
    if (bf.tipo === 'isencao') {
      icmsAliquota = 0;
      beneficiosAplicados.push({
        id: bf.id,
        nome: bf.nome,
        tipo: bf.tipo,
        tributo: 'icms',
        numero_documento: bf.numero_documento,
        efeito: 'Isenção total de ICMS',
      });
    } else if (bf.tipo === 'reducao_base' && bf.percentual_reducao) {
      icmsReducaoBase = Math.max(icmsReducaoBase, bf.percentual_reducao);
      beneficiosAplicados.push({
        id: bf.id,
        nome: bf.nome,
        tipo: bf.tipo,
        tributo: 'icms',
        numero_documento: bf.numero_documento,
        efeito: `Redução de ${bf.percentual_reducao}% na base de cálculo`,
      });
    } else if (bf.tipo === 'aliquota_zero') {
      icmsAliquota = 0;
      beneficiosAplicados.push({
        id: bf.id,
        nome: bf.nome,
        tipo: bf.tipo,
        tributo: 'icms',
        numero_documento: bf.numero_documento,
        efeito: 'Alíquota zero de ICMS',
      });
    }
  }
  
  const icmsBaseCalculo = valorBase * (1 - (icmsReducaoBase / 100));
  const icmsValor = icmsBaseCalculo * (icmsAliquota / 100);
  
  // IPI
  let ipiAliquota = regra.ipi_aliquota || 0;
  
  // Verificar benefícios de IPI
  const beneficioIpi = beneficios.find(b => 
    b.beneficio.tributo === 'ipi' || b.beneficio.tributo === 'todos'
  );
  if (beneficioIpi) {
    const bf = beneficioIpi.beneficio;
    if (bf.tipo === 'isencao' || bf.tipo === 'aliquota_zero') {
      ipiAliquota = 0;
      beneficiosAplicados.push({
        id: bf.id,
        nome: bf.nome,
        tipo: bf.tipo,
        tributo: 'ipi',
        numero_documento: bf.numero_documento,
        efeito: bf.tipo === 'isencao' ? 'Isenção de IPI' : 'Alíquota zero de IPI',
      });
    }
  }
  
  // SUFRAMA: isenção automática de IPI e ICMS para Zona Franca
  if (contexto.cliente.suframa) {
    icmsAliquota = 0;
    ipiAliquota = 0;
    observacoes.push('Cliente SUFRAMA: ICMS e IPI zerados automaticamente');
  }
  
  const ipiBaseCalculo = valorBase;
  const ipiValor = ipiBaseCalculo * (ipiAliquota / 100);
  
  // PIS
  const pisAliquota = regra.pis_aliquota || 0;
  const pisBaseCalculo = valorBase;
  const pisValor = pisBaseCalculo * (pisAliquota / 100);
  
  // COFINS
  const cofinsAliquota = regra.cofins_aliquota || 0;
  const cofinsBaseCalculo = valorBase;
  const cofinsValor = cofinsBaseCalculo * (cofinsAliquota / 100);
  
  // ICMS-ST (se aplicável)
  let icmsStValor = 0;
  let icmsSt = undefined;
  if (regra.icms_mva && regra.icms_st_aliquota) {
    const mva = regra.icms_mva;
    const stReducaoBase = regra.icms_st_reducao_base || 0;
    const stBaseCalculo = (valorBase + ipiValor) * (1 + mva / 100) * (1 - stReducaoBase / 100);
    const stAliquota = regra.icms_st_aliquota;
    icmsStValor = stBaseCalculo * (stAliquota / 100) - icmsValor;
    if (icmsStValor < 0) icmsStValor = 0;
    
    icmsSt = {
      base_calculo: Math.round(stBaseCalculo * 100) / 100,
      aliquota: stAliquota,
      mva: mva,
      valor: Math.round(icmsStValor * 100) / 100,
      reducao_base: stReducaoBase || undefined,
    };
  }
  
  // DIFAL (se operação interestadual para consumidor final)
  let difal = undefined;
  if (contexto.operacao.tipo === 'venda_consumidor_final' || contexto.operacao.tipo === 'venda_interestadual') {
    if (regra.difal_aliquota_destino && regra.difal_aliquota_origem) {
      const difalBase = icmsBaseCalculo;
      const difalDiff = regra.difal_aliquota_destino - regra.difal_aliquota_origem;
      const difalValor = difalBase * (difalDiff / 100);
      
      difal = {
        base_calculo: Math.round(difalBase * 100) / 100,
        aliquota_destino: regra.difal_aliquota_destino,
        aliquota_origem: regra.difal_aliquota_origem,
        valor_destino: Math.round(difalValor * 100) / 100,
        valor_origem: 0,
      };
    }
  }
  
  // Totais
  const totalTributos = icmsValor + icmsStValor + ipiValor + pisValor + cofinsValor + (difal?.valor_destino || 0);
  const cargaTributariaPercentual = valorBase > 0 ? (totalTributos / valorBase) * 100 : 0;
  
  // Warnings para regra de fallback
  if (regra.is_fallback) {
    warnings.push('⚠️ Usando regra de FALLBACK. Configure regras específicas para esta operação.');
  }
  
  return {
    tributacao: {
      cfop: regra.cfop_resultante,
      origem_mercadoria: regra.origem_mercadoria || contexto.produto.origem_mercadoria,
      
      icms: {
        cst: regra.icms_cst || '00',
        csosn: regra.icms_csosn,
        base_calculo: Math.round(icmsBaseCalculo * 100) / 100,
        aliquota: icmsAliquota,
        valor: Math.round(icmsValor * 100) / 100,
        reducao_base: icmsReducaoBase || undefined,
      },
      
      icms_st: icmsSt,
      
      ipi: ipiAliquota > 0 || regra.ipi_cst ? {
        cst: regra.ipi_cst || '50',
        enquadramento: regra.ipi_enquadramento,
        base_calculo: Math.round(ipiBaseCalculo * 100) / 100,
        aliquota: ipiAliquota,
        valor: Math.round(ipiValor * 100) / 100,
      } : undefined,
      
      pis: {
        cst: regra.pis_cst || '01',
        base_calculo: Math.round(pisBaseCalculo * 100) / 100,
        aliquota: pisAliquota,
        valor: Math.round(pisValor * 100) / 100,
      },
      
      cofins: {
        cst: regra.cofins_cst || '01',
        base_calculo: Math.round(cofinsBaseCalculo * 100) / 100,
        aliquota: cofinsAliquota,
        valor: Math.round(cofinsValor * 100) / 100,
      },
      
      difal,
      
      total_tributos: Math.round(totalTributos * 100) / 100,
      carga_tributaria_percentual: Math.round(cargaTributariaPercentual * 100) / 100,
    },
    beneficiosAplicados,
    observacoes,
    warnings,
  };
}

// -----------------------------------------------------------------------------
// HANDLER PRINCIPAL
// -----------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { contexto } = await req.json() as { contexto: ContextoFiscal };

    // Validação básica
    if (!contexto?.empresa?.uf || !contexto?.cliente?.uf || !contexto?.produto?.ncm) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Contexto fiscal incompleto. Campos obrigatórios: empresa.uf, cliente.uf, produto.ncm',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const hoje = new Date().toISOString().split('T')[0];

    // Buscar todas as regras ativas e vigentes
    const { data: regras, error: regrasError } = await supabase
      .from('regras_tributacao')
      .select('*')
      .eq('is_active', true)
      .lte('valid_from', hoje)
      .or(`valid_until.is.null,valid_until.gte.${hoje}`)
      .order('prioridade', { ascending: false });

    if (regrasError) throw regrasError;

    // Filtrar regras aplicáveis e ordenar por score
    const regrasAplicaveis = (regras as RegraTributacao[])
      .filter(r => regraMatchContexto(r, contexto))
      .map(r => ({ regra: r, score: calcularScoreRegra(r, contexto) }))
      .sort((a, b) => b.score - a.score);

    // Selecionar a regra de maior score
    let regraEscolhida: RegraTributacao | null = null;
    
    if (regrasAplicaveis.length > 0) {
      regraEscolhida = regrasAplicaveis[0].regra;
    }

    // AJUSTE #4: Se não encontrou regra, usar fallback obrigatório
    if (!regraEscolhida) {
      const { data: fallback, error: fallbackError } = await supabase
        .from('regras_tributacao')
        .select('*')
        .eq('is_fallback', true)
        .eq('is_active', true)
        .limit(1)
        .single();

      if (fallbackError || !fallback) {
        // ERRO BLOQUEANTE: Nenhuma regra e nenhum fallback
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Nenhuma regra fiscal vigente encontrada para o contexto informado. Configure regras fiscais ou um fallback.',
            contexto_resumo: {
              operacao: contexto.operacao.tipo,
              uf_origem: contexto.empresa.uf,
              uf_destino: contexto.cliente.uf,
              regime_empresa: contexto.empresa.regime,
              ncm: contexto.produto.ncm,
            },
          }),
          { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      regraEscolhida = fallback as RegraTributacao;
    }

    // Buscar benefícios fiscais do cliente
    const { data: beneficiosCliente } = await supabase
      .from('cliente_beneficios_fiscais')
      .select(`
        id,
        beneficio_id,
        valid_from,
        valid_until,
        is_active,
        beneficio:beneficios_fiscais (
          id,
          nome,
          tipo,
          tributo,
          percentual_reducao,
          aliquota_resultante,
          numero_documento,
          ncms_aplicaveis
        )
      `)
      .eq('company_id', contexto.cliente.id)
      .eq('is_active', true)
      .lte('valid_from', hoje)
      .or(`valid_until.is.null,valid_until.gte.${hoje}`);

    // Filtrar benefícios aplicáveis ao NCM do produto
    const beneficiosValidos = (beneficiosCliente || []).filter((bc: any) => {
      const bf = bc.beneficio;
      if (!bf) return false;
      if (!bf.ncms_aplicaveis || bf.ncms_aplicaveis.length === 0) return true;
      return bf.ncms_aplicaveis.some((ncm: string) => contexto.produto.ncm.startsWith(ncm));
    }) as BeneficioCliente[];

    // Calcular tributos
    const resultado = calcularTributos(regraEscolhida, contexto, beneficiosValidos);

    return new Response(
      JSON.stringify({
        success: true,
        tributacao: resultado.tributacao,
        regra_utilizada: {
          id: regraEscolhida.id,
          nome: regraEscolhida.nome,
          codigo_interno: regraEscolhida.codigo_interno,
          is_fallback: regraEscolhida.is_fallback,
        },
        beneficios_aplicados: resultado.beneficiosAplicados,
        observacoes: resultado.observacoes,
        warnings: resultado.warnings,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro no motor fiscal:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro interno no motor fiscal',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
