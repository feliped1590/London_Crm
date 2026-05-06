/**
 * Edge Function: validate-product-sync
 * Dry-run de validação de produto para envio ao ERP Projedata.
 * Não envia nada — apenas retorna a lista de pendências e o payload preview.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  loadProductForSync,
  validateProductForSync,
  buildProductPayloadV2,
  isProductUpdate,
  getProductGrupoComando,
} from '../_shared/projedata/index.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const body = await req.json().catch(() => ({}));
    const productId = body?.product_id as string | undefined;
    if (!productId) {
      return json(400, { success: false, error: 'product_id obrigatório' });
    }

    // Resolve executor a partir do JWT (se houver)
    let executorUserId: string | null = null;
    const authHeader = req.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const userClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: { user } } = await userClient.auth.getUser();
      executorUserId = user?.id ?? null;
    }

    const { product, ctx } = await loadProductForSync(supabase, productId, executorUserId);
    const validation = validateProductForSync(product, ctx);

    let payloadPreview: string | null = null;
    if (validation.valid) {
      payloadPreview = buildProductPayloadV2(product, ctx, getProductGrupoComando());
    }

    return json(200, {
      success: true,
      valid: validation.valid,
      mode: isProductUpdate(product) ? 'update' : 'create',
      grupo_comando: getProductGrupoComando(),
      errors: validation.errors,
      product: {
        id: product.id,
        name: product.name,
        erp_product_code: product.erp_product_code,
        familia: product.familia_label,
        classe: product.classe_label,
      },
      erp_usuario: ctx.erp_usuario,
      payload_preview: payloadPreview,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    console.error('[validate-product-sync]', msg);
    return json(500, { success: false, error: msg });
  }
});

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
