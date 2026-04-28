/**
 * Helper compartilhado: carrega o pedido + todos os mapeamentos
 * necessários para validar/sincronizar com o ERP Projedata.
 *
 * Usado por:
 *  - validate-order-sync (read-only, dry-run)
 *  - process-order-sync (envio real)
 */

import { parsePaymentTerms } from './order-mapper.ts';
import type { OrderToValidate } from './order-validator.ts';

export interface LoadedOrderContext {
  order: any;
  company: any;
  legalEntity: any;
  items: any[];
  userName: string;
  erpUsuario: number;
  sellerName: string;
  erpVendedor: number;
  crmOrderType: string;
  typeMapping: { erp_flow_code: number; erp_flow_description: string } | null;
  crmFreightType: string | null;
  freightMapping: { erp_freight_code: string; erp_freight_description: string } | null;
  crmPaymentMethod: string | null;
  paymentMapping: { erp_payment_code: number; erp_payment_description: string } | null;
  paymentTermsStr: string | null;
  paymentConditions: Array<{ dias: number; forma_recebimento: number; parcela: number; tipo?: string }>;
  saleTypeMap: Map<string, number>;
  pedidoTerceiro: number;
  toValidate: OrderToValidate;
}

export async function loadOrderForValidation(
  supabase: any,
  orderId: string,
  pedidoTerceiroFromQueue?: number | null
): Promise<LoadedOrderContext> {
  // Pedido + relacionamentos
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select(`
      id, number, order_date, delivery_date, observations,
      total_discount, freight_type, pedido_terceiro, legal_entity_id,
      company_id, erp_rep_code, order_type, created_by,
      payment_terms, payment_method, sales_rep_id,
      companies!inner(id, erp_code, cnpj, name, sales_rep_id),
      legal_entities(id, name, erp_company_code)
    `)
    .eq('id', orderId)
    .single();

  if (orderError || !order) {
    throw new Error(`Pedido não encontrado: ${orderId}`);
  }

  const company = order.companies as any;
  const legalEntity = order.legal_entities as any;

  // Empresa emissora
  const erpEmpresa = legalEntity?.erp_company_code ? Number(legalEntity.erp_company_code) : NaN;

  // Usuário criador
  let userName = 'desconhecido';
  let erpUsuario = NaN;
  if (order.created_by) {
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('id, full_name, erp_user_code')
      .eq('user_id', order.created_by)
      .maybeSingle();
    if (userProfile) {
      userName = userProfile.full_name || 'desconhecido';
      erpUsuario = Number(userProfile.erp_user_code);
    }
  }

  // Tipo de pedido
  const crmOrderType = order.order_type ?? 'producao';
  const { data: typeMapping } = await supabase
    .from('order_type_erp_mapping')
    .select('erp_flow_code, erp_flow_description')
    .eq('crm_order_type', crmOrderType)
    .eq('is_active', true)
    .maybeSingle();

  // Vendedor
  const salesRepId = order.sales_rep_id || company?.sales_rep_id;
  let sellerName = 'desconhecido';
  let erpVendedor = NaN;
  if (salesRepId) {
    const { data: salesRep } = await supabase
      .from('sales_reps')
      .select('id, name, erp_vendor_code')
      .eq('id', salesRepId)
      .maybeSingle();
    if (salesRep) {
      sellerName = salesRep.name || 'desconhecido';
      erpVendedor = Number(salesRep.erp_vendor_code);
    }
  }

  // Frete
  const crmFreightType = order.freight_type ?? null;
  let freightMapping: any = null;
  if (crmFreightType) {
    const { data } = await supabase
      .from('freight_type_erp_mapping')
      .select('erp_freight_code, erp_freight_description')
      .eq('crm_freight_type', crmFreightType)
      .eq('is_active', true)
      .maybeSingle();
    freightMapping = data;
  }

  // Forma de pagamento
  const crmPaymentMethod = order.payment_method ?? null;
  let paymentMapping: any = null;
  if (crmPaymentMethod) {
    const { data } = await supabase
      .from('payment_method_erp_mapping')
      .select('erp_payment_code, erp_payment_description')
      .eq('crm_payment_method', crmPaymentMethod)
      .eq('is_active', true)
      .maybeSingle();
    paymentMapping = data;
  }

  const paymentTermsStr = order.payment_terms ?? null;
  const paymentConditions = paymentTermsStr && paymentMapping?.erp_payment_code
    ? parsePaymentTerms(paymentTermsStr, paymentMapping.erp_payment_code)
    : [];

  // Itens
  const { data: items, error: itemsError } = await supabase
    .from('order_items')
    .select(`
      id, quantity, unit_price, discount_percent, sort_order,
      delivery_date, description, observations, observations_pcp, sale_type,
      products!inner(id, erp_product_code, erp_versao, erp_versao_codigo, name)
    `)
    .eq('order_id', orderId)
    .order('sort_order', { ascending: true });

  if (itemsError) {
    throw new Error(`Erro ao carregar itens: ${itemsError.message}`);
  }

  // Mapeamento de tipos de venda
  const distinctSaleTypes = [...new Set((items || []).map((i: any) => i.sale_type || 'venda_tributada'))];
  const saleTypeMap = new Map<string, number>();
  if (distinctSaleTypes.length > 0) {
    const { data: saleTypeMappings } = await supabase
      .from('sale_type_erp_mapping')
      .select('crm_sale_type, erp_sale_type_code')
      .in('crm_sale_type', distinctSaleTypes)
      .eq('is_active', true);
    (saleTypeMappings || []).forEach((m: any) => saleTypeMap.set(m.crm_sale_type, m.erp_sale_type_code));
  }

  // pedido_terceiro: prioriza fila → orders → fallback
  const pedidoTerceiro = pedidoTerceiroFromQueue
    || order.pedido_terceiro
    || (parseInt((order.number || '').replace(/\D/g, ''), 10) || 0);

  // Monta objeto de validação
  const toValidate: OrderToValidate = {
    order_id: order.id,
    company_id: company?.id ?? null,
    company_erp_code: company?.erp_code ?? null,
    company_cnpj: company?.cnpj ?? null,
    erp_empresa: isNaN(erpEmpresa) ? null : erpEmpresa,
    pedido_terceiro: pedidoTerceiro || null,
    erp_usuario: isNaN(erpUsuario) ? null : erpUsuario,
    erp_fluxo_venda: typeMapping?.erp_flow_code ?? null,
    erp_vendedor: isNaN(erpVendedor) ? null : erpVendedor,
    erp_frete: freightMapping?.erp_freight_code ?? null,
    payment_method_mapped: crmPaymentMethod ? !!paymentMapping : true,
    items: (items || []).map((i: any) => ({
      product_id: i.products?.id,
      product_name: i.products?.name,
      product_erp_code: i.products?.erp_product_code ?? null,
      product_erp_versao: i.products?.erp_versao_codigo ?? i.products?.erp_versao ?? null,
      quantity: i.quantity,
      unit_price: i.unit_price,
      tipo_venda: saleTypeMap.get(i.sale_type || 'venda_tributada') ?? null,
      sale_type: i.sale_type || 'venda_tributada',
    })),
    payment_conditions: paymentConditions,
    payment_terms_raw: paymentTermsStr,
  };

  return {
    order,
    company,
    legalEntity,
    items: items || [],
    userName,
    erpUsuario,
    sellerName,
    erpVendedor,
    crmOrderType,
    typeMapping,
    crmFreightType,
    freightMapping,
    crmPaymentMethod,
    paymentMapping,
    paymentTermsStr,
    paymentConditions,
    saleTypeMap,
    pedidoTerceiro,
    toValidate,
  };
}
