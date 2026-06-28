#!/usr/bin/env node
import { execSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ALLOWED_ENTITIES = new Set(["companies", "products"]);
const ALLOWED_COMMANDS = new Set(["EXP_CLIENTES_V2", "EXP_PRODUTOS_V1"]);
const EXPLICITLY_BLOCKED_COMMANDS = new Set([
  "IMP_CLIENTE_V4",
  "IMP_ITEM_VERSAO_TESTE",
  "IMP_PEDIDO_V3",
  "IMP_PEDIDO_ESPECIFICO",
  "IMP_ATRIBFICHA_V1",
]);
const MAX_LIMIT = 3;
const DEFAULT_LIMIT = 3;
const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001";
const ARTIFACT_DIR = path.resolve("artifacts/migration/phase-22bx-r2-erp-readonly-sample");
const LOCAL_RAW_DIR = path.resolve(".local/erp-samples");
const PROJECT_NAME_EXPECTED = "crm-qualyvac-restore-test";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIndex = line.indexOf("=");
    if (eqIndex <= 0) continue;
    const key = line.slice(0, eqIndex).trim();
    if (!key) continue;
    if (process.env[key]) continue;
    let value = line.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function loadLocalEnvFallbacks() {
  // Load local env files as fallback, preserving already exported vars.
  loadEnvFile(path.resolve(".env.local"));
  loadEnvFile(path.resolve(".env"));
}

function parseArgs(argv) {
  const args = {
    entity: "",
    limit: DEFAULT_LIMIT,
    noWrite: false,
    checkConfig: false,
    tenantId: DEFAULT_TENANT_ID,
    timeoutMs: 15000,
    changedSince: "",
    dateFrom: "",
    dateTo: "",
    cnpj: "",
    erpCode: "",
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--entity") {
      args.entity = String(argv[i + 1] || "");
      i += 1;
      continue;
    }
    if (token === "--limit") {
      const value = Number(argv[i + 1]);
      if (!Number.isFinite(value) || value <= 0) throw new Error("Invalid --limit value.");
      args.limit = Math.min(MAX_LIMIT, Math.floor(value));
      i += 1;
      continue;
    }
    if (token === "--tenant-id") {
      args.tenantId = String(argv[i + 1] || "").trim();
      i += 1;
      continue;
    }
    if (token === "--timeout-ms") {
      const value = Number(argv[i + 1]);
      if (!Number.isFinite(value) || value < 1000) throw new Error("Invalid --timeout-ms value.");
      args.timeoutMs = Math.floor(value);
      i += 1;
      continue;
    }
    if (token === "--changed-since") {
      args.changedSince = String(argv[i + 1] || "").trim();
      i += 1;
      continue;
    }
    if (token === "--date-from") {
      args.dateFrom = String(argv[i + 1] || "").trim();
      i += 1;
      continue;
    }
    if (token === "--date-to") {
      args.dateTo = String(argv[i + 1] || "").trim();
      i += 1;
      continue;
    }
    if (token === "--cnpj") {
      args.cnpj = onlyDigits(String(argv[i + 1] || ""));
      i += 1;
      continue;
    }
    if (token === "--erp-code") {
      args.erpCode = String(argv[i + 1] || "").trim();
      i += 1;
      continue;
    }
    if (token === "--no-write") {
      args.noWrite = true;
      continue;
    }
    if (token === "--check-config") {
      args.checkConfig = true;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }
  return args;
}

function nowCompact(date = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
}

function maskPreview(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  if (text.length <= 4) return `${text[0] || ""}***`;
  return `${text.slice(0, 2)}***${text.slice(-2)}`;
}

function sha12(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex").slice(0, 12);
}

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function firstValue(record, keys) {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null && String(record[key]).trim() !== "") {
      return String(record[key]).trim();
    }
  }
  return null;
}

