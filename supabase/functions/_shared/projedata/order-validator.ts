/**
 * Validações pré-envio para pedidos CRM → ERP (IMP_PEDIDO_V3)
 */

import type { OrderValidationResult, OrderValidationError } from './order-types.ts';

export interface OrderToValidate {
  company_erp_code?: string | null;
  company_cnpj?: string | null;
  erp_empresa?: number | null;
  pedido_terceiro?: number | null;
  erp_usuario?: number | null;
  erp_fluxo_venda?: number | null;
  erp_vendedor?: number | null;
  erp_frete?: string | null;
  items: Array<{
    product_erp_code?: string | null;
    product_erp_versao?: string | null;
    quantity?: number | null;
    unit_price?: number | null;
    tipo_venda?: number | null;
  }>;
  payment_conditions?: Array<{
    dias?: number | null;
    forma_recebimento?: number | null;
    parcela?: number | null;
  }>;
}

export function validateOrderForSync(order: OrderToValidate): OrderValidationResult {
  const errors: OrderValidationError[] = [];

  // 1. Cliente deve ter código ERP
  if (!order.company_erp_code) {
    errors.push({ field: 'company_erp_code', message: 'Cliente não sincronizado com ERP. Envie o cliente ao ERP antes de processar o pedido.' });
  }

  // 2. Cliente deve ter CNPJ
  if (!order.company_cnpj) {
    errors.push({ field: 'company_cnpj', message: 'Cliente não possui CNPJ' });
  }

  // 3. Empresa emissora deve ter código ERP
  if (!order.erp_empresa || isNaN(order.erp_empresa)) {
    errors.push({ field: 'erp_empresa', message: 'Empresa emissora não integrada ao ERP (erp_company_code não definido)' });
  }

  // 4. pedido_terceiro deve ser válido
  if (!order.pedido_terceiro || order.pedido_terceiro <= 0) {
    errors.push({ field: 'pedido_terceiro', message: 'pedido_terceiro inválido ou ausente' });
  }

  // 5. Usuário ERP obrigatório
  if (!order.erp_usuario || isNaN(order.erp_usuario)) {
    errors.push({ field: 'erp_usuario', message: 'Usuário não integrado ao ERP (erp_user_code não definido)' });
  }

  // 6. Fluxo de venda obrigatório
  if (!order.erp_fluxo_venda || isNaN(order.erp_fluxo_venda)) {
    errors.push({ field: 'erp_fluxo_venda', message: 'Tipo de pedido não mapeado para o ERP' });
  }

  // 7. Vendedor ERP obrigatório
  if (!order.erp_vendedor || isNaN(order.erp_vendedor)) {
    errors.push({ field: 'erp_vendedor', message: 'Vendedor não integrado ao ERP (erp_vendor_code não definido)' });
  }

  // 8. Frete mapeado obrigatório
  if (order.erp_frete === null || order.erp_frete === undefined) {
    errors.push({ field: 'erp_frete', message: 'Frete não mapeado para o ERP' });
  }

  // 9. Pedido deve ter itens
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
      if (!item.tipo_venda || isNaN(item.tipo_venda)) {
        errors.push({ field: `items[${idx}].tipo_venda`, message: `Item ${idx + 1}: tipo de venda não mapeado para o ERP` });
      }
    });
  }

  // 10. Condições de pagamento obrigatórias
  if (!order.payment_conditions || order.payment_conditions.length === 0) {
    errors.push({ field: 'payment_conditions', message: 'Condições de pagamento não definidas' });
  } else {
    order.payment_conditions.forEach((p, idx) => {
      if (!p.forma_recebimento || isNaN(p.forma_recebimento)) {
        errors.push({ field: `payment_conditions[${idx}].forma_recebimento`, message: `Parcela ${idx + 1}: forma de recebimento não mapeada para o ERP` });
      }
      if (!p.dias || p.dias <= 0) {
        errors.push({ field: `payment_conditions[${idx}].dias`, message: `Parcela ${idx + 1}: dias inválido` });
      }
    });
  }

  return { valid: errors.length === 0, errors };
}
