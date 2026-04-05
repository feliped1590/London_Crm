import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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

    const { tenant_id } = await req.json();

    if (!tenant_id) {
      return new Response(
        JSON.stringify({ error: "tenant_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call the promotion RPC
    const { data, error } = await supabaseAdmin.rpc(
      "promote_staging_products_v2",
      { p_tenant_id: tenant_id }
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
        console.warn("Sequence sync warning:", seqErr.message);
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
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
