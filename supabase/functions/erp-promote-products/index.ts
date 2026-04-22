import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { checkAccessWindowForTenant, AccessWindowError, AccessCheckUnavailableError } from "../_shared/accessControl.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { tenant_id, batch_size = 500 } = await req.json();

    if (!tenant_id) {
      return new Response(
        JSON.stringify({ error: "tenant_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ⏰ Janela de acesso por tenant (strict)
    try {
      await checkAccessWindowForTenant(supabaseAdmin, tenant_id, {
        mode: "strict",
        context: "erp-promote-products",
      });
    } catch (winErr) {
      if (winErr instanceof AccessWindowError || winErr instanceof AccessCheckUnavailableError) {
        return new Response(
          JSON.stringify({ error: winErr.message, code: (winErr as any).code }),
          { status: (winErr as any).status ?? 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw winErr;
    }

    // Single batch call
    const { data, error } = await supabaseAdmin.rpc(
      "promote_staging_products_v2",
      { p_tenant_id: tenant_id, p_batch_size: batch_size }
    );

    if (error) {
      throw new Error(`RPC error: ${error.message}`);
    }

    // Sync ERP sequence if needed
    if (data?.promoted > 0) {
      try {
        await supabaseAdmin.rpc("sync_erp_sequence_if_higher", {
          p_sequence_name: "product_code",
        });
      } catch (seqErr) {
        console.warn("Sequence sync warning:", (seqErr as Error).message);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        summary: data,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Promote error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
