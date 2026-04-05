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

    const BATCH_SIZE = 500;
    let totalPromoted = 0;
    let totalSkippedHash = 0;
    let totalSkippedType = 0;
    let totalErrors = 0;
    let iterations = 0;
    const MAX_ITERATIONS = 100; // safety limit

    // Loop calling RPC in batches until no more pending records
    while (iterations < MAX_ITERATIONS) {
      iterations++;

      const { data, error } = await supabaseAdmin.rpc(
        "promote_staging_products_v2",
        { p_tenant_id: tenant_id, p_batch_size: BATCH_SIZE }
      );

      if (error) {
        throw new Error(`RPC error: ${error.message}`);
      }

      const batch = data as any;
      totalPromoted += batch?.promoted || 0;
      totalSkippedHash += batch?.skipped_hash || 0;
      totalSkippedType += batch?.skipped_type || 0;
      totalErrors += batch?.errors || 0;

      const batchTotal = (batch?.promoted || 0) + (batch?.skipped_type || 0) + (batch?.errors || 0);
      console.log(`Batch ${iterations}: promoted=${batch?.promoted}, skipped_type=${batch?.skipped_type}, errors=${batch?.errors}`);

      // If batch processed fewer than BATCH_SIZE, we're done
      if (batchTotal < BATCH_SIZE) {
        break;
      }
    }

    // Sync ERP sequence if needed
    if (totalPromoted > 0) {
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
        summary: {
          promoted: totalPromoted,
          skipped_hash: totalSkippedHash,
          skipped_type: totalSkippedType,
          errors: totalErrors,
          batches: iterations,
        },
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
