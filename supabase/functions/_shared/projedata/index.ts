/**
 * Módulo de integração ERP Projedata
 * Ponto de entrada centralizado
 */

export type {
  ProjedataProduto,
  ProjedataVersao,
  ProjedataVersaoProduto,
  ProjedataEnvelope,
  CodigoVersaoParsed,
  ProjedataValidationError,
  ProjedataValidationResult,
} from './types.ts';

export { parseCodigoVersao, formatCodigoVersao } from './parser.ts';
export { buildEnvelope, serializeEnvelope, buildAndSerialize } from './serializer.ts';
export { validateProduto, validateVersaoProduto } from './validator.ts';
export { mapCRMProductToProjedata, buildProductPayload } from './mapper.ts';

// ─── Pedidos (IMP_PEDIDO_V3) ────────────────────────────────────
export type {
  ProjedataOrder,
  ProjedataOrderItem,
  ProjedataOrderDelivery,
  ProjedataOrderPayment,
  OrderValidationError,
  OrderValidationResult,
} from './order-types.ts';

export { validateOrderForSync } from './order-validator.ts';
export { mapCRMOrderToProjedata, buildOrderPayload, generatePedidoTerceiro, parsePaymentTerms } from './order-mapper.ts';
