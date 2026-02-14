import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Normalizers ─────────────────────────────────────────────────────────────

function normalizeCnpj(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, "");
  return digits.length === 14 ? digits : digits.length === 11 ? digits : null;
}

function normalizeCep(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, "");
  return digits.length === 8 ? digits : null;
}

function normalizeDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  // DD/MM/YYYY
  const brMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) {
    const [, dd, mm, yyyy] = brMatch;
    return `${yyyy}-${mm}-${dd}`;
  }
  // YYYY-MM-DD already ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.substring(0, 10);
  }
  // Timestamp ERP (try parsing)
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    return d.toISOString().substring(0, 10);
  }
  return null;
}

function normalizeBool(raw: unknown): boolean | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "boolean") return raw;
  const s = String(raw).trim().toUpperCase();
  if (["S", "SIM", "1", "TRUE", "Y", "YES"].includes(s)) return true;
  if (["N", "NAO", "NÃO", "0", "FALSE", "NO"].includes(s)) return false;
  return null;
}

function normalizeTipoPessoa(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim().toUpperCase();
  if (["PJ", "JURIDICA", "JURÍDICA", "J"].includes(s)) return "PJ";
  if (["PF", "FISICA", "FÍSICA", "F"].includes(s)) return "PF";
  return null;
}

function trimOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

// ── Types ───────────────────────────────────────────────────────────────────

interface ERPRecord {
  erp_code?: string;
  cnpj_cpf?: string;
  tipo_pessoa?: string;
  nome?: string;
  fantasia?: string;
  email?: string;
  fone?: string;
  endereco?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
  inscricao_estadual?: string;
  inscricao_municipal?: string;
  data_cadastro?: string;
  data_ultima_atualizacao?: string;
  regime_tributario?: string;
  contribuinte_icms?: unknown;
  contribuinte_ipi?: unknown;
  limite_credito?: number;
  condicao_pagamento?: string;
  forma_pagamento?: string;
  observacoes?: string;
  suframa?: string;
  // extensible – extra fields go to notes or are ignored
  [key: string]: unknown;
}

interface NormalizedRecord {
  erp_code: string | null;
  cnpj: string | null;
  tipo_pessoa: string | null;
  name: string | null;
  fantasia: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  address_number: string | null;
  address_complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  inscricao_estadual: string | null;
  inscricao_municipal: string | null;
  erp_registration_date: string | null;
  erp_last_update_date: string | null;
  regime_tributario: string | null;
  contribuinte_icms: boolean | null;
  contribuinte_ipi: boolean | null;
  limite_credito: number | null;
  condicao_pagamento: string | null;
  forma_pagamento: string | null;
  notes: string | null;
  suframa: string | null;
}

