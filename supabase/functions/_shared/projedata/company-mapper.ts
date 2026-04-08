/**
 * Mapeamento CRM → ERP Projedata para IMP_CLIENTE_V3
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
