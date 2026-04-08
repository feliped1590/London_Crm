/**
 * Edge Function: process-order-sync
 * Processa a fila order_sync_queue enviando pedidos pendentes ao ERP Projedata (IMP_PEDIDO_V3).
 * Todos os campos são resolvidos dinamicamente — NENHUM hardcode.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { mapCRMOrderToProjedata, buildOrderPayload, generatePedidoTerceiro, parsePaymentTerms } from '../_shared/projedata/order-mapper.ts';
import { validateOrderForSync } from '../_shared/projedata/order-validator.ts';
import type { CRMOrderForSync, CRMOrderItemForSync } from '../_shared/projedata/order-mapper.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const apiUrl = Deno.env.get('PROJEDATA_API_URL');
  const apiToken = Deno.env.get('PROJEDATA_API_TOKEN');

  if (!apiUrl || !apiToken) {
    return errorResponse(500, 'PROJEDATA_API_URL e PROJEDATA_API_TOKEN não configurados');
  }

  try {
    // Parse request body for optional order_id (manual sync)
    let targetOrderId: string | null = null;
    try {
      const body = await req.json();
      targetOrderId = body?.order_id || null;
    } catch { /* no body = batch mode */ }

    // If specific order_id provided, ensure it's in the queue
    if (targetOrderId) {
      const { data: existing } = await supabase
        .from('order_sync_queue')
        .select('id, status')
        .eq('order_id', targetOrderId)
        .in('status', ['pending', 'processing'])
        .maybeSingle();

      if (!existing) {
        const { data: orderInfo, error: orderInfoError } = await supabase
          .from('orders')
          .select('id, number, tenant_id')
          .eq('id', targetOrderId)
          .single();

        if (orderInfoError || !orderInfo) {
          return errorResponse(404, `Pedido não encontrado: ${targetOrderId}`);
        }

        const pedidoTerceiro = parseInt((orderInfo.number || '').replace(/\D/g, ''), 10) || Date.now();

        const { data: failedEntry } = await supabase
          .from('order_sync_queue')
          .select('id')
          .eq('order_id', targetOrderId)
          .eq('status', 'failed')
          .maybeSingle();

        if (failedEntry) {
          await supabase
            .from('order_sync_queue')
            .update({ status: 'pending', attempt_count: 0, error_message: null, next_retry_at: null, updated_at: new Date().toISOString() })
            .eq('id', failedEntry.id);
        } else {
          await supabase
            .from('order_sync_queue')
            .insert({
              order_id: targetOrderId,
              tenant_id: orderInfo.tenant_id,
              pedido_terceiro: pedidoTerceiro,
              status: 'pending',
            });
        }
      }
    }

    // 1. Buscar itens pendentes da fila
    let queueQuery = supabase
      .from('order_sync_queue')
      .select('id, order_id, pedido_terceiro, attempt_count, tenant_id')
      .eq('status', 'pending')
      .lt('attempt_count', 5)
      .or('next_retry_at.is.null,next_retry_at.lte.' + new Date().toISOString())
      .order('created_at', { ascending: true });

    if (targetOrderId) {
      queueQuery = queueQuery.eq('order_id', targetOrderId);
    } else {
      queueQuery = queueQuery.limit(10);
    }

    const { data: queue, error: queueError } = await queueQuery;

    if (queueError) {
      console.error('[process-order-sync] Erro ao ler fila:', queueError.message);
      return errorResponse(500, queueError.message);
    }

    if (!queue || queue.length === 0) {
      return jsonResponse({ success: true, processed: 0, message: 'Nenhum pedido pendente na fila' });
    }

    console.log(`[process-order-sync] Processando ${queue.length} pedido(s)`);

    let successCount = 0;
    let errorCount = 0;
    const results: Array<{ order_id: string; status: string; error?: string; erp_order_id?: number }> = [];

    for (const queueItem of queue) {
      try {
        // 2. Marcar como processing
        await supabase
          .from('order_sync_queue')
          .update({ status: 'processing', updated_at: new Date().toISOString() })
          .eq('id', queueItem.id);

        await supabase
          .from('orders')
          .update({ erp_sync_status: 'processing' })
          .eq('id', queueItem.order_id);

        // 3. Carregar pedido completo
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
          .eq('id', queueItem.order_id)
          .single();

        if (orderError || !order) {
          throw new Error(`Pedido não encontrado: ${queueItem.order_id}`);
        }

        // ─── Resolver empresa emissora ───────────────────────
        const legalEntity = order.legal_entities as any;
        if (!legalEntity?.erp_company_code) {
          throw new Error('Empresa emissora não integrada ao ERP (erp_company_code não definido)');
        }
        const erpEmpresa = Number(legalEntity.erp_company_code);
        if (!erpEmpresa || isNaN(erpEmpresa)) {
          throw new Error('Empresa emissora inválida no ERP (erp_company_code não é numérico)');
        }

        // ─── Resolver usuário ERP ────────────────────────────
        let erpUsuario = 0;
        let userName = 'desconhecido';
        if (order.created_by) {
          const { data: userProfile } = await supabase
            .from('profiles')
            .select('id, full_name, erp_user_code')
            .eq('id', order.created_by)
            .maybeSingle();

          if (userProfile) {
            userName = userProfile.full_name || 'desconhecido';
            erpUsuario = Number(userProfile.erp_user_code);
          }
        }
        if (!erpUsuario || isNaN(erpUsuario)) {
          throw new Error('Usuário não integrado ao ERP (erp_user_code não definido)');
        }

        // ─── Resolver fluxo de venda ─────────────────────────
        const crmOrderType = order.order_type ?? 'producao';
        const { data: typeMapping } = await supabase
          .from('order_type_erp_mapping')
          .select('erp_flow_code, erp_flow_description')
          .eq('crm_order_type', crmOrderType)
          .eq('is_active', true)
          .maybeSingle();

        if (!typeMapping?.erp_flow_code) {
          throw new Error(`Tipo de pedido não mapeado para o ERP (crm_order_type: ${crmOrderType})`);
        }

        // ─── Resolver vendedor ERP ───────────────────────────
        const company = order.companies as any;
        const salesRepId = order.sales_rep_id || company?.sales_rep_id;
        let erpVendedor = 0;
        let sellerName = 'desconhecido';

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
        if (!erpVendedor || isNaN(erpVendedor)) {
          throw new Error('Vendedor não integrado ao ERP (erp_vendor_code não definido)');
        }

        // ─── Resolver frete ─────────────────────────────────
        const crmFreightType = order.freight_type;
        if (!crmFreightType) {
          throw new Error('Tipo de frete não definido no pedido');
        }
        const { data: freightMapping } = await supabase
          .from('freight_type_erp_mapping')
          .select('erp_freight_code, erp_freight_description')
          .eq('crm_freight_type', crmFreightType)
          .eq('is_active', true)
          .maybeSingle();

        if (!freightMapping) {
          throw new Error(`Frete não mapeado para o ERP (freight_type: ${crmFreightType})`);
        }

        // ─── Resolver forma de pagamento ─────────────────────
        const crmPaymentMethod = order.payment_method;
        if (!crmPaymentMethod) {
          throw new Error('Forma de pagamento não definida no pedido');
        }
        const { data: paymentMapping } = await supabase
          .from('payment_method_erp_mapping')
          .select('erp_payment_code, erp_payment_description')
          .eq('crm_payment_method', crmPaymentMethod)
          .eq('is_active', true)
          .maybeSingle();

        if (!paymentMapping) {
          throw new Error(`Forma de pagamento não mapeada para o ERP (payment_method: ${crmPaymentMethod})`);
        }

        // ─── Parsear condições de pagamento ──────────────────
        const paymentTermsStr = order.payment_terms;
        if (!paymentTermsStr) {
          throw new Error('Condições de pagamento (payment_terms) não definidas no pedido');
        }
        const paymentConditions = parsePaymentTerms(paymentTermsStr, paymentMapping.erp_payment_code);

        // 4. Carregar itens com produtos
        const { data: items, error: itemsError } = await supabase
          .from('order_items')
          .select(`
            id, quantity, unit_price, discount_percent, sort_order,
            delivery_date, description, sale_type,
            products!inner(id, erp_product_code, erp_versao, name)
          `)
          .eq('order_id', queueItem.order_id)
          .order('sort_order', { ascending: true });

        if (itemsError) {
          throw new Error(`Erro ao carregar itens: ${itemsError.message}`);
        }

        // ─── Resolver tipo de venda por item ─────────────────
        const distinctSaleTypes = [...new Set((items || []).map((i: any) => i.sale_type || 'venda_tributada'))];
        const { data: saleTypeMappings } = await supabase
          .from('sale_type_erp_mapping')
          .select('crm_sale_type, erp_sale_type_code, erp_sale_type_description')
          .in('crm_sale_type', distinctSaleTypes)
          .eq('is_active', true);

        const saleTypeMap = new Map<string, number>();
        (saleTypeMappings || []).forEach((m: any) => saleTypeMap.set(m.crm_sale_type, m.erp_sale_type_code));

        // Verificar se todos os tipos de venda foram mapeados
        for (const st of distinctSaleTypes) {
          if (!saleTypeMap.has(st)) {
            throw new Error(`Tipo de venda não mapeado para o ERP (sale_type: ${st})`);
          }
        }

        console.log(`[process-order-sync] Contexto: user=${userName} (erp:${erpUsuario}), tipo=${crmOrderType}→${typeMapping.erp_flow_code}, vendedor=${sellerName} (erp:${erpVendedor}), frete=${crmFreightType}→${freightMapping.erp_freight_code}, pagto=${crmPaymentMethod}→${paymentMapping.erp_payment_code}, parcelas=${paymentTermsStr}`);

        // 5. Validar
        const validation = validateOrderForSync({
          company_erp_code: company?.erp_code,
          company_cnpj: company?.cnpj,
          erp_empresa: erpEmpresa,
          pedido_terceiro: queueItem.pedido_terceiro,
          erp_usuario: erpUsuario,
          erp_fluxo_venda: typeMapping.erp_flow_code,
          erp_vendedor: erpVendedor,
          erp_frete: freightMapping.erp_freight_code,
          items: (items || []).map((i: any) => ({
            product_erp_code: i.products?.erp_product_code,
            product_erp_versao: i.products?.erp_versao,
            quantity: i.quantity,
            unit_price: i.unit_price,
            tipo_venda: saleTypeMap.get(i.sale_type || 'venda_tributada'),
          })),
          payment_conditions: paymentConditions,
        });

        if (!validation.valid) {
          const details = validation.errors.map(e => `${e.field}: ${e.message}`).join('; ');
          throw new Error(`Validação falhou: ${details}`);
        }

        // 6. Montar payload
        const crmOrder: CRMOrderForSync = {
          pedido_terceiro: queueItem.pedido_terceiro,
          order_date: order.order_date || new Date().toISOString(),
          observations: order.observations,
          total_discount: Number(order.total_discount) || 0,
          freight_type: freightMapping.erp_freight_code,
          delivery_date: order.delivery_date,
          company_cnpj: company.cnpj,
          erp_empresa: erpEmpresa,
          erp_fluxo_venda: typeMapping.erp_flow_code,
          erp_usuario: erpUsuario,
          erp_vendedor: erpVendedor,
          items: (items || []).map((item: any, idx: number): CRMOrderItemForSync => ({
            seq: idx + 1,
            erp_product_code: item.products.erp_product_code,
            erp_versao: item.products.erp_versao,
            quantity: Number(item.quantity),
            unit_price: Number(item.unit_price),
            discount_percent: Number(item.discount_percent) || 0,
            tipo_venda: saleTypeMap.get(item.sale_type || 'venda_tributada')!,
            delivery_date: item.delivery_date || order.delivery_date,
            observations: item.description || '',
          })),
          payment_conditions: paymentConditions,
        };

        const projedataOrder = mapCRMOrderToProjedata(crmOrder);
        const payload = buildOrderPayload(projedataOrder);

        console.log(`[process-order-sync] Enviando pedido ${order.number} (terceiro: ${queueItem.pedido_terceiro})`);

        // 7. Enviar ao ERP
        const response = await fetch(apiUrl!, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiToken}`,
          },
          body: payload,
        });

        const responseText = await response.text();
        console.log(`[process-order-sync] Resposta ERP (${response.status}): ${responseText}`);

        if (!response.ok) {
          throw new Error(`ERP retornou ${response.status}: ${responseText}`);
        }

        // 8. Parse retorno
        let responseData: any;
        try {
          responseData = JSON.parse(responseText);
        } catch {
          responseData = { raw: responseText };
        }

        const retornoObj = Array.isArray(responseData) ? responseData[0] : responseData;
        const retorno = retornoObj?.['#out#p_retorno'] || retornoObj?.p_retorno || '';

        if (typeof retorno === 'string' && retorno.includes('#ERRO#')) {
          throw new Error(`ERP retornou erro: ${retorno}`);
        }

        // Parse: PEDIDO#123#20260050
        let erpOrderId: number | null = null;
        if (typeof retorno === 'string') {
          const parts = retorno.split('#');
          if (parts[0] === 'PEDIDO' && parts[1]) {
            erpOrderId = Number(parts[1]);
          }
        }

        // 9. Sucesso - atualizar tudo
        await supabase
          .from('order_sync_queue')
          .update({
            status: 'completed',
            processed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', queueItem.id);

        const orderUpdate: Record<string, unknown> = {
          erp_sync_status: 'success',
          erp_last_sync_at: new Date().toISOString(),
          erp_synced_at: new Date().toISOString(),
        };
        if (erpOrderId) {
          orderUpdate.erp_order_id = erpOrderId;
          orderUpdate.erp_order_code = String(erpOrderId);
        }

        await supabase
          .from('orders')
          .update(orderUpdate)
          .eq('id', queueItem.order_id);

        // Log detalhado
        const parsedPayload = JSON.parse(payload);
        await supabase.from('order_sync_log').insert({
          order_id: queueItem.order_id,
          queue_item_id: queueItem.id,
          pedido_terceiro: queueItem.pedido_terceiro,
          direction: 'crm_to_erp',
          status: 'success',
          request_payload: parsedPayload,
          response_payload: responseData,
        });

        // Observabilidade centralizada com TODOS os mapeamentos
        const itemsSaleTypes = (items || []).map((i: any) => ({
          product: i.products?.erp_product_code,
          sale_type: i.sale_type,
          erp_sale_type_code: saleTypeMap.get(i.sale_type || 'venda_tributada'),
        }));

        await supabase.from('erp_sync_logs').insert({
          entity_type: 'order',
          entity_id: queueItem.order_id,
          direction: 'crm_to_erp',
          status: 'success',
          external_id: erpOrderId ? String(erpOrderId) : null,
          request_payload: parsedPayload,
          metadata: {
            pedido_terceiro: queueItem.pedido_terceiro,
            company_name: legalEntity.name,
            erp_company_code: erpEmpresa,
            customer_name: company.name,
            customer_erp_code: company.erp_code,
            user_id: order.created_by,
            user_name: userName,
            erp_user_code: erpUsuario,
            crm_order_type: crmOrderType,
            erp_flow_code: typeMapping.erp_flow_code,
            erp_flow_description: typeMapping.erp_flow_description,
            seller_name: sellerName,
            erp_vendor_code: erpVendedor,
            freight_type: crmFreightType,
            erp_freight_code: freightMapping.erp_freight_code,
            erp_freight_description: freightMapping.erp_freight_description,
            payment_method: crmPaymentMethod,
            erp_payment_code: paymentMapping.erp_payment_code,
            erp_payment_description: paymentMapping.erp_payment_description,
            payment_terms: paymentTermsStr,
            items_sale_types: itemsSaleTypes,
          },
          response_payload: responseData,
        });

        successCount++;
        results.push({ order_id: queueItem.order_id, status: 'success', erp_order_id: erpOrderId ?? undefined });

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
        console.error(`[process-order-sync] Erro no pedido ${queueItem.order_id}:`, errorMsg);

        const newAttempt = (queueItem.attempt_count || 0) + 1;
        const delayMinutes = Math.min(60, Math.pow(2, newAttempt));
        const nextRetry = newAttempt < 5
          ? new Date(Date.now() + delayMinutes * 60000).toISOString()
          : null;

        await supabase
          .from('order_sync_queue')
          .update({
            status: newAttempt >= 5 ? 'failed' : 'pending',
            attempt_count: newAttempt,
            error_message: errorMsg,
            next_retry_at: nextRetry,
            updated_at: new Date().toISOString(),
          })
          .eq('id', queueItem.id);

        await supabase
          .from('orders')
          .update({ erp_sync_status: newAttempt >= 5 ? 'error' : 'pending' })
          .eq('id', queueItem.order_id);

        await supabase.from('order_sync_log').insert({
          order_id: queueItem.order_id,
          queue_item_id: queueItem.id,
          pedido_terceiro: queueItem.pedido_terceiro,
          direction: 'crm_to_erp',
          status: 'failed',
          error_message: errorMsg,
        });

        await supabase.from('erp_sync_logs').insert({
          entity_type: 'order',
          entity_id: queueItem.order_id,
          direction: 'crm_to_erp',
          status: 'failed',
          error_message: errorMsg,
        });

        errorCount++;
        results.push({ order_id: queueItem.order_id, status: 'error', error: errorMsg });
      }
    }

    console.log(`[process-order-sync] Concluído: ${successCount} sucesso, ${errorCount} erro(s)`);

    return jsonResponse({
      success: true,
      processed: queue.length,
      success_count: successCount,
      error_count: errorCount,
      results,
    });

  } catch (error) {
    console.error('[process-order-sync] Erro geral:', error);
    return errorResponse(500, error instanceof Error ? error.message : 'Erro desconhecido');
  }
});

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function errorResponse(status: number, message: string): Response {
  return new Response(
    JSON.stringify({ success: false, error: message }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
