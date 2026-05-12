/**
 * Mapeamento CRM → ERP Projedata para clientes.
 * Comando padrão atual: IMP_CLIENTE_V4_TESTE, configurável por ambiente.
 */

import type { ErpCompanyPayload, CompanySyncContext } from './company-types.ts';
import { buildEnvelope, serializeEnvelope } from './serializer.ts';

// Mapeamento Setor CRM → Segmento ERP (código numérico)
const SETOR_SEGMENTO: Record<string, number> = {
  'INDUSTRIA': 1,
  'INDÚSTRIA': 1,
  'FORNECEDORES': 2,
  'FORNECEDOR': 2,
  'DISTRIBUIDORA': 3,
  'DISTRIBUIDOR': 3,
  'COMERCIO': 4,
  'COMÉRCIO': 4,
  'SERVICOS': 4,
  'SERVIÇOS': 4,
  'AGROPECUARIA': 4,
  'AGROPECUÁRIA': 4,
};

export function getSegmentoBySetor(setorNome: string | null | undefined): number {
  if (!setorNome) return 4; // Padrão: COMERCIO
  const key = setorNome.toUpperCase().trim();
  return SETOR_SEGMENTO[key] ?? 4;
}

// Mapeamento UF → Região brasileira
const UF_REGIAO: Record<string, string> = {
  AC: 'NORTE', AP: 'NORTE', AM: 'NORTE', PA: 'NORTE', RO: 'NORTE', RR: 'NORTE', TO: 'NORTE',
  AL: 'NORDESTE', BA: 'NORDESTE', CE: 'NORDESTE', MA: 'NORDESTE', PB: 'NORDESTE',
  PE: 'NORDESTE', PI: 'NORDESTE', RN: 'NORDESTE', SE: 'NORDESTE',
  DF: 'CENTRO OESTE', GO: 'CENTRO OESTE', MT: 'CENTRO OESTE', MS: 'CENTRO OESTE',
  ES: 'SUDESTE', MG: 'SUDESTE', RJ: 'SUDESTE', SP: 'SUDESTE',
  PR: 'SUL', RS: 'SUL', SC: 'SUL',
};

export function getRegiaoByUF(uf: string | null | undefined): string {
  if (!uf) return '';
  return UF_REGIAO[uf.toUpperCase().trim()] || '';
}

export interface CRMCompanyForSync {
  cnpj: string;
  tipo_pessoa?: string | null;
  name: string;
  fantasia?: string | null;
  phone?: string | null;
  email?: string | null;
  inscricao_estadual?: string | null;
  address?: string | null;
  address_complement?: string | null;
  address_number?: string | null;
  neighborhood?: string | null;
  zip_code?: string | null;
  state?: string | null;
}

export function onlyNumbers(v: string | null | undefined): string {
  return (v || '').replace(/\D/g, '');
}

function limitText(value: string | null | undefined, max: number): string {
  return (value || '').trim().slice(0, max);
}

export function mapCompanyToErp(company: CRMCompanyForSync, context: CompanySyncContext): ErpCompanyPayload {
  const cnpj = onlyNumbers(company.cnpj);
  const cep = onlyNumbers(company.zip_code);
  const phone = onlyNumbers(company.phone);

  // Resolver região: contexto explícito > inferência por UF
  const regiaoFinal = context.regiao || getRegiaoByUF(company.state);

  return {
    cnpj_cpf: cnpj,
    pfpj: company.tipo_pessoa === 'PJ' ? 'J' : 'F',
    nome: limitText(company.name, 100),
    fantasia: limitText(company.fantasia || company.name, 100),
    fone: phone,
    email: limitText(company.email, 120),
    insc_estadual: limitText(company.inscricao_estadual, 20),
    obs_geral: '',
    tipo_correntista: 'C',
    rg: '',
    tributacao_ir: '',
    regiao: regiaoFinal,
    destino_mercadoria: context.destino_mercadoria || 'C',
    usuario: context.usuario_erp ?? 0,
    banco_padrao: context.banco_padrao ?? 999,
    segmento_mercado: context.segmento ?? 0,
    subsegmento_mercado: context.subsegmento ?? 0,
    enderecos: [
      {
        cidade: context.cidade_codigo,
        tipo_endereco: 'L',
        endereco: limitText(company.address, 100),
        complemento: limitText(company.address_complement, 60),
        numero_endereco: limitText(company.address_number, 20),
        bairro: limitText(company.neighborhood, 60),
        cep,
      },
    ],
    enderecos_entrega: [
      {
        cidade: context.cidade_codigo,
        codigo_entrega: 1,
        endereco: limitText(company.address, 100),
        complemento: limitText(company.address_complement, 60),
        numero_endereco: limitText(company.address_number, 20),
        bairro: limitText(company.neighborhood, 60),
        cep,
        telefone: phone,
      },
    ],
    vendedores: [
      {
        empresa: context.empresa_codigo ?? 0,
        codigo_vendedor: context.vendedor_codigo ?? 0,
        digita_pedidos: 'S',
        exibir_historico: 'S',
        remove_vendedor: 'N',
      },
    ],
  };
}

