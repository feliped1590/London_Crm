/**
 * Validações pré-envio para pedidos CRM → ERP (IMP_PEDIDO_V3)
 */

import type { OrderValidationResult, OrderValidationError } from './order-types.ts';

export interface OrderToValidate {
  company_erp_code?: string | null;
  company_cnpj?: string | null;
  pedido_terceiro?: number | null;
  items: Array<{
    product_erp_code?: string | null;
    product_erp_versao?: string | null;
    quantity?: number | null;
    unit_price?: number | null;
  }>;
}

export function validateOrderForSync(order: OrderToValidate): OrderValidationResult {
  const errors: OrderValidationError[] = [];

  // 1. Cliente deve ter código ERP
  if (!order.company_erp_code) {
    errors.push({ field: 'company_erp_code', message: 'Cliente não possui código no ERP' });
  }

  // 2. Cliente deve ter CNPJ
  if (!order.company_cnpj) {
    errors.push({ field: 'company_cnpj', message: 'Cliente não possui CNPJ' });
  }

  // 3. pedido_terceiro deve ser válido
  if (!order.pedido_terceiro || order.pedido_terceiro <= 0) {
    errors.push({ field: 'pedido_terceiro', message: 'pedido_terceiro inválido ou ausente' });
  }

  // 4. Pedido deve ter itens
  if (!order.items || order.items.length === 0) {
    errors.push({ field: 'items', message: 'Pedido não possui itens' });
  } else {
    order.items.forEach((item, idx) => {
      if (!item.product_erp_code) {
        errors.push({ field: `items[${idx}].product_erp_code`, message: `Item ${idx + 1}: produto sem código ERP` });
      }
      if (!item.product_erp_versao) {
        errors.push({ field: `items[${idx}].product_erp_versao`, message: `Item ${idx + 1}: versão ERP não preenchida` });
      }
      if (!item.quantity || item.quantity <= 0) {
        errors.push({ field: `items[${idx}].quantity`, message: `Item ${idx + 1}: quantidade inválida` });
      }
      if (item.unit_price == null || item.unit_price < 0) {
        errors.push({ field: `items[${idx}].unit_price`, message: `Item ${idx + 1}: preço unitário inválido` });
      }
    });
  }

  return { valid: errors.length === 0, errors };
}