function firstNonEmpty(record, keys) {
  for (const key of keys) {
    const value = record?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return null;
}

function formatChangedSince(value) {
  if (!value) return "01/01/2000 00:00:00";
  if (/^\d{2}\/\d{2}\/\d{4}/.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "01/01/2000 00:00:00";
  const p = (n) => String(n).padStart(2, "0");
  return `${p(parsed.getDate())}/${p(parsed.getMonth() + 1)}/${parsed.getFullYear()} ${p(parsed.getHours())}:${p(parsed.getMinutes())}:${p(parsed.getSeconds())}`;
}

function parseErpDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (br) {
    const [, dd, mm, yyyy, hh, mi, ss] = br;
    const d = new Date(`${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function presentFields(record) {
  return Object.keys(record).filter((k) => record[k] !== null && record[k] !== undefined && String(record[k]).trim() !== "");
}

function runLocal(command) {
  return execSync(command, { encoding: "utf8" }).trim();
}

function isReadOnlySql(sql) {
  const text = sql.trim().toLowerCase();
  if (!(text.startsWith("select") || text.startsWith("with"))) return false;
  const blocked = /\b(insert|update|upsert|delete|truncate|drop|alter|create|grant|revoke|comment|vacuum|analyze|refresh|merge|call|execute)\b/i;
  return !blocked.test(text);
}

function runSupabaseSelect(sql) {
  if (!isReadOnlySql(sql)) throw new Error("Blocked non-read-only SQL.");
  const normalized = sql.replace(/\s+/g, " ").trim();
  const escaped = normalized.replaceAll('"', '\\"');
  const output = execSync(`npx supabase db query --linked -o json "${escaped}"`, { encoding: "utf8" });
  const first = output.indexOf("{");
  const last = output.lastIndexOf("}");
  if (first < 0 || last <= first) throw new Error("Supabase JSON output parse failed.");
  const parsed = JSON.parse(output.slice(first, last + 1));
  if (!Array.isArray(parsed.rows)) throw new Error("Supabase response missing rows.");
  return parsed.rows;
}

function assertGitAndTargetPreconditions() {
  const branch = runLocal("git branch --show-current");
  const head = runLocal("git rev-parse HEAD");
  const originMain = runLocal("git rev-parse origin/main");
  const divergence = runLocal("git rev-list --left-right --count origin/main...main");
  if (branch !== "main") throw new Error(`ABORTED: branch must be main, got ${branch}`);
  if (head !== originMain) throw new Error("ABORTED: HEAD differs from origin/main.");
  if (divergence !== "0\t0" && divergence !== "0 0") throw new Error(`ABORTED: divergence must be 0 0, got ${divergence}`);

  const linkedProjectPath = path.resolve("supabase/.temp/linked-project.json");
  if (!fs.existsSync(linkedProjectPath)) return { branch, head, originMain, divergence, linkedProjectName: null };
  const linkedProject = JSON.parse(fs.readFileSync(linkedProjectPath, "utf8"));
  if (linkedProject?.name !== PROJECT_NAME_EXPECTED) {
    throw new Error(`ABORTED: linked target is ${linkedProject?.name || "unknown"}, expected ${PROJECT_NAME_EXPECTED}`);
  }
  return { branch, head, originMain, divergence, linkedProjectName: linkedProject.name };
}

function buildRequestPayload(entity, args) {
  if (entity === "companies") {
    return {
      command: "EXP_CLIENTES_V2",
      payload: {
        tipoComando: "ASDCOMANDOJSONTMP",
        grupoComando: "EXP_CLIENTES_V2",
        data_alteracao: formatChangedSince(args.changedSince),
      },
    };
  }
  if (entity === "products") {
    return {
      command: "EXP_PRODUTOS_V1",
      payload: {
        tipoComando: "ASDCOMANDO",
        grupoComando: "EXP_PRODUTOS_V1",
        data_alteracao: "01/01/2000 00:00:00",
      },
    };
  }
  throw new Error(`Unsupported entity: ${entity}`);
}

function assertCommandAllowed(command) {
  if (EXPLICITLY_BLOCKED_COMMANDS.has(command)) {
    throw new Error(`Blocked explicit write command: ${command}`);
  }
  if (!command.startsWith("EXP_")) {
    throw new Error(`Blocked non-EXP command: ${command}`);
  }
  if (!ALLOWED_COMMANDS.has(command)) {
    throw new Error(`Blocked command not on allowlist: ${command}`);
  }
}

function extractRecordsFromErpResponse(entity, responseJson) {
  const asArray = Array.isArray(responseJson)
    ? responseJson
    : Array.isArray(responseJson?.dados)
      ? responseJson.dados
      : Array.isArray(responseJson?.data)
        ? responseJson.data
        : Array.isArray(responseJson?.clientes)
          ? responseJson.clientes
          : Array.isArray(responseJson?.produtos)
            ? responseJson.produtos
            : Array.isArray(responseJson?.lista)
              ? responseJson.lista
              : [];
  return Array.isArray(asArray) ? asArray : [];
}

function classifyCompany(record) {
  const cnpj = onlyDigits(firstValue(record, ["cnpj_cpf", "cnpj", "cpf_cnpj"]));
  const name = firstValue(record, ["nome", "razao_social", "razao", "fantasia", "name"]);
  const erpCode = firstValue(record, ["codigo_erp", "cd_correntista", "codigo", "cod_cliente", "cliente"]);
  const recognizedSignals = [cnpj, name, erpCode].filter(Boolean).length;
  let status = "ready_candidate";
  if (recognizedSignals === 0) status = "blocked_unmapped";
  else if (!name) status = "blocked_missing_name";
  else if (!cnpj && !erpCode) status = "blocked_missing_cnpj_or_erp_code";
  else if (cnpj && ![11, 14].includes(cnpj.length)) status = "blocked_policy";

  const required = ["cnpj_or_cpf", "name_or_razao", "erp_code_optional"];
  const present = presentFields(record);
  const missing = [];
  if (!cnpj) missing.push("cnpj_or_cpf");
  if (!name) missing.push("name_or_razao");
  return {
    entity: "companies",
    status,
    cnpj,
    name,
    erpCode,
    required_fields: required,
    fields_present_count: present.length,
    fields_present: present,
    fields_missing: missing,
  };
}

function classifyProduct(record) {
  const sku = firstNonEmpty(record, [
    "sku",
    "item",
    "codigo",
    "codigo_item",
    "cd_item",
    "id_item",
    "produto",
    "cod_produto",
    "referencia",
  ]);
  const erpCode = firstNonEmpty(record, [
    "erp_product_code",
    "item",
    "codigo",
    "codigo_item",
    "cd_item",
    "id_item",
    "produto",
    "cod_produto",
  ]);
  const name = firstNonEmpty(record, [
    "name",
    "nome",
    "descricao",
    "descricao_item",
    "desc_item",
    "ds_item",
    "produto_descricao",
    "nome_item",
    "denominacao",
    "identificacao",
    "desc_simples_item",
    "desc_completa_item",
    "desc_simples_versao",
    "desc_material",
    "description",
  ]);
  const version = firstNonEmpty(record, [
    "erp_versao",
    "versao",
    "versao_item",
    "seq_versao",
    "versao_numero",
  ]);
  const classificationSignals = [
    firstNonEmpty(record, ["codigo_tipo_item", "cd_tipo_item", "tipo_id", "tipo", "tipo_item"]),
    firstNonEmpty(record, ["codigo_grupo_item", "codigo_grupo", "cd_grupo_item", "grupo_id", "grupo"]),
    firstNonEmpty(record, ["codigo_subgrupo_item", "codigo_subgrupo", "cd_subgrupo_item", "subgrupo_id", "subgrupo"]),
    firstNonEmpty(record, ["family_id", "codigo_familia", "cd_familia", "familia"]),
    firstNonEmpty(record, ["class_id", "codigo_classe", "cd_classe", "classe"]),
  ].filter(Boolean);

  const recognizedSignals = [sku, erpCode, name].filter(Boolean).length;
  let status = "ready_candidate";
  if (recognizedSignals === 0) status = "blocked_unmapped";
  else if (!sku && !erpCode) status = "blocked_missing_sku_or_erp_code";
  else if (!name) status = "blocked_missing_name";
  else if (classificationSignals.length === 0) status = "blocked_missing_classification";
  else if (String(sku || "").length > 120) status = "blocked_policy";

  const present = presentFields(record);
  const missing = [];
  if (!sku && !erpCode) missing.push("sku_or_erp_code");
  if (!name) missing.push("name_or_description");
  if (classificationSignals.length === 0) missing.push("classification");
  return {
    entity: "products",
    status,
    sku,
    erpCode,
    name,
    version,
    required_fields: ["sku_or_erp_code", "name_or_description", "classification"],
    fields_present_count: present.length,
    fields_present: present,
    fields_missing: missing,
  };
}

function toMaskedCompany(index, classified) {
  return {
    index,
    status: classified.status,
    cnpj_masked: classified.cnpj ? `cnpj_hash_${sha12(classified.cnpj)}` : null,
    cnpj_preview: classified.cnpj ? maskPreview(classified.cnpj) : null,
    name_masked: classified.name ? `name_hash_${sha12(classified.name)}` : null,
    name_preview: classified.name ? maskPreview(classified.name) : null,
    erp_code_masked: classified.erpCode ? `erp_hash_${sha12(classified.erpCode)}` : null,
    erp_code_preview: classified.erpCode ? maskPreview(classified.erpCode) : null,
    fields_present: classified.fields_present,
    fields_missing: classified.fields_missing,
  };
}

function toMaskedProduct(index, classified) {
  return {
    index,
    status: classified.status,
    sku_masked: classified.sku ? `sku_hash_${sha12(classified.sku)}` : null,
    sku_preview: classified.sku ? maskPreview(classified.sku) : null,
    erp_code_masked: classified.erpCode ? `erp_hash_${sha12(classified.erpCode)}` : null,
    erp_code_preview: classified.erpCode ? maskPreview(classified.erpCode) : null,
    name_masked: classified.name ? `name_hash_${sha12(classified.name)}` : null,
    name_preview: classified.name ? maskPreview(classified.name) : null,
    version_masked: classified.version ? `version_hash_${sha12(classified.version)}` : null,
    fields_present: classified.fields_present,
    fields_missing: classified.fields_missing,
  };
}

function buildConfigStatus(tenantId) {
  const iniflexApiUrl = process.env.INIFLEX_API_URL || "";
  const iniflexApiToken = process.env.INIFLEX_API_TOKEN || "";
  if (iniflexApiUrl && iniflexApiToken) {
    return {
      config_status: "ready",
      config_source: "env_iniflex",
      provider: "iniflex",
      iniflex_api_url_present: true,
      iniflex_api_token_present: true,
      api_url: iniflexApiUrl,
      api_token: iniflexApiToken,
      tenant_settings_checked: false,
      tenant_settings_present: false,
    };
  }

  let endpoint = "";
  let token = "";
  let tenantSettingsPresent = false;
  let tenantSettingsChecked = false;
  try {
    tenantSettingsChecked = true;
    const rows = runSupabaseSelect(`
      select settings
      from public.tenant_settings
      where tenant_id = '${tenantId.replaceAll("'", "''")}'
        and category = 'erp_integration'
      order by updated_at desc nulls last
      limit 1
    `);
    if (rows.length > 0 && rows[0]?.settings) {
      tenantSettingsPresent = true;
      const settings = typeof rows[0].settings === "string" ? JSON.parse(rows[0].settings) : rows[0].settings;
      endpoint = String(settings?.endpoint || "");
      token = String(settings?.token || "");
    }
  } catch {
    tenantSettingsChecked = true;
  }

  if (endpoint && token) {
    return {
      config_status: "ready",
      config_source: "tenant_settings_iniflex",
      provider: "iniflex",
      iniflex_api_url_present: true,
      iniflex_api_token_present: true,
      api_url: endpoint,
      api_token: token,
      tenant_settings_checked: tenantSettingsChecked,
      tenant_settings_present: tenantSettingsPresent,
    };
  }

  return {
    config_status: "missing",
    config_source: "none",
    provider: "missing",
    iniflex_api_url_present: Boolean(iniflexApiUrl),
    iniflex_api_token_present: Boolean(iniflexApiToken),
    api_url: "",
    api_token: "",
    tenant_settings_checked: tenantSettingsChecked,
    tenant_settings_present: tenantSettingsPresent,
  };
}

async function callErpReadOnly(apiUrl, apiToken, payload, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const rawText = await response.text();
    if (!response.ok) {
      throw new Error(`ERP HTTP ${response.status}: ${rawText.slice(0, 500)}`);
    }
    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new Error("ERP response is not valid JSON.");
    }
    return { parsed, http_status: response.status };
  } finally {
    clearTimeout(timeout);
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function safeDecision(input) {
  if (input.anyHardViolation) return "NO-GO";
  if (input.configMissing || input.externalFailure || input.readyCandidates === 0) return "PARCIAL";
  return "GO";
}

function collisionsForCompanies(tenantId, classified) {
  const results = [];
  for (const item of classified) {
    const row = {
      cnpj_hash: item.cnpj ? sha12(item.cnpj) : null,
      erp_code_hash: item.erpCode ? sha12(item.erpCode) : null,
      by_tenant_cnpj: 0,
      by_tenant_erp_code: 0,
    };
    if (item.cnpj) {
      const cnpjEscaped = item.cnpj.replaceAll("'", "''");
      const rows = runSupabaseSelect(`
        select count(*)::bigint as qty
        from public.companies
        where tenant_id = '${tenantId.replaceAll("'", "''")}'
          and regexp_replace(coalesce(cnpj, ''), '\\D', '', 'g') = '${cnpjEscaped}'
      `);
      row.by_tenant_cnpj = Number(rows[0]?.qty || 0);
    }
    if (item.erpCode) {
      const codeEscaped = item.erpCode.replaceAll("'", "''");
      const rows = runSupabaseSelect(`
        select count(*)::bigint as qty
        from public.companies
        where tenant_id = '${tenantId.replaceAll("'", "''")}'
          and coalesce(erp_code::text, '') = '${codeEscaped}'
      `);
      row.by_tenant_erp_code = Number(rows[0]?.qty || 0);
    }
    results.push(row);
  }
  return results;
}

function collisionsForProducts(tenantId, classified) {
  const results = [];
  for (const item of classified) {
    const row = {
      sku_hash: item.sku ? sha12(item.sku) : null,
      erp_code_hash: item.erpCode ? sha12(item.erpCode) : null,
      version_masked: item.version ? `version_hash_${sha12(item.version)}` : null,
      by_tenant_erp_code_version: 0,
      by_sku_unique: 0,
    };
    if (item.erpCode && item.version) {
      const codeEscaped = item.erpCode.replaceAll("'", "''");
      const versionEscaped = item.version.replaceAll("'", "''");
      const rows = runSupabaseSelect(`
        select count(*)::bigint as qty
        from public.products
        where tenant_id = '${tenantId.replaceAll("'", "''")}'
          and coalesce(erp_product_code::text, '') = '${codeEscaped}'
          and coalesce(versao_numero::text, '') = '${versionEscaped}'
      `);
      row.by_tenant_erp_code_version = Number(rows[0]?.qty || 0);
    }
    if (item.sku) {
      const skuEscaped = item.sku.replaceAll("'", "''");
      const rows = runSupabaseSelect(`
        select count(*)::bigint as qty
        from public.products
        where coalesce(sku_unique::text, '') = '${skuEscaped}'
      `);
      row.by_sku_unique = Number(rows[0]?.qty || 0);
    }
    results.push(row);
  }
  return results;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  loadLocalEnvFallbacks();
  if (args.checkConfig) {
    const config = buildConfigStatus(args.tenantId);
    console.log(
      JSON.stringify(
        {
          provider: config.provider,
          iniflex_api_url_present: config.iniflex_api_url_present,
          iniflex_api_token_present: config.iniflex_api_token_present,
          config_status: config.config_status,
          config_source: config.config_source,
        },
        null,
        2,
      ),
    );
    return;
  }
  if (!args.noWrite) throw new Error("ABORTED: --no-write is mandatory.");
  if (!ALLOWED_ENTITIES.has(args.entity)) throw new Error("ABORTED: --entity must be companies or products.");
  if (!args.tenantId) throw new Error("ABORTED: --tenant-id is required.");

  const gitAndTarget = assertGitAndTargetPreconditions();
  const runStartedAt = new Date().toISOString();
  const stamp = nowCompact();
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  fs.mkdirSync(LOCAL_RAW_DIR, { recursive: true });

  const config = buildConfigStatus(args.tenantId);
  const summary = {
    phase: "22BX-R2",
    run_at: runStartedAt,
    entity: args.entity,
    tenant_id: args.tenantId,
    limit_requested: args.limit,
    limit_effective: Math.min(args.limit, MAX_LIMIT),
    no_write_mode: true,
    git: {
      branch: gitAndTarget.branch,
      head: gitAndTarget.head,
      origin_main: gitAndTarget.originMain,
      divergence_origin_main_vs_main: gitAndTarget.divergence,
      linked_project_name: gitAndTarget.linkedProjectName,
    },
    config: {
      config_status: config.config_status,
      config_source: config.config_source,
      provider: config.provider,
      iniflex_api_url_present: config.iniflex_api_url_present,
      iniflex_api_token_present: config.iniflex_api_token_present,
      tenant_settings_checked: config.tenant_settings_checked,
      tenant_settings_present: config.tenant_settings_present,
      has_api_url: Boolean(config.api_url),
      has_api_token: Boolean(config.api_token),
    },
    command_allowlist: Array.from(ALLOWED_COMMANDS),
    command_blocklist: Array.from(EXPLICITLY_BLOCKED_COMMANDS),
    request_filters: {
      changed_since: args.changedSince || null,
      date_from: args.dateFrom || null,
      date_to: args.dateTo || null,
      cnpj_filter_present: Boolean(args.cnpj),
      erp_code_filter_present: Boolean(args.erpCode),
    },
    operation: "not_executed",
    totals: {
      fetched_records: 0,
      sample_records: 0,
      ready_candidate: 0,
      blocked_total: 0,
    },
    blocked_by_status: {},
    artifacts: {
      local_raw_path: null,
      masked_entity_path: null,
      masked_collisions_path: null,
      masked_summary_path: null,
    },
    errors: [],
    decision: "PARCIAL",
    reason: "config_missing_or_not_executed",
    confirmations: {
      no_db_write: true,
      no_sql_write: true,
      no_erp_write_api: true,
      no_staging_writes: true,
      no_queue_processing: true,
      no_deploy: true,
      no_commit: true,
      no_push: true,
      no_executor_change: true,
    },
  };

  const { command, payload } = buildRequestPayload(args.entity, args);
  assertCommandAllowed(command);

  if (config.config_status === "missing") {
    summary.operation = "skipped_config_missing";
    summary.decision = "PARCIAL";
    summary.reason = "config_status_missing";
    const summaryPath = path.join(ARTIFACT_DIR, `erp-readonly-sample-summary-${stamp}.json`);
    summary.artifacts.masked_summary_path = path.relative(process.cwd(), summaryPath);
    writeJson(summaryPath, summary);
    console.log(`config_status=missing`);
    console.log(`decision=PARCIAL`);
    console.log(`summary_artifact=${summary.artifacts.masked_summary_path}`);
    return;
  }

  let parsedResponse = null;
  let records = [];
  let operationError = null;
  try {
    summary.operation = "erp_readonly_call_started";
    const response = await callErpReadOnly(config.api_url, config.api_token, payload, args.timeoutMs);
    parsedResponse = response.parsed;
    let extracted = extractRecordsFromErpResponse(args.entity, parsedResponse);
    if (args.entity === "companies") {
      if (args.cnpj) {
        extracted = extracted.filter((row) => {
          const candidate = onlyDigits(firstValue(row || {}, ["cnpj_cpf", "cnpj", "cpf_cnpj"]));
          return candidate === args.cnpj;
        });
      }
      if (args.erpCode) {
        extracted = extracted.filter((row) => {
          const candidate = firstValue(row || {}, ["codigo_erp", "cd_correntista", "codigo", "cod_cliente", "cliente"]);
          return candidate === args.erpCode;
        });
      }
      if (args.dateFrom || args.dateTo) {
        const from = args.dateFrom ? parseErpDate(args.dateFrom) : null;
        const to = args.dateTo ? parseErpDate(args.dateTo) : null;
        extracted = extracted.filter((row) => {
          const d = parseErpDate(firstValue(row || {}, ["data_alteracao", "dt_alteracao"]));
          if (!d) return false;
          if (from && d < from) return false;
          if (to && d > to) return false;
          return true;
        });
      }
    }
    records = extracted.slice(0, Math.min(args.limit, MAX_LIMIT));
    summary.operation = "erp_readonly_call_succeeded";
    summary.totals.fetched_records = extracted.length;
    summary.totals.sample_records = records.length;
  } catch (error) {
    operationError = error instanceof Error ? error.message : String(error);
    summary.operation = "erp_readonly_call_failed";
    summary.errors.push(operationError);
  }

  const localRawName = args.entity === "companies"
    ? `real-erp-01-companies-raw-${stamp}.json`
    : `real-erp-01-products-raw-${stamp}.json`;
  const localRawPath = path.join(LOCAL_RAW_DIR, localRawName);

  if (records.length > 0) {
    writeJson(localRawPath, {
      phase: "22BX-R2",
      entity: args.entity,
      run_at: runStartedAt,
      tenant_id: args.tenantId,
      command_executed: command,
      sample_size: records.length,
      records,
    });
    summary.artifacts.local_raw_path = path.relative(process.cwd(), localRawPath);
  }

  let classified = [];
  if (records.length > 0) {
    classified = args.entity === "companies" ? records.map(classifyCompany) : records.map(classifyProduct);
    const maskedRows = args.entity === "companies"
      ? classified.map((row, idx) => toMaskedCompany(idx + 1, row))
      : classified.map((row, idx) => toMaskedProduct(idx + 1, row));

    const blockedByStatus = {};
    let ready = 0;
    for (const row of classified) {
      if (row.status === "ready_candidate") ready += 1;
      else blockedByStatus[row.status] = (blockedByStatus[row.status] || 0) + 1;
    }
    summary.totals.ready_candidate = ready;
    summary.totals.blocked_total = classified.length - ready;
    summary.blocked_by_status = blockedByStatus;

    const entityMaskedPath = path.join(
      ARTIFACT_DIR,
      args.entity === "companies"
        ? `erp-readonly-companies-masked-${stamp}.json`
        : `erp-readonly-products-masked-${stamp}.json`,
    );
    writeJson(entityMaskedPath, {
      phase: "22BX-R2",
      entity: args.entity,
      run_at: runStartedAt,
      tenant_id: args.tenantId,
      sample_size: maskedRows.length,
      ready_candidate: ready,
      blocked_total: classified.length - ready,
      blocked_by_status: blockedByStatus,
      rows: maskedRows,
    });
    summary.artifacts.masked_entity_path = path.relative(process.cwd(), entityMaskedPath);

    try {
      const collisions = args.entity === "companies"
        ? collisionsForCompanies(args.tenantId, classified)
        : collisionsForProducts(args.tenantId, classified);
      const collisionsPath = path.join(ARTIFACT_DIR, `erp-readonly-collisions-masked-${stamp}.json`);
      writeJson(collisionsPath, {
        phase: "22BX-R2",
        entity: args.entity,
        run_at: runStartedAt,
        tenant_id: args.tenantId,
        sample_size: collisions.length,
        collisions,
      });
      summary.artifacts.masked_collisions_path = path.relative(process.cwd(), collisionsPath);
    } catch (error) {
      summary.errors.push(`collision_check_failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const decision = safeDecision({
    anyHardViolation: false,
    configMissing: config.config_status !== "ready",
    externalFailure: Boolean(operationError),
    readyCandidates: summary.totals.ready_candidate,
  });
  summary.decision = decision;
  summary.reason = operationError
    ? "external_error_or_timeout"
    : summary.totals.ready_candidate > 0
      ? "ready_candidates_found"
      : "no_ready_candidates";

  const summaryPath = path.join(ARTIFACT_DIR, `erp-readonly-sample-summary-${stamp}.json`);
  summary.artifacts.masked_summary_path = path.relative(process.cwd(), summaryPath);
  writeJson(summaryPath, summary);

  console.log(`entity=${args.entity}`);
  console.log(`operation=${summary.operation}`);
  console.log(`sample_records=${summary.totals.sample_records}`);
  console.log(`ready_candidate=${summary.totals.ready_candidate}`);
  console.log(`decision=${summary.decision}`);
  console.log(`summary_artifact=${summary.artifacts.masked_summary_path}`);
}

main().catch((error) => {
  console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
