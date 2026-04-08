/**
 * Tipos para integração de Pedidos CRM → ERP Projedata
 * Comando: IMP_PEDIDO_V3
 *
 * PAYLOAD VALIDADO (referência oficial):
 * {
 *   "cpf_cnpj_cliente": 61580034000197,       // número (sem formatação)
 *   "data_pedido": "07/04/2026 19:45:00",      // DD/MM/YYYY HH:mm:ss
 *   "empresa": 1,                               // número inteiro
 *   "fluxo_venda": 10,                          // número inteiro
 *   "desconto_pedido": 0,                       // número
 *   "id_moeda": 1,                              // número inteiro
 *   "observacao": "...",                         // string
 *   "pedido_terceiro": 20260050,                // número (idempotência)
 *   "usuario": 6867786936,                      // número inteiro
 *   "vendedor": 105,                            // número inteiro
 *   "frete": "1",                               // string (código tipo frete)
 *   "itens": [...],
 *   "pagto": [...]
 * }
 */

// ─── Entrega dentro do item ─────────────────────────────────────

export interface ProjedataOrderDelivery {
  /** Ordem de compra do cliente */
  ordem_compra: string;
  /** Observação do item */
  observacao: string;
  /** Observação PCP */
  observacao_pcp: string;
  /** Previsão de entrega (DD/MM/YYYY HH:mm:ss) */
  previsao_entrega: string;
  /** Previsão de entrega ao cliente (DD/MM/YYYY HH:mm:ss) */
  previsao_ent_cliente: string;
  /** Quantidade */
  quantidade: number;
}

// ─── Item do pedido ─────────────────────────────────────────────

export interface ProjedataOrderItem {
  /** Código do produto no ERP (string numérica) */
  item: string;
  /** Sequência do item no pedido (1, 2, 3...) */
  seq_item: number;
  /** Tipo de venda (inteiro) */
  tipo_venda: number;
  /** Desconto do item (%) */
  desconto_item: number;
  /** Preço unitário */
  unitario: number;
  /** Versão do produto (string) */
  versao: string;
  /** Entregas do item */
  entregas: ProjedataOrderDelivery[];
}

// ─── Parcela de pagamento ───────────────────────────────────────

export interface ProjedataOrderPayment {
  /** Dias para vencimento */
  dias: number;
  /** Forma de recebimento (código inteiro) */
  forma_recebimento: number;
  /** Número da parcela */
  parcela: number;
  /** Tipo: "P" = parcela */
  tipo: string;
}

// ─── Pedido completo ────────────────────────────────────────────

export interface ProjedataOrder {
  /** CPF/CNPJ do cliente (número, sem formatação) */
  cpf_cnpj_cliente: number;
  /** Data do pedido (DD/MM/YYYY HH:mm:ss) */
  data_pedido: string;
  /** Empresa no ERP (inteiro) */
  empresa: number;
  /** Fluxo de venda (inteiro) */
  fluxo_venda: number;
  /** Desconto geral do pedido (%) */
  desconto_pedido: number;
  /** Moeda (1 = BRL) */
  id_moeda: number;
  /** Observações do pedido */
  observacao: string;
  /** Chave de idempotência (numérico) */
  pedido_terceiro: number;
  /** Código do usuário ERP */
  usuario: number;
  /** Código do vendedor ERP */
  vendedor: number;
  /** Tipo de frete (string) */
  frete: string;
  /** Itens do pedido */
  itens: ProjedataOrderItem[];
  /** Parcelas de pagamento */
  pagto: ProjedataOrderPayment[];
}

// ─── Resultado de validação ─────────────────────────────────────

export interface OrderValidationError {
  field: string;
  message: string;
}

export interface OrderValidationResult {
  valid: boolean;
  errors: OrderValidationError[];
}
