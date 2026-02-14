import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Data padrão para primeira carga
const DEFAULT_SYNC_DATE = '01/01/2000 00:00:00';

interface SyncRequest {
  baseUrl: string;
  token: string;
  tenant_id?: string;
}

interface CRMClient {
  external_id: string;
  tipo_pessoa: string | null;
  cnpj_cpf: string | null;
  rg: string | null;
  razao_social: string | null;
  nome_fantasia: string | null;
  telefone: string | null;
  celular: string | null;
  emails: string[];
  tipo_cliente: string | null;
  tipo_fornecedor: string | null;
  tipo_transportador: string | null;
  tipo_representante: string | null;
  segmento: string | null;
  subsegmento: string | null;
  regiao: string | null;
  subregiao: string | null;
  contribui_icms: boolean;
  possui_titulos: boolean;
  insc_estadual: string | null;
  destino_mercadoria: string | null;
  data_alteracao_erp: string | null;
  usuario_alteracao_erp: string | null;
  raw_data: unknown;
  synced_at: string;
}

interface ClientAddress {
  client_id: string;
  tipo: 'LOCAL' | 'ENTREGA' | 'COBRANCA';
  endereco: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cep: string | null;
  codigo_cidade: string | null;
  cidade: string | null;
  uf: string | null;
}

// ── Normalizers ──────────────────────────────────────────────────────────────

function normalizeCnpj(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, '');
  return digits.length === 14 ? digits : digits.length === 11 ? digits : null;
}

function normalizeCep(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, '');
  return digits.length === 8 ? digits : null;
}

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
  if (typeof raw === 'boolean') return raw;
  const s = String(raw).trim().toUpperCase();
  if (['S', 'SIM', '1', 'TRUE', 'Y', 'YES'].includes(s)) return true;
  if (['N', 'NAO', 'NÃO', '0', 'FALSE', 'NO'].includes(s)) return false;
  return null;
}

function trimOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

// Extrai emails de uma string separada por ;
function extractEmails(emailStr: unknown): string[] {
  if (!emailStr || typeof emailStr !== 'string') return [];
  return emailStr.split(';').map(e => e.trim()).filter(e => e.length > 0 && e.includes('@'));
}

// Converte S/N para boolean
function snToBoolean(value: unknown): boolean {
  return value === 'S' || value === 's';
}

// Converte qualquer valor para string ou null
function toStringOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

// ── Mappers ──────────────────────────────────────────────────────────────────

function mapInflexClientToCRM(raw: unknown): CRMClient {
  const c = raw as Record<string, unknown>;
  return {
    external_id: String(c.codigo_erp || c.codigo || c.id || ''),
    tipo_pessoa: toStringOrNull(c.tipo_pessoa),
    cnpj_cpf: toStringOrNull(c.cnpj_cpf),
    rg: toStringOrNull(c.rg),
    razao_social: toStringOrNull(c.nome),
    nome_fantasia: toStringOrNull(c.nome_fantasia),
    telefone: toStringOrNull(c.fone),
    celular: toStringOrNull(c.celular),
    emails: extractEmails(c.se_mail),
    tipo_cliente: toStringOrNull(c.tipo_cliente),
    tipo_fornecedor: toStringOrNull(c.tipo_fornecedor),
    tipo_transportador: toStringOrNull(c.tipo_transportador),
    tipo_representante: toStringOrNull(c.tipo_representante),
    segmento: toStringOrNull(c.desc_segmento_mercado),
    subsegmento: toStringOrNull(c.desc_subsegmentomerc_descricao),
    regiao: toStringOrNull(c.desc_regiao),
    subregiao: toStringOrNull(c.desc_subregiao),
    contribui_icms: snToBoolean(c.contribui_icms),
    possui_titulos: snToBoolean(c.possui_titulos),
    insc_estadual: toStringOrNull(c.insc_estadual),
    destino_mercadoria: toStringOrNull(c.destino_mercadoria),
    data_alteracao_erp: toStringOrNull(c.data_alteracao),
    usuario_alteracao_erp: toStringOrNull(c.usuario_alteracao),
    raw_data: c,
    synced_at: new Date().toISOString(),
  };
}

