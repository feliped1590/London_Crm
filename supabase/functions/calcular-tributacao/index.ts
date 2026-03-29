// =============================================================================
// MOTOR FISCAL CENTRALIZADO - Edge Function
// =============================================================================
// Calcula tributação automaticamente com base em regras configuradas.
// Implementa: matching por prioridade, fallback obrigatório, benefícios fiscais.
// Suporte: modelo legado + IVA Dual (CBS/IBS/IS) + transição 2026-2033.
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
    tipo_adquirente?: string;
  };
  produto: {
    id: string;
    ncm: string;
    origem_mercadoria: string;
    tipo_produto?: string;
    descricao?: string;
    produto_final?: boolean;
    categoria_is?: string;
  };
  operacao: {
    tipo: string;
    cfop?: string;
    finalidade?: string;
    data_operacao?: string; // ISO date string
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
  // Campos Reforma Tributária
  modelo_tributario?: string;
  cbs_regime_incidencia?: string;
  cbs_tipo_credito?: string;
  cbs_aliquota?: number;
  cbs_reducao_base?: number;
  ibs_regime_incidencia?: string;
  ibs_tipo_credito?: string;
  ibs_aliquota?: number;
  ibs_reducao_base?: number;
  ibs_reparticao_estadual?: number;
  ibs_reparticao_municipal?: number;
  is_aplicavel?: boolean;
  is_aliquota?: number;
  is_categoria?: string;
  is_produto_final?: boolean;
  c_class_trib?: string;
  cst_nfe?: string;
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

interface TransicaoParametros {
  ano_referencia: number;
  modelo_tributario: string;
  percentual_icms_iss: number;
  percentual_ibs: number;
  percentual_pis_cofins: number;
  percentual_cbs: number;
  aliquota_cbs_referencia?: number;
  aliquota_ibs_referencia?: number;
  aliquota_ibs_estadual?: number;
  aliquota_ibs_municipal?: number;
}

type ModeloTributario = 'legado' | 'dual_teste' | 'dual_transicao' | 'novo';

// -----------------------------------------------------------------------------
// FUNÇÕES DE MATCHING
// -----------------------------------------------------------------------------

function calcularScoreRegra(regra: RegraTributacao, contexto: ContextoFiscal): number {
  let score = regra.prioridade;
  
  if (regra.tipo_operacao && regra.tipo_operacao === contexto.operacao.tipo) score += 100;
  if (regra.uf_origem && regra.uf_origem === contexto.empresa.uf) score += 50;
  if (regra.uf_destino && regra.uf_destino === contexto.cliente.uf) score += 50;
  if (regra.regime_empresa && regra.regime_empresa === contexto.empresa.regime) score += 40;
  if (regra.regime_cliente && regra.regime_cliente === contexto.cliente.regime) score += 30;
  if (regra.cfop && regra.cfop === contexto.operacao.cfop) score += 20;
  
  if (regra.ncm_code) {
    if (contexto.produto.ncm.startsWith(regra.ncm_code)) {
      score += 10 * regra.ncm_code.length;
    } else {
      return -Infinity;
    }
  }
  
  return score;
}

function regraMatchContexto(regra: RegraTributacao, contexto: ContextoFiscal): boolean {
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
// DETERMINAÇÃO DO MODELO TRIBUTÁRIO (PARAMETRIZADO)
// -----------------------------------------------------------------------------

function determinarModeloTributario(
  dataOperacao: Date,
  parametros: TransicaoParametros[]
): { modelo: ModeloTributario; params?: TransicaoParametros } {
  const ano = dataOperacao.getFullYear();
  const params = parametros.find(p => p.ano_referencia === ano);
  
  if (params) {
    return { modelo: params.modelo_tributario as ModeloTributario, params };
  }
  
  // Fallback se não houver parâmetros configurados
  if (ano < 2026) return { modelo: 'legado' };
  if (ano === 2026) return { modelo: 'dual_teste' };
  if (ano >= 2027 && ano <= 2032) return { modelo: 'dual_transicao' };
  return { modelo: 'novo' };
}

// -----------------------------------------------------------------------------
// CÁLCULO DE TRIBUTOS LEGADOS
// -----------------------------------------------------------------------------

function calcularTributosLegados(
  regra: RegraTributacao,
  contexto: ContextoFiscal,
  beneficios: BeneficioCliente[],
  fatorTransicao: number // 1.0 = 100% legado, 0.0 = legado extinto
) {
  const valorBase = contexto.valor_base;
  const observacoes: string[] = [];
  const warnings: string[] = [];
  const beneficiosAplicados: Array<{
    id: string; nome: string; tipo: string; tributo: string;
    numero_documento: string; efeito: string;
  }> = [];
  
  // ICMS
  let icmsAliquota = regra.icms_aliquota || 0;
  let icmsReducaoBase = regra.icms_reducao_base || 0;
  
  const beneficioIcms = beneficios.find(b => 
    b.beneficio.tributo === 'icms' || b.beneficio.tributo === 'todos'
  );
  if (beneficioIcms) {
    const bf = beneficioIcms.beneficio;
    if (bf.tipo === 'isencao' || bf.tipo === 'aliquota_zero') {
      icmsAliquota = 0;
      beneficiosAplicados.push({
        id: bf.id, nome: bf.nome, tipo: bf.tipo, tributo: 'icms',
        numero_documento: bf.numero_documento,
        efeito: bf.tipo === 'isencao' ? 'Isenção total de ICMS' : 'Alíquota zero de ICMS',
      });
    } else if (bf.tipo === 'reducao_base' && bf.percentual_reducao) {
      icmsReducaoBase = Math.max(icmsReducaoBase, bf.percentual_reducao);
      beneficiosAplicados.push({
        id: bf.id, nome: bf.nome, tipo: bf.tipo, tributo: 'icms',
        numero_documento: bf.numero_documento,
        efeito: `Redução de ${bf.percentual_reducao}% na base de cálculo`,
      });
    }
  }
  
  // Aplicar fator de transição ao ICMS
  icmsAliquota = icmsAliquota * fatorTransicao;
  
  // SUFRAMA
  if (contexto.cliente.suframa) {
    icmsAliquota = 0;
    observacoes.push('Cliente SUFRAMA: ICMS zerado automaticamente');
  }
  
  const icmsBaseCalculo = valorBase * (1 - (icmsReducaoBase / 100));
  const icmsValor = icmsBaseCalculo * (icmsAliquota / 100);
  
  // IPI
  let ipiAliquota = regra.ipi_aliquota || 0;
  const beneficioIpi = beneficios.find(b => 
    b.beneficio.tributo === 'ipi' || b.beneficio.tributo === 'todos'
  );
  if (beneficioIpi) {
    const bf = beneficioIpi.beneficio;
    if (bf.tipo === 'isencao' || bf.tipo === 'aliquota_zero') {
      ipiAliquota = 0;
      beneficiosAplicados.push({
        id: bf.id, nome: bf.nome, tipo: bf.tipo, tributo: 'ipi',
        numero_documento: bf.numero_documento,
        efeito: bf.tipo === 'isencao' ? 'Isenção de IPI' : 'Alíquota zero de IPI',
      });
    }
  }
  
  if (contexto.cliente.suframa) {
    ipiAliquota = 0;
    if (!observacoes.some(o => o.includes('SUFRAMA'))) {
      observacoes.push('Cliente SUFRAMA: IPI zerado automaticamente');
    }
  }
  
  // Aplicar fator de transição ao IPI (extinto a partir de 2027 para maioria)
  ipiAliquota = ipiAliquota * fatorTransicao;
  
  const ipiBaseCalculo = valorBase;
  const ipiValor = ipiBaseCalculo * (ipiAliquota / 100);
  
  // PIS
  const pisAliquota = (regra.pis_aliquota || 0) * fatorTransicao;
  const pisBaseCalculo = valorBase;
  const pisValor = pisBaseCalculo * (pisAliquota / 100);
  
  // COFINS
  const cofinsAliquota = (regra.cofins_aliquota || 0) * fatorTransicao;
  const cofinsBaseCalculo = valorBase;
  const cofinsValor = cofinsBaseCalculo * (cofinsAliquota / 100);
  
  // ICMS-ST
  let icmsStValor = 0;
  let icmsSt = undefined;
  if (regra.icms_mva && regra.icms_st_aliquota && fatorTransicao > 0) {
    const mva = regra.icms_mva;
    const stReducaoBase = regra.icms_st_reducao_base || 0;
    const stBaseCalculo = (valorBase + ipiValor) * (1 + mva / 100) * (1 - stReducaoBase / 100);
    const stAliquota = (regra.icms_st_aliquota || 0) * fatorTransicao;
    icmsStValor = stBaseCalculo * (stAliquota / 100) - icmsValor;
    if (icmsStValor < 0) icmsStValor = 0;
    
    icmsSt = {
      base_calculo: round2(stBaseCalculo),
      aliquota: stAliquota,
      mva,
      valor: round2(icmsStValor),
      reducao_base: stReducaoBase || undefined,
    };
  }
  
  // DIFAL
  let difal = undefined;
  if ((contexto.operacao.tipo === 'venda_consumidor_final' || contexto.operacao.tipo === 'venda_interestadual') && fatorTransicao > 0) {
    if (regra.difal_aliquota_destino && regra.difal_aliquota_origem) {
      const difalBase = icmsBaseCalculo;
      const difalDiff = regra.difal_aliquota_destino - regra.difal_aliquota_origem;
      const difalValor = difalBase * (difalDiff / 100) * fatorTransicao;
      
      difal = {
        base_calculo: round2(difalBase),
        aliquota_destino: regra.difal_aliquota_destino,
        aliquota_origem: regra.difal_aliquota_origem,
        valor_destino: round2(difalValor),
        valor_origem: 0,
      };
    }
  }
  
  const totalTributos = icmsValor + icmsStValor + ipiValor + pisValor + cofinsValor + (difal?.valor_destino || 0);
  const cargaTributariaPercentual = valorBase > 0 ? (totalTributos / valorBase) * 100 : 0;
  
  if (regra.is_fallback) {
    warnings.push('⚠️ Usando regra de FALLBACK. Configure regras específicas para esta operação.');
  }
  
  if (fatorTransicao < 1 && fatorTransicao > 0) {
    observacoes.push(`Período de transição: tributos legados a ${round2(fatorTransicao * 100)}%`);
  }
  
  return {
    tributacao: {
      cfop: regra.cfop_resultante,
      origem_mercadoria: regra.origem_mercadoria || contexto.produto.origem_mercadoria,
      icms: {
        cst: regra.icms_cst || '00',
        csosn: regra.icms_csosn,
        base_calculo: round2(icmsBaseCalculo),
        aliquota: icmsAliquota,
        valor: round2(icmsValor),
        reducao_base: icmsReducaoBase || undefined,
      },
      icms_st: icmsSt,
      ipi: ipiAliquota > 0 || regra.ipi_cst ? {
        cst: regra.ipi_cst || '50',
        enquadramento: regra.ipi_enquadramento,
        base_calculo: round2(ipiBaseCalculo),
        aliquota: ipiAliquota,
        valor: round2(ipiValor),
      } : undefined,
      pis: {
        cst: regra.pis_cst || '01',
        base_calculo: round2(pisBaseCalculo),
        aliquota: pisAliquota,
        valor: round2(pisValor),
      },
      cofins: {
        cst: regra.cofins_cst || '01',
        base_calculo: round2(cofinsBaseCalculo),
        aliquota: cofinsAliquota,
        valor: round2(cofinsValor),
      },
      difal,
      total_tributos: round2(totalTributos),
      carga_tributaria_percentual: round2(cargaTributariaPercentual),
    },
    beneficiosAplicados,
    observacoes,
    warnings,
  };
}

// -----------------------------------------------------------------------------
// CÁLCULO CBS/IBS/IS (REFORMA TRIBUTÁRIA)
// -----------------------------------------------------------------------------

function calcularCBS(
  regra: RegraTributacao,
  valorBase: number,
  modelo: ModeloTributario,
  params?: TransicaoParametros,
  creditoPresumido?: { codigo: string; nome: string; percentual: number } | null
) {
  if (modelo === 'legado') return null;
  
  const regime = regra.cbs_regime_incidencia || 'normal';
  const tipoCredito = regra.cbs_tipo_credito || 'integral';
  
  // Regimes sem valor
  if (['isento', 'imune', 'nao_incidencia'].includes(regime)) {
    return {
      regime_incidencia: regime,
      tipo_credito: regime === 'isento' ? 'vedado' : tipoCredito,
      base_calculo: 0,
      aliquota: 0,
      aliquota_efetiva: 0,
      valor: 0,
    };
  }
  
  // Alíquota
  let aliquota: number;
  if (modelo === 'dual_teste') {
    aliquota = 0.9; // Fase teste 2026
  } else if (regime === 'aliquota_zero' || regime === 'suspensao' || regime === 'diferimento') {
    aliquota = 0;
  } else {
    aliquota = regra.cbs_aliquota ?? params?.aliquota_cbs_referencia ?? 8.8;
  }
  
  const reducao = regra.cbs_reducao_base || 0;
  const baseCalculo = valorBase * (1 - reducao / 100);
  const aliquotaEfetiva = aliquota * (1 - reducao / 100);
  const valor = baseCalculo * (aliquota / 100);
  
  const result: Record<string, unknown> = {
    regime_incidencia: regime,
    tipo_credito: tipoCredito,
    base_calculo: round2(baseCalculo),
    aliquota,
    aliquota_efetiva: round2(aliquotaEfetiva),
    valor: round2(valor),
    reducao_base: reducao || undefined,
  };
  
  if (creditoPresumido) {
    result.credito_presumido = {
      codigo: creditoPresumido.codigo,
      nome: creditoPresumido.nome,
      percentual: creditoPresumido.percentual,
      valor: round2(valor * (creditoPresumido.percentual / 100)),
    };
  }
  
  return result;
}

function calcularIBS(
  regra: RegraTributacao,
  valorBase: number,
  modelo: ModeloTributario,
  params?: TransicaoParametros,
  creditoPresumido?: { codigo: string; nome: string; percentual: number } | null
) {
  if (modelo === 'legado') return null;
  
  const regime = regra.ibs_regime_incidencia || 'normal';
  const tipoCredito = regra.ibs_tipo_credito || 'integral';
  
  if (['isento', 'imune', 'nao_incidencia'].includes(regime)) {
    return {
      regime_incidencia: regime,
      tipo_credito: regime === 'isento' ? 'vedado' : tipoCredito,
      base_calculo: 0,
      aliquota: 0,
      aliquota_efetiva: 0,
      valor_total: 0,
      reparticao: {
        percentual_estadual: regra.ibs_reparticao_estadual ?? 65,
        percentual_municipal: regra.ibs_reparticao_municipal ?? 35,
        valor_estadual: 0,
        valor_municipal: 0,
      },
    };
  }
  
  // Alíquota única do IBS
  let aliquota: number;
  if (modelo === 'dual_teste') {
    aliquota = 0.1; // Fase teste 2026
  } else if (regime === 'aliquota_zero' || regime === 'suspensao' || regime === 'diferimento') {
    aliquota = 0;
  } else {
    aliquota = regra.ibs_aliquota ?? params?.aliquota_ibs_referencia ?? 17.7;
    // Em período de transição, IBS cresce conforme percentual_ibs
    if (modelo === 'dual_transicao' && params) {
      aliquota = aliquota * (params.percentual_ibs / 100);
    }
  }
  
  const reducao = regra.ibs_reducao_base || 0;
  const baseCalculo = valorBase * (1 - reducao / 100);
  const aliquotaEfetiva = aliquota * (1 - reducao / 100);
  const valorTotal = baseCalculo * (aliquota / 100);
  
  // Repartição interna (IBS é imposto único)
  const pctEstadual = regra.ibs_reparticao_estadual ?? params?.aliquota_ibs_estadual 
    ? ((params?.aliquota_ibs_estadual ?? 11.5) / (params?.aliquota_ibs_referencia ?? 17.7)) * 100 
    : 65;
  const pctMunicipal = 100 - pctEstadual;
  
  const result: Record<string, unknown> = {
    regime_incidencia: regime,
    tipo_credito: tipoCredito,
    base_calculo: round2(baseCalculo),
    aliquota,
    aliquota_efetiva: round2(aliquotaEfetiva),
    valor_total: round2(valorTotal),
    reparticao: {
      percentual_estadual: round2(pctEstadual),
      percentual_municipal: round2(pctMunicipal),
      valor_estadual: round2(valorTotal * (pctEstadual / 100)),
      valor_municipal: round2(valorTotal * (pctMunicipal / 100)),
    },
    reducao_base: reducao || undefined,
  };
  
  if (creditoPresumido) {
    result.credito_presumido = {
      codigo: creditoPresumido.codigo,
      nome: creditoPresumido.nome,
      percentual: creditoPresumido.percentual,
      valor: round2(valorTotal * (creditoPresumido.percentual / 100)),
    };
  }
  
  return result;
}

function calcularIS(
  regra: RegraTributacao,
  valorBase: number,
  modelo: ModeloTributario,
  cadastroIS: any[] | null,
  contexto: ContextoFiscal
) {
  if (modelo === 'legado' || modelo === 'dual_teste') return null;
  if (!regra.is_aplicavel) return null;
  
  const categoria = regra.is_categoria || contexto.produto.categoria_is || 'nao_aplicavel';
  if (categoria === 'nao_aplicavel') return null;
  
  // Buscar cadastro IS pela categoria
  let aliquota = regra.is_aliquota ?? 0;
  let excecaoLegal: string | undefined;
  
  if (cadastroIS && cadastroIS.length > 0) {
    const cadastro = cadastroIS.find((c: any) => c.categoria === categoria);
    if (cadastro) {
      aliquota = aliquota || cadastro.aliquota_padrao;
      
      // Verificar exceções legais
      if (cadastro.excecoes_legais && contexto.produto.descricao) {
        const descLower = contexto.produto.descricao.toLowerCase();
        const excecao = cadastro.excecoes_legais.find(
          (exc: string) => descLower.includes(exc.toLowerCase())
        );
        if (excecao) {
          excecaoLegal = excecao;
          aliquota = 0;
        }
      }
      
      // Verificar produto final
      if (cadastro.incide_produto_final && !contexto.produto.produto_final) {
        return null;
      }
    }
  }
  
  if (aliquota <= 0 && !excecaoLegal) return null;
  
  const valor = valorBase * (aliquota / 100);
  
  return {
    aplicavel: true,
    categoria,
    produto_final: contexto.produto.produto_final ?? false,
    base_calculo: round2(valorBase),
    aliquota,
    valor: round2(valor),
    excecao_legal: excecaoLegal,
  };
}

// -----------------------------------------------------------------------------
// SPLIT PAYMENT
// -----------------------------------------------------------------------------

function calcularSplitPayment(
  valorOperacao: number,
  cbs: any,
  ibs: any,
  is: any,
  dataOperacao: string
) {
  const cbsValor = cbs?.valor ?? 0;
  const ibsValor = ibs?.valor_total ?? 0;
  const isValor = is?.valor ?? 0;
  const totalRetido = cbsValor + ibsValor + isValor;
  
  if (totalRetido <= 0) return null;
  
  return {
    valor_operacao: round2(valorOperacao),
    cbs: cbsValor > 0 ? {
      base_calculo: cbs.base_calculo,
      aliquota: cbs.aliquota,
      valor: cbsValor,
      status: 'estimado',
    } : undefined,
    ibs: ibsValor > 0 ? {
      base_calculo: ibs.base_calculo,
      aliquota: ibs.aliquota,
      valor: ibsValor,
      valor_estadual: ibs.reparticao?.valor_estadual ?? 0,
      valor_municipal: ibs.reparticao?.valor_municipal ?? 0,
      status: 'estimado',
    } : undefined,
    is: isValor > 0 ? {
      base_calculo: is.base_calculo,
      aliquota: is.aliquota,
      valor: isValor,
      status: 'estimado',
    } : undefined,
    valor_total_retido: round2(totalRetido),
    valor_liquido_fornecedor: round2(valorOperacao - totalRetido),
    data_operacao: dataOperacao,
  };
}

// -----------------------------------------------------------------------------
// UTIL
// -----------------------------------------------------------------------------

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

// -----------------------------------------------------------------------------
// HANDLER PRINCIPAL
// -----------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // =========================================================================
    // 1. AUTENTICAÇÃO — validar usuário real via getUser()
    // =========================================================================
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =========================================================================
    // 2. SERVICE CLIENT — criado APÓS autenticação
    // =========================================================================
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // =========================================================================
    // 3. INPUT VALIDATION + PARSE
    // =========================================================================
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

    const dataOperacao = contexto.operacao.data_operacao 
      ? new Date(contexto.operacao.data_operacao) 
      : new Date();
    const hoje = dataOperacao.toISOString().split('T')[0];

    // Buscar parâmetros de transição e regras em paralelo
    const [regrasResult, parametrosResult, cadastroISResult, creditoPresumidoResult] = await Promise.all([
      // Regras ativas e vigentes
      supabase
        .from('regras_tributacao')
        .select('*')
        .eq('is_active', true)
        .lte('valid_from', hoje)
        .or(`valid_until.is.null,valid_until.gte.${hoje}`)
        .order('prioridade', { ascending: false }),
      // Parâmetros de transição
      supabase
        .from('transicao_tributaria_parametros')
        .select('*')
        .eq('is_active', true)
        .order('ano_referencia'),
      // Cadastro IS
      supabase
        .from('cadastro_imposto_seletivo')
        .select('*')
        .eq('is_active', true),
      // Crédito presumido
      supabase
        .from('credito_presumido_regras')
        .select('*')
        .eq('is_active', true)
        .lte('valid_from', hoje)
        .or(`valid_until.is.null,valid_until.gte.${hoje}`),
    ]);

    if (regrasResult.error) throw regrasResult.error;

    const regras = regrasResult.data as RegraTributacao[];
    const parametros = (parametrosResult.data || []) as TransicaoParametros[];
    const cadastroIS = cadastroISResult.data || [];
    const creditosPresumidos = creditoPresumidoResult.data || [];

    // Determinar modelo tributário
    const { modelo, params: transicaoParams } = determinarModeloTributario(dataOperacao, parametros);

    // Filtrar regras aplicáveis e ordenar por score
    const regrasAplicaveis = regras
      .filter(r => regraMatchContexto(r, contexto))
      .map(r => ({ regra: r, score: calcularScoreRegra(r, contexto) }))
      .sort((a, b) => b.score - a.score);

    let regraEscolhida: RegraTributacao | null = null;
    
    if (regrasAplicaveis.length > 0) {
      regraEscolhida = regrasAplicaveis[0].regra;
    }

    // Fallback obrigatório
    if (!regraEscolhida) {
      const { data: fallback, error: fallbackError } = await supabase
        .from('regras_tributacao')
        .select('*')
        .eq('is_fallback', true)
        .eq('is_active', true)
        .limit(1)
        .single();

      if (fallbackError || !fallback) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Nenhuma regra fiscal vigente encontrada para o contexto informado.',
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
        id, beneficio_id, valid_from, valid_until, is_active,
        beneficio:beneficios_fiscais (
          id, nome, tipo, tributo, percentual_reducao, aliquota_resultante,
          numero_documento, ncms_aplicaveis
        )
      `)
      .eq('company_id', contexto.cliente.id)
      .eq('is_active', true)
      .lte('valid_from', hoje)
      .or(`valid_until.is.null,valid_until.gte.${hoje}`);

    const beneficiosValidos = (beneficiosCliente || []).filter((bc: any) => {
      const bf = bc.beneficio;
      if (!bf) return false;
      if (!bf.ncms_aplicaveis || bf.ncms_aplicaveis.length === 0) return true;
      return bf.ncms_aplicaveis.some((ncm: string) => contexto.produto.ncm.startsWith(ncm));
    }) as BeneficioCliente[];

    // Calcular fator de transição para tributos legados
    let fatorTransicaoLegado = 1.0;
    if (modelo === 'dual_transicao' && transicaoParams) {
      fatorTransicaoLegado = transicaoParams.percentual_icms_iss / 100;
    } else if (modelo === 'novo') {
      fatorTransicaoLegado = 0;
    }

    // Fator PIS/COFINS (zerados a partir de 2027)
    let fatorPisCofins = 1.0;
    if (transicaoParams) {
      fatorPisCofins = transicaoParams.percentual_pis_cofins / 100;
    } else if (modelo !== 'legado' && modelo !== 'dual_teste') {
      fatorPisCofins = 0;
    }

    // Calcular tributos legados
    const resultadoLegado = calcularTributosLegados(
      regraEscolhida, contexto, beneficiosValidos, 
      // ICMS/ISS usa fator de transição, PIS/COFINS usa fator separado
      modelo === 'legado' || modelo === 'dual_teste' ? 1.0 : fatorTransicaoLegado
    );

    // Para PIS/COFINS, reaplicar fator PIS/COFINS separado do ICMS
    if (fatorPisCofins === 0 && modelo !== 'legado') {
      resultadoLegado.tributacao.pis.aliquota = 0;
      resultadoLegado.tributacao.pis.valor = 0;
      resultadoLegado.tributacao.cofins.aliquota = 0;
      resultadoLegado.tributacao.cofins.valor = 0;
      resultadoLegado.observacoes.push('PIS/COFINS substituídos pela CBS');
      
      // Recalcular totais
      const { icms, icms_st, ipi, difal } = resultadoLegado.tributacao;
      const total = icms.valor + (icms_st?.valor || 0) + (ipi?.valor || 0) + (difal?.valor_destino || 0);
      resultadoLegado.tributacao.total_tributos = round2(total);
      resultadoLegado.tributacao.carga_tributaria_percentual = round2(
        contexto.valor_base > 0 ? (total / contexto.valor_base) * 100 : 0
      );
    }

    // Buscar crédito presumido aplicável (condicional)
    const findCreditoPresumido = (tributo: string) => {
      return creditosPresumidos.find((cp: any) => {
        if (cp.tributo !== tributo && cp.tributo !== 'ambos') return false;
        if (cp.aplica_por_ncm && cp.ncms_aplicaveis?.length > 0) {
          if (!cp.ncms_aplicaveis.some((n: string) => contexto.produto.ncm.startsWith(n))) return false;
        }
        if (cp.aplica_por_adquirente && cp.tipos_adquirente?.length > 0) {
          if (!cp.tipos_adquirente.includes(contexto.cliente.tipo_adquirente)) return false;
        }
        if (cp.aplica_por_operacao && cp.tipos_operacao?.length > 0) {
          if (!cp.tipos_operacao.includes(contexto.operacao.tipo)) return false;
        }
        if (cp.aplica_por_regiao && cp.ufs_aplicaveis?.length > 0) {
          if (!cp.ufs_aplicaveis.includes(contexto.cliente.uf)) return false;
        }
        return true;
      });
    };

    const cpCbs = findCreditoPresumido('cbs');
    const cpIbs = findCreditoPresumido('ibs');

    // Calcular novos tributos (CBS/IBS/IS)
    const cbs = calcularCBS(
      regraEscolhida, contexto.valor_base, modelo, transicaoParams,
      cpCbs ? { codigo: cpCbs.codigo, nome: cpCbs.nome, percentual: cpCbs.percentual_credito } : null
    );
    const ibs = calcularIBS(
      regraEscolhida, contexto.valor_base, modelo, transicaoParams,
      cpIbs ? { codigo: cpIbs.codigo, nome: cpIbs.nome, percentual: cpIbs.percentual_credito } : null
    );
    const is = calcularIS(regraEscolhida, contexto.valor_base, modelo, cadastroIS, contexto);

    // Split Payment
    const splitPayment = calcularSplitPayment(
      contexto.valor_base, cbs, ibs, is, hoje
    );

    // Campos NF-e
    const nfe = modelo !== 'legado' ? {
      c_class_trib: regraEscolhida.c_class_trib || '00',
      cst_nfe: regraEscolhida.cst_nfe,
    } : undefined;

    // Totais reforma
    const totalCbsIbsIs = (cbs?.valor ?? 0) + (ibs?.valor_total ?? 0) + (is?.valor ?? 0);

    // Montar resposta
    const observacoes = [...resultadoLegado.observacoes];
    const warnings = [...resultadoLegado.warnings];

    if (modelo !== 'legado') {
      observacoes.push(`Modelo tributário: ${modelo} (ano ${dataOperacao.getFullYear()})`);
    }

    if (is?.excecao_legal) {
      observacoes.push(`Imposto Seletivo: exceção legal aplicada - ${is.excecao_legal}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        // Tributação legada
        tributacao: resultadoLegado.tributacao,
        // Tributação reforma (quando aplicável)
        reforma: modelo !== 'legado' ? {
          modelo_tributario: modelo,
          ano_referencia: dataOperacao.getFullYear(),
          percentual_legado_aplicado: round2(fatorTransicaoLegado * 100),
          cbs,
          ibs,
          is,
          split_payment: splitPayment,
          nfe,
          total_cbs_ibs_is: round2(totalCbsIbsIs),
          carga_tributaria_percentual_novo: round2(
            contexto.valor_base > 0 ? (totalCbsIbsIs / contexto.valor_base) * 100 : 0
          ),
        } : undefined,
        // Metadados
        regra_utilizada: {
          id: regraEscolhida.id,
          nome: regraEscolhida.nome,
          codigo_interno: regraEscolhida.codigo_interno,
          is_fallback: regraEscolhida.is_fallback,
        },
        parametros_transicao: transicaoParams || undefined,
        creditos_presumidos: (cpCbs || cpIbs) ? {
          cbs: cpCbs ? { id: cpCbs.id, codigo: cpCbs.codigo, nome: cpCbs.nome } : undefined,
          ibs: cpIbs ? { id: cpIbs.id, codigo: cpIbs.codigo, nome: cpIbs.nome } : undefined,
        } : undefined,
        beneficios_aplicados: resultadoLegado.beneficiosAplicados,
        observacoes,
        warnings,
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