/**
 * Gera o payload final serializado para envio ao ERP (IMP_CLIENTE_V4_TESTE).
 * V4 retorna o código ERP do cliente recém-criado em p_retorno (V3 retornava null).
 */
export function buildCompanyPayload(mapped: ErpCompanyPayload): string {
  const command = Deno.env.get('PROJEDATA_CLIENT_COMMAND') || 'IMP_CLIENTE_V4_TESTE';
  const envelope = buildEnvelope(command, mapped as unknown as Record<string, unknown>);
  return serializeEnvelope(envelope);
}

// ─── Consulta EXP_CLIENTES_V2 ──────────────────────────────────

/**
 * Consulta o ERP por CNPJ usando EXP_CLIENTES_V2.
 * Retorna codigo_erp se encontrar, null caso contrário.
 * Usa early return no primeiro match e normalização de CNPJ.
 */
export async function searchClienteByCnpj(
  cnpj: string,
  apiUrl: string,
  apiToken: string,
  supabaseAdmin?: { from: (table: string) => any },
): Promise<string | null> {
  const cnpjNorm = onlyNumbers(cnpj);
  if (!cnpjNorm) return null;

  // ─── L2: Cache persistente (erp_clients_cache) ───
  if (supabaseAdmin) {
    try {
      const { data: cached } = await supabaseAdmin
        .from('erp_clients_cache')
        .select('codigo_erp')
        .eq('cnpj', cnpjNorm)
        .maybeSingle();

      if (cached?.codigo_erp) {
        console.log(`[searchClienteByCnpj] Cache hit: ${cnpjNorm} → ${cached.codigo_erp}`);
        // Fire-and-forget: atualizar last_seen
        supabaseAdmin
          .from('erp_clients_cache')
          .update({ last_seen: new Date().toISOString() })
          .eq('cnpj', cnpjNorm)
          .then(() => {})
          .catch(() => {});
        return cached.codigo_erp;
      }
    } catch (cacheErr: any) {
      console.warn(`[searchClienteByCnpj] Cache read error: ${cacheErr.message}`);
    }
  }

  // ─── L3: Consulta ERP (EXP_CLIENTES_V2) ───
  const payload = JSON.stringify({
    tipoComando: 'ASDCOMANDOJSONTMP',
    grupoComando: 'EXP_CLIENTES_V2',
    data_alteracao: '01/01/2000 00:00:00',
  });

  console.log(`[searchClienteByCnpj] L3: Consultando ERP por CNPJ ${cnpjNorm}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiToken}`,
      },
      body: payload,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(`[searchClienteByCnpj] ERP retornou ${res.status}`);
      return null;
    }

    const text = await res.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      console.warn('[searchClienteByCnpj] Resposta não é JSON válido');
      return null;
    }

    const lista = Array.isArray(data) ? data : (data?.clientes || data?.lista || []);

    for (const cliente of lista) {
      const erpCnpj = onlyNumbers(String(cliente.cnpj_cpf ?? ''));
      if (erpCnpj === cnpjNorm) {
        const codigo = cliente.codigo_erp?.toString()
          || cliente.cd_correntista?.toString()
          || cliente.codigo?.toString()
          || null;
        console.log(`[searchClienteByCnpj] Encontrado: codigo_erp=${codigo}`);

        // Salvar no cache persistente (L2)
        if (codigo && supabaseAdmin) {
          try {
            await supabaseAdmin
              .from('erp_clients_cache')
              .upsert(
                { cnpj: cnpjNorm, codigo_erp: codigo, last_seen: new Date().toISOString() },
                { onConflict: 'cnpj' }
              );
            console.log(`[searchClienteByCnpj] Cache saved: ${cnpjNorm} → ${codigo}`);
          } catch (cacheErr: any) {
            console.warn(`[searchClienteByCnpj] Cache write error: ${cacheErr.message}`);
          }
        }

        return codigo;
      }
    }

    console.log(`[searchClienteByCnpj] Não encontrado no ERP`);
    return null;
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      console.warn('[searchClienteByCnpj] Timeout (15s) na consulta ao ERP');
    } else {
      console.warn(`[searchClienteByCnpj] Erro na consulta: ${err.message}`);
    }
    return null;
  }
}
