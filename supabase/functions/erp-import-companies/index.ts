/**
 * Edge Function: erp-import-companies
 * FASE 3 — ETL Inicial: Importação de empresas do ERP para o CRM normalizado
 * 
 * Fluxo:
 * 1. Busca clientes do ERP (API Iniflex/CIGAM)
 * 2. Normaliza dados (CNPJ, CEP, datas, booleanos)
 * 3. Merge composto: (tenant_id, cnpj) ou (tenant_id, erp_code) como fallback
 * 4. Popula companies + company_erp_fiscal + company_erp_financial
 * 5. Registra conflitos em import_conflict_log
 * 6. Processa em batches de 100
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const DEFAULT_SYNC_DATE = '01/01/2000 00:00:00';
const BATCH_SIZE = 100;

interface ImportRequest {
  baseUrl: string;
  token: string;
  tenant_id: string;
  dry_run?: boolean; // If true, only validate without writing
}

interface ImportStats {
  total_received: number;
  created: number;
  updated: number;
  skipped: number;
  conflicts: number;
  errors: number;
  error_details: string[];
}

// ==================== NORMALIZATION HELPERS ====================

function normalizeCnpj(value: unknown): string | null {
  if (!value) return null;
  const digits = String(value).replace(/\D/g, '');
  if (digits.length === 0) return null;
  // Pad CNPJ to 14 digits, CPF to 11
  if (digits.length <= 11) return digits.padStart(11, '0');
  return digits.padStart(14, '0');
}

function normalizeCep(value: unknown): string | null {
  if (!value) return null;
  const digits = String(value).replace(/\D/g, '');
  if (digits.length === 0) return null;
  return digits.padStart(8, '0');
}

function normalizeDate(value: unknown): string | null {
  if (!value) return null;
  const str = String(value).trim();
  if (str === '' || str === '0' || str === 'null') return null;
  
  // Try DD/MM/YYYY format
  const brMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (brMatch) {
    const [, day, month, year] = brMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // Try ISO format
  const isoMatch = str.match(/^\d{4}-\d{2}-\d{2}/);
  if (isoMatch) return isoMatch[0];
  
  return null;
}

function normalizeDatetime(value: unknown): string | null {
  if (!value) return null;
  const str = String(value).trim();
  if (str === '' || str === '0' || str === 'null') return null;

  // DD/MM/YYYY HH:MI:SS
  const brMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (brMatch) {
    const [, day, month, year, h, m, s] = brMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${h}:${m}:${s}Z`;
  }

  // ISO
  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d.toISOString();
  } catch { /* ignore */ }

  return null;
}

function snToBoolean(value: unknown): boolean {
  return value === 'S' || value === 's' || value === true || value === 'true';
}

function toStringOrNull(value: unknown): string | null {
  if (value === null || value === undefined || value === '' || value === 'null') return null;
  return String(value).trim();
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return isNaN(n) ? null : n;
}

function extractEmails(value: unknown): string | null {
  if (!value || typeof value !== 'string') return null;
  const emails = value.split(';').map(e => e.trim()).filter(e => e.includes('@'));
  return emails[0] || null;
}

// ==================== MAPPER: ERP RAW -> NORMALIZED ====================

interface NormalizedCompany {
  // companies table
  name: string;
  fantasia: string | null;
  cnpj: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  address_number: string | null;
  address_complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  country: string;
  inscricao_estadual: string | null;
  inscricao_municipal: string | null;
  contribuinte_icms: boolean;
  contribuinte_ipi: boolean;
  tipo_pessoa: string | null;
  contact_name: string | null;
  erp_code: string;
  erp_registration_date: string | null;
  erp_last_update_date: string | null;
  erp_last_movement_date: string | null;
  erp_synced_at: string;
  origin: string;
  active: boolean;
  notes: string | null;
  custom_fields: Record<string, unknown>;
  // fiscal
  fiscal: {
    regime_tributario: string | null;
    contribuinte_icms: boolean;
    contribuinte_ipi: boolean;
    inscricao_estadual: string | null;
    inscricao_municipal: string | null;
    suframa: string | null;
    destino_mercadoria: string | null;
    erp_fiscal_data: Record<string, unknown>;
  };
  // financial
  financial: {
    possui_titulos_abertos: boolean;
    possui_titulos_vencidos: boolean;
    erp_financial_data: Record<string, unknown>;
  };
}

