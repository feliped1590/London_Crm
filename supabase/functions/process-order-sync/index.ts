/**
 * Edge Function: process-order-sync
 * Processa a fila order_sync_queue enviando pedidos pendentes ao ERP Projedata (IMP_PEDIDO_V3).
 * Todos os campos são resolvidos dinamicamente — NENHUM hardcode.
 *
 * Defesa em profundidade: se a pré-validação falhar, o item da fila é marcado
 * como 'blocked_validation' (sem consumir retries) em vez de gerar erro infinito.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { mapCRMOrderToProjedata, buildOrderPayload, parsePaymentTerms } from '../_shared/projedata/order-mapper.ts';
import { validateOrderForSync } from '../_shared/projedata/order-validator.ts';
import { loadOrderForValidation } from '../_shared/projedata/order-loader.ts';
import type { CRMOrderForSync, CRMOrderItemForSync } from '../_shared/projedata/order-mapper.ts';
import { parseOrderRetorno, toLogPayload } from '../_shared/erp/projedata-parser.ts';
import { trackParserResult } from '../_shared/erp/parser-telemetry.ts';
import { resolveOrderErpConfig, isOrderErpConfigError } from '../_shared/erp/order-endpoint-resolver.ts';
import { checkAccessWindowForTenant, AccessWindowError, AccessCheckUnavailableError } from '../_shared/accessControl.ts';
import { permissionErrorResponse, requireModulePermission } from '../_shared/permissionEngine.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PERMANENT_ORDER_SYNC_MESSAGE = 'A Projedata não permite sincronizar novamente este pedido porque ele já avançou no fluxo do ERP.';

function isPermanentOrderSyncError(message: string): boolean {
  const normalized = message
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  return normalized.includes('nao e permitido alterar/remover pedido')
    && normalized.includes('saiu do fluxo inicial');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Endpoint e token são resolvidos POR PEDIDO via resolveOrderErpConfig (escopo:
  // apenas pedidos). Outras integrações continuam usando env vars globais.

  try {
    // Parse request body for optional order_id (manual sync)
    let targetOrderId: string | null = null;
    try {
      const body = await req.json();
      targetOrderId = body?.order_id || null;
    } catch { /* no body = batch mode */ }

    if (targetOrderId) {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return errorResponse(401, 'Unauthorized');
      }

      const supabaseAuth = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
      if (authError || !user) return errorResponse(401, 'Unauthorized');

      await requireModulePermission(supabase, user.id, 'orders', 'edit');
    }

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

        // Check for any existing entry (failed, completed, etc.) to reset
        const { data: existingEntry } = await supabase
          .from('order_sync_queue')
          .select('id, status, error_message')
          .eq('order_id', targetOrderId)
          .maybeSingle();

        if (existingEntry) {
          if (existingEntry.status === 'permanent_failure' && isPermanentOrderSyncError(existingEntry.error_message || '')) {
            return jsonResponse({
              success: true,
              processed: 0,
              status: 'permanent_failure',
              message: PERMANENT_ORDER_SYNC_MESSAGE,
            });
          }

          await supabase
            .from('order_sync_queue')
            .update({
              status: 'pending',
              attempt_count: 0,
              error_message: null,
              next_retry_at: null,
              processed_at: null,
              validation_errors: null,
              validation_fields: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingEntry.id);
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
        // ⏰ Janela de acesso por tenant (strict — evita escrita no ERP fora do horário)
        try {
          await checkAccessWindowForTenant(supabase, queueItem.tenant_id, {
            mode: 'strict',
            context: 'process-order-sync',
          });
        } catch (winErr) {
          if (winErr instanceof AccessWindowError || winErr instanceof AccessCheckUnavailableError) {
            console.warn(`[process-order-sync] Item ${queueItem.id} adiado: ${winErr.message}`);
            // Devolve para fila com retry curto (10 min) — não consome attempt
            await supabase
              .from('order_sync_queue')
              .update({
                status: 'pending',
                next_retry_at: new Date(Date.now() + 10 * 60_000).toISOString(),
                error_message: winErr.message,
                updated_at: new Date().toISOString(),
              })
              .eq('id', queueItem.id);
            errorCount++;
            results.push({ order_id: queueItem.order_id, status: 'deferred', error: winErr.message });
            continue;
          }
          throw winErr;
        }

        // 2. Marcar como processing (lock atômico — só pega se ainda estiver pending)
        const { data: locked } = await supabase
          .from('order_sync_queue')
          .update({ status: 'processing', updated_at: new Date().toISOString() })
          .eq('id', queueItem.id)
          .eq('status', 'pending')
          .select('id')
          .maybeSingle();

        if (!locked) {
          console.log(`[process-order-sync] Item ${queueItem.id} já em processamento, pulando`);
          continue;
        }

        await supabase
          .from('orders')
          .update({ erp_sync_status: 'processing' })
          .eq('id', queueItem.order_id);

        // 3. Carregar contexto via loader compartilhado
        const ctx = await loadOrderForValidation(supabase, queueItem.order_id, queueItem.pedido_terceiro);
        const { order, company, legalEntity, items, userName, erpUsuario, sellerName, erpVendedor,
                crmOrderType, typeMapping, crmFreightType, freightMapping, crmPaymentMethod,
                paymentMapping, paymentTermsStr, paymentConditions, saleTypeMap,
                orderSaleType, orderTipoVendaCode,
                carrierErpCode, redespachoErpCode, followup, toValidate } = ctx;
        // 4. Pré-validar (defesa em profundidade)
        const validation = validateOrderForSync(toValidate);

        if (!validation.valid) {
          console.warn(`[process-order-sync] Pedido ${queueItem.order_id} bloqueado por validação:`,
            validation.errors.map(e => e.field).join(', '));

          await supabase
            .from('order_sync_queue')
            .update({
              status: 'blocked_validation',
              attempt_count: 0,
              error_message: 'Dados incompletos. Corrija as pendências e reenvie.',
              next_retry_at: null,
              validation_errors: validation.errors,
              validation_fields: validation.fields,
              updated_at: new Date().toISOString(),
            })
            .eq('id', queueItem.id);

          await supabase
            .from('orders')
            .update({ erp_sync_status: 'blocked_validation' })
            .eq('id', queueItem.order_id);

          await supabase.from('order_sync_log').insert({
            order_id: queueItem.order_id,
            queue_item_id: queueItem.id,
            pedido_terceiro: queueItem.pedido_terceiro,
            direction: 'crm_to_erp',
            status: 'blocked_validation',
            error_message: validation.errors.map(e => `${e.field}: ${e.message}`).join('; '),
          });

          errorCount++;
          results.push({ order_id: queueItem.order_id, status: 'blocked_validation' });
          continue;
        }

        console.log(`[process-order-sync] Contexto: user=${userName} (erp:${erpUsuario}), tipo=${crmOrderType}→${typeMapping!.erp_flow_code}, vendedor=${sellerName} (erp:${erpVendedor}), frete=${crmFreightType}→${freightMapping!.erp_freight_code}, pagto=${crmPaymentMethod}→${paymentMapping?.erp_payment_code ?? '?'}, parcelas=${paymentTermsStr}, sale_type=${orderSaleType}→${orderTipoVendaCode}, transp=${carrierErpCode}, redesp=${redespachoErpCode}, followup=${followup ? 'sim' : 'não'}`);

        // 5. Montar payload
        const crmOrder: CRMOrderForSync = {
          pedido_terceiro: queueItem.pedido_terceiro,
          order_date: order.order_date || new Date().toISOString(),
          observations: order.observations,
          total_discount: Number(order.total_discount) || 0,
          freight_type: freightMapping!.erp_freight_code,
          delivery_date: order.delivery_date,
          company_cnpj: company.cnpj,
          erp_empresa: Number(legalEntity.erp_company_code),
          erp_fluxo_venda: typeMapping!.erp_flow_code,
          erp_usuario: erpUsuario,
          erp_vendedor: erpVendedor,
          erp_transportador: carrierErpCode,
          erp_redespacho: redespachoErpCode,
          items: items.map((item: any, idx: number): CRMOrderItemForSync => {
            // tipo_venda vem do HEADER (sovereign) — todos os itens recebem o mesmo
            const tipoVenda = orderTipoVendaCode ?? saleTypeMap.get(item.sale_type || 'venda_tributada')!;
            return {
              seq: idx + 1,
              erp_product_code: item.products.erp_product_code,
              erp_versao: item.products.erp_versao_codigo || '1',
              quantity: Number(item.quantity) || 0,
              unit_price: Number(item.unit_price) || 0,
              discount_percent: Number(item.discount_percent) || 0,
              commission_pct: Number(item.commission_pct) || 0,
              tipo_venda: tipoVenda,
              delivery_date: item.delivery_date || order.delivery_date,
              observations: item.observations || '',
              observations_pcp: item.observations_pcp || '',
              ordem_compra: item.ordem_compra || '0',
            };
          }),
          payment_conditions: paymentConditions,
          followup,
        };


        const projedataOrder = mapCRMOrderToProjedata(crmOrder);
        const payload = buildOrderPayload(projedataOrder);

        console.log(`[process-order-sync] Enviando pedido ${order.number} (terceiro: ${queueItem.pedido_terceiro})`);

        // 6. Enviar ao ERP
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

        // 8. Parse retorno via parser unificado
        let responseData: any;
        try {
          responseData = JSON.parse(responseText);
        } catch {
          responseData = { raw: responseText };
        }

        const parsedResult = parseOrderRetorno(responseData, {
          pedidoTerceiro: queueItem.pedido_terceiro,
          orderNumber: order.number,
          requestedAt: new Date().toISOString(),
        });

        // Telemetria: padrão desconhecido = ERP pode ter mudado formato
        await trackParserResult(supabase, parsedResult, {
          source: 'process-order-sync',
          entityId: queueItem.order_id,
          tenantId: order.tenant_id ?? null,
          userId: order.created_by ?? null,
        });

        if (parsedResult.errorType === 'erp') {
          throw new Error(`ERP retornou erro: ${parsedResult.errorMessage || parsedResult.raw}`);
        }

        // Extrair erpOrderId numérico do código validado pelo parser
        let erpOrderId: number | null = null;
        if (parsedResult.erpCode) {
          const n = Number(parsedResult.erpCode);
          if (Number.isFinite(n)) erpOrderId = n;
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

        console.log(`[process-order-sync] Atualizando orders ${queueItem.order_id} com:`, JSON.stringify(orderUpdate));
        const { error: orderUpdateError } = await supabase
          .from('orders')
          .update(orderUpdate as any)
          .eq('id', queueItem.order_id);
        if (orderUpdateError) {
          console.error(`[process-order-sync] ERRO ao atualizar orders: ${orderUpdateError.message}`, orderUpdateError);
        } else {
          console.log(`[process-order-sync] orders atualizado com sucesso`);
        }

        // Log detalhado
        const parsedPayload = JSON.parse(payload);
        await supabase.from('order_sync_log').insert({
          order_id: queueItem.order_id,
          queue_item_id: queueItem.id,
          pedido_terceiro: queueItem.pedido_terceiro,
          direction: 'crm_to_erp',
          status: 'success',
          request_payload: parsedPayload,
          response_payload: toLogPayload(parsedResult),
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
            erp_company_code: legalEntity.erp_company_code,
            customer_name: company.name,
            customer_erp_code: company.erp_code,
            user_id: order.created_by,
            user_name: userName,
            erp_user_code: erpUsuario,
            crm_order_type: crmOrderType,
            erp_flow_code: typeMapping!.erp_flow_code,
            erp_flow_description: typeMapping!.erp_flow_description,
            seller_name: sellerName,
            erp_vendor_code: erpVendedor,
            freight_type: crmFreightType,
            erp_freight_code: freightMapping!.erp_freight_code,
            erp_freight_description: freightMapping!.erp_freight_description,
            payment_method: crmPaymentMethod,
            erp_payment_code: paymentMapping!.erp_payment_code,
            erp_payment_description: paymentMapping!.erp_payment_description,
            payment_terms: paymentTermsStr,
            items_sale_types: itemsSaleTypes,
          },
          response_payload: toLogPayload(parsedResult),
        });

        successCount++;
        results.push({ order_id: queueItem.order_id, status: 'success', erp_order_id: erpOrderId ?? undefined });

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
        console.error(`[process-order-sync] Erro no pedido ${queueItem.order_id}:`, errorMsg);

        if (isPermanentOrderSyncError(errorMsg)) {
          await supabase
            .from('order_sync_queue')
            .update({
              status: 'permanent_failure',
              attempt_count: 0,
              error_message: errorMsg,
              next_retry_at: null,
              processed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', queueItem.id);

          await supabase
            .from('orders')
            .update({ erp_sync_status: 'error' })
            .eq('id', queueItem.order_id);

          await supabase.from('order_sync_log').insert({
            order_id: queueItem.order_id,
            queue_item_id: queueItem.id,
            pedido_terceiro: queueItem.pedido_terceiro,
            direction: 'crm_to_erp',
            status: 'permanent_failure',
            error_message: errorMsg,
          });

          await supabase.from('erp_sync_logs').insert({
            entity_type: 'order',
            entity_id: queueItem.order_id,
            direction: 'crm_to_erp',
            status: 'failed',
            error_message: errorMsg,
            response_payload: {
              error_kind: 'permanent_failure',
              reason: 'order_already_advanced_in_erp',
            },
          });

          errorCount++;
          results.push({ order_id: queueItem.order_id, status: 'permanent_failure', error: PERMANENT_ORDER_SYNC_MESSAGE });
          continue;
        }

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
    const permissionResponse = permissionErrorResponse(error, corsHeaders);
    if (permissionResponse) return permissionResponse;

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