interface ConflictEntry {
  field: string;
  crm_value: string | null;
  erp_value: string | null;
  auto_resolved: boolean;
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

// ── Normalize one record ────────────────────────────────────────────────────

function normalize(rec: ERPRecord): NormalizedRecord {
  return {
    erp_code: trimOrNull(rec.erp_code),
    cnpj: normalizeCnpj(rec.cnpj_cpf),
    tipo_pessoa: normalizeTipoPessoa(rec.tipo_pessoa),
    name: trimOrNull(rec.nome),
    fantasia: trimOrNull(rec.fantasia),
    email: trimOrNull(rec.email),
    phone: trimOrNull(rec.fone),
    address: trimOrNull(rec.endereco),
    address_number: trimOrNull(rec.numero),
    address_complement: trimOrNull(rec.complemento),
    neighborhood: trimOrNull(rec.bairro),
    city: trimOrNull(rec.cidade),
    state: trimOrNull(rec.uf),
    zip_code: normalizeCep(rec.cep),
    inscricao_estadual: trimOrNull(rec.inscricao_estadual),
    inscricao_municipal: trimOrNull(rec.inscricao_municipal),
    erp_registration_date: normalizeDate(rec.data_cadastro),
    erp_last_update_date: normalizeDate(rec.data_ultima_atualizacao),
    regime_tributario: trimOrNull(rec.regime_tributario),
    contribuinte_icms: normalizeBool(rec.contribuinte_icms),
    contribuinte_ipi: normalizeBool(rec.contribuinte_ipi),
    limite_credito: typeof rec.limite_credito === "number" ? rec.limite_credito : null,
    condicao_pagamento: trimOrNull(rec.condicao_pagamento),
    forma_pagamento: trimOrNull(rec.forma_pagamento),
    notes: trimOrNull(rec.observacoes),
    suframa: trimOrNull(rec.suframa),
  };
}

// ── Conflict detection ──────────────────────────────────────────────────────

const MERGE_FIELDS: { key: string; crmKey: string }[] = [
  { key: "name", crmKey: "name" },
  { key: "fantasia", crmKey: "fantasia" },
  { key: "email", crmKey: "email" },
  { key: "phone", crmKey: "phone" },
  { key: "address", crmKey: "address" },
  { key: "address_number", crmKey: "address_number" },
  { key: "address_complement", crmKey: "address_complement" },
  { key: "neighborhood", crmKey: "neighborhood" },
  { key: "city", crmKey: "city" },
  { key: "state", crmKey: "state" },
  { key: "zip_code", crmKey: "zip_code" },
  { key: "inscricao_estadual", crmKey: "inscricao_estadual" },
  { key: "inscricao_municipal", crmKey: "inscricao_municipal" },
  { key: "notes", crmKey: "notes" },
  { key: "suframa", crmKey: "suframa" },
  { key: "tipo_pessoa", crmKey: "tipo_pessoa" },
];

function detectConflicts(
  existing: Record<string, unknown>,
  normalized: NormalizedRecord
): { conflicts: ConflictEntry[]; fieldsToUpdate: Record<string, unknown> } {
  const conflicts: ConflictEntry[] = [];
  const fieldsToUpdate: Record<string, unknown> = {};

  for (const { key, crmKey } of MERGE_FIELDS) {
    const erpVal = (normalized as Record<string, unknown>)[key];
    const crmVal = existing[crmKey];

    if (erpVal === null || erpVal === undefined) continue; // ERP has no value, skip

    const crmStr = crmVal != null ? String(crmVal) : null;
    const erpStr = String(erpVal);

    if (crmStr === null || crmStr === "") {
      // Auto-resolve: CRM empty, ERP has value
      fieldsToUpdate[crmKey] = erpVal;
      conflicts.push({
        field: crmKey,
        crm_value: null,
        erp_value: erpStr,
        auto_resolved: true,
      });
    } else if (crmStr !== erpStr) {
      // Real conflict – don't overwrite, just log
      conflicts.push({
        field: crmKey,
        crm_value: crmStr,
        erp_value: erpStr,
        auto_resolved: false,
      });
    }
    // If equal, nothing to do
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

    // Process in batches
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);

      for (let j = 0; j < batch.length; j++) {
        const globalIdx = i + j;
        const raw = batch[j] as ERPRecord;

        try {
          const norm = normalize(raw);

          if (!norm.name) {
            summary.skipped++;
            summary.errors.push({
              index: globalIdx,
              erp_code: norm.erp_code,
              message: "Missing required field: nome",
            });
            continue;
          }

          // ── Lookup existing ───────────────────────────────────
          let existing: Record<string, unknown> | null = null;
          let matchedBy: string | null = null;

          // Priority 1: (tenant_id, cnpj)
          if (norm.cnpj) {
            const { data } = await supabase
              .from("companies")
              .select("*")
              .eq("tenant_id", tenant_id)
              .eq("cnpj", norm.cnpj)
              .maybeSingle();
            if (data) {
              existing = data;
              matchedBy = "cnpj";
            }
          }

          // Priority 2: (tenant_id, erp_code)
          if (!existing && norm.erp_code) {
            const { data } = await supabase
              .from("companies")
              .select("*")
              .eq("tenant_id", tenant_id)
              .eq("erp_code", norm.erp_code)
              .maybeSingle();
            if (data) {
              existing = data;
              matchedBy = "erp_code";
            }
          }

          if (existing) {
            // ── UPDATE path ─────────────────────────────────────
            const { conflicts, fieldsToUpdate } = detectConflicts(existing, norm);

            // Always update ERP sync metadata
            fieldsToUpdate.erp_code = norm.erp_code ?? existing.erp_code;
            fieldsToUpdate.erp_synced_at = new Date().toISOString();
            fieldsToUpdate.erp_registration_date =
              norm.erp_registration_date ?? existing.erp_registration_date;
            fieldsToUpdate.erp_last_update_date =
              norm.erp_last_update_date ?? existing.erp_last_update_date;

            // Update company
            if (Object.keys(fieldsToUpdate).length > 0) {
              const { error: updateErr } = await supabase
                .from("companies")
                .update(fieldsToUpdate)
                .eq("id", existing.id);
              if (updateErr) throw new Error(`Update failed: ${updateErr.message}`);
            }

            // Log conflicts
            if (conflicts.length > 0) {
              summary.conflicts_detected += conflicts.length;
              summary.conflicts_auto_resolved += conflicts.filter(
                (c) => c.auto_resolved
              ).length;

              for (const c of conflicts) {
                await supabase.from("import_conflict_log").insert({
                  tenant_id: tenant_id,
                  entity_type: "company",
                  entity_id: existing.id as string,
                  erp_code: norm.erp_code,
                  field_name: c.field,
                  crm_value: c.crm_value,
                  erp_value: c.erp_value,
                  auto_resolved: c.auto_resolved,
                  resolution: c.auto_resolved ? "auto_erp_fill" : "pending",
                });
              }
            }

            // Upsert fiscal
            await upsertFiscal(supabase, existing.id as string, tenant_id, norm);
            // Upsert financial
            await upsertFinancial(supabase, existing.id as string, tenant_id, norm);

            summary.updated++;
          } else {
            // ── INSERT path ─────────────────────────────────────
            const companyData = {
              tenant_id,
              name: norm.name,
              fantasia: norm.fantasia,
              cnpj: norm.cnpj,
              email: norm.email,
              phone: norm.phone,
              address: norm.address,
              address_number: norm.address_number,
              address_complement: norm.address_complement,
              neighborhood: norm.neighborhood,
              city: norm.city,
              state: norm.state,
              zip_code: norm.zip_code,
              inscricao_estadual: norm.inscricao_estadual,
              inscricao_municipal: norm.inscricao_municipal,
              tipo_pessoa: norm.tipo_pessoa,
              notes: norm.notes,
              suframa: norm.suframa,
              erp_code: norm.erp_code,
              erp_synced_at: new Date().toISOString(),
              erp_registration_date: norm.erp_registration_date,
              erp_last_update_date: norm.erp_last_update_date,
              contribuinte_icms: norm.contribuinte_icms,
              contribuinte_ipi: norm.contribuinte_ipi,
              origin: "erp_import",
              active: true,
            };

            const { data: inserted, error: insertErr } = await supabase
              .from("companies")
              .insert(companyData)
              .select("id")
              .single();

            if (insertErr) throw new Error(`Insert failed: ${insertErr.message}`);

            // Insert fiscal
            await upsertFiscal(supabase, inserted.id, tenant_id, norm);
            // Insert financial
            await upsertFinancial(supabase, inserted.id, tenant_id, norm);

            summary.inserted++;
          }

          summary.total_processed++;
        } catch (err) {
          summary.errors.push({
            index: globalIdx,
            erp_code: trimOrNull(raw.erp_code),
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
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ── Fiscal upsert ───────────────────────────────────────────────────────────

async function upsertFiscal(
  supabase: ReturnType<typeof createClient>,
  companyId: string,
  tenantId: string,
  norm: NormalizedRecord
) {
  const hasFiscalData =
    norm.regime_tributario ||
    norm.inscricao_estadual ||
    norm.inscricao_municipal ||
    norm.contribuinte_icms !== null ||
    norm.contribuinte_ipi !== null ||
    norm.suframa;

  if (!hasFiscalData) return;

  const fiscalData = {
    company_id: companyId,
    tenant_id: tenantId,
    regime_tributario: norm.regime_tributario,
    inscricao_estadual: norm.inscricao_estadual,
    inscricao_municipal: norm.inscricao_municipal,
    contribuinte_icms: norm.contribuinte_icms,
    contribuinte_ipi: norm.contribuinte_ipi,
    suframa: norm.suframa,
  };

  // Check if exists
  const { data: existing } = await supabase
    .from("company_erp_fiscal")
    .select("id")
    .eq("company_id", companyId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("company_erp_fiscal")
      .update(fiscalData)
      .eq("id", existing.id);
  } else {
    await supabase.from("company_erp_fiscal").insert(fiscalData);
  }
}

// ── Financial upsert ────────────────────────────────────────────────────────

async function upsertFinancial(
  supabase: ReturnType<typeof createClient>,
  companyId: string,
  tenantId: string,
  norm: NormalizedRecord
) {
  const hasFinancialData =
    norm.limite_credito !== null ||
    norm.condicao_pagamento ||
    norm.forma_pagamento;

  if (!hasFinancialData) return;

  const financialData = {
    company_id: companyId,
    tenant_id: tenantId,
    limite_credito: norm.limite_credito,
    condicao_pagamento: norm.condicao_pagamento,
    forma_pagamento: norm.forma_pagamento,
  };

  const { data: existing } = await supabase
    .from("company_erp_financial")
    .select("id")
    .eq("company_id", companyId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("company_erp_financial")
      .update(financialData)
      .eq("id", existing.id);
  } else {
    await supabase.from("company_erp_financial").insert(financialData);
  }
}
