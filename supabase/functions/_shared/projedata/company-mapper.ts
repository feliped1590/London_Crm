/**
 * Mapeamento CRM → ERP Projedata para IMP_CLIENTE_V3
 * + Consulta EXP_CLIENTES_V2
 */

import type { ErpCompanyPayload, CompanySyncContext } from './company-types.ts';
import { buildEnvelope, serializeEnvelope } from './serializer.ts';

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
}

function onlyNumbers(v: string | null | undefined): string {
  return (v || '').replace(/\D/g, '');
}

export function mapCompanyToErp(company: CRMCompanyForSync, context: CompanySyncContext): ErpCompanyPayload {
  const cnpjNum = Number(onlyNumbers(company.cnpj));
  const cepNum = Number(onlyNumbers(company.zip_code)) || 0;

  return {
    cnpj_cpf: cnpjNum,
    pfpj: company.tipo_pessoa === 'PJ' ? 'J' : 'F',
    nome: company.name,
    fantasia: company.fantasia || company.name,
    fone: company.phone || '',
    email: company.email || '',
    insc_estadual: company.inscricao_estadual || '',
    obs_geral: '',
    tipo_correntista: 'C',
    rg: '',
    tributacao_ir: '',
    regiao: context.regiao || '',
    destino_mercadoria: 'N',
    usuario: context.usuario_erp || 1,
    banco_padrao: context.banco_padrao || 0,
    segmento_mercado: context.segmento || 0,
    subsegmento_mercado: context.subsegmento || 0,
    enderecos: [
      {
        cidade: context.cidade_codigo,
        tipo_endereco: 'P',
        endereco: company.address || '',
        complemento: company.address_complement || '',
        numero_endereco: company.address_number || '',
        bairro: company.neighborhood || '',
        cep: cepNum,
      },
    ],
    enderecos_entrega: [
      {
        cidade: context.cidade_codigo,
        codigo_entrega: 1,
        endereco: company.address || '',
        complemento: company.address_complement || '',
        numero_endereco: company.address_number || '',
        bairro: company.neighborhood || '',
        cep: cepNum,
        telefone: company.phone || '',
      },
    ],
    vendedores: [
      {
        empresa: context.empresa_codigo || 1,
        codigo_vendedor: context.vendedor_codigo || 0,
        digita_pedidos: 'S',
        exibir_historico: 'S',
        remove_vendedor: 'N',
      },
    ],
  };
}

/**
 * Gera o payload final serializado para envio ao ERP (IMP_CLIENTE_V3).
 */
export function buildCompanyPayload(mapped: ErpCompanyPayload): string {
  const envelope = buildEnvelope('IMP_CLIENTE_V3', mapped as unknown as Record<string, unknown>);
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
): Promise<string | null> {
  const cnpjNorm = onlyNumbers(cnpj);
  if (!cnpjNorm) return null;

  const payload = JSON.stringify({
    tipoComando: 'ASDCOMANDOJSONTMP',
    grupoComando: 'EXP_CLIENTES_V2',
    data_alteracao: '01/01/2000 00:00:00',
  });

  console.log(`[searchClienteByCnpj] Consultando ERP por CNPJ ${cnpjNorm}`);

  // Timeout de 15s para não travar a Edge Function
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

    // O ERP retorna array de clientes (ou objeto com lista)
    const lista = Array.isArray(data) ? data : (data?.clientes || data?.lista || []);

    // Early return no primeiro match — normaliza ambos os lados
    for (const cliente of lista) {
      const erpCnpj = onlyNumbers(String(cliente.cnpj_cpf ?? ''));
      if (erpCnpj === cnpjNorm) {
        const codigo = cliente.codigo_erp?.toString()
          || cliente.cd_correntista?.toString()
          || cliente.codigo?.toString()
          || null;
        console.log(`[searchClienteByCnpj] Encontrado: codigo_erp=${codigo}`);
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