function mapErpToNormalized(raw: Record<string, unknown>, erpCode: string): NormalizedCompany {
  const cnpj = normalizeCnpj(raw.cnpj_cpf);
  const nome = toStringOrNull(raw.nome) || toStringOrNull(raw.razao_social) || `ERP-${erpCode}`;
  const fantasia = toStringOrNull(raw.nome_fantasia) || toStringOrNull(raw.fantasia);

  return {
    name: nome,
    fantasia,
    cnpj,
    email: extractEmails(raw.se_mail) || toStringOrNull(raw.email),
    phone: toStringOrNull(raw.fone) || toStringOrNull(raw.telefone),
    address: toStringOrNull(raw.loc_endereco) || toStringOrNull(raw.endereco),
    address_number: toStringOrNull(raw.loc_numero),
    address_complement: toStringOrNull(raw.loc_complemento),
    neighborhood: toStringOrNull(raw.loc_bairro),
    city: toStringOrNull(raw.loc_cidade) || toStringOrNull(raw.cidade),
    state: toStringOrNull(raw.loc_uf) || toStringOrNull(raw.uf),
    zip_code: normalizeCep(raw.loc_cep || raw.cep),
    country: 'Brasil',
    inscricao_estadual: toStringOrNull(raw.insc_estadual),
    inscricao_municipal: toStringOrNull(raw.insc_municipal),
    contribuinte_icms: snToBoolean(raw.contribui_icms),
    contribuinte_ipi: snToBoolean(raw.contribui_ipi),
    tipo_pessoa: toStringOrNull(raw.tipo_pessoa) || (cnpj && cnpj.length === 14 ? 'PJ' : 'PF'),
    contact_name: toStringOrNull(raw.contato) || toStringOrNull(raw.nome_contato),
    erp_code: erpCode,
    erp_registration_date: normalizeDate(raw.data_cadastro || raw.data_inclusao),
    erp_last_update_date: normalizeDatetime(raw.data_alteracao),
    erp_last_movement_date: normalizeDate(raw.data_ultimo_movimento),
    erp_synced_at: new Date().toISOString(),
    origin: 'erp',
    active: true,
    notes: toStringOrNull(raw.obs_geral),
    custom_fields: {
      segmento: toStringOrNull(raw.desc_segmento_mercado),
      subsegmento: toStringOrNull(raw.desc_subsegmentomerc_descricao),
      regiao: toStringOrNull(raw.desc_regiao),
      subregiao: toStringOrNull(raw.desc_subregiao),
    },
    fiscal: {
      regime_tributario: toStringOrNull(raw.regime_tributario),
      contribuinte_icms: snToBoolean(raw.contribui_icms),
      contribuinte_ipi: snToBoolean(raw.contribui_ipi),
      inscricao_estadual: toStringOrNull(raw.insc_estadual),
      inscricao_municipal: toStringOrNull(raw.insc_municipal),
      suframa: toStringOrNull(raw.suframa),
      destino_mercadoria: toStringOrNull(raw.destino_mercadoria),
      erp_fiscal_data: {
        tipo_cliente: toStringOrNull(raw.tipo_cliente),
        tipo_fornecedor: toStringOrNull(raw.tipo_fornecedor),
        tipo_transportador: toStringOrNull(raw.tipo_transportador),
        tributacao_ir: toStringOrNull(raw.tributacao_ir),
        segmento_mercado: toNumberOrNull(raw.segmento_mercado),
        subsegmento_mercado: toNumberOrNull(raw.subsegmento_mercado),
      },
    },
    financial: {
      possui_titulos_abertos: snToBoolean(raw.possui_titulos),
      possui_titulos_vencidos: false,
      erp_financial_data: {
        banco_padrao: toNumberOrNull(raw.banco_padrao),
        limite_credito: toNumberOrNull(raw.limite_credito),
        tipo_representante: toStringOrNull(raw.tipo_representante),
      },
    },
  };
}

