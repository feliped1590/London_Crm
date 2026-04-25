import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { permissionErrorResponse, requireModulePermission } from "../_shared/permissionEngine.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify user
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await requireModulePermission(supabase, user.id, "products", "create");

    // Get tenant
    const { data: profile } = await supabase
      .from("profiles")
      .select("active_tenant_id")
      .eq("user_id", user.id)
      .single();
    const tenantId = profile?.active_tenant_id || "00000000-0000-0000-0000-000000000001";

    // Parse body - expect { csvContent: string } with the raw CSV text
    const body = await req.json();
    const csvContent: string = body.csvContent;

    if (!csvContent) {
      return new Response(JSON.stringify({ error: "csvContent is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load lookup tables for resolution
    const [tiposRes, familiasRes, unitMeasuresRes] = await Promise.all([
      supabase.from("product_types").select("id, value").eq("tenant_id", tenantId),
      supabase.from("product_families").select("id, value").eq("tenant_id", tenantId),
      supabase.from("product_unit_measures").select("id, value"),
    ]);

    const tipoMap = new Map<string, string>();
    (tiposRes.data || []).forEach((t: any) => tipoMap.set(t.value.trim().toUpperCase(), t.id));

    const familiaMap = new Map<string, string>();
    (familiasRes.data || []).forEach((f: any) => familiaMap.set(f.value.trim().toUpperCase(), f.id));

    // Parse CSV lines
    const lines = csvContent.split("\n").filter((l: string) => l.trim().length > 0);
    
    // Skip header
    const dataLines = lines.slice(1);
    
    console.log(`Parsing ${dataLines.length} lines...`);

    const products: any[] = [];
    const errors: string[] = [];
    const skuSet = new Set<string>();

    for (let i = 0; i < dataLines.length; i++) {
      const line = dataLines[i];
      const cols = line.split("\t").map((c: string) => c.trim());

      if (cols.length < 4) {
        errors.push(`Linha ${i + 2}: colunas insuficientes (${cols.length})`);
        continue;
      }

      const [tipo, familia, codigo, descricao, unidade, ncm, largura, comprimento, espessura] = cols;

      if (!codigo || !descricao) {
        errors.push(`Linha ${i + 2}: código ou descrição vazios`);
        continue;
      }

      // Skip duplicate SKUs in the file
      if (skuSet.has(codigo.toUpperCase())) {
        errors.push(`Linha ${i + 2}: SKU duplicado no arquivo: ${codigo}`);
        continue;
      }
      skuSet.add(codigo.toUpperCase());

      const tipoId = tipo ? tipoMap.get(tipo.toUpperCase()) || null : null;
      const familiaId = familia ? familiaMap.get(familia.toUpperCase()) || null : null;

      if (tipo && !tipoId) {
        errors.push(`Linha ${i + 2}: tipo "${tipo}" não encontrado no cadastro`);
      }
      if (familia && !familiaId) {
        errors.push(`Linha ${i + 2}: família "${familia}" não encontrada no cadastro`);
      }

      products.push({
        sku: codigo.toUpperCase(),
        name: descricao,
        tipo_id: tipoId,
        family_id: familiaId,
        unit_measure: unidade?.toLowerCase() || "un",
        ncm_code: ncm || null,
        width: largura ? parseFloat(largura.replace(",", ".")) || null : null,
        length: comprimento ? parseFloat(comprimento.replace(",", ".")) || null : null,
        thickness: espessura ? parseFloat(espessura.replace(",", ".")) || null : null,
        active: true,
        tenant_id: tenantId,
        created_by: user.id,
        origem_alteracao: "CRM",
      });
    }

    console.log(`Parsed ${products.length} products, ${errors.length} warnings`);

    // Batch insert (chunks of 200)
    const BATCH_SIZE = 200;
    let inserted = 0;
    let insertErrors = 0;
    const insertErrorDetails: string[] = [];

    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      const batch = products.slice(i, i + BATCH_SIZE);
      const { error: insertError, data: insertData } = await supabase
        .from("products")
        .upsert(batch, { onConflict: "sku", ignoreDuplicates: false })
        .select("id");

      if (insertError) {
        console.error(`Batch ${i / BATCH_SIZE + 1} error:`, insertError.message);
        insertErrors += batch.length;
        insertErrorDetails.push(`Batch ${i / BATCH_SIZE + 1}: ${insertError.message}`);
      } else {
        inserted += insertData?.length || batch.length;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_lines: dataLines.length,
        parsed: products.length,
        inserted,
        insert_errors: insertErrors,
        warnings: errors.slice(0, 50),
        insert_error_details: insertErrorDetails,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    const permissionResponse = permissionErrorResponse(err, corsHeaders);
    if (permissionResponse) return permissionResponse;

    console.error("Import error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
