/**
 * Edge Function: process-product-sync
 * Processa a fila product_sync_queue enviando produtos pendentes ao ERP Projedata.
 *
 * Mapper V2: payload simplificado, versão/depósito/conta_contabil fixos,
 * familia/classe como string, codigo controlado por erp_product_code.
 *
 * Hardening Fase 21B:
 * - Dry-run seguro: sem escrita em banco, sem chamada ERP, sem disparar process-attribute-sync.
 * - Execução real bloqueada por gate explícito (PRODUCT_SYNC_EXECUTION_ENABLED=true).
 * - Gate opcional por projeto (PRODUCT_SYNC_ALLOWED_PROJECT_REF).
 * - Filtro de fila respeita next_retry_at <= now().
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

type QueueItem = {
  id: string;
  product_id: string;
  attempt_count: number | null;
  max_attempts: number | null;
  payload: Record<string, unknown> | null;
};

const ERP_SYNC_PAUSED = Deno.env.get('ERP_SYNC_PAUSED') === 'true';

function isTruthy(input: unknown): boolean {
  if (typeof input === 'boolean') return input;
  if (typeof input === 'string') return ['1', 'true', 'yes', 'on'].includes(input.toLowerCase());
  return false;
}

function resolveDryRun(req: Request, body: Record<string, unknown>): boolean {
  const url = new URL(req.url);
  const queryDryRun = url.searchParams.get('dryRun') ?? url.searchParams.get('dry_run');
  const headerDryRun = req.headers.get('x-dry-run');
  return isTruthy(body.dryRun) || isTruthy(queryDryRun) || isTruthy(headerDryRun);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const requestBody = await req.json().catch(() => ({})) as Record<string, unknown>;
    const dryRun = resolveDryRun(req, requestBody);
    const mode = dryRun ? 'dry_run' : 'real';
    const requestedProductId = typeof requestBody?.product_id === 'string' ? requestBody.product_id : null;
    const executionEnabled = Deno.env.get('PRODUCT_SYNC_EXECUTION_ENABLED') === 'true';
    const allowedProjectRef = Deno.env.get('PRODUCT_SYNC_ALLOWED_PROJECT_REF') ?? null;
    const currentProjectRef =
      Deno.env.get('SUPABASE_PROJECT_REF')
      ?? Deno.env.get('SB_PROJECT_REF')
      ?? null;

    console.log(
      '[process-product-sync] execution_context',
      JSON.stringify({
        mode,
        execution_enabled: executionEnabled,
        erp_sync_paused: ERP_SYNC_PAUSED,
        allowed_project_ref_configured: !!allowedProjectRef,
        current_project_ref_present: !!currentProjectRef,
        requested_product_id: requestedProductId,
      }),
    );

    if (!dryRun) {
      if (ERP_SYNC_PAUSED) {
        return new Response(
          JSON.stringify({
            success: false,
            paused: true,
            mode,
            error: 'Sincronização ERP temporariamente bloqueada (ERP_SYNC_PAUSED=true).',
          }),
          { status: 423, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      if (!executionEnabled) {
        return new Response(
          JSON.stringify({
            success: false,
            mode,
            error: 'Execução real bloqueada: PRODUCT_SYNC_EXECUTION_ENABLED=true é obrigatório.',
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      if (allowedProjectRef && currentProjectRef !== allowedProjectRef) {
        return new Response(
          JSON.stringify({
            success: false,
            mode,
            error: 'Execução real bloqueada: project ref atual não permitido para este drainer.',
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    const apiUrl = Deno.env.get('PROJEDATA_API_URL') ?? '';
    const apiToken = Deno.env.get('PROJEDATA_API_TOKEN') ?? '';
    if (!dryRun && (!apiUrl || !apiToken)) {
      return new Response(
        JSON.stringify({ success: false, mode, error: 'PROJEDATA_API_URL e PROJEDATA_API_TOKEN não configurados' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let requesterUserId: string | null = null;
    const authHeader = req.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const userClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: { user } } = await userClient.auth.getUser();
      requesterUserId = user?.id ?? null;
    }

    // Buscar itens pendentes/retry da fila (máx 20 por execução), respeitando janela de retry.
    const nowIso = new Date().toISOString();
    let queueQuery = supabase
      .from('product_sync_queue')
      .select('id, product_id, attempt_count, max_attempts, payload')
      .in('status', ['pending', 'retry'])
      .or('next_retry_at.is.null,next_retry_at.lte.' + nowIso)
      .order('created_at', { ascending: true })
      .limit(20);

    if (requestedProductId) {
      queueQuery = queueQuery.eq('product_id', requestedProductId);
    }

    const { data: queueRaw, error: queueError } = await queueQuery;

    if (queueError) {
      console.error('[process-product-sync] Erro ao ler fila:', queueError);
      return errorResponse(500, queueError.message);
    }

    const queue = (queueRaw ?? []).filter((item) => {
      const attempt = item.attempt_count ?? 0;
      const maxAttempts = item.max_attempts ?? 5;
      return attempt < maxAttempts;
    }) as QueueItem[];

    if (!queue || queue.length === 0) {
      return new Response(
        JSON.stringify({ success: true, mode, processed: 0, message: 'Nenhum item elegível na fila' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(
      '[process-product-sync] queue_selected',
      JSON.stringify({ mode, selected: queue.length, requested_product_id: requestedProductId }),
    );

    let successCount = 0;
    let errorCount = 0;
    let validationFailCount = 0;
    let wouldSendCount = 0;
    let deferredCount = 0;
    const results: Array<{ product_id: string; status: string; error?: string }> = [];

    for (const item of queue) {
      try {
        if (!dryRun) {
          // Marcar como processing (lock atômico — só pega se ainda estiver pending/retry)
          const { data: locked } = await supabase
            .from('product_sync_queue')
            .update({ status: 'processing', updated_at: new Date().toISOString() })
            .eq('id', item.id)
            .in('status', ['pending', 'retry'])
            .select('id')
            .maybeSingle();

          if (!locked) {
            console.log(`[process-product-sync] Item ${item.id} já em processamento, pulando`);
            continue;
          }
        }

        // Carregar produto + labels + erp_usuario (também devolve tenantId para a checagem de janela)
        const executorUserId = typeof item.payload?.executor_user_id === 'string'
          ? item.payload.executor_user_id
          : requesterUserId;

        const { product: productForSync, ctx, tenantId } = await loadProductForSync(
          supabase,
          item.product_id,
          executorUserId,
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
            deferredCount++;
            if (!dryRun) {
              await supabase
                .from('product_sync_queue')
                .update({
                  status: 'retry',
                  next_retry_at: new Date(Date.now() + 10 * 60_000).toISOString(),
                  error_message: winErr.message,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', item.id);
              errorCount++;
              results.push({ product_id: item.product_id, status: 'deferred', error: winErr.message });
            } else {
              results.push({ product_id: item.product_id, status: 'would_defer', error: winErr.message });
            }
            continue;
          }
          throw winErr;
        }

        // Validar campos obrigatórios antes do envio
        const validation = validateProductForSync(productForSync, ctx);
        if (!validation.valid) {
          const errorMsg = 'Validação falhou: ' + validation.errors.map(e => `${e.field}: ${e.message}`).join('; ');
          validationFailCount++;
          if (!dryRun) {
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
          } else {
            results.push({ product_id: item.product_id, status: 'would_fail_validation', error: errorMsg });
          }
          continue;
        }

        const isUpdate = isProductUpdate(productForSync);
        const grupoComando = getProductGrupoComando();
        const payload = buildProductPayloadV2(productForSync, ctx, grupoComando);
        wouldSendCount++;

        if (dryRun) {
          results.push({
            product_id: item.product_id,
            status: 'would_send',
            error: undefined,
          });
          continue;
        }

        console.log(`[process-product-sync] ${isUpdate ? 'UPDATE' : 'CREATE'} produto ${productForSync.id} (codigo="${productForSync.erp_product_code ?? ''}")`);
        console.log(`[process-product-sync] grupoComando=${grupoComando}`);
        console.log(`[process-product-sync] payload_size=${payload.length}`);

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
          // Espelha o número da versão enviado ao ERP (1 para principal, 2+ para variações)
          erp_versao_codigo: String(productForSync.versao_numero ?? 1),
          erp_versao_situacao: 'A',
        };

        // Persiste erp_product_code na linha sempre que ela estiver vazia.
        // Para versões filhas (v2+) o productForSync já vem com o código herdado do pai,
        // mas a linha do filho no banco continua NULL — precisamos gravar para o badge
        // e para destravar os atributos bloqueados.
        const { data: rowSnapshot } = await supabase
          .from('products')
          .select('erp_product_code')
          .eq('id', item.product_id)
          .maybeSingle();
        const rowHasCode = !!rowSnapshot?.erp_product_code?.toString().trim();
        if (!rowHasCode) {
          const codeToPersist = parsedResult.erpCode
            ?? (productForSync.erp_product_code?.toString().trim() || null);
          if (codeToPersist) {
            productUpdate.erp_product_code = codeToPersist;
          }
        }

        const { error: productUpdateError } = await supabase
          .from('products')
          .update(productUpdate)
          .eq('id', item.product_id);

        if (productUpdateError) {
          throw new Error(`ERP sincronizou, mas falhou ao gravar código no CRM: ${productUpdateError.message}`);
        }

        // Liberar atributos bloqueados (produto agora tem erp_product_code),
        // enfileirar TODOS os atributos mapeados (cada sync de produto re-envia tudo)
        // e disparar drain.
        try {
          await supabase.rpc('release_blocked_attributes', { p_product_id: item.product_id });
          await supabase.rpc('enqueue_all_product_attributes', { p_product_id: item.product_id });
          // Fire-and-forget: processa atributos pendentes deste produto
          supabase.functions
            .invoke('process-attribute-sync', { body: { product_id: item.product_id } })
            .catch((e: unknown) => console.warn('[process-product-sync] drain atributos falhou:', e));
        } catch (e) {
          console.warn('[process-product-sync] enqueue/release atributos falhou:', e);
        }




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
        const maxAttempts = item.max_attempts ?? 5;
        const nextRetry = newAttempt < maxAttempts
          ? new Date(Date.now() + Math.pow(2, newAttempt) * 60000).toISOString()
          : null;

        if (!dryRun) {
          await supabase
            .from('product_sync_queue')
            .update({
              status: newAttempt >= maxAttempts ? 'failed' : 'retry',
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
        }

        errorCount++;
        results.push({ product_id: item.product_id, status: dryRun ? 'would_error' : 'error', error: errorMsg });
      }
    }

    console.log(
      '[process-product-sync] completed',
      JSON.stringify({
        mode,
        selected: queue.length,
        validated: queue.length - validationFailCount,
        would_send: wouldSendCount,
        deferred: deferredCount,
        success_count: successCount,
        error_count: errorCount,
      }),
    );

    return new Response(
      JSON.stringify({
        success: true,
        mode,
        dry_run: dryRun,
        processed: queue.length,
        validated_count: queue.length - validationFailCount,
        validation_fail_count: validationFailCount,
        deferred_count: deferredCount,
        would_send_count: wouldSendCount,
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
