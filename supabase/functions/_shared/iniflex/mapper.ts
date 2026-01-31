/**
 * Mapeamento CRM → ERP Iniflex
 * Fundação v1 - Centralização de transformações
 */

import { CRMCompany, CRMContact } from './types.ts';

/**
 * Transforma empresa do CRM para payload do Iniflex
 */
export function mapCompanyToIniflex(company: CRMCompany): Record<string, unknown> {
  const INIFLEX_COMPANY_ID = Deno.env.get('INIFLEX_COMPANY_ID') || '1';
  const cnpjLimpo = company.cnpj?.replace(/\D/g, '') || '';

  return {
    tipoComando: 'ASDCOMANDO',
    grupoComando: 'IMP_CLIENTE_V3',
    '#out#p_retorno': 'T',
    json: {
      cnpj_cpf: cnpjLimpo ? parseInt(cnpjLimpo) : 0,
      pfpj: 'PJ',
      nome: company.name,
      fantasia: company.fantasia || company.name,
      email: company.email || '',
      fone: company.phone || '',
      insc_estadual: company.inscricao_estadual || '',
      obs_geral: company.notes || '',
      tipo_correntista: 'C',
      regiao: 1,
      destino_mercadoria: 'R',
      usuario: parseInt(INIFLEX_COMPANY_ID) || 1,
      banco_padrao: 0,
      tributacao_ir: 'N',
      segmento_mercado: 1,
      subsegmento_mercado: 0,
      enderecos: buildAddresses(company),
      enderecos_entrega: [],
      vendedores: [],
    },
  };
}

/**
 * Transforma contato do CRM para payload do Iniflex
 */
export function mapContactToIniflex(contact: CRMContact): Record<string, unknown> {
  const INIFLEX_COMPANY_ID = Deno.env.get('INIFLEX_COMPANY_ID') || '1';
  const cpfLimpo = contact.cpf?.replace(/\D/g, '') || '';
  const nome = `${contact.first_name} ${contact.last_name || ''}`.trim();

  return {
    tipoComando: 'ASDCOMANDO',
    grupoComando: 'IMP_CLIENTE_V3',
    '#out#p_retorno': 'T',
    json: {
      cnpj_cpf: cpfLimpo ? parseInt(cpfLimpo) : 0,
      pfpj: contact.tipo_pessoa || 'PF',
      nome: nome,
      fantasia: nome,
      email: contact.email || '',
      fone: contact.mobile || contact.phone || '',
      obs_geral: contact.notes || '',
      tipo_correntista: 'C',
      regiao: 1,
      destino_mercadoria: 'R',
      usuario: parseInt(INIFLEX_COMPANY_ID) || 1,
      banco_padrao: 0,
      tributacao_ir: 'N',
      segmento_mercado: 1,
      subsegmento_mercado: 0,
      enderecos: [],
      enderecos_entrega: [],
      vendedores: [],
    },
  };
}

/**
 * Constrói lista de endereços para o ERP
 */
function buildAddresses(company: CRMCompany): Array<Record<string, unknown>> {
  if (!company.address && !company.city) {
    return [];
  }

  return [{
    endereco: company.address || '',
    bairro: '',
    cidade: company.city || '',
    uf: company.state || '',
    cep: '',
    principal: 'S',
    tipo_endereco: 'COM',
  }];
}
