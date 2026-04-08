/**
 * Edge Function: process-order-sync
 * Processa a fila order_sync_queue enviando pedidos pendentes ao ERP Projedata (IMP_PEDIDO_V3).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { mapCRMOrderToProjedata, buildOrderPayload, generatePedidoTerceiro } from '../_shared/projedata/order-mapper.ts';
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

  // Buscar configuração ERP do tenant
  let apiUrl: string | undefined;
  let apiToken: string | undefined;

  // Tentar configuração via tenant_settings primeiro, fallback para env vars
  apiUrl = Deno.env.get('PROJEDATA_API_URL');
  apiToken = Deno.env.get('PROJEDATA_API_TOKEN');

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
      // Check if already in queue
      const { data: existing } = await supabase
        .from('order_sync_queue')
        .select('id, status')
        .eq('order_id', targetOrderId)
        .in('status', ['pending', 'processing'])
        .maybeSingle();

      if (!existing) {
        // Get order info to enqueue
        const { data: orderInfo, error: orderInfoError } = await supabase
          .from('orders')
          .select('id, number, tenant_id')
          .eq('id', targetOrderId)
          .single();

        if (orderInfoError || !orderInfo) {
          return errorResponse(404, `Pedido não encontrado: ${targetOrderId}`);
        }

        const pedidoTerceiro = parseInt((orderInfo.number || '').replace(/\D/g, ''), 10) || Date.now();

        // Reset failed status or insert new
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
            companies!inner(id, erp_code, cnpj, name),
            legal_entities(id, name, erp_company_code)
          `)
          .eq('id', queueItem.order_id)
          .single();

        if (orderError || !order) {
          throw new Error(`Pedido não encontrado: ${queueItem.order_id}`);
        }

        // Resolver empresa emissora via legal_entities
        const legalEntity = order.legal_entities as any;
        if (!legalEntity?.erp_company_code) {
          throw new Error('Empresa emissora não integrada ao ERP (erp_company_code não definido)');
        }
        const erpEmpresa = Number(legalEntity.erp_company_code);
        if (!erpEmpresa || isNaN(erpEmpresa)) {
          throw new Error('Empresa emissora inválida no ERP (erp_company_code não é numérico)');
        }

        // 3.1 Resolver usuário ERP via profiles
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

        // 3.2 Resolver fluxo de venda via order_type_erp_mapping
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

        console.log(`[process-order-sync] Contexto: user=${userName} (erp:${erpUsuario}), tipo=${crmOrderType} → fluxo=${typeMapping.erp_flow_code} (${typeMapping.erp_flow_description})`);

        // 4. Carregar itens com produtos
        const { data: items, error: itemsError } = await supabase
          .from('order_items')
          .select(`
            id, quantity, unit_price, discount_percent, sort_order,
            delivery_date, description,
            products!inner(id, erp_product_code, erp_versao, name)
          `)
          .eq('order_id', queueItem.order_id)
          .order('sort_order', { ascending: true });

        if (itemsError) {
          throw new Error(`Erro ao carregar itens: ${itemsError.message}`);
        }

        const company = order.companies as any;

        // 5. Validar
        const validation = validateOrderForSync({
          company_erp_code: company?.erp_code,
          company_cnpj: company?.cnpj,
          erp_empresa: erpEmpresa,
          pedido_terceiro: queueItem.pedido_terceiro,
          erp_usuario: erpUsuario,
          erp_fluxo_venda: typeMapping.erp_flow_code,
          items: (items || []).map((i: any) => ({
            product_erp_code: i.products?.erp_product_code,
            product_erp_versao: i.products?.erp_versao,
            quantity: i.quantity,
            unit_price: i.unit_price,
          })),
        });

        if (!validation.valid) {
          const details = validation.errors.map(e => `${e.field}: ${e.message}`).join('; ');
          throw new Error(`Validação falhou: ${details}`);
        }

        // 6. Buscar código vendedor ERP
        let erpVendedor = 0;
        if (order.erp_rep_code) {
          erpVendedor = Number(order.erp_rep_code) || 0;
        }

        // 7. Montar payload
        const crmOrder: CRMOrderForSync = {
          pedido_terceiro: queueItem.pedido_terceiro,
          order_date: order.order_date || new Date().toISOString(),
          observations: order.observations,
          total_discount: Number(order.total_discount) || 0,
          freight_type: order.freight_type || '1',
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
            delivery_date: item.delivery_date || order.delivery_date,
            observations: item.description || '',
          })),
        };

        const projedataOrder = mapCRMOrderToProjedata(crmOrder);
        const payload = buildOrderPayload(projedataOrder);

        console.log(`[process-order-sync] Enviando pedido ${order.number} (terceiro: ${queueItem.pedido_terceiro}, empresa: ${legalEntity.name} [${erpEmpresa}], usuario: ${userName} [${erpUsuario}], fluxo: ${typeMapping.erp_flow_code} ${typeMapping.erp_flow_description})`);

        // 8. Enviar ao ERP
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

        // 9. Parse retorno
        let responseData: any;
        try {
          responseData = JSON.parse(responseText);
        } catch {
          responseData = { raw: responseText };
        }

        const retornoObj = Array.isArray(responseData) ? responseData[0] : responseData;
        const retorno = retornoObj?.['#out#p_retorno'] || retornoObj?.p_retorno || '';

        // Verificar erro do ERP
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

        // 10. Sucesso - atualizar tudo
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

        // Log em erp_sync_logs (observabilidade centralizada)
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

        // Log de erro
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
