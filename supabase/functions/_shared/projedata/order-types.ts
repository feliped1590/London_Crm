/**
 * Tipos para integração de Pedidos CRM → ERP Projedata
 * Comando: IMP_PEDIDO_V3
 */

// ─── Entrega dentro do item ─────────────────────────────────────

export interface ProjedataOrderDelivery {
  ordem_compra: string;
  observacao: string;
  observacao_pcp: string;
  previsao_entrega: string;
  previsao_ent_cliente: string;
  quantidade: number;
}

// ─── Item do pedido ─────────────────────────────────────────────

export interface ProjedataOrderItem {
  item: string;
  seq_item: number;
  tipo_venda: number;
  desconto_item: number;
  comissao: number;
  unitario: number;
  versao: string;
  entregas: ProjedataOrderDelivery[];
}

// ─── Parcela de pagamento ───────────────────────────────────────

export interface ProjedataOrderPayment {
  dias: number;
  forma_recebimento: number;
  parcela: number;
  tipo: string;       // 'V' = valor, 'P' = percentual (rateio automático pelo ERP)
  fator?: number;     // valor (R$) quando tipo='V'; OMITIDO quando tipo='P' (ERP calcula saldo)
}

// ─── Pedido completo ────────────────────────────────────────────

export interface ProjedataOrder {
  cpf_cnpj_cliente: string;
  data_pedido: string;
  empresa: number;
  fluxo_venda: number;
  desconto_pedido: number;
  id_moeda: number;
  observacao: string;
  pedido_terceiro: number;
  usuario: number;
  vendedor: number;
  frete: string;
  itens: ProjedataOrderItem[];
  pagto: ProjedataOrderPayment[];
}

// ─── Resultado de validação ─────────────────────────────────────

export interface OrderValidationError {
  field: string;
  message: string;
  fixHint: string;
  fixRoute?: string;
}

export interface OrderValidationResult {
  valid: boolean;
  errors: OrderValidationError[];
  fields: string[];
}
