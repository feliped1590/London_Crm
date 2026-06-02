/**
 * Edge Function: process-attribute-sync
 *
 * Processa attribute_sync_queue enviando 1 atributo por requisição ao ERP
 * Projedata via comando IMP_ATRIBFICHA_V1.
 *
 * Regras:
 * - 1 request = 1 atributo
 * - Bloqueia (status=blocked_no_erp_code) se produto ainda não tem erp_product_code
 * - Retry exponencial (max 5 tentativas)
 * - Loga todo request/response em attribute_sync_log
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildAndSerialize } from '../_shared/projedata/serializer.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GRUPO_COMANDO = 'IMP_ATRIBFICHA_V1';
const BATCH_SIZE = 25;

interface QueueItem {
  id: string;
  tenant_id: string;
  product_id: string;
  attribute_catalog_id: string;
  attempt_count: number;
  correlation_id: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const apiUrl = Deno.env.get('PROJEDATA_API_URL');
  const apiToken = Deno.env.get('PROJEDATA_API_TOKEN');

  if (!apiUrl || !apiToken) {
    return json(500, { success: false, error: 'PROJEDATA_API_URL e PROJEDATA_API_TOKEN não configurados' });
  }

  let productFilter: string | null = null;
  try {
    const body = await req.json().catch(() => ({}));
    if (typeof body?.product_id === 'string') productFilter = body.product_id;
  } catch (_) { /* noop */ }

  // Buscar fila
  let q = supabase
    .from('attribute_sync_queue')
    .select('id, tenant_id, product_id, attribute_catalog_id, attempt_count, correlation_id')
    .eq('status', 'pending')
    .lt('attempt_count', 5)
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (productFilter) q = q.eq('product_id', productFilter);

  const { data: queue, error: queueError } = await q;
  if (queueError) return json(500, { success: false, error: queueError.message });
  if (!queue || queue.length === 0) {
    return json(200, { success: true, processed: 0, message: 'Fila vazia' });
  }

  const results: any[] = [];
  let successCount = 0;
  let errorCount = 0;
  let blockedCount = 0;

  for (const item of queue as QueueItem[]) {
    const startedAt = Date.now();

    // Marca em processamento
    await supabase
      .from('attribute_sync_queue')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', item.id);

    try {
      // Carrega produto + atributo + valor
      const { data: product, error: prodErr } = await supabase
        .from('products')
        .select('id, erp_product_code, erp_versao_codigo, versao_numero, erp_empresa')
        .eq('id', item.product_id)
        .single();



      if (prodErr || !product) throw new Error(`Produto não encontrado: ${prodErr?.message ?? ''}`);

      // BLOQUEIO: produto ainda sem código ERP
      if (!product.erp_product_code || String(product.erp_product_code).trim() === '') {
        await supabase
          .from('attribute_sync_queue')
          .update({
            status: 'blocked_no_erp_code',
            error_message: 'Produto ERP ainda não sincronizado',
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.id);
        blockedCount++;
        results.push({ id: item.id, status: 'blocked_no_erp_code' });
        continue;
      }

      const { data: attr, error: attrErr } = await supabase
        .from('erp_attribute_catalog')
        .select('id, erp_codigo, descricao, tolerancia_mais, tolerancia_menos, aceita_tolerancia, ativo')
        .eq('id', item.attribute_catalog_id)
        .single();

      if (attrErr || !attr) throw new Error(`Atributo não encontrado: ${attrErr?.message ?? ''}`);
      if (!attr.ativo) throw new Error('Atributo está inativo no catálogo');

      // Verifica se este atributo tem mapeamento derivado (ex.: tipo_solda) para
      // saber se valor vazio significa "produto fora de escopo" (não retentar).
      const { data: mappingRow } = await supabase
        .from('product_attribute_mapping')
        .select('crm_source, crm_path')
        .eq('attribute_catalog_id', item.attribute_catalog_id)
        .eq('tenant_id', item.tenant_id)
        .eq('ativo', true)
        .maybeSingle();

      const { data: value, error: valErr } = await supabase
        .from('product_attribute_values')
        .select('id, valor_padrao')
        .eq('product_id', item.product_id)
        .eq('attribute_catalog_id', item.attribute_catalog_id)
        .maybeSingle();

      if (valErr) throw new Error(`Falha ao ler valor: ${valErr.message}`);
      if (!value || value.valor_padrao === null || value.valor_padrao === '') {
        if (mappingRow?.crm_source === 'derived') {
          await supabase
            .from('attribute_sync_queue')
            .update({
              status: 'skipped_out_of_scope',
              error_message: 'Produto fora do escopo para este atributo derivado (ex.: grupo não é Saco/Stand Up ou subgrupo vazio)',
              updated_at: new Date().toISOString(),
            })
            .eq('id', item.id);
          blockedCount++;
          results.push({ id: item.id, status: 'skipped_out_of_scope' });
          continue;
        }
        throw new Error('Valor do atributo está vazio no CRM');
      }

      // ERP exige o NÚMERO da versão ativa (ex.: "1", "2"), não o descritivo dimensional
      const versao = product.erp_versao_codigo
        ?? (product.versao_numero != null ? String(product.versao_numero) : null);
      if (!versao) throw new Error('Produto sem versão ERP ativa (erp_versao_codigo/versao_numero vazio)');

      // Monta payload interno
      const inner: Record<string, unknown> = {
        empresa: product.erp_empresa ?? 1,
        produto: String(product.erp_product_code),
        versao,
        atributo: attr.erp_codigo,
        valor_padrao: String(value.valor_padrao),
      };


      if (attr.aceita_tolerancia) {
        if (attr.tolerancia_mais !== null && attr.tolerancia_mais !== undefined) {
          inner.tolerancia_mais = String(attr.tolerancia_mais);
        }
        if (attr.tolerancia_menos !== null && attr.tolerancia_menos !== undefined) {
          inner.tolerancia_menos = String(attr.tolerancia_menos);
        }
      }

      const body = buildAndSerialize(GRUPO_COMANDO, inner);

      // POST ao ERP
      const resp = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiToken}`,
        },
        body,
      });

      const responseText = await resp.text();
      let responseData: any;
      try { responseData = JSON.parse(responseText); } catch { responseData = { raw: responseText }; }

      const pRetorno: string = responseData?.p_retorno
        ?? responseData?.['#out#p_retorno']
        ?? (typeof responseData === 'string' ? responseData : JSON.stringify(responseData));

      const isError = typeof pRetorno === 'string' && pRetorno.includes('#ERRO#');
      const duration = Date.now() - startedAt;

      // Log append-only
      await supabase.from('attribute_sync_log').insert({
        tenant_id: item.tenant_id,
        queue_item_id: item.id,
        product_id: item.product_id,
        attribute_catalog_id: item.attribute_catalog_id,
        erp_codigo: attr.erp_codigo,
        request_body: JSON.parse(body),
        response_body: responseText.slice(0, 8000),
        response_status: resp.status,
        success: !isError,
        error_message: isError ? extractErpError(pRetorno) : null,
        duration_ms: duration,
      });

      if (isError) {
        throw new Error(extractErpError(pRetorno) || 'Erro do ERP');
      }

      // Sucesso → atualiza fila e valor
      await supabase
        .from('attribute_sync_queue')
        .update({
          status: 'sent',
          processed_at: new Date().toISOString(),
          attempt_count: item.attempt_count + 1,
          error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id);

      await supabase
        .from('product_attribute_values')
        .update({
          dirty: false,
          last_synced_value: String(value.valor_padrao),
          last_synced_at: new Date().toISOString(),
          last_sync_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', value.id);

      successCount++;
      results.push({ id: item.id, status: 'sent', erp_codigo: attr.erp_codigo });

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      const newAttempt = item.attempt_count + 1;
      const exhausted = newAttempt >= 5;
      const nextRetry = exhausted ? null : new Date(Date.now() + Math.pow(2, newAttempt) * 60_000).toISOString();

      await supabase
        .from('attribute_sync_queue')
        .update({
          status: exhausted ? 'error' : 'pending',
          attempt_count: newAttempt,
          error_message: msg,
          next_retry_at: nextRetry,
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id);

      await supabase
        .from('product_attribute_values')
        .update({ last_sync_error: msg, updated_at: new Date().toISOString() })
        .eq('product_id', item.product_id)
        .eq('attribute_catalog_id', item.attribute_catalog_id);

      errorCount++;
      results.push({ id: item.id, status: exhausted ? 'error' : 'retry', error: msg });
    }
  }

  return json(200, {
    success: true,
    processed: queue.length,
    successCount,
    errorCount,
    blockedCount,
    results,
  });
});

function extractErpError(text: string): string {
  if (!text) return '';
  const match = text.match(/#ERRO#([\s\S]+)$/i);
  return (match ? match[1] : text).trim().slice(0, 500);
}

function json(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
