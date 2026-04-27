/**
 * Tipos para integração de Clientes CRM → ERP Projedata (IMP_CLIENTE_V3)
 */

export interface ErpCompanyAddress {
  cidade: number;
  tipo_endereco: string;
  endereco: string;
  complemento: string;
  numero_endereco: string;
  bairro: string;
  cep: string;
}

export interface ErpCompanyDeliveryAddress {
  cidade: number;
  codigo_entrega: number;
  endereco: string;
  complemento: string;
  numero_endereco: string;
  bairro: string;
  cep: string;
  telefone: string;
}

export interface ErpCompanySeller {
  empresa: number;
  codigo_vendedor: number;
  digita_pedidos: string;
  exibir_historico: string;
  remove_vendedor: string;
}

export interface ErpCompanyPayload {
  cnpj_cpf: string;
  pfpj: 'J' | 'F';
  nome: string;
  fantasia: string;
  fone: string;
  email: string;
  insc_estadual: string;
  obs_geral: string;
  tipo_correntista: string;
  rg: string;
  tributacao_ir: string;
  regiao: string;
  destino_mercadoria: 'I' | 'C';
  usuario: number;
  banco_padrao: number;
  segmento_mercado: number;
  subsegmento_mercado: number;
  enderecos: ErpCompanyAddress[];
  enderecos_entrega: ErpCompanyDeliveryAddress[];
  vendedores: ErpCompanySeller[];
}

export interface CompanySyncContext {
  cidade_codigo: number;
  empresa_codigo?: number;
  vendedor_codigo?: number;
  usuario_erp?: number;
  regiao?: string;
  destino_mercadoria?: string;
  banco_padrao?: number;
  segmento?: number;
  subsegmento?: number;
}

export interface CompanyValidationError {
  field: string;
  message: string;
}

export interface CompanyValidationResult {
  valid: boolean;
  errors: CompanyValidationError[];
}
