import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Normalizers (reused from erp-import-companies) ──────────────────────────

function normalizeDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const brMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) {
    const [, dd, mm, yyyy] = brMatch;
    return `${yyyy}-${mm}-${dd}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.substring(0, 10);
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) return d.toISOString().substring(0, 10);
  return null;
}

function trimOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function toNumeric(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
  return isNaN(n) ? null : n;
}

function toInt(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? Math.round(v) : parseInt(String(v), 10);
  return isNaN(n) ? null : n;
}

function normalizeErpStatus(tipo: string | null | undefined): string | null {
  if (!tipo) return null;
  const s = tipo.trim().toUpperCase();
  const map: Record<string, string> = {
    ATIVO: "ATIVO",
    INATIVO: "INATIVO",
    SERVICO: "SERVICO",
    SERVIÇO: "SERVICO",
    OBSOLETO: "OBSOLETO",
    MODELO: "MODELO",
    A: "ATIVO",
    I: "INATIVO",
    S: "SERVICO",
    O: "OBSOLETO",
    M: "MODELO",
  };
  return map[s] ?? null;
}

function normalizeAbc(v: unknown): string | null {
  if (!v) return null;
  const s = String(v).trim().toUpperCase();
  return ["A", "B", "C"].includes(s) ? s : null;
}

// ── Types ───────────────────────────────────────────────────────────────────

interface ERPProductRecord {
  cd_material?: string;
  descricao?: string;
  cd_grupo?: string;
  cd_sub_grupo?: string;
  cd_unidade_me?: string;
  cd_unidade_ven?: string;
  referencia?: string;
  peso?: unknown;
  pr_vista?: unknown;
  pr_prazo?: unknown;
  tipo?: string;
  garantia_venda?: unknown;
  aplicacao?: string;
  classificacao_abc?: string;
  // ERP data fields
  centro_controle?: string;
  campo7?: unknown;
  pr_custo?: unknown;
  pe_frete?: unknown;
  pe_embalagem?: unknown;
  pe_comissao?: unknown;
  pe_reajuste?: unknown;
  dt_reajuste?: string;
  tempo_recebim?: unknown;
  cd_fabricante?: string;
  codigo_fabrica?: string;
  cd_reduzido?: unknown;
  conversor_com?: unknown;
  conversor_vend?: unknown;
  pe_encargos_fin?: unknown;
  vl_frete?: unknown;
  qt_multiplo_co?: unknown;
  cd_unidade_com?: string;
  peso_embalagem?: unknown;
  garantia_compr?: unknown;
  cd_unidade_neg?: string;
  dt_cadastro?: string;
  dt_modificacao?: string;
  campo84?: string;
  cd_especif1?: string;
  cd_especif2?: string;
  cd_especif3?: string;
  cd_especif4?: string;
  cd_especif5?: string;
  cd_especif6?: string;
  [key: string]: unknown;
}

interface Summary {
  total_received: number;
  total_processed: number;
  inserted: number;
  updated: number;
  skipped: number;
  conflicts_detected: number;
  conflicts_auto_resolved: number;
  errors: { index: number; erp_code: string | null; message: string }[];
}

interface ConflictEntry {
  field: string;
  crm_value: string | null;
  erp_value: string | null;
  auto_resolved: boolean;
}

// ── Conflict detection for products ─────────────────────────────────────────

const MERGE_FIELDS: { key: string; crmKey: string }[] = [
  { key: "name", crmKey: "name" },
  { key: "description", crmKey: "description" },
  { key: "category", crmKey: "category" },
  { key: "subcategory", crmKey: "subcategory" },
  { key: "unit_measure", crmKey: "unit_measure" },
  { key: "unit_sale", crmKey: "unit_sale" },
  { key: "reference", crmKey: "reference" },
];

function detectConflicts(
  existing: Record<string, unknown>,
  normalized: Record<string, unknown>
): { conflicts: ConflictEntry[]; fieldsToUpdate: Record<string, unknown> } {
  const conflicts: ConflictEntry[] = [];
  const fieldsToUpdate: Record<string, unknown> = {};

  for (const { key, crmKey } of MERGE_FIELDS) {
    const erpVal = normalized[key];
    const crmVal = existing[crmKey];

    if (erpVal === null || erpVal === undefined) continue;

    const crmStr = crmVal != null ? String(crmVal) : null;
    const erpStr = String(erpVal);

    if (crmStr === null || crmStr === "") {
      fieldsToUpdate[crmKey] = erpVal;
      conflicts.push({ field: crmKey, crm_value: null, erp_value: erpStr, auto_resolved: true });
    } else if (crmStr !== erpStr) {
      conflicts.push({ field: crmKey, crm_value: crmStr, erp_value: erpStr, auto_resolved: false });
    }
  }

  return { conflicts, fieldsToUpdate };
}

// ── Main handler ────────────────────────────────────────────────────────────

const BATCH_SIZE = 100;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tenant_id, records } = await req.json();

    if (!tenant_id) {
      return new Response(
        JSON.stringify({ success: false, error: "tenant_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!Array.isArray(records) || records.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "records array is required and must not be empty" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const summary: Summary = {
      total_received: records.length,
      total_processed: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      conflicts_detected: 0,
      conflicts_auto_resolved: 0,
      errors: [],
    };

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);

      for (let j = 0; j < batch.length; j++) {
        const globalIdx = i + j;
        const raw = batch[j] as ERPProductRecord;

        try {
          const erpCode = trimOrNull(raw.cd_material);
          const name = trimOrNull(raw.descricao);

          if (!name) {
            summary.skipped++;
            summary.errors.push({ index: globalIdx, erp_code: erpCode, message: "Missing required field: descricao" });
            continue;
          }

          // Normalize commercial fields
          const normalized: Record<string, unknown> = {
            name,
            description: trimOrNull(raw.aplicacao),
            category: trimOrNull(raw.cd_grupo),
            subcategory: trimOrNull(raw.cd_sub_grupo),
            unit_measure: trimOrNull(raw.cd_unidade_me),
            unit_sale: trimOrNull(raw.cd_unidade_ven),
            reference: trimOrNull(raw.referencia),
            weight: toNumeric(raw.peso),
            price_cash: toNumeric(raw.pr_vista),
            price_term: toNumeric(raw.pr_prazo),
            warranty_months: toInt(raw.garantia_venda),
            erp_status: normalizeErpStatus(raw.tipo),
            abc_classification: normalizeAbc(raw.classificacao_abc),
            erp_product_code: erpCode,
          };

          // ── Lookup existing ───────────────────────────────────
          let existing: Record<string, unknown> | null = null;

          // Priority 1: (tenant_id, sku)
          if (erpCode) {
            const { data } = await supabase
              .from("products")
              .select("*")
              .eq("tenant_id", tenant_id)
              .eq("sku", erpCode)
              .maybeSingle();
            if (data) existing = data;
          }

          // Priority 2: (tenant_id, erp_product_code)
          if (!existing && erpCode) {
            const { data } = await supabase
              .from("products")
              .select("*")
              .eq("tenant_id", tenant_id)
              .eq("erp_product_code", erpCode)
              .maybeSingle();
            if (data) existing = data;
          }

          if (existing) {
            // ── UPDATE path ─────────────────────────────────────
            const { conflicts, fieldsToUpdate } = detectConflicts(existing, normalized);

            // Always update ERP sync metadata + informational fields
            fieldsToUpdate.erp_product_code = erpCode ?? existing.erp_product_code;
            fieldsToUpdate.erp_synced_at = new Date().toISOString();
            fieldsToUpdate.origem_alteracao = 'ERP';
            fieldsToUpdate.pendente_envio = false;
            fieldsToUpdate.erp_last_update_date = normalizeDate(raw.dt_modificacao) ?? existing.erp_last_update_date;
            fieldsToUpdate.erp_status = normalized.erp_status ?? existing.erp_status;

            // ERP price fields are always informational – update them
            if (normalized.price_cash !== null) fieldsToUpdate.price_cash = normalized.price_cash;
            if (normalized.price_term !== null) fieldsToUpdate.price_term = normalized.price_term;
            if (normalized.weight !== null) fieldsToUpdate.weight = normalized.weight;
            if (normalized.warranty_months !== null) fieldsToUpdate.warranty_months = normalized.warranty_months;
            if (normalized.abc_classification !== null) fieldsToUpdate.abc_classification = normalized.abc_classification;

            // NOTE: active is NOT touched – controlled by CRM only

            if (Object.keys(fieldsToUpdate).length > 0) {
              const { error: updateErr } = await supabase
                .from("products")
                .update(fieldsToUpdate)
                .eq("id", existing.id);
              if (updateErr) throw new Error(`Update failed: ${updateErr.message}`);
            }

            // Log conflicts
            if (conflicts.length > 0) {
              summary.conflicts_detected += conflicts.length;
              summary.conflicts_auto_resolved += conflicts.filter((c) => c.auto_resolved).length;

              for (const c of conflicts) {
                await supabase.from("import_conflict_log").insert({
                  tenant_id,
                  entity_type: "product",
                  entity_id: existing.id as string,
                  erp_code: erpCode,
                  field_name: c.field,
                  crm_value: c.crm_value,
                  erp_value: c.erp_value,
                  auto_resolved: c.auto_resolved,
                  resolution: c.auto_resolved ? "auto_erp_fill" : "pending",
                });
              }
            }

            // Upsert ERP data
            await upsertProductErpData(supabase, existing.id as string, tenant_id, raw);

            summary.updated++;
          } else {
            // ── INSERT path ─────────────────────────────────────
            const productData = {
              tenant_id,
              sku: erpCode,
              name,
              description: normalized.description,
              category: normalized.category,
              subcategory: normalized.subcategory,
              unit_measure: normalized.unit_measure,
              unit_sale: normalized.unit_sale,
              reference: normalized.reference,
              weight: normalized.weight,
              price_cash: normalized.price_cash,
              price_term: normalized.price_term,
              warranty_months: normalized.warranty_months,
              erp_status: normalized.erp_status,
              abc_classification: normalized.abc_classification,
              erp_product_code: erpCode,
              erp_synced_at: new Date().toISOString(),
              erp_last_update_date: normalizeDate(raw.dt_modificacao),
              active: true,
              origem_alteracao: 'ERP',
              pendente_envio: false,
            };

            const { data: inserted, error: insertErr } = await supabase
              .from("products")
              .insert(productData)
              .select("id")
              .single();

            if (insertErr) throw new Error(`Insert failed: ${insertErr.message}`);

            await upsertProductErpData(supabase, inserted.id, tenant_id, raw);

            summary.inserted++;
          }

          summary.total_processed++;
        } catch (err) {
          summary.errors.push({
            index: globalIdx,
            erp_code: trimOrNull(raw.cd_material),
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, summary }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ── Product ERP Data upsert ─────────────────────────────────────────────────

async function upsertProductErpData(
  supabase: ReturnType<typeof createClient>,
  productId: string,
  tenantId: string,
  raw: ERPProductRecord
) {
  const especifs: Record<string, string | null> = {};
  for (let i = 1; i <= 6; i++) {
    const val = trimOrNull(raw[`cd_especif${i}`]);
    if (val) especifs[`especif${i}`] = val;
  }

  const erpData = {
    product_id: productId,
    tenant_id: tenantId,
    center_control: trimOrNull(raw.centro_controle),
    parent_child_qty: toNumeric(raw.campo7),
    cost_price: toNumeric(raw.pr_custo),
    freight_pct: toNumeric(raw.pe_frete),
    packaging_pct: toNumeric(raw.pe_embalagem),
    commission_pct: toNumeric(raw.pe_comissao),
    readjust_pct: toNumeric(raw.pe_reajuste),
    readjust_date: normalizeDate(raw.dt_reajuste),
    erp_product_type_id: toInt(raw.tempo_recebim),
    manufacturer_code: trimOrNull(raw.cd_fabricante),
    factory_code: trimOrNull(raw.codigo_fabrica),
    short_code: toInt(raw.cd_reduzido),
    purchase_converter: toNumeric(raw.conversor_com),
    sale_converter: toNumeric(raw.conversor_vend),
    finance_charges_pct: toNumeric(raw.pe_encargos_fin),
    freight_value: toNumeric(raw.vl_frete),
    volume: toNumeric(raw.qt_multiplo_co),
    purchase_unit: trimOrNull(raw.cd_unidade_com),
    packaging_weight: toNumeric(raw.peso_embalagem),
    purchase_warranty: toInt(raw.garantia_compr),
    business_unit: trimOrNull(raw.cd_unidade_neg),
    erp_price_table_code: trimOrNull(raw.campo84),
    erp_registered_at: normalizeDate(raw.dt_cadastro),
    erp_modified_at: normalizeDate(raw.dt_modificacao),
    extra_data: Object.keys(especifs).length > 0 ? especifs : {},
  };

  const { data: existing } = await supabase
    .from("product_erp_data")
    .select("id")
    .eq("product_id", productId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("product_erp_data")
      .update(erpData)
      .eq("id", existing.id);
  } else {
    await supabase.from("product_erp_data").insert(erpData);
  }
}
