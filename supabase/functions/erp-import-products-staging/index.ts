import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/** Deterministic JSON stringify with sorted keys */
function stableStringify(obj: unknown): string {
  if (obj === null || obj === undefined) return JSON.stringify(obj);
  if (typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj))
    return "[" + obj.map(stableStringify).join(",") + "]";
  const sorted = Object.keys(obj as Record<string, unknown>).sort();
  return (
    "{" +
    sorted
      .map(
        (k) =>
          JSON.stringify(k) +
          ":" +
          stableStringify((obj as Record<string, unknown>)[k])
      )
      .join(",") +
    "}"
  );
}

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { tenant_id, records } = await req.json();

    if (!tenant_id || !Array.isArray(records) || records.length === 0) {
      return new Response(
        JSON.stringify({ error: "tenant_id e records[] são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let inserted = 0;
    let skipped = 0;
    const errors: string[] = [];
    const BATCH_SIZE = 50;

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      const rows = [];

      for (const record of batch) {
        try {
          const erp_code = String(
            record.cd_material || record.codigo || ""
          ).trim();
          if (!erp_code) {
            skipped++;
            continue;
          }

          const codigo_tipo_item = parseInt(
            String(record.codigo_tipo_item || record.cd_tipo_item || "0"),
            10
          );

          let data_alteracao: string | null = null;
          const rawDate = record.data_alteracao || record.dt_alteracao;
          if (rawDate) {
            const d = new Date(rawDate);
            if (!isNaN(d.getTime())) {
              data_alteracao = d.toISOString();
            }
          }

          const hash_data = await md5Hex(stableStringify(record));

          // Check dedup: same tenant + erp_code + hash already pending?
          const { data: existing } = await supabaseAdmin
            .from("erp_products_staging")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("erp_code", erp_code)
            .eq("hash_data", hash_data)
            .eq("status", "pending")
            .limit(1);

          if (existing && existing.length > 0) {
            skipped++;
            continue;
          }

          rows.push({
            tenant_id,
            erp_code,
            codigo_tipo_item,
            data_alteracao,
            raw_data: record,
            hash_data,
            status: "pending",
          });
        } catch (e) {
          errors.push(`Record error: ${e.message}`);
        }
      }

      if (rows.length > 0) {
        const { error } = await supabaseAdmin
          .from("erp_products_staging")
          .insert(rows);

        if (error) {
          errors.push(`Batch insert error: ${error.message}`);
        } else {
          inserted += rows.length;
        }
      }
    }

    return new Response(
      JSON.stringify({
        staging_inserted: inserted,
        staging_skipped_unchanged: skipped,
        errors: errors.length > 0 ? errors : undefined,
        total_received: records.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
