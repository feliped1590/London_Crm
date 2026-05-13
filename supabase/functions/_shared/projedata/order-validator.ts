/**
 * Validações pré-envio para pedidos CRM → ERP (IMP_PEDIDO_V3)
 * Cada erro inclui hint e rota para correção (espelha company-validator).
 */

import type { OrderValidationResult, OrderValidationError } from './order-types.ts';

export interface OrderToValidate {
  order_id?: string | null;
  company_id?: string | null;
  company_erp_code?: string | null;
  company_cnpj?: string | null;
  erp_empresa?: number | null;
  pedido_terceiro?: number | null;
  erp_usuario?: number | null;
  erp_fluxo_venda?: number | null;
  erp_vendedor?: number | null;
  erp_frete?: string | null;
  payment_method_mapped?: boolean;
  items: Array<{
    product_id?: string | null;
    product_name?: string | null;
    product_erp_code?: string | null;
    product_erp_versao?: string | null;
    quantity?: number | null;
    unit_price?: number | null;
    tipo_venda?: number | null;
    sale_type?: string | null;
  }>;
  payment_conditions?: Array<{
    dias?: number | null;
    forma_recebimento?: number | null;
    parcela?: number | null;
    tipo?: string | null;
    fator?: number | null;
  }>;
  payment_terms_raw?: string | null;
}

