/**
 * Edge Function: process-product-sync
 * Processa a fila product_sync_queue enviando produtos pendentes ao ERP Projedata.
 * Pode ser invocado via cron (automático) ou manualmente.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { mapCRMProductToProjedata, buildProductPayload } from '../_shared/projedata/mapper.ts';
import { parseProductRetorno, toLogPayload } from '../_shared/erp/projedata-parser.ts';

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
        // Marcar como processing
        await supabase
          .from('product_sync_queue')
          .update({ status: 'processing', updated_at: new Date().toISOString() })
          .eq('id', item.id);

        // Buscar produto
        const { data: product, error: productError } = await supabase
          .from('products')
          .select('*')
          .eq('id', item.product_id)
          .single();

        if (productError || !product) {
          throw new Error(`Produto não encontrado: ${item.product_id}`);
        }

        // Gerar código ERP se não existir
        if (!product.erp_product_code) {
          const { data: nextCode, error: seqError } = await supabase
            .rpc('next_erp_sequence', { p_sequence_name: 'product_code' });

          if (seqError || nextCode === null || nextCode === undefined) {
            throw new Error(`Falha ao gerar código ERP: ${seqError?.message || 'valor nulo'}`);
          }

          const newCode = String(nextCode);

          // Salvar no produto (com origem SYNC para não disparar re-envio)
          await supabase
            .from('products')
            .update({ erp_product_code: newCode, origem_alteracao: 'SYNC' })
            .eq('id', item.product_id);

          // Log de auditoria
          await supabase.from('erp_sequence_logs').insert({
            sequence_name: 'product_code',
            generated_value: nextCode,
            product_id: item.product_id,
            generated_by: 'process-product-sync',
          });

          product.erp_product_code = newCode;
          console.log(`[process-product-sync] Código ERP gerado: ${newCode} para produto ${item.product_id}`);
        }

        // Mapear para formato Projedata
        const crmProduct = {
          sku: product.sku,
          name: product.name,
          description: product.description,
          category: product.category,
          unit: product.unit_measure,
          ncm: product.ncm_code,
          weight: product.weight,
          color: product.color,
          material: product.material,
          erp_product_code: product.erp_product_code,
          tipo_item: product.tipo_item,
          tipo_ficha: product.tipo_ficha,
          erp_grupo: product.erp_grupo,
          erp_subgrupo: product.erp_subgrupo,
          erp_empresa: product.erp_empresa,
          erp_versao: product.erp_versao,
          erp_versao_detalhes: product.erp_versao_detalhes,
          erp_versao_roteiro: product.erp_versao_roteiro,
          erp_versao_situacao: product.erp_versao_situacao,
          nome_impresso: product.nome_impresso,
        };

        const produto = mapCRMProductToProjedata(crmProduct);
        const payload = buildProductPayload(produto);

        console.log(`[process-product-sync] Enviando produto ${product.sku} ao ERP`);
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

        // Parse response — ERP pode retornar array ou objeto
        let responseData: any;
        try {
          responseData = JSON.parse(responseText);
        } catch {
          responseData = { raw: responseText };
        }

        // Parser unificado
        const parsedResult = parseProductRetorno(responseData, {
          sku: product.sku,
          requestedAt: new Date().toISOString(),
        });

        if (parsedResult.errorType === 'erp') {
          throw new Error(`ERP retornou erro: ${parsedResult.errorMessage || parsedResult.raw}`);
        }

        // Sucesso - atualizar fila e produto
        await supabase
          .from('product_sync_queue')
          .update({
            status: 'completed',
            processed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.id);

        await supabase
          .from('products')
          .update({
            pendente_envio: false,
            erp_synced_at: new Date().toISOString(),
            origem_alteracao: 'SYNC',
          })
          .eq('id', item.product_id);

        // Registrar log detalhado de sync
        const parsedPayload = JSON.parse(payload);
        await supabase.from('product_sync_log').insert({
          product_id: item.product_id,
          queue_item_id: item.id,
          direction: 'crm_to_erp',
          status: 'success',
          request_payload: parsedPayload,
          response_payload: toLogPayload(parsedResult),
          erp_hash_at_sync: product.erp_hash,
          ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'edge-function',
        });

        // Manter log legado em erp_sync_logs com payload estruturado
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