function extractAddresses(raw: Record<string, unknown>): Array<Omit<ClientAddress, 'client_id'>> {
  const addresses: Array<Omit<ClientAddress, 'client_id'>> = [];
  const prefixes: { key: string; tipo: 'LOCAL' | 'ENTREGA' | 'COBRANCA' }[] = [
    { key: 'loc_', tipo: 'LOCAL' },
    { key: 'ent_', tipo: 'ENTREGA' },
    { key: 'cob_', tipo: 'COBRANCA' },
  ];
  for (const { key, tipo } of prefixes) {
    if (raw[`${key}endereco`] || raw[`${key}cidade`]) {
      addresses.push({
        tipo,
        endereco: toStringOrNull(raw[`${key}endereco`]),
        numero: toStringOrNull(raw[`${key}numero`]),
        complemento: toStringOrNull(raw[`${key}complemento`]),
        bairro: toStringOrNull(raw[`${key}bairro`]),
        cep: toStringOrNull(raw[`${key}cep`]),
        codigo_cidade: toStringOrNull(raw[`${key}codigo_cidade`]),
        cidade: toStringOrNull(raw[`${key}cidade`]),
        uf: toStringOrNull(raw[`${key}uf`]),
      });
    }
  }
  return addresses;
}

// ── Conflict detection for companies merge ───────────────────────────────────

const MERGE_FIELDS = [
  { key: 'name', crmKey: 'name' },
  { key: 'fantasia', crmKey: 'fantasia' },
  { key: 'email', crmKey: 'email' },
  { key: 'phone', crmKey: 'phone' },
  { key: 'address', crmKey: 'address' },
  { key: 'city', crmKey: 'city' },
  { key: 'state', crmKey: 'state' },
  { key: 'zip_code', crmKey: 'zip_code' },
  { key: 'inscricao_estadual', crmKey: 'inscricao_estadual' },
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
    if (crmStr === null || crmStr === '') {
      fieldsToUpdate[crmKey] = erpVal;
      conflicts.push({ field: crmKey, crm_value: null, erp_value: erpStr, auto_resolved: true });
    } else if (crmStr !== erpStr) {
      conflicts.push({ field: crmKey, crm_value: crmStr, erp_value: erpStr, auto_resolved: false });
    }
  }
  return { conflicts, fieldsToUpdate };
}

// ── Date helpers ─────────────────────────────────────────────────────────────

function parseErpDate(dateStr: string): Date {
  const [datePart, timePart] = dateStr.split(' ');
  const [day, month, year] = datePart.split('/').map(Number);
  const [hour, minute, second] = (timePart || '00:00:00').split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute, second);
}

function isNewerDate(dateA: string, dateB: string): boolean {
  try { return parseErpDate(dateA) > parseErpDate(dateB); } catch { return false; }
}

function formatDateForErp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// ── Companies merge logic ────────────────────────────────────────────────────