// ==================== MERGE LOGIC ====================

async function findExistingCompany(
  supabase: SupabaseClient,
  tenantId: string,
  cnpj: string | null,
  erpCode: string
): Promise<{ id: string; source: 'cnpj' | 'erp_code' } | null> {
  // Primary: match by CNPJ
  if (cnpj && cnpj.length >= 11) {
    const { data } = await supabase
      .from('companies')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('cnpj', cnpj)
      .maybeSingle();
    
    if (data) return { id: data.id, source: 'cnpj' };
  }

  // Fallback: match by erp_code
  const { data } = await supabase
    .from('companies')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('erp_code', erpCode)
    .maybeSingle();
  
  if (data) return { id: data.id, source: 'erp_code' };

  return null;
}

async function logConflict(
  supabase: SupabaseClient,
  tenantId: string,
  entityId: string | null,
  erpCode: string,
  fieldName: string,
  crmValue: string | null,
  erpValue: string | null
) {
  await supabase.from('import_conflict_log').insert({
    tenant_id: tenantId,
    entity_type: 'company',
    entity_id: entityId,
    erp_code: erpCode,
    field_name: fieldName,
    crm_value: crmValue,
    erp_value: erpValue,
    resolution: 'pending',
  });
}

// Fields that should log conflicts when different (CRM has user-edited data)
const CONFLICT_FIELDS = ['name', 'email', 'phone', 'address', 'city', 'state', 'notes'];

async function detectConflicts(
  supabase: SupabaseClient,
  tenantId: string,
  existingId: string,
  normalized: NormalizedCompany
): Promise<number> {
  const { data: existing } = await supabase
    .from('companies')
    .select('*')
    .eq('id', existingId)
    .single();

  if (!existing) return 0;

  let conflicts = 0;
  for (const field of CONFLICT_FIELDS) {
    const crmVal = toStringOrNull((existing as Record<string, unknown>)[field]);
    const erpVal = toStringOrNull((normalized as unknown as Record<string, unknown>)[field]);
    
    // Only log if both have values and they differ
    if (crmVal && erpVal && crmVal !== erpVal) {
      await logConflict(supabase, tenantId, existingId, normalized.erp_code, field, crmVal, erpVal);
      conflicts++;
    }
  }

  return conflicts;
}

// ==================== BATCH PROCESSOR ====================

