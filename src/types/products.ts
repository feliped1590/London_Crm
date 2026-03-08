import { TipoProdutoFiscal } from './fiscal';

export type ProposalStatus = 'rascunho' | 'enviada' | 'em_analise' | 'aprovada' | 'recusada' | 'expirada';
export type OrderStatus = 'pendente' | 'em_producao' | 'produzido' | 'faturado' | 'entregue' | 'cancelado';
export type OrderType = 'producao' | 'pronta_entrega';
export type IpiMode = 'destacar' | 'incluso' | 'isento';

export const orderTypeConfig: Record<OrderType, { label: string; color: string }> = {
  producao: { label: 'Produção', color: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800' },
  pronta_entrega: { label: 'Pronta Entrega', color: 'bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-800' },
};

export const ipiModeConfig: Record<IpiMode, { label: string; description: string }> = {
  destacar: { label: 'Destacar IPI', description: 'IPI calculado e somado ao total' },
  incluso: { label: 'IPI Incluso no Preço', description: 'IPI embutido no preço (informativo)' },
  isento: { label: 'Isento de IPI', description: 'IPI não se aplica' },
};

export interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string;
  tipo_id?: string;
  grupo_id?: string;
  subgrupo_id?: string;
  family_id?: string;
  class_id?: string;
  unit_measure?: string;
  unit_price?: number;
  fator_kg?: number;
  fator_milheiro?: number;
  width?: number;
  length?: number;
  thickness?: number;
  active?: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
  // Campos NCM e Fiscais
  ncm_code?: string;
  ncm_id?: string;
  cst_icms?: string;
  csosn?: string;
  aliquota_icms?: number;
  tem_icms_st?: boolean;
  aliquota_ipi?: number;
  cst_pis_cofins?: string;
  aliquota_pis?: number;
  aliquota_cofins?: number;
  tipo_produto_fiscal?: TipoProdutoFiscal;
  ncm_validated_at?: string;
  // Campos ERP Projedata
  tipo_item?: string;
  tipo_ficha?: number;
  erp_grupo?: string;
  erp_subgrupo?: string;
  erp_empresa?: number;
  erp_versao?: string;
  erp_versao_detalhes?: string;
  erp_versao_roteiro?: number;
  erp_versao_situacao?: string;
  erp_status?: string;
  // Campos de sincronização ERP
  origem_alteracao?: string;
  pendente_envio?: boolean;
  erp_hash?: string;
  erp_last_sync_at?: string;
  crm_last_update_at?: string;
}

// Função para calcular o Fator Milheiro
export function calcularFatorMilheiro(
  fatorKg: number,
  largura: number, // em mm
  comprimento: number, // em mm
  espessura: number // em micras
): number {
  // Fórmula: Fator KG × Largura(mm) × Comprimento(mm) × Espessura(micras) / 1.000.000
  // A divisão por 1.000.000 converte para valor adequado
  return fatorKg * largura * comprimento * espessura / 1000000;
}

export interface Proposal {
  id: string;
  number: string;
  deal_id: string;
  company_id?: string;
  contact_id?: string;
  status: ProposalStatus;
  validity_date?: string;
  payment_terms?: string;
  delivery_terms?: string;
  observations?: string;
  total_value?: number;
  ipi_mode?: IpiMode;
  subtotal_products?: number;
  total_ipi?: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
  deal?: {
    id: string;
    name: string;
  };
  company?: {
    id: string;
    name: string;
  };
  contact?: {
    id: string;
    first_name: string;
    last_name?: string;
    email?: string;
  };
  items?: ProposalItem[];
}

export type PriceSource = 'TABLE' | 'FACTOR_KG' | 'MANUAL';

export interface ProposalItem {
  id: string;
  proposal_id: string;
  product_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  width?: number;
  length?: number;
  thickness?: number;
  discount_percent?: number;
  subtotal: number;
  ipi_rate?: number;
  ipi_value?: number;
  subtotal_item?: number;
  total_item?: number;
  sort_order?: number;
  calculated_price_source?: PriceSource;
  created_at: string;
  product?: Partial<Product> | { id: string; sku: string; name: string };
}

export interface Order {
  id: string;
  number: string;
  proposal_id?: string;
  company_id?: string;
  contact_id?: string;
  status: OrderStatus;
  delivery_date?: string;
  total_value?: number;
  ipi_mode?: IpiMode;
  subtotal_products?: number;
  total_ipi?: number;
  observations?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  proposal?: Proposal;
  company?: {
    id: string;
    name: string;
  };
  contact?: {
    id: string;
    first_name: string;
    last_name?: string;
  };
  items?: OrderItem[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  width?: number;
  length?: number;
  thickness?: number;
  discount_percent?: number;
  subtotal: number;
  ipi_rate?: number;
  ipi_value?: number;
  subtotal_item?: number;
  total_item?: number;
  sort_order?: number;
  calculated_price_source?: PriceSource;
  created_at: string;
  product?: Partial<Product> | { id: string; sku: string; name: string };
}

export const proposalStatusConfig: Record<ProposalStatus, { label: string; color: string }> = {
  rascunho: { label: 'Rascunho', color: 'bg-slate-500' },
  enviada: { label: 'Enviada', color: 'bg-blue-500' },
  em_analise: { label: 'Em Análise', color: 'bg-yellow-500' },
  aprovada: { label: 'Aprovada', color: 'bg-green-500' },
  recusada: { label: 'Recusada', color: 'bg-red-500' },
  expirada: { label: 'Expirada', color: 'bg-gray-500' },
};

export const orderStatusConfig: Record<OrderStatus, { label: string; color: string }> = {
  pendente: { label: 'Pendente', color: 'bg-slate-500' },
  em_producao: { label: 'Em Produção', color: 'bg-blue-500' },
  produzido: { label: 'Produzido', color: 'bg-cyan-500' },
  faturado: { label: 'Faturado', color: 'bg-yellow-500' },
  entregue: { label: 'Entregue', color: 'bg-green-500' },
  cancelado: { label: 'Cancelado', color: 'bg-red-500' },
};

export const tipoOptions = [
  { value: 'bobina', label: 'Bobina' },
  { value: 'sacola', label: 'Sacola' },
  { value: 'filme', label: 'Filme' },
  { value: 'saco', label: 'Saco' },
  { value: 'fita', label: 'Fita' },
  { value: 'outros', label: 'Outros' },
];

export const unitMeasureOptions = [
  { value: 'un', label: 'Unidade (un)' },
  { value: 'kg', label: 'Quilograma (kg)' },
  { value: 'm', label: 'Metro (m)' },
  { value: 'm2', label: 'Metro² (m²)' },
  { value: 'pc', label: 'Peça (pc)' },
  { value: 'rl', label: 'Rolo (rl)' },
];

export const grupoOptions = [
  { value: 'PEBD', label: 'PEBD (Polietileno de Baixa Densidade)' },
  { value: 'PEAD', label: 'PEAD (Polietileno de Alta Densidade)' },
  { value: 'PP', label: 'PP (Polipropileno)' },
  { value: 'BOPP', label: 'BOPP (Polipropileno Biorientado)' },
  { value: 'PET', label: 'PET (Polietileno Tereftalato)' },
  { value: 'PVC', label: 'PVC (Policloreto de Vinila)' },
  { value: 'outros', label: 'Outros' },
];

export const subgrupoOptions = [
  { value: 'transparente', label: 'Transparente' },
  { value: 'branco', label: 'Branco' },
  { value: 'preto', label: 'Preto' },
  { value: 'colorido', label: 'Colorido' },
  { value: 'impresso', label: 'Impresso' },
];
