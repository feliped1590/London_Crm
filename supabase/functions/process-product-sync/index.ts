/**
 * Edge Function: process-product-sync
 * Processa a fila product_sync_queue enviando produtos pendentes ao ERP Projedata.
 *
 * Mapper V2: payload simplificado, versão/depósito/conta_contabil fixos,
 * familia/classe como string, codigo controlado por erp_product_code.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  loadProductForSync,
  validateProductForSync,
  buildProductPayloadV2,
  isProductUpdate,
  getProductGrupoComando,
} from '../_shared/projedata/index.ts';
import { parseProductRetorno, toLogPayload } from '../_shared/erp/projedata-parser.ts';
import { trackParserResult } from '../_shared/erp/parser-telemetry.ts';
import { checkAccessWindowForTenant, AccessWindowError, AccessCheckUnavailableError } from '../_shared/accessControl.ts';

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
    return new Response(
      JSON.stringify({ success: false, error: 'PROJEDATA_API_URL e PROJEDATA_API_TOKEN não configurados' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Buscar itens pendentes da fila (máx 20 por execução)
    const { data: queue, error: queueError } = await supabase
      .from('product_sync_queue')
      .select('id, product_id, attempt_count')
      .eq('status', 'pending')
      .lt('attempt_count', 5)
      .order('created_at', { ascending: true })
      .limit(20);

    if (queueError) {
      console.error('[process-product-sync] Erro ao ler fila:', queueError);
      return errorResponse(500, queueError.message);
    }

    if (!queue || queue.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: 'Nenhum item pendente na fila' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[process-product-sync] Processando ${queue.length} item(ns)`);

    let successCount = 0;
    let errorCount = 0;
    const results: Array<{ product_id: string; status: string; error?: string }> = [];

    for (const item of queue) {
      try {
        // Marcar como processing (lock atômico — só pega se ainda estiver pending)
        const { data: locked } = await supabase
          .from('product_sync_queue')
          .update({ status: 'processing', updated_at: new Date().toISOString() })
          .eq('id', item.id)
          .eq('status', 'pending')
          .select('id')
          .maybeSingle();

        if (!locked) {
          console.log(`[process-product-sync] Item ${item.id} já em processamento, pulando`);
          continue;
        }

        // Carregar produto + labels + erp_usuario (também devolve tenantId para a checagem de janela)
        const { product: productForSync, ctx, tenantId } = await loadProductForSync(
          supabase,
          item.product_id,
          null, // usa created_by como fallback
        );

        // ⏰ Janela de acesso por tenant (strict) — depois do load, com tenantId resolvido
        try {
          await checkAccessWindowForTenant(supabase, tenantId, {
            mode: 'strict',
            context: 'process-product-sync',
          });
        } catch (winErr) {
          if (winErr instanceof AccessWindowError || winErr instanceof AccessCheckUnavailableError) {
            console.warn(`[process-product-sync] Item ${item.id} adiado: ${winErr.message}`);
            await supabase
              .from('product_sync_queue')
              .update({
                status: 'pending',
                next_retry_at: new Date(Date.now() + 10 * 60_000).toISOString(),
                error_message: winErr.message,
                updated_at: new Date().toISOString(),
              })
              .eq('id', item.id);
            errorCount++;
            results.push({ product_id: item.product_id, status: 'deferred', error: winErr.message });
            continue;
          }
          throw winErr;
        }

        // Validar campos obrigatórios antes do envio
        const validation = validateProductForSync(productForSync, ctx);
        if (!validation.valid) {
          const errorMsg = 'Validação falhou: ' + validation.errors.map(e => `${e.field}: ${e.message}`).join('; ');
          await supabase
            .from('product_sync_queue')
            .update({
              status: 'failed',
              attempt_count: (item.attempt_count || 0) + 1,
              error_message: errorMsg,
              next_retry_at: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', item.id);

          await supabase.from('product_sync_log').insert({
            product_id: item.product_id,
            queue_item_id: item.id,
            direction: 'crm_to_erp',
            status: 'failed',
            error_message: errorMsg,
            ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'edge-function',
          });

          errorCount++;
          results.push({ product_id: item.product_id, status: 'error', error: errorMsg });
          continue;
        }

        const isUpdate = isProductUpdate(productForSync);
        const grupoComando = getProductGrupoComando();
        const payload = buildProductPayloadV2(productForSync, ctx, grupoComando);

        console.log(`[process-product-sync] ${isUpdate ? 'UPDATE' : 'CREATE'} produto ${productForSync.id} (codigo="${productForSync.erp_product_code ?? ''}")`);
        console.log(`[process-product-sync] grupoComando=${grupoComando}`);
        console.log(`[process-product-sync] Payload: ${payload}`);

        // Enviar ao ERP Projedata
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiToken}`,
          },
          body: payload,
        });

        const responseText = await response.text();
        console.log(`[process-product-sync] Resposta ERP (${response.status}): ${responseText}`);

        if (!response.ok) {
          throw new Error(`ERP retornou ${response.status}: ${responseText}`);
        }

        let responseData: any;
        try {
          responseData = JSON.parse(responseText);
        } catch {
          responseData = { raw: responseText };
        }

        const parsedResult = parseProductRetorno(responseData, {
          sku: productForSync.erp_product_code ?? null,
          requestedAt: new Date().toISOString(),
        });

        await trackParserResult(supabase, parsedResult, {
          source: 'process-product-sync',
          entityId: item.product_id,
          tenantId: tenantId,
        });

        if (parsedResult.errorType === 'erp') {
          throw new Error(`ERP retornou erro: ${parsedResult.errorMessage || parsedResult.raw}`);
        }

        // Em CREATE, exigir erpCode; sem ele, considerar falha de parse
        if (!isUpdate && !parsedResult.erpCode) {
          throw new Error(
            `ERP não retornou código do produto. Resposta: ${parsedResult.errorMessage || parsedResult.raw || 'vazia'}`,
          );
        }


        // Sucesso - atualizar fila
        await supabase
          .from('product_sync_queue')
          .update({
            status: 'completed',
            processed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.id);

        // Atualizar produto: grava erp_product_code retornado (no CREATE)
        // e marca origem_alteracao = 'SYNC' para evitar loop
        const productUpdate: Record<string, unknown> = {
          pendente_envio: false,
          erp_synced_at: new Date().toISOString(),
          origem_alteracao: 'SYNC',
          erp_status: 'synced',
        };

        // Se ERP retornou um código (CREATE), persiste; em UPDATE mantém o existente
        if (!isUpdate && parsedResult.erpCode) {
          productUpdate.erp_product_code = parsedResult.erpCode;
        }

        await supabase
          .from('products')
          .update(productUpdate)
          .eq('id', item.product_id);

        // Log detalhado
        const parsedPayload = JSON.parse(payload);
        await supabase.from('product_sync_log').insert({
          product_id: item.product_id,
          queue_item_id: item.id,
          direction: 'crm_to_erp',
          status: 'success',
          request_payload: parsedPayload,
          response_payload: toLogPayload(parsedResult),
          ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'edge-function',
        });

        await supabase.from('erp_sync_logs').insert({
          entity_type: 'product',
          entity_id: item.product_id,
          direction: 'crm_to_erp',
          status: 'success',
          request_payload: parsedPayload,
          response_payload: toLogPayload(parsedResult),
        });

        successCount++;
        results.push({ product_id: item.product_id, status: 'success' });

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
        console.error(`[process-product-sync] Erro no produto ${item.product_id}:`, errorMsg);

        const newAttempt = (item.attempt_count || 0) + 1;
        const nextRetry = newAttempt < 5
          ? new Date(Date.now() + Math.pow(2, newAttempt) * 60000).toISOString()
          : null;

        await supabase
          .from('product_sync_queue')
          .update({
            status: newAttempt >= 5 ? 'failed' : 'pending',
            attempt_count: newAttempt,
            error_message: errorMsg,
            next_retry_at: nextRetry,
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.id);

        // Registrar log detalhado de erro
        await supabase.from('product_sync_log').insert({
          product_id: item.product_id,
          queue_item_id: item.id,
          direction: 'crm_to_erp',
          status: 'failed',
          error_message: errorMsg,
          ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'edge-function',
        });

        // Manter log legado
        await supabase.from('erp_sync_logs').insert({
          entity_type: 'product',
          entity_id: item.product_id,
          direction: 'crm_to_erp',
          status: 'failed',
          error_message: errorMsg,
        });

        errorCount++;
        results.push({ product_id: item.product_id, status: 'error', error: errorMsg });
      }
    }

    console.log(`[process-product-sync] Concluído: ${successCount} sucesso, ${errorCount} erro(s)`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: queue.length,
        success_count: successCount,
        error_count: errorCount,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[process-product-sync] Erro geral:', error);
    return errorResponse(500, error instanceof Error ? error.message : 'Erro desconhecido');
  }
});

function errorResponse(status: number, message: string): Response {
  return new Response(
    JSON.stringify({ success: false, error: message }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
