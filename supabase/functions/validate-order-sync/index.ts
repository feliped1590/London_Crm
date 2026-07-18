/**
 * Edge Function: validate-order-sync
 * Valida (read-only) se um pedido pode ser enviado ao ERP Projedata.
 * Não enfileira nada — apenas retorna lista de pendências enriquecida com hints/rotas.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { loadOrderForValidation } from '../_shared/projedata/order-loader.ts';
import { validateOrderForSync } from '../_shared/projedata/order-validator.ts';
import { resolveOrderErpConfig, isOrderErpConfigError } from '../_shared/erp/order-endpoint-resolver.ts';
import { envFlagEnabled, disabledIntegrationResponse } from '../_shared/integration-gates.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (!envFlagEnabled('ERP_INTEGRATION_ENABLED', false)) {
    return disabledIntegrationResponse('ERP', corsHeaders);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const body = await req.json().catch(() => ({}));
    const orderId = body?.order_id;

    if (!orderId || typeof orderId !== 'string') {
      return jsonResponse({ valid: false, error: 'order_id é obrigatório' }, 400);
    }

    // Recuperar pedido_terceiro da fila (se existir) para validar coerência
    const { data: queueEntry } = await supabase
      .from('order_sync_queue')
      .select('pedido_terceiro')
      .eq('order_id', orderId)
      .maybeSingle();

    const ctx = await loadOrderForValidation(supabase, orderId, queueEntry?.pedido_terceiro);
    const validation = validateOrderForSync(ctx.toValidate);

    // Pré-valida também o endpoint/token/empresa resolvidos pela entidade jurídica
    // (somente pedidos). Falha aqui é adicionada como pendência estruturada.
    const extraErrors: any[] = [...validation.errors];
    const extraFields = new Set<string>(validation.fields);
    try {
      await resolveOrderErpConfig(supabase, ctx.order.legal_entity_id);
    } catch (cfgErr) {
      if (isOrderErpConfigError(cfgErr)) {
        extraErrors.push({
          field: cfgErr.field,
          message: cfgErr.message,
          fixHint: cfgErr.fixHint,
          fixRoute: cfgErr.fixRoute,
        });
        extraFields.add(cfgErr.field);
      } else {
        throw cfgErr;
      }
    }

    return jsonResponse({
      valid: extraErrors.length === 0,
      errors: extraErrors,
      fields: Array.from(extraFields),
      order_number: ctx.order.number,
    });
  } catch (error) {
    console.error('[validate-order-sync] Erro:', error);
    return jsonResponse({
      valid: false,
      errors: [{
        field: 'system',
        message: error instanceof Error ? error.message : 'Erro inesperado',
        fixHint: 'Tente novamente. Se persistir, contate o suporte.',
      }],
      fields: ['system'],
    }, 200);
  }
});

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
