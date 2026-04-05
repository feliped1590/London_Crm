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

/**
 * Parse date from ERP format "DD/MM/YYYY HH:mm:ss" or ISO string
 */
function parseErpDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // Try DD/MM/YYYY HH:mm:ss
  const brMatch = String(raw).match(
    /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/
  );
  if (brMatch) {
    const [, dd, mm, yyyy, hh, mi, ss] = brMatch;
    const d = new Date(`${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}`);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  // Try ISO / other JS-parseable formats
  const d = new Date(raw);
  if (!isNaN(d.getTime())) return d.toISOString();
  return null;
}

/**
 * Fetch products from ERP Iniflex API
 */
async function fetchFromErp(
  since: string,
  configEndpoint?: string,
  configToken?: string
): Promise<unknown[]> {
  // Priority: config from tenant_settings > env vars
  const apiUrl = configEndpoint || Deno.env.get("INIFLEX_API_URL");
  const apiToken = configToken || Deno.env.get("INIFLEX_API_TOKEN");

  if (!apiUrl || !apiToken) {
    throw new Error("Endpoint e Token do ERP não configurados. Configure na aba ERP em Integrações.");
  }

  const payload = {
    tipoComando: "ASDCOMANDO",
    grupoComando: "EXP_PRODUTOS_V1",
    data_alteracao: since,
  };

  console.log(`[ERP] Fetching products since ${since} from ${apiUrl}`);

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `ERP API error [${response.status}]: ${body.substring(0, 500)}`
    );
  }

  const result = await response.json();

  // The ERP may return data in different structures
  if (Array.isArray(result)) return result;
  if (result?.dados && Array.isArray(result.dados)) return result.dados;
  if (result?.data && Array.isArray(result.data)) return result.data;
  if (result?.json) {
    try {
      const parsed = typeof result.json === "string" ? JSON.parse(result.json) : result.json;
      if (Array.isArray(parsed)) return parsed;
    } catch { /* ignore */ }
  }

  throw new Error("Formato de resposta do ERP não reconhecido");
}

/**
 * Batch dedup: given a list of {erp_code, hash_data}, return a Set of
 * "erp_code|hash_data" keys that already exist as pending in staging.
 */
async function batchCheckExisting(
  supabaseAdmin: ReturnType<typeof createClient>,
  tenantId: string,
  keys: Array<{ erp_code: string; hash_data: string }>
): Promise<Set<string>> {
  const existingSet = new Set<string>();
  if (keys.length === 0) return existingSet;

  // Query in chunks of 200 erp_codes at a time
  const uniqueCodes = [...new Set(keys.map((k) => k.erp_code))];
  const CHUNK = 200;

  for (let i = 0; i < uniqueCodes.length; i += CHUNK) {
    const codeBatch = uniqueCodes.slice(i, i + CHUNK);
    const { data } = await supabaseAdmin
      .from("erp_products_staging")
      .select("erp_code, hash_data")
      .eq("tenant_id", tenantId)
      .eq("status", "pending")
      .in("erp_code", codeBatch);

    if (data) {
      for (const row of data) {
        existingSet.add(`${row.erp_code}|${row.hash_data}`);
      }
    }
  }

  return existingSet;
}

/**
 * Process records into staging table
 */
async function ingestRecords(
  supabaseAdmin: ReturnType<typeof createClient>,
  tenantId: string,
  records: unknown[]
): Promise<{ inserted: number; skipped: number; errors: string[] }> {
  let inserted = 0;
  let skipped = 0;
  const errors: string[] = [];
  const BATCH_SIZE = 500;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);

    // Step 1: Prepare all rows with hashes
    const prepared: Array<{
      erp_code: string;
      codigo_tipo_item: number;
      data_alteracao: string | null;
      raw_data: unknown;
      hash_data: string;
    }> = [];

    for (const record of batch) {
      try {
        const rec = record as Record<string, unknown>;
        const erp_code = String(rec.cd_material || rec.codigo || "").trim();
        if (!erp_code) {
          skipped++;
          continue;
        }

        const codigo_tipo_item = parseInt(
          String(rec.codigo_tipo_item || rec.cd_tipo_item || "0"),
          10
        );

        const rawDate = rec.data_alteracao || rec.dt_alteracao;
        const data_alteracao = parseErpDate(rawDate as string);

        const hash_data = await sha256Hex(stableStringify(rec));

        prepared.push({
          erp_code,
          codigo_tipo_item,
          data_alteracao,
          raw_data: rec,
          hash_data,
        });
      } catch (e) {
        errors.push(`Record parse error: ${(e as Error).message}`);
      }
    }

    if (prepared.length === 0) continue;

    // Step 2: Batch dedup check
    const existingKeys = await batchCheckExisting(
      supabaseAdmin,
      tenantId,
      prepared.map((p) => ({ erp_code: p.erp_code, hash_data: p.hash_data }))
    );

    // Step 3: Filter out duplicates
    const newRows = [];
    for (const p of prepared) {
      const key = `${p.erp_code}|${p.hash_data}`;
      if (existingKeys.has(key)) {
        skipped++;
        continue;
      }
      newRows.push({
        tenant_id: tenantId,
        erp_code: p.erp_code,
        codigo_tipo_item: p.codigo_tipo_item,
        data_alteracao: p.data_alteracao,
        raw_data: p.raw_data,
        hash_data: p.hash_data,
        status: "pending",
      });
    }

    if (newRows.length === 0) continue;

    // Step 4: Insert in sub-batches (Supabase limit ~1000 rows per insert)
    const INSERT_CHUNK = 500;
    for (let j = 0; j < newRows.length; j += INSERT_CHUNK) {
      const chunk = newRows.slice(j, j + INSERT_CHUNK);
      const { error } = await supabaseAdmin
        .from("erp_products_staging")
        .insert(chunk);

      if (error) {
        errors.push(`Batch insert error (offset ${i + j}): ${error.message}`);
      } else {
        inserted += chunk.length;
      }
    }
  }

  return { inserted, skipped, errors };
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

    const body = await req.json();
    const { tenant_id, source, since, records } = body;

    if (!tenant_id) {
      return new Response(
        JSON.stringify({ error: "tenant_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let recordsToProcess: unknown[];

    if (source === "erp" || (!records && !source)) {
      // === MODE: Fetch from ERP API ===
      const sinceDate = since || "01/01/2000 00:00:00";
      console.log(`[Staging] Mode: ERP fetch, since=${sinceDate}, tenant=${tenant_id}`);

      recordsToProcess = await fetchFromErp(sinceDate);
      console.log(`[Staging] ERP returned ${recordsToProcess.length} records`);
    } else if (Array.isArray(records) && records.length > 0) {
      // === MODE: Direct records (existing behavior) ===
      console.log(`[Staging] Mode: Direct records, count=${records.length}, tenant=${tenant_id}`);
      recordsToProcess = records;
    } else {
      return new Response(
        JSON.stringify({ error: "Informe source='erp' ou records[]" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await ingestRecords(supabaseAdmin, tenant_id, recordsToProcess);

    console.log(
      `[Staging] Done: inserted=${result.inserted}, skipped=${result.skipped}, errors=${result.errors.length}`
    );

    return new Response(
      JSON.stringify({
        staging_inserted: result.inserted,
        staging_skipped_unchanged: result.skipped,
        errors: result.errors.length > 0 ? result.errors : undefined,
        total_received: recordsToProcess.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[Staging] Fatal error:", (err as Error).message);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