export function validateOrderForSync(order: OrderToValidate): OrderValidationResult {
  const errors: OrderValidationError[] = [];
  const fields = new Set<string>();

  const customerRoute = order.company_id ? `/customers/${order.company_id}` : '/customers';

  // 1. Cliente sincronizado
  if (!order.company_erp_code) {
    errors.push({
      field: 'company_erp_code',
      message: 'Cliente ainda não foi enviado ao ERP',
      fixHint: 'Sincronize o cliente com o ERP antes de enviar o pedido.',
      fixRoute: customerRoute,
    });
    fields.add('company_erp_code');
  }

  // 2. CNPJ do cliente
  if (!order.company_cnpj) {
    errors.push({
      field: 'company_cnpj',
      message: 'Cliente sem CNPJ cadastrado',
      fixHint: 'Preencha o CNPJ no cadastro do cliente.',
      fixRoute: customerRoute,
    });
    fields.add('company_cnpj');
  }

  // 3. Empresa emissora
  if (!order.erp_empresa || isNaN(order.erp_empresa)) {
    errors.push({
      field: 'erp_empresa',
      message: 'Empresa emissora sem código ERP configurado',
      fixHint: 'Configure o código ERP da empresa emissora (Razão Social).',
      fixRoute: '/settings?tab=legal-entities',
    });
    fields.add('erp_empresa');
  }

  // 4. pedido_terceiro
  if (!order.pedido_terceiro || order.pedido_terceiro <= 0) {
    errors.push({
      field: 'pedido_terceiro',
      message: 'Número interno do pedido inválido (pedido_terceiro)',
      fixHint: 'Reabra e salve o pedido para regenerar o número de referência.',
    });
    fields.add('pedido_terceiro');
  }

  // 5. Usuário ERP
  if (!order.erp_usuario || isNaN(order.erp_usuario)) {
    errors.push({
      field: 'erp_usuario',
      message: 'Usuário criador do pedido não está vinculado ao ERP',
      fixHint: 'Defina o código ERP do usuário em Configurações → Usuários e Permissões.',
      fixRoute: '/settings?tab=permissions',
    });
    fields.add('erp_usuario');
  }

  // 6. Fluxo de venda
  if (!order.erp_fluxo_venda || isNaN(order.erp_fluxo_venda)) {
    errors.push({
      field: 'erp_fluxo_venda',
      message: 'Tipo de pedido não mapeado para o ERP',
      fixHint: 'Mapeie o tipo de pedido em Configurações → Mapeamentos ERP.',
      fixRoute: '/settings?tab=erp-mappings',
    });
    fields.add('erp_fluxo_venda');
  }

  // 7. Vendedor ERP
  if (!order.erp_vendedor || isNaN(order.erp_vendedor)) {
    errors.push({
      field: 'erp_vendedor',
      message: 'Vendedor sem código ERP configurado',
      fixHint: 'Configure o código ERP do vendedor em Configurações → Vendedores Comerciais.',
      fixRoute: '/settings?tab=sales-reps',
    });
    fields.add('erp_vendedor');
  }

  // 8. Frete mapeado
  if (order.erp_frete === null || order.erp_frete === undefined) {
    errors.push({
      field: 'erp_frete',
      message: 'Tipo de frete não mapeado para o ERP',
      fixHint: 'Mapeie o tipo de frete em Configurações → Mapeamentos ERP.',
      fixRoute: '/settings?tab=erp-mappings',
    });
    fields.add('erp_frete');
  }

  // 9. Forma de pagamento (se foi sinalizado pelo loader)
  if (order.payment_method_mapped === false) {
    errors.push({
      field: 'payment_method',
      message: 'Forma de pagamento não mapeada para o ERP',
      fixHint: 'Mapeie a forma de pagamento em Configurações → Mapeamentos ERP.',
      fixRoute: '/settings?tab=erp-mappings',
    });
    fields.add('payment_method');
  }

  // 10. Itens
  if (!order.items || order.items.length === 0) {
    errors.push({
      field: 'items',
      message: 'Pedido não possui itens',
      fixHint: 'Adicione pelo menos um item ao pedido.',
    });
    fields.add('items');
  } else {
    order.items.forEach((item, idx) => {
      const productLabel = item.product_name ? ` (${item.product_name})` : '';
      const productRoute = item.product_id ? `/products` : '/products';

      if (!item.product_erp_code) {
        errors.push({
          field: `items[${idx}].product_erp_code`,
          message: `Item ${idx + 1}${productLabel}: produto sem Código ERP`,
          fixHint: 'Preencha o Código ERP do produto na aba ERP Projedata.',
          fixRoute: productRoute,
        });
        fields.add('product_erp_code');
      }
      if (!item.product_erp_versao) {
        errors.push({
          field: `items[${idx}].product_erp_versao`,
          message: `Item ${idx + 1}${productLabel}: versão ERP do produto não definida`,
          fixHint: 'Preencha a versão do produto na aba ERP Projedata.',
          fixRoute: productRoute,
        });
        fields.add('product_erp_versao');
      }
      if (!item.quantity || item.quantity <= 0) {
        errors.push({
          field: `items[${idx}].quantity`,
          message: `Item ${idx + 1}${productLabel}: quantidade inválida`,
          fixHint: 'Corrija a quantidade no pedido.',
        });
        fields.add('item_quantity');
      }
      if (item.unit_price == null || item.unit_price < 0) {
        errors.push({
          field: `items[${idx}].unit_price`,
          message: `Item ${idx + 1}${productLabel}: preço unitário inválido`,
          fixHint: 'Corrija o preço unitário do item no pedido.',
        });
        fields.add('item_unit_price');
      }
      if (!item.tipo_venda || isNaN(item.tipo_venda)) {
        errors.push({
          field: `items[${idx}].tipo_venda`,
          message: `Item ${idx + 1}${productLabel}: tipo de venda "${item.sale_type ?? '?'}" não mapeado para o ERP`,
          fixHint: 'Mapeie o tipo de venda em Configurações → Mapeamentos ERP.',
          fixRoute: '/settings?tab=erp-mappings',
        });
        fields.add('sale_type');
      }
    });
  }

  // 11. Condições de pagamento
  if (!order.payment_conditions || order.payment_conditions.length === 0) {
    errors.push({
      field: 'payment_terms',
      message: 'Condições de pagamento não definidas',
      fixHint: 'Defina as condições de pagamento (parcelas) no pedido.',
    });
    fields.add('payment_terms');
  } else {
    let percentSum = 0;
    let hasPercent = false;
    order.payment_conditions.forEach((p, idx) => {
      if (!p.forma_recebimento || isNaN(p.forma_recebimento)) {
        errors.push({
          field: `payment_conditions[${idx}].forma_recebimento`,
          message: `Parcela ${idx + 1}: forma de recebimento não mapeada para o ERP`,
          fixHint: 'Mapeie a forma de pagamento em Configurações → Mapeamentos ERP.',
          fixRoute: '/settings?tab=erp-mappings',
        });
        fields.add('payment_method');
      }
      if (p.dias == null || isNaN(p.dias) || p.dias < 0) {
        errors.push({
          field: `payment_conditions[${idx}].dias`,
          message: `Parcela ${idx + 1}: prazo (dias) inválido`,
          fixHint: 'Corrija as condições de pagamento no pedido.',
        });
        fields.add('payment_terms');
      }
      const tipo = p.tipo === 'V' ? 'V' : 'P';
      const fator = Number(p.fator ?? 0);
      // Tipo 'V' (valor fixo): fator obrigatório > 0.
      // Tipo 'P' (percentual): fator é IGNORADO — ERP faz rateio automático do saldo.
      if (tipo === 'V' && (!fator || fator <= 0)) {
        errors.push({
          field: `payment_conditions[${idx}].fator`,
          message: `Parcela ${idx + 1}: valor deve ser maior que zero`,
          fixHint: 'Preencha o valor da parcela no pedido.',
        });
        fields.add('payment_terms');
      }
    });
  }
  // Variáveis preservadas para futura expansão (não usadas após mudança para rateio automático).
  void percentSum; void hasPercent;

  return { valid: errors.length === 0, errors, fields: Array.from(fields) };
}