async function mergeToCompanies(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  rawClient: Record<string, unknown>,
  crmClient: CRMClient
) {
  const cnpj = normalizeCnpj(crmClient.cnpj_cpf);
  const erpCode = crmClient.external_id;
  const isPJ = crmClient.tipo_pessoa === 'PJ' || (cnpj && cnpj.length === 14);

  // Only merge PJ (companies) to companies table
  if (!isPJ) return { action: 'skipped_pf', conflicts: 0, conflicts_auto: 0 };

  const name = crmClient.razao_social;
  if (!name) return { action: 'skipped_no_name', conflicts: 0, conflicts_auto: 0 };

  // Build normalized record for merge
  const locAddr = rawClient.loc_endereco ? toStringOrNull(rawClient.loc_endereco) : null;
  const locNum = rawClient.loc_numero ? toStringOrNull(rawClient.loc_numero) : null;
  const locComp = rawClient.loc_complemento ? toStringOrNull(rawClient.loc_complemento) : null;
  const locBairro = rawClient.loc_bairro ? toStringOrNull(rawClient.loc_bairro) : null;
  const locCidade = rawClient.loc_cidade ? toStringOrNull(rawClient.loc_cidade) : null;
  const locUf = rawClient.loc_uf ? toStringOrNull(rawClient.loc_uf) : null;
  const locCep = normalizeCep(toStringOrNull(rawClient.loc_cep));

  const normalized: Record<string, unknown> = {
    name,
    fantasia: crmClient.nome_fantasia,
    email: crmClient.emails?.[0] || null,
    phone: crmClient.telefone,
    address: locAddr,
    address_number: locNum,
    address_complement: locComp,
    neighborhood: locBairro,
    city: locCidade,
    state: locUf,
    zip_code: locCep,
    inscricao_estadual: crmClient.insc_estadual,
    tipo_pessoa: 'PJ',
  };

  // Lookup existing
  let existing: Record<string, unknown> | null = null;

  if (cnpj) {
    const { data } = await supabase
      .from('companies')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('cnpj', cnpj)
      .maybeSingle();
    if (data) existing = data;
  }

  if (!existing && erpCode) {
    const { data } = await supabase
      .from('companies')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('erp_code', erpCode)
      .maybeSingle();
    if (data) existing = data;
  }

  let totalConflicts = 0;
  let autoResolved = 0;

  if (existing) {
    // UPDATE path
    const { conflicts, fieldsToUpdate } = detectConflicts(existing, normalized);

    fieldsToUpdate.erp_code = erpCode;
    fieldsToUpdate.erp_synced_at = new Date().toISOString();
    fieldsToUpdate.erp_last_update_date = normalizeDate(crmClient.data_alteracao_erp);

    if (Object.keys(fieldsToUpdate).length > 0) {
      await supabase.from('companies').update(fieldsToUpdate).eq('id', existing.id);
    }

    // Log conflicts
    for (const c of conflicts) {
      totalConflicts++;
      if (c.auto_resolved) autoResolved++;
      await supabase.from('import_conflict_log').insert({
        tenant_id: tenantId,
        entity_type: 'company',
        entity_id: existing.id as string,
        erp_code: erpCode,
        field_name: c.field,
        crm_value: c.crm_value,
        erp_value: c.erp_value,
        auto_resolved: c.auto_resolved,
        resolution: c.auto_resolved ? 'auto_erp_fill' : 'pending',
      });
    }

    // Upsert fiscal
    await upsertFiscal(supabase, existing.id as string, tenantId, crmClient, rawClient);
    await upsertFinancial(supabase, existing.id as string, tenantId, rawClient);

    return { action: 'updated', conflicts: totalConflicts, conflicts_auto: autoResolved };
  } else {
    // INSERT path
    const companyData = {
      tenant_id: tenantId,
      name,
      fantasia: crmClient.nome_fantasia,
      cnpj,
      email: crmClient.emails?.[0] || null,
      phone: crmClient.telefone,
      address: locAddr,
      address_number: locNum,
      address_complement: locComp,
      neighborhood: locBairro,
      city: locCidade,
      state: locUf,
      zip_code: locCep,
      inscricao_estadual: crmClient.insc_estadual,
      tipo_pessoa: 'PJ',
      erp_code: erpCode,
      erp_synced_at: new Date().toISOString(),
      erp_last_update_date: normalizeDate(crmClient.data_alteracao_erp),
      contribuinte_icms: crmClient.contribui_icms,
      origin: 'erp_sync',
      active: true,
    };

    const { data: inserted, error } = await supabase
      .from('companies')
      .insert(companyData)
      .select('id')
      .single();

    if (error) {
      console.error('[sync-clients] Error inserting company:', error.message);
      return { action: 'error', conflicts: 0, conflicts_auto: 0 };
    }

    await upsertFiscal(supabase, inserted.id, tenantId, crmClient, rawClient);
    await upsertFinancial(supabase, inserted.id, tenantId, rawClient);

    return { action: 'inserted', conflicts: 0, conflicts_auto: 0 };
  }
}

