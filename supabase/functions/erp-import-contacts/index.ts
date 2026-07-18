import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkAccessWindowForTenant, AccessWindowError, AccessCheckUnavailableError } from "../_shared/accessControl.ts";
import { envFlagEnabled, disabledIntegrationResponse } from "../_shared/integration-gates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Normalizers ─────────────────────────────────────────────────────────────

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

function normalizeBool(raw: unknown): boolean | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "boolean") return raw;
  const s = String(raw).trim().toUpperCase();
  if (["S", "SIM", "1", "TRUE", "Y", "YES"].includes(s)) return true;
  if (["N", "NAO", "NÃO", "0", "FALSE", "NO"].includes(s)) return false;
  return null;
}

function normalizeGender(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim().toUpperCase();
  if (["M", "MASCULINO", "MASC"].includes(s)) return "M";
  if (["F", "FEMININO", "FEM"].includes(s)) return "F";
  return "O";
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

// ── Name splitting ──────────────────────────────────────────────────────────
// Ajuste 2: Estratégia robusta para nomes brasileiros
// Primeira palavra → first_name
// Última palavra → last_name
// Palavras intermediárias (incluindo preposições) ficam em last_name
// Justificativa: Manter compatibilidade com schema existente (sem middle_name)
// e garantir que last_name contenha o sobrenome principal (último token),
// preservando partículas como "da", "de", "dos" no contexto correto.

function splitName(fullName: string): { first_name: string; last_name: string | null } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first_name: fullName.trim(), last_name: null };
  if (parts.length === 1) return { first_name: parts[0], last_name: null };
  
  const firstName = parts[0];
  const rest = parts.slice(1).join(" ");
  return { first_name: firstName, last_name: rest };
}

// ── Types ───────────────────────────────────────────────────────────────────

interface ERPContact {
  cd_empresa?: string;       // Código empresa no ERP
  sequencia_conta?: number;  // Sequência do contato
  pessoa_contato?: string;   // Nome completo
  cargo?: string;
  fone?: string;
  email?: string;
  celular?: string;
  ramal?: string;
  observacao?: string;
  dt_nascimento?: string;
  sexo?: string;
  setor?: string;
  tipo_pessoa?: string;
  tratamento?: string;
  home_page?: string;
  cd_pessoa_fisic?: string;
  superior?: number;
  im_foto?: string;
  validade_credenciamento?: string;
  data_atualizacao?: string;
  dt_modificacao?: string;
  relacionamento?: string;
  recebe_email_cobranca?: unknown;
  recebe_email_pgtos?: unknown;
  recebe_email?: unknown;
  participa?: unknown;
  notifica_venda?: unknown;
  [key: string]: unknown;
}

interface Summary {
  total_received: number;
  total_processed: number;
  inserted: number;
  updated: number;
  skipped: number;
  orphans_rejected: number;
  conflicts_detected: number;
  conflicts_auto_resolved: number;
  errors: { index: number; erp_code: string | null; message: string }[];
}

// ── Conflict detection for contacts ─────────────────────────────────────────

const MERGE_FIELDS = [
  { key: "email", crmKey: "email" },
  { key: "phone", crmKey: "phone" },
  { key: "mobile", crmKey: "mobile" },
  { key: "job_title", crmKey: "job_title" },
  { key: "department", crmKey: "department" },
  { key: "notes", crmKey: "notes" },
];

interface ConflictEntry {
  field: string;
  crm_value: string | null;
  erp_value: string | null;
  auto_resolved: boolean;
}

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

    if (!crmStr || crmStr === "") {
      fieldsToUpdate[crmKey] = erpVal;
      conflicts.push({ field: crmKey, crm_value: null, erp_value: erpStr, auto_resolved: true });
    } else if (crmStr !== erpStr) {
      conflicts.push({ field: crmKey, crm_value: crmStr, erp_value: erpStr, auto_resolved: false });
    }
  }

  // Name conflict: compare full reconstructed name
  const erpFirst = normalized.first_name as string | null;
  const erpLast = normalized.last_name as string | null;
  const erpFull = [erpFirst, erpLast].filter(Boolean).join(" ").toLowerCase();
  const crmFull = [existing.first_name, existing.last_name].filter(Boolean).join(" ").toLowerCase();
  
  if (erpFull && crmFull && erpFull !== crmFull) {
    conflicts.push({
      field: "name",
      crm_value: [existing.first_name, existing.last_name].filter(Boolean).join(" "),
      erp_value: [erpFirst, erpLast].filter(Boolean).join(" "),
      auto_resolved: false,
    });
  } else if (erpFull && !crmFull) {
    fieldsToUpdate.first_name = erpFirst;
    fieldsToUpdate.last_name = erpLast;
  }

  return { conflicts, fieldsToUpdate };
}

// ── Main handler ────────────────────────────────────────────────────────────