async function processCompany(
  supabase: SupabaseClient,
  tenantId: string,
  normalized: NormalizedCompany,
  stats: ImportStats
): Promise<void> {
  try {
    const existing = await findExistingCompany(supabase, tenantId, normalized.cnpj, normalized.erp_code);

    if (existing) {
      // UPDATE existing — detect conflicts first
      const conflictCount = await detectConflicts(supabase, tenantId, existing.id, normalized);
      stats.conflicts += conflictCount;

      // Update company with ERP data (ERP wins on ERP-specific fields, CRM wins on user-edited fields)
      const { error: updateError } = await supabase
        .from('companies')
        .update({
          // ERP-specific fields always update
          erp_code: normalized.erp_code,
          erp_last_update_date: normalized.erp_last_update_date,
          erp_last_movement_date: normalized.erp_last_movement_date,
          erp_synced_at: normalized.erp_synced_at,
          erp_registration_date: normalized.erp_registration_date,
          tipo_pessoa: normalized.tipo_pessoa,
          contribuinte_icms: normalized.contribuinte_icms,
          contribuinte_ipi: normalized.contribuinte_ipi,
          inscricao_estadual: normalized.inscricao_estadual,
          inscricao_municipal: normalized.inscricao_municipal,
          // Address fields from ERP (fill if empty in CRM)
          address: normalized.address,
          address_number: normalized.address_number,
          address_complement: normalized.address_complement,
          neighborhood: normalized.neighborhood,
          zip_code: normalized.zip_code,
          city: normalized.city,
          state: normalized.state,
          contact_name: normalized.contact_name,
          origin: 'erp',
        })
        .eq('id', existing.id);

      if (updateError) {
        stats.errors++;
        stats.error_details.push(`Update ${normalized.erp_code}: ${updateError.message}`);
        return;
      }

      // Upsert fiscal data
      await supabase.from('company_erp_fiscal').upsert({
        tenant_id: tenantId,
        company_id: existing.id,
        ...normalized.fiscal,
      }, { onConflict: 'tenant_id,company_id' });

      // Upsert financial data
      await supabase.from('company_erp_financial').upsert({
        tenant_id: tenantId,
        company_id: existing.id,
        ...normalized.financial,
      }, { onConflict: 'tenant_id,company_id' });

      stats.updated++;
    } else {
      // INSERT new company
      const { data: newCompany, error: insertError } = await supabase
        .from('companies')
        .insert({
          tenant_id: tenantId,
          name: normalized.name,
          fantasia: normalized.fantasia,
          cnpj: normalized.cnpj,
          email: normalized.email,
          phone: normalized.phone,
          address: normalized.address,
          address_number: normalized.address_number,
          address_complement: normalized.address_complement,
          neighborhood: normalized.neighborhood,
          city: normalized.city,
          state: normalized.state,
          zip_code: normalized.zip_code,
          country: normalized.country,
          inscricao_estadual: normalized.inscricao_estadual,
          inscricao_municipal: normalized.inscricao_municipal,
          contribuinte_icms: normalized.contribuinte_icms,
          contribuinte_ipi: normalized.contribuinte_ipi,
          tipo_pessoa: normalized.tipo_pessoa,
          contact_name: normalized.contact_name,
          erp_code: normalized.erp_code,
          erp_registration_date: normalized.erp_registration_date,
          erp_last_update_date: normalized.erp_last_update_date,
          erp_last_movement_date: normalized.erp_last_movement_date,
          erp_synced_at: normalized.erp_synced_at,
          origin: normalized.origin,
          active: normalized.active,
          notes: normalized.notes,
          custom_fields: normalized.custom_fields,
        })
        .select('id')
        .single();

      if (insertError) {
        stats.errors++;
        stats.error_details.push(`Insert ${normalized.erp_code}: ${insertError.message}`);
        return;
      }

      if (newCompany) {
        // Insert fiscal data
        await supabase.from('company_erp_fiscal').insert({
          tenant_id: tenantId,
          company_id: newCompany.id,
          ...normalized.fiscal,
        });

        // Insert financial data
        await supabase.from('company_erp_financial').insert({
          tenant_id: tenantId,
          company_id: newCompany.id,
          ...normalized.financial,
        });
      }

      stats.created++;
    }
  } catch (err) {
    stats.errors++;
    stats.error_details.push(`${normalized.erp_code}: ${err instanceof Error ? err.message : 'Unknown'}`);
  }
}