async function upsertFiscal(
  supabase: ReturnType<typeof createClient>,
  companyId: string,
  tenantId: string,
  crmClient: CRMClient,
  raw: Record<string, unknown>
) {
  const hasData = crmClient.insc_estadual || crmClient.contribui_icms;
  if (!hasData) return;

  const data = {
    company_id: companyId,
    tenant_id: tenantId,
    inscricao_estadual: crmClient.insc_estadual,
    contribuinte_icms: crmClient.contribui_icms,
    destino_mercadoria: toStringOrNull(raw.destino_mercadoria),
  };

  const { data: existing } = await supabase
    .from('company_erp_fiscal')
    .select('id')
    .eq('company_id', companyId)
    .maybeSingle();

  if (existing) {
    await supabase.from('company_erp_fiscal').update(data).eq('id', existing.id);
  } else {
    await supabase.from('company_erp_fiscal').insert(data);
  }
}

async function upsertFinancial(
  supabase: ReturnType<typeof createClient>,
  companyId: string,
  tenantId: string,
  raw: Record<string, unknown>
) {
  const possuiTitulos = snToBoolean(raw.possui_titulos);
  if (!possuiTitulos && possuiTitulos !== false) return;

  const data = {
    company_id: companyId,
    tenant_id: tenantId,
    possui_titulos_abertos: possuiTitulos,
  };

  const { data: existing } = await supabase
    .from('company_erp_financial')
    .select('id')
    .eq('company_id', companyId)
    .maybeSingle();

  if (existing) {
    await supabase.from('company_erp_financial').update(data).eq('id', existing.id);
  } else {
    await supabase.from('company_erp_financial').insert(data);
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json() as SyncRequest;

    if (!body.baseUrl || !body.token) {
      return new Response(
        JSON.stringify({ success: false, error: 'Credenciais obrigatórias: baseUrl e token', entity: 'clientes', processed: 0 }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Resolve tenant_id
    let tenantId = body.tenant_id;
    if (!tenantId) {
      const { data: tenant } = await supabase.from('tenants').select('id').limit(1).single();
      tenantId = tenant?.id;
    }

    // Read last_sync_at
    const { data: syncControl } = await supabase
      .from('erp_sync_control')
      .select('last_sync_at')
      .eq('entity', 'clientes')
      .maybeSingle();

    let lastSyncAt = DEFAULT_SYNC_DATE;
    if (syncControl?.last_sync_at) {
      lastSyncAt = formatDateForErp(new Date(syncControl.last_sync_at));
    }

    console.log('[sync-clients] data_alteracao enviada:', lastSyncAt);

    // Call Iniflex API
    const apiUrl = body.baseUrl.replace(/\/+$/, '');
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${body.token.trim()}`,
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
      console.error('[sync-clients] Erro HTTP:', response.status, errorText);
      return new Response(
        JSON.stringify({ success: false, error: `Erro HTTP ${response.status}: ${errorText.substring(0, 200)}`, entity: 'clientes', processed: 0 }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const responseData = await response.json();

    let clients: unknown[] = [];
    if (Array.isArray(responseData)) clients = responseData;
    else if (responseData?.data && Array.isArray(responseData.data)) clients = responseData.data;
    else if (responseData?.clientes && Array.isArray(responseData.clientes)) clients = responseData.clientes;

    console.log('[sync-clients] registros recebidos:', clients.length);

    if (clients.length === 0) {
      return new Response(
        JSON.stringify({
          success: true, entity: 'clientes', processed: 0, created: 0, updated: 0,
          companies_inserted: 0, companies_updated: 0, conflicts_detected: 0, conflicts_auto_resolved: 0,
          last_sync_at: lastSyncAt, message: 'Nenhum cliente novo ou alterado encontrado',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process clients
    let created = 0;
    let updated = 0;
    let companiesInserted = 0;
    let companiesUpdated = 0;
    let conflictsDetected = 0;
    let conflictsAutoResolved = 0;
    let maxDataAlteracao = lastSyncAt;

    for (const rawClient of clients) {
      try {
        const clientData = mapInflexClientToCRM(rawClient);

        if (!clientData.external_id) {
          console.warn('[sync-clients] Cliente sem external_id, pulando');
          continue;
        }

        // Track max date
        if (clientData.data_alteracao_erp && isNewerDate(clientData.data_alteracao_erp, maxDataAlteracao)) {
          maxDataAlteracao = clientData.data_alteracao_erp;
        }

        // Check existing in crm_clients
        const { data: existingClient } = await supabase
          .from('crm_clients')
          .select('id')
          .eq('external_id', clientData.external_id)
          .maybeSingle();

        // UPSERT crm_clients
        const { data: upsertedClient, error: upsertError } = await supabase
          .from('crm_clients')
          .upsert(clientData, { onConflict: 'external_id' })
          .select('id')
          .single();

        if (upsertError) {
          console.error('[sync-clients] Erro ao salvar cliente:', clientData.external_id, upsertError);
          continue;
        }

        if (existingClient) updated++;
        else created++;

        // Process addresses
        const rawRecord = rawClient as Record<string, unknown>;
        const addresses = extractAddresses(rawRecord);
        for (const addr of addresses) {
          await supabase
            .from('crm_client_addresses')
            .upsert({ ...addr, client_id: upsertedClient.id }, { onConflict: 'client_id,tipo' });
        }

        // ── Phase 4: Merge to companies table ──
        if (tenantId) {
          try {
            const mergeResult = await mergeToCompanies(supabase, tenantId, rawRecord, clientData);
            if (mergeResult.action === 'inserted') companiesInserted++;
            if (mergeResult.action === 'updated') companiesUpdated++;
            conflictsDetected += mergeResult.conflicts;
            conflictsAutoResolved += mergeResult.conflicts_auto;
          } catch (mergeErr) {
            console.error('[sync-clients] Merge error for', clientData.external_id, mergeErr);
          }
        }

      } catch (clientError) {
        console.error('[sync-clients] Erro ao processar cliente:', clientError);
      }
    }

    console.log('[sync-clients] maior data_alteracao:', maxDataAlteracao);

    // Update sync control
    const parsedMaxDate = parseErpDate(maxDataAlteracao);
    await supabase
      .from('erp_sync_control')
      .upsert({
        entity: 'clientes',
        last_sync_at: parsedMaxDate.toISOString(),
        last_sync_count: clients.length,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'entity' });

    // Log sync in erp_sync_logs
    await supabase.from('erp_sync_logs').insert({
      entity_type: 'sync_clients',
      entity_id: 'batch',
      direction: 'erp_to_crm',
      status: 'success',
      request_payload: { data_alteracao: lastSyncAt, total_received: clients.length },
      response_payload: {
        created, updated,
        companies_inserted: companiesInserted,
        companies_updated: companiesUpdated,
        conflicts_detected: conflictsDetected,
        conflicts_auto_resolved: conflictsAutoResolved,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        entity: 'clientes',
        processed: created + updated,
        created,
        updated,
        companies_inserted: companiesInserted,
        companies_updated: companiesUpdated,
        conflicts_detected: conflictsDetected,
        conflicts_auto_resolved: conflictsAutoResolved,
        last_sync_at: maxDataAlteracao,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[sync-clients] Erro geral:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        entity: 'clientes',
        processed: 0,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