const BATCH_SIZE = 100;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!envFlagEnabled("ERP_INTEGRATION_ENABLED", false)) {
    return disabledIntegrationResponse("ERP", corsHeaders);
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
        JSON.stringify({ success: false, error: "records array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // ⏰ Janela de acesso por tenant (strict)
    try {
      await checkAccessWindowForTenant(supabase, tenant_id, {
        mode: "strict",
        context: "erp-import-contacts",
      });
    } catch (winErr) {
      if (winErr instanceof AccessWindowError || winErr instanceof AccessCheckUnavailableError) {
        return new Response(
          JSON.stringify({ success: false, error: winErr.message, code: (winErr as any).code }),
          { status: (winErr as any).status ?? 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw winErr;
    }

    const summary: Summary = {
      total_received: records.length,
      total_processed: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      orphans_rejected: 0,
      conflicts_detected: 0,
      conflicts_auto_resolved: 0,
      errors: [],
    };

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);

      for (let j = 0; j < batch.length; j++) {
        const globalIdx = i + j;
        const raw = batch[j] as ERPContact;

        try {
          const fullName = trimOrNull(raw.pessoa_contato);
          if (!fullName) {
            summary.skipped++;
            summary.errors.push({ index: globalIdx, erp_code: trimOrNull(raw.cd_empresa), message: "Missing pessoa_contato" });
            continue;
          }

          const cdEmpresa = trimOrNull(raw.cd_empresa);
          const erpContactCode = cdEmpresa && raw.sequencia_conta != null
            ? `${cdEmpresa}-${raw.sequencia_conta}`
            : null;

          // ── Ajuste 3: Resolver company_id — rejeitar órfãos ──
          let companyId: string | null = null;
          if (cdEmpresa) {
            const { data: company } = await supabase
              .from("companies")
              .select("id")
              .eq("tenant_id", tenant_id)
              .eq("erp_code", cdEmpresa)
              .maybeSingle();
            companyId = company?.id ?? null;
          }

          if (!companyId) {
            // Ajuste 3: Não inserir contato órfão — registrar no import_conflict_log
            summary.orphans_rejected++;
            await supabase.from("import_conflict_log").insert({
              tenant_id,
              entity_type: "contact",
              entity_id: null,
              erp_code: erpContactCode,
              field_name: "company_id",
              crm_value: null,
              erp_value: cdEmpresa,
              auto_resolved: false,
              resolution: "orphan_rejected",
            });
            summary.errors.push({
              index: globalIdx,
              erp_code: erpContactCode,
              message: `Company not found for cd_empresa=${cdEmpresa}. Contact rejected (no orphans).`,
            });
            continue;
          }

          // ── Normalize contact fields ──
          const { first_name, last_name } = splitName(fullName);
          const email = trimOrNull(raw.email);
          const phone = trimOrNull(raw.fone);
          const mobile = trimOrNull(raw.celular);
          const jobTitle = trimOrNull(raw.cargo);
          const department = trimOrNull(raw.setor);
          const notes = trimOrNull(raw.observacao);
          const birthDate = normalizeDate(raw.dt_nascimento);
          const gender = normalizeGender(raw.sexo);
          const tipoPessoa = normalizeTipoPessoa(raw.tipo_pessoa) as "PF" | "PJ" | null;
          const phoneExtension = trimOrNull(raw.ramal);

          const normalizedForMerge: Record<string, unknown> = {
            first_name, last_name, email, phone, mobile,
            job_title: jobTitle, department, notes,
          };

          // ── Lookup existing contact ──
          let existing: Record<string, unknown> | null = null;

          // Priority 1: (tenant_id, company_id, email) — if email exists
          if (email) {
            const { data } = await supabase
              .from("contacts")
              .select("*")
              .eq("tenant_id", tenant_id)
              .eq("company_id", companyId)
              .eq("email", email)
              .maybeSingle();
            if (data) existing = data;
          }

          // Priority 2: (tenant_id, erp_contact_code)
          if (!existing && erpContactCode) {
            const { data } = await supabase
              .from("contacts")
              .select("*")
              .eq("tenant_id", tenant_id)
              .eq("erp_contact_code", erpContactCode)
              .maybeSingle();
            if (data) existing = data;
          }

          if (existing) {
            // ── UPDATE path ──
            const { conflicts, fieldsToUpdate } = detectConflicts(existing, normalizedForMerge);

            // Always update ERP metadata
            fieldsToUpdate.erp_contact_code = erpContactCode ?? existing.erp_contact_code;
            fieldsToUpdate.erp_synced_at = new Date().toISOString();
            fieldsToUpdate.erp_last_update_date = normalizeDate(raw.data_atualizacao) ?? existing.erp_last_update_date;

            // Update optional fields if CRM is empty
            if (!existing.birth_date && birthDate) fieldsToUpdate.birth_date = birthDate;
            if (!existing.gender && gender) fieldsToUpdate.gender = gender;
            if (!existing.tipo_pessoa && tipoPessoa) fieldsToUpdate.tipo_pessoa = tipoPessoa;
            if (!existing.phone_extension && phoneExtension) fieldsToUpdate.phone_extension = phoneExtension;

            if (Object.keys(fieldsToUpdate).length > 0) {
              const { error } = await supabase
                .from("contacts")
                .update(fieldsToUpdate)
                .eq("id", existing.id);
              if (error) throw new Error(`Update contact failed: ${error.message}`);
            }

            // Log conflicts
            if (conflicts.length > 0) {
              summary.conflicts_detected += conflicts.length;
              summary.conflicts_auto_resolved += conflicts.filter(c => c.auto_resolved).length;
              for (const c of conflicts) {
                await supabase.from("import_conflict_log").insert({
                  tenant_id,
                  entity_type: "contact",
                  entity_id: existing.id as string,
                  erp_code: erpContactCode,
                  field_name: c.field,
                  crm_value: c.crm_value,
                  erp_value: c.erp_value,
                  auto_resolved: c.auto_resolved,
                  resolution: c.auto_resolved ? "auto_erp_fill" : "pending",
                });
              }
            }

            // Upsert ERP data
            await upsertContactErpData(supabase, existing.id as string, tenant_id, raw);

            summary.updated++;
          } else {
            // ── INSERT path ──
            const contactData: Record<string, unknown> = {
              tenant_id,
              company_id: companyId,
              first_name,
              last_name,
              email,
              phone,
              mobile,
              job_title: jobTitle,
              department,
              notes,
              birth_date: birthDate,
              gender,
              tipo_pessoa: tipoPessoa,
              phone_extension: phoneExtension,
              erp_contact_code: erpContactCode,
              erp_synced_at: new Date().toISOString(),
              erp_last_update_date: normalizeDate(raw.data_atualizacao),
              origin: "erp_import",
            };

            // Handle partial unique constraint violation gracefully
            const { data: inserted, error: insertErr } = await supabase
              .from("contacts")
              .insert(contactData)
              .select("id")
              .single();

            if (insertErr) {
              // Ajuste 4: If unique violation on (tenant_id, company_id, email), treat as duplicate
              if (insertErr.message?.includes("idx_contacts_tenant_company_email_unique")) {
                summary.skipped++;
                summary.errors.push({
                  index: globalIdx,
                  erp_code: erpContactCode,
                  message: `Duplicate: contact with same email already exists for this company`,
                });
                continue;
              }
              throw new Error(`Insert contact failed: ${insertErr.message}`);
            }

            // Insert ERP data
            await upsertContactErpData(supabase, inserted.id, tenant_id, raw);

            summary.inserted++;
          }

          summary.total_processed++;
        } catch (err) {
          summary.errors.push({
            index: globalIdx,
            erp_code: trimOrNull(raw.cd_empresa),
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

// ── Upsert contact_erp_data ─────────────────────────────────────────────────

async function upsertContactErpData(
  supabase: ReturnType<typeof createClient>,
  contactId: string,
  tenantId: string,
  raw: ERPContact
) {
  const erpData: Record<string, unknown> = {
    contact_id: contactId,
    tenant_id: tenantId,
    erp_sequence: raw.sequencia_conta ?? null,
    person_code: trimOrNull(raw.cd_pessoa_fisic),
    superior_seq: raw.superior ?? null,
    treatment: trimOrNull(raw.tratamento),
    homepage: trimOrNull(raw.home_page),
    photo_path: trimOrNull(raw.im_foto),
    relationship_code: trimOrNull(raw.relacionamento),
    credential_expiry: normalizeDate(raw.validade_credenciamento),
    receives_billing_email: normalizeBool(raw.recebe_email_cobranca) ?? false,
    receives_payment_email: normalizeBool(raw.recebe_email_pgtos) ?? false,
    receives_email: normalizeBool(raw.recebe_email) ?? false,
    notify_sale: normalizeBool(raw.notifica_venda) ?? false,
    participates: normalizeBool(raw.participa) ?? false,
    erp_notes: trimOrNull(raw.observacao),
    erp_modified_at: normalizeDate(raw.dt_modificacao),
    erp_updated_at: normalizeDate(raw.data_atualizacao),
  };

  // Collect extra fields not mapped above
  const knownKeys = new Set([
    "cd_empresa", "sequencia_conta", "pessoa_contato", "cargo", "fone", "email",
    "celular", "ramal", "observacao", "dt_nascimento", "sexo", "setor",
    "tipo_pessoa", "tratamento", "home_page", "cd_pessoa_fisic", "superior",
    "im_foto", "validade_credenciamento", "data_atualizacao", "dt_modificacao",
    "relacionamento", "recebe_email_cobranca", "recebe_email_pgtos",
    "recebe_email", "participa", "notifica_venda",
  ]);
  const extra: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!knownKeys.has(k) && v !== null && v !== undefined && v !== "") {
      extra[k] = v;
    }
  }
  if (Object.keys(extra).length > 0) erpData.extra_data = extra;

  const { data: existing } = await supabase
    .from("contact_erp_data")
    .select("id")
    .eq("contact_id", contactId)
    .maybeSingle();

  if (existing) {
    await supabase.from("contact_erp_data").update(erpData).eq("id", existing.id);
  } else {
    await supabase.from("contact_erp_data").insert(erpData);
  }
}
