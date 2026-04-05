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

function parseErpDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const brMatch = String(raw).match(
    /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/
  );
  if (brMatch) {
    const [, dd, mm, yyyy, hh, mi, ss] = brMatch;
    const d = new Date(`${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}`);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  const d = new Date(raw);
  if (!isNaN(d.getTime())) return d.toISOString();
  return null;
}

async function fetchFromErp(
  since: string,
  configEndpoint?: string,
  configToken?: string
): Promise<unknown[]> {
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

async function batchCheckExisting(
  supabaseAdmin: ReturnType<typeof createClient>,
  tenantId: string,
  keys: Array<{ erp_code: string; hash_data: string }>
): Promise<Set<string>> {
  const existingSet = new Set<string>();
  if (keys.length === 0) return existingSet;

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
 * Background processing: ingest records into staging with progress tracking via erp_sync_control
 */
async function processInBackground(
  supabaseAdmin: ReturnType<typeof createClient>,
  tenantId: string,
  records: unknown[],
  syncJobId: string
) {
  let inserted = 0;
  let skipped = 0;
  let skippedNoCode = 0;
  const errors: string[] = [];
  const BATCH_SIZE = 500;

  try {
    // Log first record for field discovery
    if (records.length > 0) {
      const firstRec = records[0] as Record<string, unknown>;
      console.log(`[Staging BG] First record keys: ${JSON.stringify(Object.keys(firstRec))}`);
    }

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);

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
          const erp_code = String(
            rec.produto || rec.PRODUTO ||
            rec.cd_material || rec.CD_MATERIAL ||
            rec.codigo || rec.CODIGO ||
            rec.cd_produto || rec.CD_PRODUTO ||
            rec.code || rec.CODE || ""
          ).trim();
          if (!erp_code) {
            if (skippedNoCode < 3) {
              console.warn(`[Staging BG] Record without erp_code, keys: ${Object.keys(rec).join(",")}`);
            }
            skippedNoCode++;
            skipped++;
            continue;
          }

          const codigo_tipo_item = parseInt(
            String(rec.codigo_tipo_item || rec.cd_tipo_item || rec.CODIGO_TIPO_ITEM || rec.CD_TIPO_ITEM || "0"),
            10
          );

          const rawDate = rec.data_alteracao || rec.dt_alteracao || rec.DATA_ALTERACAO || rec.DT_ALTERACAO;
          const data_alteracao = parseErpDate(rawDate as string);

          const hash_data = await sha256Hex(stableStringify(rec));

          prepared.push({ erp_code, codigo_tipo_item, data_alteracao, raw_data: rec, hash_data });
        } catch (e) {
          errors.push(`Record parse error: ${(e as Error).message}`);
        }
      }

      if (prepared.length === 0) continue;

      // Batch dedup check
      const existingKeys = await batchCheckExisting(
        supabaseAdmin,
        tenantId,
        prepared.map((p) => ({ erp_code: p.erp_code, hash_data: p.hash_data }))
      );

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

      // Insert in sub-batches
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

      // Update progress every 5 batches
      if (i % (BATCH_SIZE * 5) === 0 && i > 0) {
        console.log(`[Staging BG] Progress: ${i}/${records.length} processed, inserted=${inserted}`);
      }
    }

    // Update sync control with final result
    await supabaseAdmin
      .from("erp_sync_control")
      .upsert({
        tenant_id: tenantId,
        entity_type: "products_staging",
        last_sync_at: new Date().toISOString(),
        records_synced: inserted,
        sync_status: errors.length > 0 ? "partial" : "success",
        error_message: errors.length > 0 ? errors.slice(0, 5).join("; ") : null,
      }, { onConflict: "tenant_id,entity_type" });

    console.log(
      `[Staging BG] DONE: inserted=${inserted}, skipped=${skipped}, skippedNoCode=${skippedNoCode}, errors=${errors.length}`
    );
  } catch (err) {
    console.error("[Staging BG] Fatal error in background:", (err as Error).message);
    await supabaseAdmin
      .from("erp_sync_control")
      .upsert({
        tenant_id: tenantId,
        entity_type: "products_staging",
        last_sync_at: new Date().toISOString(),
        sync_status: "error",
        error_message: (err as Error).message,
      }, { onConflict: "tenant_id,entity_type" });
  }
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
      const sinceDate = since || "01/01/2000 00:00:00";
      console.log(`[Staging] Mode: ERP fetch, since=${sinceDate}, tenant=${tenant_id}`);

      let configEndpoint: string | undefined;
      let configToken: string | undefined;
      const { data: tenantConfig } = await supabaseAdmin
        .from("tenant_settings")
        .select("settings")
        .eq("tenant_id", tenant_id)
        .eq("category", "erp_integration")
        .maybeSingle();

      if (tenantConfig?.settings) {
        const s = tenantConfig.settings as Record<string, string>;
        configEndpoint = s.endpoint || undefined;
        configToken = s.token || undefined;
      }

      recordsToProcess = await fetchFromErp(sinceDate, configEndpoint, configToken);
      console.log(`[Staging] ERP returned ${recordsToProcess.length} records`);
    } else if (Array.isArray(records) && records.length > 0) {
      console.log(`[Staging] Mode: Direct records, count=${records.length}, tenant=${tenant_id}`);
      recordsToProcess = records;
    } else {
      return new Response(
        JSON.stringify({ error: "Informe source='erp' ou records[]" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark sync as in_progress
    await supabaseAdmin
      .from("erp_sync_control")
      .upsert({
        tenant_id: tenant_id,
        entity_type: "products_staging",
        last_sync_at: new Date().toISOString(),
        sync_status: "in_progress",
        records_synced: 0,
        error_message: null,
      }, { onConflict: "tenant_id,entity_type" });

    // Start background processing — returns immediately
    (globalThis as any).EdgeRuntime.waitUntil(
      processInBackground(supabaseAdmin, tenant_id, recordsToProcess, "")
    );

    return new Response(
      JSON.stringify({
        status: "processing",
        message: `Ingestão de ${recordsToProcess.length} registros iniciada em background. Acompanhe o progresso no monitor.`,
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