// ==================== MAIN ====================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const body = await req.json() as ImportRequest;
    const { baseUrl, token, tenant_id, dry_run } = body;

    // Validate
    if (!baseUrl?.trim() || !token?.trim()) {
      return errorResponse(400, 'baseUrl e token são obrigatórios');
    }
    if (!tenant_id?.trim()) {
      return errorResponse(400, 'tenant_id é obrigatório');
    }

    // Verify tenant exists
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('id', tenant_id)
      .single();

    if (!tenant) {
      return errorResponse(404, 'Tenant não encontrado');
    }

    console.log(`[erp-import] Iniciando importação para tenant: ${tenant_id}`);

    // Get last sync date
    const { data: syncControl } = await supabase
      .from('erp_sync_control')
      .select('last_sync_at')
      .eq('entity', 'import_companies')
      .maybeSingle();

    let lastSyncAt = DEFAULT_SYNC_DATE;
    if (syncControl?.last_sync_at) {
      const d = new Date(syncControl.last_sync_at);
      lastSyncAt = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
    }

    console.log('[erp-import] data_alteracao:', lastSyncAt);

    // Call ERP API
    const apiUrl = baseUrl.replace(/\/+$/, '');
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token.trim()}`,
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        tipoComando: 'ASDCOMANDO',
        grupoComando: 'EXP_CLIENTES_V1',
        data_alteracao: lastSyncAt,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[erp-import] Erro HTTP:', response.status, errorText.substring(0, 300));
      return errorResponse(500, `Erro HTTP ${response.status}: ${errorText.substring(0, 200)}`);
    }

    const responseData = await response.json();

    // Extract clients array
    let clients: unknown[] = [];
    if (Array.isArray(responseData)) {
      clients = responseData;
    } else if (responseData?.data && Array.isArray(responseData.data)) {
      clients = responseData.data;
    } else if (responseData?.clientes && Array.isArray(responseData.clientes)) {
      clients = responseData.clientes;
    }

    console.log('[erp-import] registros recebidos:', clients.length);

    if (clients.length === 0) {
      return jsonResponse({
        success: true,
        message: 'Nenhum registro novo ou alterado encontrado no ERP',
        stats: { total_received: 0, created: 0, updated: 0, skipped: 0, conflicts: 0, errors: 0 },
      });
    }

    // Initialize stats
    const stats: ImportStats = {
      total_received: clients.length,
      created: 0,
      updated: 0,
      skipped: 0,
      conflicts: 0,
      errors: 0,
      error_details: [],
    };

    // Process in batches
    for (let i = 0; i < clients.length; i += BATCH_SIZE) {
      const batch = clients.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(clients.length / BATCH_SIZE);
      console.log(`[erp-import] Processando batch ${batchNum}/${totalBatches} (${batch.length} registros)`);

      for (const rawClient of batch) {
        const raw = rawClient as Record<string, unknown>;
        const erpCode = String(raw.codigo_erp || raw.codigo || raw.id || '');

        if (!erpCode || erpCode === '' || erpCode === 'undefined') {
          stats.skipped++;
          continue;
        }

        const normalized = mapErpToNormalized(raw, erpCode);

        if (dry_run) {
          // In dry run, just count what would happen
          const existing = await findExistingCompany(supabase, tenant_id, normalized.cnpj, erpCode);
          if (existing) {
            stats.updated++;
          } else {
            stats.created++;
          }
          continue;
        }

        await processCompany(supabase, tenant_id, normalized, stats);
      }
    }

    // Update sync control
    if (!dry_run && stats.created + stats.updated > 0) {
      await supabase.from('erp_sync_control').upsert({
        entity: 'import_companies',
        last_sync_at: new Date().toISOString(),
        last_sync_count: stats.total_received,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'entity' });
    }

    console.log(`[erp-import] Finalizado: ${JSON.stringify(stats)}`);

    // Final validation
    const { data: countData } = await supabase
      .from('companies')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenant_id);

    const { count: fiscalCount } = await supabase
      .from('company_erp_fiscal')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenant_id);

    const { count: financialCount } = await supabase
      .from('company_erp_financial')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenant_id);

    const { count: conflictCount } = await supabase
      .from('import_conflict_log')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenant_id);

    return jsonResponse({
      success: true,
      dry_run: dry_run || false,
      stats: {
        total_received: stats.total_received,
        created: stats.created,
        updated: stats.updated,
        skipped: stats.skipped,
        conflicts: stats.conflicts,
        errors: stats.errors,
        error_details: stats.error_details.slice(0, 20), // Limit error details
      },
      validation: {
        total_companies_in_tenant: countData?.length ?? 0,
        total_erp_fiscal: fiscalCount ?? 0,
        total_erp_financial: financialCount ?? 0,
        total_conflict_logs: conflictCount ?? 0,
      },
    });

  } catch (error) {
    console.error('[erp-import] Erro geral:', error);
    return errorResponse(500, error instanceof Error ? error.message : 'Erro desconhecido');
  }
});

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function errorResponse(status: number, message: string): Response {
  return jsonResponse({ success: false, error: message }, status);
}
