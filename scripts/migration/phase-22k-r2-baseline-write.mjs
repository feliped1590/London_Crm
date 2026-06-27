#!/usr/bin/env node
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const EXPECTED_TARGET_REF = "nsnmlleplpzsefzkuxlb";
const EXPECTED_TARGET_NAME = "crm-qualyvac-restore-test";
const EXPECTED_BATCH_ID = "baseline_22f_r2_restore_test_qualyvac";
const EXPECTED_AUTHORIZATION =
  "AUTORIZO A ESCRITA CONTROLADA DA BASELINE 22H-R2 NO RESTORE-TEST nsnmlleplpzsefzkuxlb";
const EXPECTED_PILOT_ENTITY = "legal_entities";
const ALLOWED_PILOT_ENTITIES = new Set(["legal_entities", "product_types", "product_groups", "product_subgroups"]);
const EXPECTED_PILOT_AUTHORIZATION =
  "AUTORIZO A PRIMEIRA ESCRITA PILOTO DA BASELINE 22R-R2 SOMENTE EM legal_entities NO RESTORE-TEST nsnmlleplpzsefzkuxlb";
const EXPECTED_PRODUCT_TYPES_PILOT_AUTHORIZATION =
  "AUTORIZO A TERCEIRA ESCRITA PILOTO DA BASELINE 22AD-R2 SOMENTE EM product_types NO RESTORE-TEST nsnmlleplpzsefzkuxlb";
const EXPECTED_PRODUCT_GROUPS_PILOT_AUTHORIZATION =
  "AUTORIZO A QUARTA ESCRITA PILOTO DA BASELINE 22AK-R2 SOMENTE EM product_groups NO RESTORE-TEST nsnmlleplpzsefzkuxlb";
const EXPECTED_PRODUCT_SUBGROUPS_PILOT_AUTHORIZATION =
  "AUTORIZO A QUINTA ESCRITA PILOTO DA BASELINE 22AR-R2 SOMENTE EM product_subgroups NO RESTORE-TEST nsnmlleplpzsefzkuxlb";
const EXPECTED_PRODUCT_TYPES_PILOT_PAYLOAD = {
  phase: "22AD-R2",
  entity: "product_types",
  source: "baseline_simulation_22g_r2",
  temp_key: "TMP-22F-R2-PRODTYPE-01",
  value: "TMP-PT-001",
  label: "TMP Product Type",
  tenant_id: null,
};
const EXPECTED_PRODUCT_GROUPS_PILOT_PAYLOAD = {
  phase: "22AK-R2",
  entity: "product_groups",
  source: "baseline_simulation_22g_r2",
  temp_key: "TMP-22F-R2-PRODGROUP-01",
  value: "TMP-PG-001",
  label: "TMP Product Group",
  tenant_id: null,
  created_by: null,
  dimension_profile_default: "none",
  ficha_profile_default: "none",
};
const EXPECTED_PRODUCT_SUBGROUPS_PILOT_PAYLOAD = {
  phase: "22AR-R2",
  entity: "product_subgroups",
  source: "baseline_simulation_22g_r2",
  temp_key: "TMP-22F-R2-PRODSUBGROUP-01",
  value: "TMP-PSG-001",
  label: "TMP Product Subgroup",
  tenant_id: null,
  created_by: null,
  sort_order_default: "0",
  is_active_default: "true",
  created_at_default: "now()",
};

const ALLOWED_ENTITIES = new Set([
  "legal_entities",
  "profiles",
  "sales_reps",
  "user_tenants",
  "user_legal_entities",
  "user_sales_reps",
  "product_types",
  "product_groups",
  "product_subgroups",
  "product_families",
  "product_classes",
  "products",
  "companies",
  "contacts",
]);

const BLOCKED_ENTITIES = new Set([
  "deals",
  "deal_stage_history",
  "proposals",
  "sales_proposals",
  "proposal_items",
  "sales_proposal_items",
  "orders",
  "order_items",
  "sync_queues",
  "erp_sync",
  "audit_logs",
  "sessions",
  "attachments",
  "notifications",
  "webhooks",
  "n8n",
]);

const INPUT_REFERENCE_ONLY_ENTITIES = new Set(["company_contacts"]);

const FORBIDDEN_FLAGS = new Set([
  "--force",
  "--skip-guards",
  "--tables",
  "--cleanup",
  "--rollback",
  "--all",
  "--prod",
  "--staging",
]);

const ALLOWED_FLAGS = new Set([
  "--expected-target",
  "--batch",
  "--authorization",
  "--pilot-entity",
  "--pilot-payload",
  "--pilot-authorization",
  "--execute-pilot-write",
  "--input",
  "--write-plan",
  "--write",
]);

const FIRST_ROUND_EXECUTABLE_ENTITIES_22Q = new Set([
  "legal_entities",
  "user_tenants",
  "user_legal_entities",
  "sales_reps",
  "user_sales_reps",
  "product_types",
  "product_groups",
  "product_subgroups",
  "product_families",
  "product_classes",
  "products",
  "companies",
  "contacts",
]);

const PILOT_T_WRITE_DIR = "artifacts/migration/phase-22t-r2-pilot-legal-entities-write";
const PILOT_LEGAL_ENTITY_RECORD = {
  tenant_id: "00000000-0000-0000-0000-000000000001",
  name: "Qualyvac Baseline LE",
  trade_name: "Qualyvac Baseline LE",
  cnpj: "TMP-CNPJ-LE-0001",
  erp_company_code: "TMP-LE-001",
  is_headquarters: true,
  active: true,
};

function nowStamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function escapeSqlLiteral(value) {
  return String(value).replaceAll("'", "''");
}

function extractSupabaseJson(rawOutput) {
  const firstBrace = rawOutput.indexOf("{");
  const lastBrace = rawOutput.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("Unable to parse Supabase JSON output.");
  }
  const parsed = JSON.parse(rawOutput.slice(firstBrace, lastBrace + 1));
  if (!parsed || !Array.isArray(parsed.rows)) {
    throw new Error("Supabase JSON output missing rows.");
  }
  return parsed.rows;
}

function runSupabaseDbQuery(sql) {
  const normalizedSql = sql.replace(/\s+/g, " ").trim();
  const escapedSql = normalizedSql.replaceAll('"', '\\"');
  const output = execSync(`npx supabase db query --linked -o json "${escapedSql}"`, {
    encoding: "utf8",
  });
  return extractSupabaseJson(output);
}

function parseArgs(argv) {
  const parsed = {
    expectedTarget: "",
    batch: "",
    authorization: "",
    pilotEntity: "",
    pilotPayload: "",
    pilotAuthorization: "",
    executePilotWrite: false,
    input: "",
    writePlan: "",
    write: false,
    unknownFlags: [],
    forbiddenFlags: [],
    receivedFlags: [],
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    parsed.receivedFlags.push(token);
    if (FORBIDDEN_FLAGS.has(token)) {
      parsed.forbiddenFlags.push(token);
      continue;
    }
    if (!ALLOWED_FLAGS.has(token)) {
      parsed.unknownFlags.push(token);
      continue;
    }
    if (token === "--write") {
      parsed.write = true;
      continue;
    }
    if (token === "--execute-pilot-write") {
      parsed.executePilotWrite = true;
      continue;
    }
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) {
      parsed.unknownFlags.push(`${token}(missing_value)`);
      continue;
    }
    i += 1;
    if (token === "--expected-target") parsed.expectedTarget = value;
    if (token === "--batch") parsed.batch = value;
    if (token === "--authorization") parsed.authorization = value;
    if (token === "--pilot-entity") parsed.pilotEntity = value;
    if (token === "--pilot-payload") parsed.pilotPayload = value;
    if (token === "--pilot-authorization") parsed.pilotAuthorization = value;
    if (token === "--input") parsed.input = value;
    if (token === "--write-plan") parsed.writePlan = value;
  }
  return parsed;
}

function classifyDecision(noGoReasons, partialReasons) {
  if (noGoReasons.length > 0) return "NO-GO";
  if (partialReasons.length > 0) return "PARCIAL";
  return "GO";
}

function pushValidation(validations, key, status, detail) {
  validations.push({ key, status, detail });
}

function flattenEntities(inputJson) {
  const buckets = [
    inputJson?.baseline_entities,
    inputJson?.entities,
    inputJson?.schema_validation?.found_tables,
    Object.keys(inputJson?.simulated_records_count || {}),
  ];
  const out = new Set();
  for (const bucket of buckets) {
    if (!Array.isArray(bucket)) continue;
    bucket.forEach((v) => {
      if (typeof v === "string" && v.trim()) out.add(v.trim());
    });
  }
  return [...out].sort();
}

function hasSuspiciousWriteText(rawText) {
  const re =
    /\b(insert\s+into|update\s+\w+|delete\s+from|truncate\s+\w+|drop\s+table|alter\s+table|create\s+table|create\s+schema|db\s+push|functions\s+invoke|rpc\(|fetch\(|axios)\b/i;
  return re.test(rawText);
}

function hasSuspiciousExternalText(rawText) {
  const re = /\b(erp|n8n|webhook|https?:\/\/)\b/i;
  return re.test(rawText);
}

function collectValuesByKey(node, targetKey, acc = []) {
  if (Array.isArray(node)) {
    node.forEach((item) => collectValuesByKey(item, targetKey, acc));
    return acc;
  }
  if (!node || typeof node !== "object") return acc;
  for (const [key, value] of Object.entries(node)) {
    if (key === targetKey) acc.push(value);
    collectValuesByKey(value, targetKey, acc);
  }
  return acc;
}

function analyzeWritePlanFields(inputJson) {
  const writePlanKeys = [
    "writePlan",
    "operations",
    "inserts",
    "upserts",
    "deletes",
    "sql",
    "mutations",
    "tablesToWrite",
    "entitiesToWrite",
  ];

  const fieldsFound = [];
  const companyContactsWriteSignals = [];

  for (const key of writePlanKeys) {
    const values = collectValuesByKey(inputJson, key);
    if (values.length === 0) continue;

    fieldsFound.push(key);
    for (const value of values) {
      const serialized = JSON.stringify(value).toLowerCase();
      if (serialized.includes("company_contacts")) {
        companyContactsWriteSignals.push(key);
      }
    }
  }

  return {
    fieldsFound: [...new Set(fieldsFound)].sort(),
    companyContactsWriteSignals: [...new Set(companyContactsWriteSignals)].sort(),
  };
}

function buildPlannedWriteOrder() {
  return [
    "tenant_context_validation_only",
    "legal_entities",
    "profiles",
    "user_tenants",
    "user_legal_entities",
    "sales_reps",
    "user_sales_reps",
    "product_types",
    "product_groups",
    "product_subgroups",
    "product_families",
    "product_classes",
    "products",
    "companies",
    "contacts",
  ];
}

function shouldAcceptPartialByPolicy22NR2(context) {
  const {
    preflightDecision,
    noGoReasons,
    partialReasons,
    referenceOnlyEntitiesFound,
    blockedEntitiesFound,
    companyContactsWritePlanSignals,
    unknownEntitiesFound,
  } = context;

  if (preflightDecision === "GO") {
    return {
      accepted: true,
      reason: "Preflight GO; no partial acceptance needed.",
      criticalFailures: [],
    };
  }

  if (preflightDecision === "NO-GO") {
    return {
      accepted: false,
      reason: "Preflight NO-GO cannot be accepted by policy 22N-R2.",
      criticalFailures: ["preflight_no_go"],
    };
  }

  const failures = [];

  if (noGoReasons.length > 0) failures.push("no_go_reasons_present");
  if (blockedEntitiesFound.length > 0) failures.push("blocked_entities_found");
  if (companyContactsWritePlanSignals.length > 0) failures.push("company_contacts_write_signal");
  if (unknownEntitiesFound.length > 0) failures.push("unknown_entities_found");

  const onlyReferenceOnlyIsCompanyContacts =
    referenceOnlyEntitiesFound.length === 1 && referenceOnlyEntitiesFound[0] === "company_contacts";
  if (!onlyReferenceOnlyIsCompanyContacts) failures.push("reference_only_not_limited_to_company_contacts");

  const unexpectedPartials = partialReasons.filter(
    (r) => !r.toLowerCase().includes("reference-only entities found in input: company_contacts"),
  );
  if (unexpectedPartials.length > 0) failures.push("partial_reasons_beyond_reference_only_company_contacts");

  if (failures.length > 0) {
    return {
      accepted: false,
      reason: `Policy 22N-R2 rejected PARCIAL due to: ${failures.join(", ")}`,
      criticalFailures: failures,
    };
  }

  return {
    accepted: true,
    reason: "PARCIAL accepted by policy 22N-R2: only company_contacts as reference-only.",
    criticalFailures: [],
  };
}

function executePlannedOperations() {
  throw new Error(
    "EXECUÇÃO REAL BLOQUEADA NA FASE 22Q-R2. Operações montadas em memória, mas nenhuma mutação foi executada.",
  );
}

function executePilotWrite() {
  throw new Error(
    "EXECUÇÃO PILOTO REAL BLOQUEADA NA FASE 22S-R2. legal_entities validada como piloto, mas nenhuma mutação foi executada.",
  );
}

function executeProductTypesPilotWrite(params) {
  const { value, label, tenant_id, expectedTargetRef, expectedTargetName, batchId, localTargetRef, localTargetName } = params;
  if (expectedTargetRef !== EXPECTED_TARGET_REF || localTargetRef !== EXPECTED_TARGET_REF) {
    throw new Error("Target ref mismatch for product_types pilot write.");
  }
  if (expectedTargetName !== EXPECTED_TARGET_NAME || localTargetName !== EXPECTED_TARGET_NAME) {
    throw new Error("Target name mismatch for product_types pilot write.");
  }
  if (batchId !== EXPECTED_BATCH_ID) {
    throw new Error("Batch mismatch for product_types pilot write.");
  }
  if (value !== EXPECTED_PRODUCT_TYPES_PILOT_PAYLOAD.value) {
    throw new Error("product_types pilot value mismatch.");
  }
  if (label !== EXPECTED_PRODUCT_TYPES_PILOT_PAYLOAD.label) {
    throw new Error("product_types pilot label mismatch.");
  }
  if (tenant_id !== null) {
    throw new Error("product_types pilot tenant_id must be null.");
  }

  const existingRows = runSupabaseDbQuery(
    `select id, value, label, tenant_id from public.product_types where value = '${escapeSqlLiteral(value)}'`,
  );
  if (existingRows.length > 1) {
    throw new Error("Unexpected duplicate rows for product_types.value during pilot.");
  }
  if (existingRows.length === 1) {
    const existing = existingRows[0];
    const samePayload = existing.value === value && existing.label === label && existing.tenant_id === null;
    if (!samePayload) {
      throw new Error("Existing product_types row diverges from frozen pilot payload.");
    }
    return {
      operation: "idempotent_noop",
      record: existing,
      inserted: false,
    };
  }

  const labelRows = runSupabaseDbQuery(
    `select count(*)::bigint as label_count from public.product_types where label = '${escapeSqlLiteral(label)}'`,
  );
  const labelCount = Number(labelRows[0]?.label_count || 0);
  if (labelCount > 0) {
    throw new Error("Label collision detected without value match for product_types pilot.");
  }

  const insertedRows = runSupabaseDbQuery(`
    insert into public.product_types (value, label, tenant_id)
    values ('${escapeSqlLiteral(value)}', '${escapeSqlLiteral(label)}', null)
    returning id, value, label, tenant_id
  `);
  if (insertedRows.length !== 1) {
    throw new Error("Pilot insert did not return exactly one row.");
  }
  return {
    operation: "inserted",
    record: insertedRows[0],
    inserted: true,
  };
}

function executeProductGroupsPilotWrite(params) {
  const {
    value,
    label,
    tenant_id,
    created_by,
    expectedTargetRef,
    expectedTargetName,
    batchId,
    localTargetRef,
    localTargetName,
  } = params;

  if (expectedTargetRef !== EXPECTED_TARGET_REF || localTargetRef !== EXPECTED_TARGET_REF) {
    throw new Error("Target ref mismatch for product_groups pilot write.");
  }
  if (expectedTargetName !== EXPECTED_TARGET_NAME || localTargetName !== EXPECTED_TARGET_NAME) {
    throw new Error("Target name mismatch for product_groups pilot write.");
  }
  if (batchId !== EXPECTED_BATCH_ID) {
    throw new Error("Batch mismatch for product_groups pilot write.");
  }
  if (value !== EXPECTED_PRODUCT_GROUPS_PILOT_PAYLOAD.value) {
    throw new Error("product_groups pilot value mismatch.");
  }
  if (label !== EXPECTED_PRODUCT_GROUPS_PILOT_PAYLOAD.label) {
    throw new Error("product_groups pilot label mismatch.");
  }
  if (tenant_id !== null) {
    throw new Error("product_groups pilot tenant_id must be null.");
  }
  if (created_by !== null && created_by !== undefined) {
    throw new Error("product_groups pilot created_by must be null or omitted.");
  }

  const uniqueRows = runSupabaseDbQuery(`
    select exists(
      select 1
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public'
        and t.relname = 'product_groups'
        and c.contype = 'u'
        and pg_get_constraintdef(c.oid) ilike '%(value)%'
    ) as has_unique_value
  `);
  if (uniqueRows[0]?.has_unique_value !== true) {
    throw new Error("UNIQUE(value) missing for product_groups.");
  }

  const defaultsRows = runSupabaseDbQuery(`
    select column_name, is_nullable, column_default
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'product_groups'
      and column_name in ('tenant_id', 'created_by', 'dimension_profile', 'ficha_profile')
  `);
  let tenantNullable = false;
  let createdByNullable = false;
  let dimensionDefault = "";
  let fichaDefault = "";
  for (const row of defaultsRows) {
    if (row.column_name === "tenant_id") tenantNullable = row.is_nullable === "YES";
    if (row.column_name === "created_by") createdByNullable = row.is_nullable === "YES";
    if (row.column_name === "dimension_profile") dimensionDefault = String(row.column_default || "");
    if (row.column_name === "ficha_profile") fichaDefault = String(row.column_default || "");
  }
  if (!tenantNullable) {
    throw new Error("product_groups.tenant_id must be nullable.");
  }
  if (!createdByNullable) {
    throw new Error("product_groups.created_by must be nullable.");
  }
  if (!dimensionDefault.toLowerCase().includes("'none'::dimension_profile")) {
    throw new Error("product_groups.dimension_profile default must be none.");
  }
  if (!fichaDefault.toLowerCase().includes("'none'::text")) {
    throw new Error("product_groups.ficha_profile default must be none.");
  }

  const existingRows = runSupabaseDbQuery(`
    select id, value, label, tenant_id, created_by, dimension_profile::text as dimension_profile, ficha_profile
    from public.product_groups
    where value = '${escapeSqlLiteral(value)}'
  `);
  if (existingRows.length > 1) {
    throw new Error("Unexpected duplicate rows for product_groups.value during pilot.");
  }
  if (existingRows.length === 1) {
    const existing = existingRows[0];
    const samePayload =
      existing.value === value &&
      existing.label === label &&
      existing.tenant_id === null &&
      existing.created_by === null &&
      existing.dimension_profile === EXPECTED_PRODUCT_GROUPS_PILOT_PAYLOAD.dimension_profile_default &&
      existing.ficha_profile === EXPECTED_PRODUCT_GROUPS_PILOT_PAYLOAD.ficha_profile_default;
    if (!samePayload) {
      throw new Error("Existing product_groups row diverges from frozen pilot payload/defaults.");
    }
    return {
      operation: "idempotent_noop",
      record: existing,
      inserted: false,
    };
  }

  const labelRows = runSupabaseDbQuery(
    `select count(*)::bigint as label_count from public.product_groups where label = '${escapeSqlLiteral(label)}'`,
  );
  const labelCount = Number(labelRows[0]?.label_count || 0);
  if (labelCount > 0) {
    throw new Error("Label collision detected without value match for product_groups pilot.");
  }

  const insertedRows = runSupabaseDbQuery(`
    insert into public.product_groups (value, label, tenant_id)
    values ('${escapeSqlLiteral(value)}', '${escapeSqlLiteral(label)}', null)
    returning id, value, label, tenant_id, created_by, dimension_profile::text as dimension_profile, ficha_profile
  `);
  if (insertedRows.length !== 1) {
    throw new Error("Pilot insert did not return exactly one row.");
  }
  const inserted = insertedRows[0];
  if (
    inserted.dimension_profile !== EXPECTED_PRODUCT_GROUPS_PILOT_PAYLOAD.dimension_profile_default ||
    inserted.ficha_profile !== EXPECTED_PRODUCT_GROUPS_PILOT_PAYLOAD.ficha_profile_default
  ) {
    throw new Error("product_groups defaults were not applied as expected after insert.");
  }
  return {
    operation: "inserted",
    record: inserted,
    inserted: true,
  };
}

function executeProductSubgroupsPilotWrite(params) {
  const {
    value,
    label,
    tenant_id,
    created_by,
    expectedTargetRef,
    expectedTargetName,
    batchId,
    localTargetRef,
    localTargetName,
  } = params;

  if (expectedTargetRef !== EXPECTED_TARGET_REF || localTargetRef !== EXPECTED_TARGET_REF) {
    throw new Error("Target ref mismatch for product_subgroups pilot write.");
  }
  if (expectedTargetName !== EXPECTED_TARGET_NAME || localTargetName !== EXPECTED_TARGET_NAME) {
    throw new Error("Target name mismatch for product_subgroups pilot write.");
  }
  if (batchId !== EXPECTED_BATCH_ID) {
    throw new Error("Batch mismatch for product_subgroups pilot write.");
  }
  if (value !== EXPECTED_PRODUCT_SUBGROUPS_PILOT_PAYLOAD.value) {
    throw new Error("product_subgroups pilot value mismatch.");
  }
  if (label !== EXPECTED_PRODUCT_SUBGROUPS_PILOT_PAYLOAD.label) {
    throw new Error("product_subgroups pilot label mismatch.");
  }
  if (tenant_id !== null) {
    throw new Error("product_subgroups pilot tenant_id must be null.");
  }
  if (created_by !== null && created_by !== undefined) {
    throw new Error("product_subgroups pilot created_by must be null or omitted.");
  }

  const uniqueRows = runSupabaseDbQuery(`
    select exists(
      select 1
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public'
        and t.relname = 'product_subgroups'
        and c.contype = 'u'
        and pg_get_constraintdef(c.oid) ilike '%(value)%'
    ) as has_unique_value
  `);
  if (uniqueRows[0]?.has_unique_value !== true) {
    throw new Error("UNIQUE(value) missing for product_subgroups.");
  }

  const columnsRows = runSupabaseDbQuery(`
    select column_name, is_nullable, column_default
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'product_subgroups'
      and column_name in ('tenant_id', 'created_by', 'sort_order', 'is_active', 'created_at', 'product_group_id')
  `);
  let tenantNullable = false;
  let createdByNullable = false;
  let sortOrderDefault = "";
  let isActiveDefault = "";
  let createdAtDefault = "";
  let hasProductGroupIdColumn = false;
  for (const row of columnsRows) {
    if (row.column_name === "tenant_id") tenantNullable = row.is_nullable === "YES";
    if (row.column_name === "created_by") createdByNullable = row.is_nullable === "YES";
    if (row.column_name === "sort_order") sortOrderDefault = String(row.column_default || "");
    if (row.column_name === "is_active") isActiveDefault = String(row.column_default || "");
    if (row.column_name === "created_at") createdAtDefault = String(row.column_default || "");
    if (row.column_name === "product_group_id") hasProductGroupIdColumn = true;
  }
  if (hasProductGroupIdColumn) {
    throw new Error("product_subgroups must not define product_group_id in current pilot contract.");
  }
  if (!tenantNullable) {
    throw new Error("product_subgroups.tenant_id must be nullable.");
  }
  if (!createdByNullable) {
    throw new Error("product_subgroups.created_by must be nullable.");
  }
  if (!sortOrderDefault.trim().startsWith(EXPECTED_PRODUCT_SUBGROUPS_PILOT_PAYLOAD.sort_order_default)) {
    throw new Error("product_subgroups.sort_order default must be 0.");
  }
  if (!isActiveDefault.trim().toLowerCase().startsWith(EXPECTED_PRODUCT_SUBGROUPS_PILOT_PAYLOAD.is_active_default)) {
    throw new Error("product_subgroups.is_active default must be true.");
  }
  if (!createdAtDefault.toLowerCase().includes(EXPECTED_PRODUCT_SUBGROUPS_PILOT_PAYLOAD.created_at_default)) {
    throw new Error("product_subgroups.created_at default must be now().");
  }

  const fkRows = runSupabaseDbQuery(`
    select count(*)::bigint as fk_count
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    join pg_class rt on rt.oid = c.confrelid
    join pg_namespace rn on rn.oid = rt.relnamespace
    where c.contype = 'f'
      and n.nspname='public'
      and t.relname='product_subgroups'
      and rn.nspname='public'
      and rt.relname='product_groups'
  `);
  if (Number(fkRows[0]?.fk_count || 0) !== 0) {
    throw new Error("product_subgroups must not have FK to product_groups for 22AT-R2 pilot.");
  }

  const existingRows = runSupabaseDbQuery(`
    select id, value, label, tenant_id, created_by, sort_order, is_active, created_at::text as created_at
    from public.product_subgroups
    where value = '${escapeSqlLiteral(value)}'
  `);
  if (existingRows.length > 1) {
    throw new Error("Unexpected duplicate rows for product_subgroups.value during pilot.");
  }
  if (existingRows.length === 1) {
    const existing = existingRows[0];
    const samePayload =
      existing.value === value &&
      existing.label === label &&
      existing.tenant_id === null &&
      existing.created_by === null &&
      Number(existing.sort_order) === 0 &&
      existing.is_active === true &&
      typeof existing.created_at === "string" &&
      existing.created_at.length > 0;
    if (!samePayload) {
      throw new Error("Existing product_subgroups row diverges from frozen pilot payload/defaults.");
    }
    return {
      operation: "idempotent_noop",
      record: existing,
      inserted: false,
    };
  }

  const labelRows = runSupabaseDbQuery(
    `select count(*)::bigint as label_count from public.product_subgroups where label = '${escapeSqlLiteral(label)}'`,
  );
  const labelCount = Number(labelRows[0]?.label_count || 0);
  if (labelCount > 0) {
    throw new Error("Label collision detected without value match for product_subgroups pilot.");
  }

  const insertedRows = runSupabaseDbQuery(`
    insert into public.product_subgroups (value, label, tenant_id)
    values ('${escapeSqlLiteral(value)}', '${escapeSqlLiteral(label)}', null)
    returning id, value, label, tenant_id, created_by, sort_order, is_active, created_at::text as created_at
  `);
  if (insertedRows.length !== 1) {
    throw new Error("Pilot insert did not return exactly one row.");
  }
  const inserted = insertedRows[0];
  if (
    Number(inserted.sort_order) !== 0 ||
    inserted.is_active !== true ||
    typeof inserted.created_at !== "string" ||
    inserted.created_at.length === 0
  ) {
    throw new Error("product_subgroups defaults were not applied as expected after insert.");
  }
  return {
    operation: "inserted",
    record: inserted,
    inserted: true,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const noGoReasons = [];
  const partialReasons = [];
  const gaps = [];
  const validations = [];

  if (args.forbiddenFlags.length > 0) {
    noGoReasons.push(`Forbidden flags detected: ${args.forbiddenFlags.join(", ")}`);
    pushValidation(validations, "flags.forbidden", "FAIL", "Forbidden flags are not allowed.");
  } else {
    pushValidation(validations, "flags.forbidden", "PASS", "No forbidden flags detected.");
  }

  if (args.unknownFlags.length > 0) {
    noGoReasons.push(`Unknown or malformed flags detected: ${args.unknownFlags.join(", ")}`);
    pushValidation(validations, "flags.unknown", "FAIL", "Unknown flags are not allowed.");
  } else {
    pushValidation(validations, "flags.unknown", "PASS", "Only allowed flags were used.");
  }

  const projectRefPath = path.resolve("supabase/.temp/project-ref");
  const linkedProjectPath = path.resolve("supabase/.temp/linked-project.json");
  let localTargetRef = null;
  let localTargetName = "not_checked_in_22k_r2";

  if (!fs.existsSync(projectRefPath)) {
    noGoReasons.push("Local project-ref file is missing.");
    pushValidation(validations, "target.project_ref_file", "FAIL", "supabase/.temp/project-ref not found.");
  } else {
    localTargetRef = fs.readFileSync(projectRefPath, "utf8").trim();
    pushValidation(validations, "target.project_ref_file", "PASS", "supabase/.temp/project-ref found.");
  }

  if (localTargetRef !== EXPECTED_TARGET_REF) {
    noGoReasons.push(`Local target ref mismatch: ${localTargetRef || "missing"} != ${EXPECTED_TARGET_REF}`);
    pushValidation(validations, "target.project_ref_value", "FAIL", "Local project-ref does not match expected target.");
  } else {
    pushValidation(validations, "target.project_ref_value", "PASS", "Local project-ref matches expected target.");
  }

  if (fs.existsSync(linkedProjectPath)) {
    try {
      const linkedProject = JSON.parse(fs.readFileSync(linkedProjectPath, "utf8"));
      localTargetName = linkedProject?.name || "not_checked_in_22k_r2";
      if (localTargetName !== EXPECTED_TARGET_NAME) {
        noGoReasons.push(`Local target name mismatch: ${localTargetName} != ${EXPECTED_TARGET_NAME}`);
        pushValidation(validations, "target.project_name_value", "FAIL", "Local project name does not match expected name.");
      } else {
        pushValidation(validations, "target.project_name_value", "PASS", "Local project name matches expected name.");
      }
    } catch {
      partialReasons.push("linked-project.json exists but could not be parsed.");
      gaps.push("Unable to parse linked-project.json for target name validation.");
      pushValidation(validations, "target.project_name_value", "PARTIAL", "Could not parse linked-project.json.");
      localTargetName = "not_checked_in_22k_r2";
    }
  } else {
    partialReasons.push("linked-project.json not found; project name validation not fully enforced.");
    gaps.push("targetNameValidation: not_checked_in_22k_r2");
    pushValidation(validations, "target.project_name_value", "PARTIAL", "linked-project.json not found.");
  }

  if (!args.expectedTarget) {
    noGoReasons.push("--expected-target is required.");
    pushValidation(validations, "target.expected_target_flag", "FAIL", "--expected-target not provided.");
  } else if (args.expectedTarget !== EXPECTED_TARGET_REF) {
    noGoReasons.push(`--expected-target mismatch: ${args.expectedTarget} != ${EXPECTED_TARGET_REF}`);
    pushValidation(validations, "target.expected_target_flag", "FAIL", "--expected-target does not match expected target.");
  } else {
    pushValidation(validations, "target.expected_target_flag", "PASS", "--expected-target validated.");
  }

  if (!args.authorization) {
    noGoReasons.push("--authorization is required.");
    pushValidation(validations, "authorization.flag", "FAIL", "Authorization phrase not provided.");
  } else if (args.authorization !== EXPECTED_AUTHORIZATION) {
    noGoReasons.push("Authorization phrase mismatch.");
    pushValidation(validations, "authorization.value", "FAIL", "Authorization phrase is not exact.");
  } else {
    pushValidation(validations, "authorization.value", "PASS", "Authorization phrase validated.");
  }

  const selectedPilotEntity = args.pilotEntity || null;
  const expectedPilotAuthorization =
    selectedPilotEntity === "product_types"
      ? EXPECTED_PRODUCT_TYPES_PILOT_AUTHORIZATION
      : selectedPilotEntity === "product_groups"
        ? EXPECTED_PRODUCT_GROUPS_PILOT_AUTHORIZATION
      : selectedPilotEntity === "product_subgroups"
        ? EXPECTED_PRODUCT_SUBGROUPS_PILOT_AUTHORIZATION
      : EXPECTED_PILOT_AUTHORIZATION;

  if (args.executePilotWrite && !selectedPilotEntity) {
    noGoReasons.push("--pilot-entity is required when --execute-pilot-write is used.");
    pushValidation(validations, "pilot.entity.flag", "FAIL", "--pilot-entity not provided in pilot mode.");
  } else if (selectedPilotEntity && !ALLOWED_PILOT_ENTITIES.has(selectedPilotEntity)) {
    noGoReasons.push(`Pilot entity is not allowed: ${selectedPilotEntity}`);
    pushValidation(
      validations,
      "pilot.entity.value",
      "FAIL",
      "Pilot entity must be legal_entities, product_types, product_groups or product_subgroups.",
    );
  } else if (selectedPilotEntity === "legal_entities") {
    pushValidation(validations, "pilot.entity.value", "PASS", "Pilot entity validated as legal_entities.");
  } else if (selectedPilotEntity === "product_types") {
    pushValidation(validations, "pilot.entity.value", "PASS", "Pilot entity validated as product_types.");
  } else if (selectedPilotEntity === "product_groups") {
    pushValidation(validations, "pilot.entity.value", "PASS", "Pilot entity validated as product_groups.");
  } else if (selectedPilotEntity === "product_subgroups") {
    pushValidation(validations, "pilot.entity.value", "PASS", "Pilot entity validated as product_subgroups.");
  } else {
    pushValidation(validations, "pilot.entity.value", "PASS", "Pilot entity not requested.");
  }

  if (args.executePilotWrite && !args.pilotAuthorization) {
    noGoReasons.push("--pilot-authorization is required when --execute-pilot-write is used.");
    pushValidation(validations, "pilot.authorization.flag", "FAIL", "--pilot-authorization not provided in pilot mode.");
  } else if (args.pilotAuthorization && args.pilotAuthorization !== expectedPilotAuthorization) {
    noGoReasons.push("Pilot authorization phrase mismatch.");
    pushValidation(validations, "pilot.authorization.value", "FAIL", "Pilot authorization phrase is not exact.");
  } else if (args.pilotAuthorization === expectedPilotAuthorization) {
    pushValidation(validations, "pilot.authorization.value", "PASS", "Pilot authorization phrase validated.");
  } else {
    pushValidation(validations, "pilot.authorization.value", "PASS", "Pilot authorization not requested.");
  }

  if (
    (selectedPilotEntity === "product_types" ||
      selectedPilotEntity === "product_groups" ||
      selectedPilotEntity === "product_subgroups") &&
    !args.pilotPayload
  ) {
    noGoReasons.push(`--pilot-payload is required when --pilot-entity ${selectedPilotEntity} is used.`);
    pushValidation(validations, "pilot.payload.flag", "FAIL", `--pilot-payload not provided for ${selectedPilotEntity} pilot.`);
  } else if (
    (selectedPilotEntity === "product_types" ||
      selectedPilotEntity === "product_groups" ||
      selectedPilotEntity === "product_subgroups") &&
    args.pilotPayload
  ) {
    pushValidation(validations, "pilot.payload.flag", "PASS", `--pilot-payload provided for ${selectedPilotEntity} pilot.`);
  } else {
    pushValidation(validations, "pilot.payload.flag", "PASS", "Pilot payload not required for this pilot entity.");
  }

  if (!args.batch) {
    noGoReasons.push("--batch is required.");
    pushValidation(validations, "batch.flag", "FAIL", "Batch id not provided.");
  } else if (args.batch !== EXPECTED_BATCH_ID) {
    noGoReasons.push(`Batch mismatch: ${args.batch} != ${EXPECTED_BATCH_ID}`);
    pushValidation(validations, "batch.value", "FAIL", "Batch id does not match expected.");
  } else {
    pushValidation(validations, "batch.value", "PASS", "Batch id validated.");
  }

  let inputExists = false;
  let inputParsed = false;
  let inputJson = null;
  let inputRaw = "";
  let inputEntities = [];
  const allowedEntitiesFound = [];
  const blockedEntitiesFound = [];
  const referenceOnlyEntitiesFound = [];
  const unknownEntitiesFound = [];
  let writePlanAnalysis = { fieldsFound: [], companyContactsWriteSignals: [] };
  let writePlanExists = false;
  let writePlanParsed = false;
  let writePlanJson = null;
  const writePlanValidationErrors = [];
  let pilotPayloadExists = false;
  let pilotPayloadParsed = false;
  let pilotPayloadJson = null;
  const pilotPayloadValidationErrors = [];
  let productTypesCountCurrent = null;
  let productTypesValueCollisionCount = null;
  let productTypesLabelCollisionCount = null;
  let productTypesUniqueValuePresent = false;
  let productGroupsCountCurrent = null;
  let productGroupsValueCollisionCount = null;
  let productGroupsLabelCollisionCount = null;
  let productGroupsUniqueValuePresent = false;
  let productGroupsTenantNullable = null;
  let productGroupsCreatedByNullable = null;
  let productGroupsDimensionDefault = null;
  let productGroupsFichaDefault = null;
  let productSubgroupsCountCurrent = null;
  let productSubgroupsValueCollisionCount = null;
  let productSubgroupsLabelCollisionCount = null;
  let productSubgroupsUniqueValuePresent = false;
  let productSubgroupsTenantNullable = null;
  let productSubgroupsCreatedByNullable = null;
  let productSubgroupsSortOrderDefault = null;
  let productSubgroupsIsActiveDefault = null;
  let productSubgroupsCreatedAtDefault = null;
  let productSubgroupsHasProductGroupIdColumn = false;
  let productSubgroupsHasFkToProductGroups = false;

  if (!args.input) {
    noGoReasons.push("--input is required.");
    pushValidation(validations, "input.flag", "FAIL", "Input file path not provided.");
  } else {
    const inputPath = path.resolve(args.input);
    inputExists = fs.existsSync(inputPath);
    if (!inputExists) {
      noGoReasons.push(`Input file does not exist: ${args.input}`);
      pushValidation(validations, "input.exists", "FAIL", "Input file was not found.");
    } else {
      pushValidation(validations, "input.exists", "PASS", "Input file exists.");
      inputRaw = fs.readFileSync(inputPath, "utf8");
      try {
        inputJson = JSON.parse(inputRaw);
        inputParsed = true;
        pushValidation(validations, "input.parse_json", "PASS", "Input JSON parsed successfully.");
      } catch {
        noGoReasons.push("Input is not valid JSON.");
        pushValidation(validations, "input.parse_json", "FAIL", "Input JSON parsing failed.");
      }
    }
  }

  if (inputParsed) {
    if (inputJson?.linked_target && inputJson.linked_target !== EXPECTED_TARGET_REF) {
      noGoReasons.push(`Input linked_target mismatch: ${inputJson.linked_target} != ${EXPECTED_TARGET_REF}`);
      pushValidation(validations, "input.target_compatibility", "FAIL", "Input target is incompatible.");
    } else if (inputJson?.expected_target && inputJson.expected_target !== EXPECTED_TARGET_REF) {
      noGoReasons.push(`Input expected_target mismatch: ${inputJson.expected_target} != ${EXPECTED_TARGET_REF}`);
      pushValidation(validations, "input.target_compatibility", "FAIL", "Input expected_target is incompatible.");
    } else if (!inputJson?.linked_target && !inputJson?.expected_target) {
      partialReasons.push("Input has no explicit target field.");
      gaps.push("Input target metadata absent.");
      pushValidation(validations, "input.target_compatibility", "PARTIAL", "Input target metadata is missing.");
    } else {
      pushValidation(validations, "input.target_compatibility", "PASS", "Input target metadata is compatible.");
    }

    if (inputJson?.batch_id && inputJson.batch_id !== EXPECTED_BATCH_ID) {
      noGoReasons.push(`Input batch_id mismatch: ${inputJson.batch_id} != ${EXPECTED_BATCH_ID}`);
      pushValidation(validations, "input.batch_compatibility", "FAIL", "Input batch_id is incompatible.");
    } else if (!inputJson?.batch_id) {
      partialReasons.push("Input has no explicit batch_id.");
      gaps.push("Input batch metadata absent.");
      pushValidation(validations, "input.batch_compatibility", "PARTIAL", "Input batch metadata is missing.");
    } else {
      pushValidation(validations, "input.batch_compatibility", "PASS", "Input batch metadata is compatible.");
    }

    const decision = String(inputJson?.decision || "").toUpperCase();
    if (!decision) {
      partialReasons.push("Input has no decision field.");
      gaps.push("Input decision metadata absent.");
      pushValidation(validations, "input.decision", "PARTIAL", "Input decision metadata is missing.");
    } else if (decision !== "GO" && decision !== "PARCIAL") {
      noGoReasons.push(`Input decision is not acceptable: ${decision}`);
      pushValidation(validations, "input.decision", "FAIL", "Input decision must be GO or PARCIAL.");
    } else {
      pushValidation(validations, "input.decision", "PASS", `Input decision accepted: ${decision}`);
    }

    inputEntities = flattenEntities(inputJson);
    for (const entity of inputEntities) {
      if (ALLOWED_ENTITIES.has(entity)) {
        allowedEntitiesFound.push(entity);
        continue;
      }
      if (BLOCKED_ENTITIES.has(entity)) {
        blockedEntitiesFound.push(entity);
        continue;
      }
      if (INPUT_REFERENCE_ONLY_ENTITIES.has(entity)) {
        referenceOnlyEntitiesFound.push(entity);
        continue;
      }
      unknownEntitiesFound.push(entity);
    }

    writePlanAnalysis = analyzeWritePlanFields(inputJson);
    if (blockedEntitiesFound.length > 0) {
      noGoReasons.push(`Blocked entities found in input: ${blockedEntitiesFound.join(", ")}`);
      pushValidation(validations, "input.entities_blocked", "FAIL", "Input contains blocked entities.");
    } else {
      pushValidation(validations, "input.entities_blocked", "PASS", "No blocked entities found in input.");
    }

    if (referenceOnlyEntitiesFound.length > 0) {
      partialReasons.push(
        `Reference-only entities found in input: ${referenceOnlyEntitiesFound.join(", ")}. They remain non-writable.`,
      );
      gaps.push("Reference-only entities present in input; write remains prohibited for these entities.");
      pushValidation(
        validations,
        "input.entities_reference_only",
        "PARTIAL",
        "Reference-only entities found and kept non-writable.",
      );
    } else {
      pushValidation(validations, "input.entities_reference_only", "PASS", "No reference-only entities found in input.");
    }

    if (unknownEntitiesFound.length > 0) {
      partialReasons.push(`Unknown entities found outside policy sets: ${unknownEntitiesFound.join(", ")}`);
      gaps.push("Input contains entities outside allowed/blocked/reference-only sets.");
      pushValidation(validations, "input.entities_policy_scope", "PARTIAL", "Input has entities outside policy sets.");
    } else {
      pushValidation(validations, "input.entities_policy_scope", "PASS", "Input entities are within known policy sets.");
    }

    if (writePlanAnalysis.fieldsFound.length > 0) {
      pushValidation(
        validations,
        "input.write_plan_fields",
        "PASS",
        `Write-plan related fields found: ${writePlanAnalysis.fieldsFound.join(", ")}`,
      );
    } else {
      pushValidation(validations, "input.write_plan_fields", "PASS", "No write-plan fields found in input.");
    }

    if (writePlanAnalysis.companyContactsWriteSignals.length > 0) {
      noGoReasons.push(
        `company_contacts appears in write-plan fields: ${writePlanAnalysis.companyContactsWriteSignals.join(", ")}`,
      );
      pushValidation(
        validations,
        "input.company_contacts_write_plan",
        "FAIL",
        "company_contacts appears in write-plan fields and is not writable.",
      );
    } else {
      pushValidation(
        validations,
        "input.company_contacts_write_plan",
        "PASS",
        "No company_contacts write-plan signal found.",
      );
    }

    if (hasSuspiciousWriteText(inputRaw)) {
      noGoReasons.push("Input contains suspicious write command text.");
      pushValidation(validations, "input.write_text_scan", "FAIL", "Suspicious write command text detected.");
    } else {
      pushValidation(validations, "input.write_text_scan", "PASS", "No suspicious write command text detected.");
    }

    if (hasSuspiciousExternalText(inputRaw)) {
      partialReasons.push("Input contains external integration keywords; review required.");
      gaps.push("Potential external integration keyword found in input payload.");
      pushValidation(validations, "input.external_text_scan", "PARTIAL", "External integration keywords detected.");
    } else {
      pushValidation(validations, "input.external_text_scan", "PASS", "No external integration keywords detected.");
    }
  }

  if (args.write && !args.writePlan) {
    noGoReasons.push("--write-plan is required for armed execution in 22Q-R2.");
    pushValidation(validations, "write_plan.flag_required", "FAIL", "--write-plan not provided in armed mode.");
  }

  if (args.writePlan) {
    const writePlanPath = path.resolve(args.writePlan);
    writePlanExists = fs.existsSync(writePlanPath);
    if (!writePlanExists) {
      noGoReasons.push(`Write plan file does not exist: ${args.writePlan}`);
      pushValidation(validations, "write_plan.exists", "FAIL", "Write plan file not found.");
    } else {
      pushValidation(validations, "write_plan.exists", "PASS", "Write plan file exists.");
      try {
        writePlanJson = JSON.parse(fs.readFileSync(writePlanPath, "utf8"));
        writePlanParsed = true;
        pushValidation(validations, "write_plan.parse_json", "PASS", "Write plan JSON parsed successfully.");
      } catch {
        noGoReasons.push("Write plan is not valid JSON.");
        pushValidation(validations, "write_plan.parse_json", "FAIL", "Write plan parsing failed.");
      }
    }
  }

  if (writePlanParsed) {
    if (writePlanJson?.targetRef !== EXPECTED_TARGET_REF) {
      writePlanValidationErrors.push("targetRef mismatch");
    }
    if (writePlanJson?.targetName !== EXPECTED_TARGET_NAME) {
      writePlanValidationErrors.push("targetName mismatch");
    }
    if (writePlanJson?.batchId !== EXPECTED_BATCH_ID) {
      writePlanValidationErrors.push("batchId mismatch");
    }
    if (String(writePlanJson?.planDecision || "").toUpperCase() !== "GO") {
      writePlanValidationErrors.push("planDecision is not GO");
    }
    if (args.input && writePlanJson?.inputPath) {
      const expectedInputResolved = path.resolve(args.input);
      const planInputResolved = path.resolve(writePlanJson.inputPath);
      if (expectedInputResolved !== planInputResolved) {
        writePlanValidationErrors.push("inputPath mismatch");
      }
    } else {
      writePlanValidationErrors.push("inputPath metadata missing");
    }

    if (writePlanValidationErrors.length > 0) {
      noGoReasons.push(`Write plan validation failed: ${writePlanValidationErrors.join(", ")}`);
      pushValidation(validations, "write_plan.compatibility", "FAIL", "Write plan metadata incompatible.");
    } else {
      pushValidation(validations, "write_plan.compatibility", "PASS", "Write plan metadata validated.");
    }
  }

  if (selectedPilotEntity === "product_types") {
    const payloadPath = args.pilotPayload ? path.resolve(args.pilotPayload) : null;
    pilotPayloadExists = Boolean(payloadPath && fs.existsSync(payloadPath));
    if (!pilotPayloadExists) {
      noGoReasons.push(`Pilot payload file does not exist: ${args.pilotPayload || "missing"}`);
      pushValidation(validations, "pilot.payload.exists", "FAIL", "Pilot payload file was not found.");
    } else {
      pushValidation(validations, "pilot.payload.exists", "PASS", "Pilot payload file exists.");
      try {
        pilotPayloadJson = JSON.parse(fs.readFileSync(payloadPath, "utf8"));
        pilotPayloadParsed = true;
        pushValidation(validations, "pilot.payload.parse_json", "PASS", "Pilot payload parsed successfully.");
      } catch {
        noGoReasons.push("Pilot payload is not valid JSON.");
        pushValidation(validations, "pilot.payload.parse_json", "FAIL", "Pilot payload parsing failed.");
      }
    }

    if (pilotPayloadParsed) {
      if (pilotPayloadJson?.phase !== EXPECTED_PRODUCT_TYPES_PILOT_PAYLOAD.phase) {
        pilotPayloadValidationErrors.push("phase mismatch");
      }
      if (pilotPayloadJson?.targetRef !== EXPECTED_TARGET_REF) {
        pilotPayloadValidationErrors.push("targetRef mismatch");
      }
      if (pilotPayloadJson?.targetName !== EXPECTED_TARGET_NAME) {
        pilotPayloadValidationErrors.push("targetName mismatch");
      }
      if (pilotPayloadJson?.batchId !== EXPECTED_BATCH_ID) {
        pilotPayloadValidationErrors.push("batchId mismatch");
      }
      if (!["GO", "PARCIAL"].includes(String(pilotPayloadJson?.decision || "").toUpperCase())) {
        pilotPayloadValidationErrors.push("payload decision is not GO/PARCIAL");
      }
      const sourceOk =
        typeof pilotPayloadJson?.payloadOrigin?.primarySource === "string" &&
        pilotPayloadJson.payloadOrigin.primarySource.includes("phase-22g-r2-baseline-dry-run.mjs");
      if (!sourceOk) {
        pilotPayloadValidationErrors.push("payload origin source mismatch");
      }
      const sectionOk = String(pilotPayloadJson?.payloadOrigin?.section || "").includes("BASELINE_SIMULATION.product_types");
      if (!sectionOk) {
        pilotPayloadValidationErrors.push("payload origin section mismatch");
      }

      const frozenRecords = pilotPayloadJson?.frozenPayload?.records;
      if (!Array.isArray(frozenRecords) || frozenRecords.length !== 1) {
        pilotPayloadValidationErrors.push("frozen payload must contain exactly 1 record");
      } else {
        const [record] = frozenRecords;
        if (pilotPayloadJson?.frozenPayload?.entity !== EXPECTED_PRODUCT_TYPES_PILOT_PAYLOAD.entity) {
          pilotPayloadValidationErrors.push("frozen payload entity mismatch");
        }
        if (record?.temp_key !== EXPECTED_PRODUCT_TYPES_PILOT_PAYLOAD.temp_key) {
          pilotPayloadValidationErrors.push("temp_key mismatch");
        }
        if (record?.value !== EXPECTED_PRODUCT_TYPES_PILOT_PAYLOAD.value) {
          pilotPayloadValidationErrors.push("value mismatch");
        }
        if (record?.label !== EXPECTED_PRODUCT_TYPES_PILOT_PAYLOAD.label) {
          pilotPayloadValidationErrors.push("label mismatch");
        }
        if (record?.tenant_id !== EXPECTED_PRODUCT_TYPES_PILOT_PAYLOAD.tenant_id) {
          pilotPayloadValidationErrors.push("tenant_id mismatch");
        }
        if (typeof record?.value !== "string" || record.value.trim().length === 0) {
          pilotPayloadValidationErrors.push("value must be non-empty text");
        }
        if (typeof record?.label !== "string" || record.label.trim().length === 0) {
          pilotPayloadValidationErrors.push("label must be non-empty text");
        }
      }

      const tenantPolicyIsNull =
        pilotPayloadJson?.tenantPolicy?.tenant_id === null &&
        String(pilotPayloadJson?.tenantPolicy?.mode || "").toLowerCase().includes("null");
      if (!tenantPolicyIsNull) {
        pilotPayloadValidationErrors.push("tenant policy must be null scope");
      }

      const idempotencyByValue = String(pilotPayloadJson?.idempotencyRule?.key || "") === "value";
      if (!idempotencyByValue) {
        pilotPayloadValidationErrors.push("idempotency key must be value");
      }

      if (pilotPayloadValidationErrors.length > 0) {
        noGoReasons.push(`Pilot payload validation failed: ${pilotPayloadValidationErrors.join(", ")}`);
        pushValidation(validations, "pilot.payload.compatibility", "FAIL", "Pilot payload metadata incompatible.");
      } else {
        pushValidation(validations, "pilot.payload.compatibility", "PASS", "Pilot payload metadata validated.");
      }
    }

    try {
      const uniqueRows = runSupabaseDbQuery(`
        select exists(
          select 1
          from pg_constraint c
          join pg_class t on t.oid = c.conrelid
          join pg_namespace n on n.oid = t.relnamespace
          where n.nspname = 'public'
            and t.relname = 'product_types'
            and c.contype = 'u'
            and pg_get_constraintdef(c.oid) ilike '%(value)%'
        ) as has_unique_value
      `);
      productTypesUniqueValuePresent = uniqueRows[0]?.has_unique_value === true;
      if (!productTypesUniqueValuePresent) {
        noGoReasons.push("UNIQUE(value) was not found for public.product_types.");
        pushValidation(validations, "pilot.product_types.unique_value", "FAIL", "UNIQUE(value) is required.");
      } else {
        pushValidation(validations, "pilot.product_types.unique_value", "PASS", "UNIQUE(value) validated.");
      }
    } catch {
      noGoReasons.push("Unable to validate UNIQUE(value) for public.product_types.");
      pushValidation(validations, "pilot.product_types.unique_value", "FAIL", "Failed to validate UNIQUE(value).");
    }

    try {
      const countRows = runSupabaseDbQuery(
        "select count(*)::bigint as total_rows from public.product_types",
      );
      productTypesCountCurrent = Number(countRows[0]?.total_rows ?? 0);
      pushValidation(validations, "pilot.product_types.current_count", "PASS", "Current product_types count collected.");
    } catch {
      noGoReasons.push("Unable to read current count from public.product_types.");
      pushValidation(validations, "pilot.product_types.current_count", "FAIL", "Failed to read product_types count.");
    }

    const candidateValue = EXPECTED_PRODUCT_TYPES_PILOT_PAYLOAD.value;
    const candidateLabel = EXPECTED_PRODUCT_TYPES_PILOT_PAYLOAD.label;
    try {
      const valueRows = runSupabaseDbQuery(
        `select count(*)::bigint as value_count from public.product_types where value = '${escapeSqlLiteral(candidateValue)}'`,
      );
      productTypesValueCollisionCount = Number(valueRows[0]?.value_count ?? 0);
      if (productTypesValueCollisionCount > 0) {
        pushValidation(
          validations,
          "pilot.product_types.value_collision",
          "PASS",
          "Value exists; idempotent payload match will be validated in pilot before/write stage.",
        );
      } else {
        pushValidation(validations, "pilot.product_types.value_collision", "PASS", "No value collision detected.");
      }
    } catch {
      noGoReasons.push("Unable to validate value collision for product_types pilot payload.");
      pushValidation(validations, "pilot.product_types.value_collision", "FAIL", "Failed to validate value collision.");
    }

    try {
      const labelRows = runSupabaseDbQuery(
        `select count(*)::bigint as label_count from public.product_types where label = '${escapeSqlLiteral(candidateLabel)}'`,
      );
      productTypesLabelCollisionCount = Number(labelRows[0]?.label_count ?? 0);
      if (productTypesLabelCollisionCount > 0) {
        pushValidation(
          validations,
          "pilot.product_types.label_collision",
          "PASS",
          "Label exists; collision will be validated against value/idempotency in pilot before/write stage.",
        );
      } else {
        pushValidation(validations, "pilot.product_types.label_collision", "PASS", "No label collision detected.");
      }
    } catch {
      noGoReasons.push("Unable to validate label collision for product_types pilot payload.");
      pushValidation(validations, "pilot.product_types.label_collision", "FAIL", "Failed to validate label collision.");
    }
  }

  if (selectedPilotEntity === "product_groups") {
    const payloadPath = args.pilotPayload ? path.resolve(args.pilotPayload) : null;
    pilotPayloadExists = Boolean(payloadPath && fs.existsSync(payloadPath));
    if (!pilotPayloadExists) {
      noGoReasons.push(`Pilot payload file does not exist: ${args.pilotPayload || "missing"}`);
      pushValidation(validations, "pilot.payload.exists", "FAIL", "Pilot payload file was not found.");
    } else {
      pushValidation(validations, "pilot.payload.exists", "PASS", "Pilot payload file exists.");
      try {
        pilotPayloadJson = JSON.parse(fs.readFileSync(payloadPath, "utf8"));
        pilotPayloadParsed = true;
        pushValidation(validations, "pilot.payload.parse_json", "PASS", "Pilot payload parsed successfully.");
      } catch {
        noGoReasons.push("Pilot payload is not valid JSON.");
        pushValidation(validations, "pilot.payload.parse_json", "FAIL", "Pilot payload parsing failed.");
      }
    }

    if (pilotPayloadParsed) {
      if (pilotPayloadJson?.phase !== EXPECTED_PRODUCT_GROUPS_PILOT_PAYLOAD.phase) {
        pilotPayloadValidationErrors.push("phase mismatch");
      }
      if (pilotPayloadJson?.targetRef !== EXPECTED_TARGET_REF) {
        pilotPayloadValidationErrors.push("targetRef mismatch");
      }
      if (pilotPayloadJson?.targetName !== EXPECTED_TARGET_NAME) {
        pilotPayloadValidationErrors.push("targetName mismatch");
      }
      if (pilotPayloadJson?.batchId !== EXPECTED_BATCH_ID) {
        pilotPayloadValidationErrors.push("batchId mismatch");
      }
      if (!["GO", "PARCIAL"].includes(String(pilotPayloadJson?.payloadDecision || "").toUpperCase())) {
        pilotPayloadValidationErrors.push("payload decision is not GO/PARCIAL");
      }
      const sourceOk =
        typeof pilotPayloadJson?.payloadOrigin?.primarySource === "string" &&
        pilotPayloadJson.payloadOrigin.primarySource.includes("phase-22g-r2-baseline-dry-run.mjs");
      if (!sourceOk) {
        pilotPayloadValidationErrors.push("payload origin source mismatch");
      }
      const sectionOk = String(pilotPayloadJson?.payloadOrigin?.section || "").includes("BASELINE_SIMULATION.product_groups");
      if (!sectionOk) {
        pilotPayloadValidationErrors.push("payload origin section mismatch");
      }

      const frozenRecords = pilotPayloadJson?.frozenPayload?.records;
      if (!Array.isArray(frozenRecords) || frozenRecords.length !== 1) {
        pilotPayloadValidationErrors.push("frozen payload must contain exactly 1 record");
      } else {
        const [record] = frozenRecords;
        if (pilotPayloadJson?.frozenPayload?.entity !== EXPECTED_PRODUCT_GROUPS_PILOT_PAYLOAD.entity) {
          pilotPayloadValidationErrors.push("frozen payload entity mismatch");
        }
        if (record?.temp_key !== EXPECTED_PRODUCT_GROUPS_PILOT_PAYLOAD.temp_key) {
          pilotPayloadValidationErrors.push("temp_key mismatch");
        }
        if (record?.value !== EXPECTED_PRODUCT_GROUPS_PILOT_PAYLOAD.value) {
          pilotPayloadValidationErrors.push("value mismatch");
        }
        if (record?.label !== EXPECTED_PRODUCT_GROUPS_PILOT_PAYLOAD.label) {
          pilotPayloadValidationErrors.push("label mismatch");
        }
        if (record?.tenant_id !== EXPECTED_PRODUCT_GROUPS_PILOT_PAYLOAD.tenant_id) {
          pilotPayloadValidationErrors.push("tenant_id mismatch");
        }
        if (record?.created_by !== EXPECTED_PRODUCT_GROUPS_PILOT_PAYLOAD.created_by) {
          pilotPayloadValidationErrors.push("created_by mismatch");
        }
      }

      const tenantPolicyIsNull =
        pilotPayloadJson?.tenantPolicy?.tenant_id === null &&
        String(pilotPayloadJson?.tenantPolicy?.mode || "").toLowerCase().includes("null");
      if (!tenantPolicyIsNull) {
        pilotPayloadValidationErrors.push("tenant policy must be null scope");
      }

      const createdByNullOrOmit =
        pilotPayloadJson?.createdByPolicy?.created_by === null &&
        String(pilotPayloadJson?.createdByPolicy?.mode || "").toLowerCase().includes("null");
      if (!createdByNullOrOmit) {
        pilotPayloadValidationErrors.push("created_by policy must be null/omit");
      }

      const dimensionDefaultOk = String(pilotPayloadJson?.requiredDefaultsPolicy?.dimension_profile?.default || "")
        .toLowerCase()
        .includes("'none'::dimension_profile");
      const fichaDefaultOk = String(pilotPayloadJson?.requiredDefaultsPolicy?.ficha_profile?.default || "")
        .toLowerCase()
        .includes("'none'::text");
      if (!dimensionDefaultOk) {
        pilotPayloadValidationErrors.push("dimension_profile default must be none");
      }
      if (!fichaDefaultOk) {
        pilotPayloadValidationErrors.push("ficha_profile default must be none");
      }

      const idempotencyByValue = String(pilotPayloadJson?.idempotencyRule?.key || "") === "value";
      if (!idempotencyByValue) {
        pilotPayloadValidationErrors.push("idempotency key must be value");
      }

      if (pilotPayloadValidationErrors.length > 0) {
        noGoReasons.push(`Pilot payload validation failed: ${pilotPayloadValidationErrors.join(", ")}`);
        pushValidation(validations, "pilot.payload.compatibility", "FAIL", "Pilot payload metadata incompatible.");
      } else {
        pushValidation(validations, "pilot.payload.compatibility", "PASS", "Pilot payload metadata validated.");
      }
    }

    try {
      const uniqueRows = runSupabaseDbQuery(`
        select exists(
          select 1
          from pg_constraint c
          join pg_class t on t.oid = c.conrelid
          join pg_namespace n on n.oid = t.relnamespace
          where n.nspname = 'public'
            and t.relname = 'product_groups'
            and c.contype = 'u'
            and pg_get_constraintdef(c.oid) ilike '%(value)%'
        ) as has_unique_value
      `);
      productGroupsUniqueValuePresent = uniqueRows[0]?.has_unique_value === true;
      if (!productGroupsUniqueValuePresent) {
        noGoReasons.push("UNIQUE(value) was not found for public.product_groups.");
        pushValidation(validations, "pilot.product_groups.unique_value", "FAIL", "UNIQUE(value) is required.");
      } else {
        pushValidation(validations, "pilot.product_groups.unique_value", "PASS", "UNIQUE(value) validated.");
      }
    } catch {
      noGoReasons.push("Unable to validate UNIQUE(value) for public.product_groups.");
      pushValidation(validations, "pilot.product_groups.unique_value", "FAIL", "Failed to validate UNIQUE(value).");
    }

    try {
      const cols = runSupabaseDbQuery(`
        select column_name, is_nullable, column_default
        from information_schema.columns
        where table_schema = 'public' and table_name = 'product_groups'
          and column_name in ('tenant_id', 'created_by', 'dimension_profile', 'ficha_profile')
      `);
      for (const row of cols) {
        if (row.column_name === "tenant_id") productGroupsTenantNullable = row.is_nullable === "YES";
        if (row.column_name === "created_by") productGroupsCreatedByNullable = row.is_nullable === "YES";
        if (row.column_name === "dimension_profile") productGroupsDimensionDefault = row.column_default || null;
        if (row.column_name === "ficha_profile") productGroupsFichaDefault = row.column_default || null;
      }
      if (productGroupsTenantNullable !== true) {
        noGoReasons.push("product_groups.tenant_id must be nullable for 22AK policy.");
      }
      if (productGroupsCreatedByNullable !== true) {
        noGoReasons.push("product_groups.created_by must be nullable for 22AK policy.");
      }
      if (!String(productGroupsDimensionDefault || "").toLowerCase().includes("'none'::dimension_profile")) {
        noGoReasons.push("product_groups.dimension_profile default must be none.");
      }
      if (!String(productGroupsFichaDefault || "").toLowerCase().includes("'none'::text")) {
        noGoReasons.push("product_groups.ficha_profile default must be none.");
      }
      pushValidation(validations, "pilot.product_groups.defaults_and_nullable", "PASS", "Defaults and nullable policies validated.");
    } catch {
      noGoReasons.push("Unable to validate product_groups defaults/nullable metadata.");
      pushValidation(
        validations,
        "pilot.product_groups.defaults_and_nullable",
        "FAIL",
        "Failed to validate product_groups defaults/nullable metadata.",
      );
    }

    try {
      const countRows = runSupabaseDbQuery(
        "select count(*)::bigint as total_rows from public.product_groups",
      );
      productGroupsCountCurrent = Number(countRows[0]?.total_rows ?? 0);
      pushValidation(validations, "pilot.product_groups.current_count", "PASS", "Current product_groups count collected.");
    } catch {
      noGoReasons.push("Unable to read current count from public.product_groups.");
      pushValidation(validations, "pilot.product_groups.current_count", "FAIL", "Failed to read product_groups count.");
    }

    const candidateValue = EXPECTED_PRODUCT_GROUPS_PILOT_PAYLOAD.value;
    const candidateLabel = EXPECTED_PRODUCT_GROUPS_PILOT_PAYLOAD.label;
    try {
      const valueRows = runSupabaseDbQuery(
        `select count(*)::bigint as value_count from public.product_groups where value = '${escapeSqlLiteral(candidateValue)}'`,
      );
      productGroupsValueCollisionCount = Number(valueRows[0]?.value_count ?? 0);
      if (productGroupsValueCollisionCount > 0) {
        pushValidation(
          validations,
          "pilot.product_groups.value_collision",
          "PARTIAL",
          "Value exists; full idempotent payload match must be checked in real pilot before/write stage.",
        );
      } else {
        pushValidation(validations, "pilot.product_groups.value_collision", "PASS", "No value collision detected.");
      }
    } catch {
      noGoReasons.push("Unable to validate value collision for product_groups pilot payload.");
      pushValidation(validations, "pilot.product_groups.value_collision", "FAIL", "Failed to validate value collision.");
    }

    try {
      const labelRows = runSupabaseDbQuery(
        `select count(*)::bigint as label_count from public.product_groups where label = '${escapeSqlLiteral(candidateLabel)}'`,
      );
      productGroupsLabelCollisionCount = Number(labelRows[0]?.label_count ?? 0);
      if (productGroupsLabelCollisionCount > 0) {
        pushValidation(
          validations,
          "pilot.product_groups.label_collision",
          "PARTIAL",
          "Label exists; full idempotent payload match must be checked in real pilot before/write stage.",
        );
      } else {
        pushValidation(validations, "pilot.product_groups.label_collision", "PASS", "No label collision detected.");
      }
    } catch {
      noGoReasons.push("Unable to validate label collision for product_groups pilot payload.");
      pushValidation(validations, "pilot.product_groups.label_collision", "FAIL", "Failed to validate label collision.");
    }
  }

  if (selectedPilotEntity === "product_subgroups") {
    const payloadPath = args.pilotPayload ? path.resolve(args.pilotPayload) : null;
    pilotPayloadExists = Boolean(payloadPath && fs.existsSync(payloadPath));
    if (!pilotPayloadExists) {
      noGoReasons.push(`Pilot payload file does not exist: ${args.pilotPayload || "missing"}`);
      pushValidation(validations, "pilot.payload.exists", "FAIL", "Pilot payload file was not found.");
    } else {
      pushValidation(validations, "pilot.payload.exists", "PASS", "Pilot payload file exists.");
      try {
        pilotPayloadJson = JSON.parse(fs.readFileSync(payloadPath, "utf8"));
        pilotPayloadParsed = true;
        pushValidation(validations, "pilot.payload.parse_json", "PASS", "Pilot payload parsed successfully.");
      } catch {
        noGoReasons.push("Pilot payload is not valid JSON.");
        pushValidation(validations, "pilot.payload.parse_json", "FAIL", "Pilot payload parsing failed.");
      }
    }

    if (pilotPayloadParsed) {
      if (pilotPayloadJson?.phase !== EXPECTED_PRODUCT_SUBGROUPS_PILOT_PAYLOAD.phase) {
        pilotPayloadValidationErrors.push("phase mismatch");
      }
      if (pilotPayloadJson?.targetRef !== EXPECTED_TARGET_REF) {
        pilotPayloadValidationErrors.push("targetRef mismatch");
      }
      if (pilotPayloadJson?.targetName !== EXPECTED_TARGET_NAME) {
        pilotPayloadValidationErrors.push("targetName mismatch");
      }
      if (pilotPayloadJson?.batchId !== EXPECTED_BATCH_ID) {
        pilotPayloadValidationErrors.push("batchId mismatch");
      }
      if (!["GO", "PARCIAL"].includes(String(pilotPayloadJson?.payloadDecision || "").toUpperCase())) {
        pilotPayloadValidationErrors.push("payload decision is not GO/PARCIAL");
      }
      const sourceOk =
        typeof pilotPayloadJson?.frozenPayload?.source === "string" &&
        pilotPayloadJson.frozenPayload.source === EXPECTED_PRODUCT_SUBGROUPS_PILOT_PAYLOAD.source;
      if (!sourceOk) {
        pilotPayloadValidationErrors.push("payload origin source mismatch");
      }
      const sectionOk = String(pilotPayloadJson?.payloadOrigin?.section || "").includes("BASELINE_SIMULATION.product_subgroups");
      if (!sectionOk) {
        pilotPayloadValidationErrors.push("payload origin section mismatch");
      }

      const frozenRecords = pilotPayloadJson?.frozenPayload?.records;
      if (!Array.isArray(frozenRecords) || frozenRecords.length !== 1) {
        pilotPayloadValidationErrors.push("frozen payload must contain exactly 1 record");
      } else {
        const [record] = frozenRecords;
        if (pilotPayloadJson?.frozenPayload?.entity !== EXPECTED_PRODUCT_SUBGROUPS_PILOT_PAYLOAD.entity) {
          pilotPayloadValidationErrors.push("frozen payload entity mismatch");
        }
        if (record?.temp_key !== EXPECTED_PRODUCT_SUBGROUPS_PILOT_PAYLOAD.temp_key) {
          pilotPayloadValidationErrors.push("temp_key mismatch");
        }
        if (record?.value !== EXPECTED_PRODUCT_SUBGROUPS_PILOT_PAYLOAD.value) {
          pilotPayloadValidationErrors.push("value mismatch");
        }
        if (record?.label !== EXPECTED_PRODUCT_SUBGROUPS_PILOT_PAYLOAD.label) {
          pilotPayloadValidationErrors.push("label mismatch");
        }
        if (record?.tenant_id !== EXPECTED_PRODUCT_SUBGROUPS_PILOT_PAYLOAD.tenant_id) {
          pilotPayloadValidationErrors.push("tenant_id mismatch");
        }
        if (record?.created_by !== null && record?.created_by !== undefined) {
          pilotPayloadValidationErrors.push("created_by must be null/omitted");
        }
      }

      const tenantPolicyIsNull =
        pilotPayloadJson?.tenantPolicy?.tenant_id === null &&
        String(pilotPayloadJson?.tenantPolicy?.mode || "").toLowerCase().includes("null");
      if (!tenantPolicyIsNull) {
        pilotPayloadValidationErrors.push("tenant policy must be null scope");
      }
      const createdByNullOrOmit =
        pilotPayloadJson?.createdByPolicy?.created_by === null &&
        String(pilotPayloadJson?.createdByPolicy?.mode || "").toLowerCase().includes("null");
      if (!createdByNullOrOmit) {
        pilotPayloadValidationErrors.push("created_by policy must be null/omit");
      }

      const sortOrderDefaultOk = String(pilotPayloadJson?.defaultsPolicy?.sort_order?.default || "")
        .trim()
        .toLowerCase() === EXPECTED_PRODUCT_SUBGROUPS_PILOT_PAYLOAD.sort_order_default;
      const isActiveDefaultOk = String(pilotPayloadJson?.defaultsPolicy?.is_active?.default || "")
        .trim()
        .toLowerCase() === EXPECTED_PRODUCT_SUBGROUPS_PILOT_PAYLOAD.is_active_default;
      const createdAtDefaultOk = String(pilotPayloadJson?.defaultsPolicy?.created_at?.default || "")
        .toLowerCase()
        .includes(EXPECTED_PRODUCT_SUBGROUPS_PILOT_PAYLOAD.created_at_default);
      if (!sortOrderDefaultOk) pilotPayloadValidationErrors.push("sort_order default must be 0");
      if (!isActiveDefaultOk) pilotPayloadValidationErrors.push("is_active default must be true");
      if (!createdAtDefaultOk) pilotPayloadValidationErrors.push("created_at default must be now()");

      const noTechnicalLink =
        pilotPayloadJson?.technicalLinkToProductGroups?.hasProductGroupIdColumn === false &&
        pilotPayloadJson?.technicalLinkToProductGroups?.hasForeignKeyToProductGroups === false;
      if (!noTechnicalLink) {
        pilotPayloadValidationErrors.push("technical link to product_groups must be absent");
      }

      const idempotencyByValue = String(pilotPayloadJson?.idempotencyRule?.key || "") === "value";
      if (!idempotencyByValue) {
        pilotPayloadValidationErrors.push("idempotency key must be value");
      }

      if (pilotPayloadValidationErrors.length > 0) {
        noGoReasons.push(`Pilot payload validation failed: ${pilotPayloadValidationErrors.join(", ")}`);
        pushValidation(validations, "pilot.payload.compatibility", "FAIL", "Pilot payload metadata incompatible.");
      } else {
        pushValidation(validations, "pilot.payload.compatibility", "PASS", "Pilot payload metadata validated.");
      }
    }

    try {
      const uniqueRows = runSupabaseDbQuery(`
        select exists(
          select 1
          from pg_constraint c
          join pg_class t on t.oid = c.conrelid
          join pg_namespace n on n.oid = t.relnamespace
          where n.nspname = 'public'
            and t.relname = 'product_subgroups'
            and c.contype = 'u'
            and pg_get_constraintdef(c.oid) ilike '%(value)%'
        ) as has_unique_value
      `);
      productSubgroupsUniqueValuePresent = uniqueRows[0]?.has_unique_value === true;
      if (!productSubgroupsUniqueValuePresent) {
        noGoReasons.push("UNIQUE(value) was not found for public.product_subgroups.");
        pushValidation(validations, "pilot.product_subgroups.unique_value", "FAIL", "UNIQUE(value) is required.");
      } else {
        pushValidation(validations, "pilot.product_subgroups.unique_value", "PASS", "UNIQUE(value) validated.");
      }
    } catch {
      noGoReasons.push("Unable to validate UNIQUE(value) for public.product_subgroups.");
      pushValidation(validations, "pilot.product_subgroups.unique_value", "FAIL", "Failed to validate UNIQUE(value).");
    }

    try {
      const cols = runSupabaseDbQuery(`
        select column_name, is_nullable, column_default
        from information_schema.columns
        where table_schema = 'public' and table_name = 'product_subgroups'
      `);
      const colNames = new Set(cols.map((r) => r.column_name));
      productSubgroupsHasProductGroupIdColumn = colNames.has("product_group_id");
      for (const row of cols) {
        if (row.column_name === "tenant_id") productSubgroupsTenantNullable = row.is_nullable === "YES";
        if (row.column_name === "created_by") productSubgroupsCreatedByNullable = row.is_nullable === "YES";
        if (row.column_name === "sort_order") productSubgroupsSortOrderDefault = row.column_default || null;
        if (row.column_name === "is_active") productSubgroupsIsActiveDefault = row.column_default || null;
        if (row.column_name === "created_at") productSubgroupsCreatedAtDefault = row.column_default || null;
      }
      if (productSubgroupsHasProductGroupIdColumn) noGoReasons.push("product_subgroups must not define product_group_id in current pilot contract.");
      if (productSubgroupsTenantNullable !== true) noGoReasons.push("product_subgroups.tenant_id must be nullable.");
      if (productSubgroupsCreatedByNullable !== true) noGoReasons.push("product_subgroups.created_by must be nullable.");
      if (!String(productSubgroupsSortOrderDefault || "").trim().startsWith("0")) noGoReasons.push("product_subgroups.sort_order default must be 0.");
      if (!String(productSubgroupsIsActiveDefault || "").trim().toLowerCase().startsWith("true")) noGoReasons.push("product_subgroups.is_active default must be true.");
      if (!String(productSubgroupsCreatedAtDefault || "").toLowerCase().includes("now()")) noGoReasons.push("product_subgroups.created_at default must be now().");
      pushValidation(validations, "pilot.product_subgroups.defaults_and_nullable", "PASS", "Defaults and nullable policies validated.");
    } catch {
      noGoReasons.push("Unable to validate product_subgroups defaults/nullable metadata.");
      pushValidation(
        validations,
        "pilot.product_subgroups.defaults_and_nullable",
        "FAIL",
        "Failed to validate product_subgroups defaults/nullable metadata.",
      );
    }

    try {
      const fkRows = runSupabaseDbQuery(`
        select pg_get_constraintdef(c.oid) as fk_def
        from pg_constraint c
        join pg_class t on t.oid = c.conrelid
        join pg_namespace n on n.oid = t.relnamespace
        where n.nspname='public'
          and t.relname='product_subgroups'
          and c.contype='f'
      `);
      productSubgroupsHasFkToProductGroups = fkRows.some((r) =>
        String(r.fk_def || "").toLowerCase().includes("product_groups"),
      );
      if (productSubgroupsHasFkToProductGroups) {
        noGoReasons.push("product_subgroups must not have FK to product_groups for 22AS-R2 assumptions.");
      }
      pushValidation(validations, "pilot.product_subgroups.no_fk_product_groups", "PASS", "No FK to product_groups detected.");
    } catch {
      noGoReasons.push("Unable to validate FK absence to product_groups for product_subgroups.");
      pushValidation(validations, "pilot.product_subgroups.no_fk_product_groups", "FAIL", "Failed FK absence validation.");
    }

    try {
      const countRows = runSupabaseDbQuery("select count(*)::bigint as total_rows from public.product_subgroups");
      productSubgroupsCountCurrent = Number(countRows[0]?.total_rows ?? 0);
      pushValidation(validations, "pilot.product_subgroups.current_count", "PASS", "Current product_subgroups count collected.");
    } catch {
      noGoReasons.push("Unable to read current count from public.product_subgroups.");
      pushValidation(validations, "pilot.product_subgroups.current_count", "FAIL", "Failed to read product_subgroups count.");
    }

    const candidateValue = EXPECTED_PRODUCT_SUBGROUPS_PILOT_PAYLOAD.value;
    const candidateLabel = EXPECTED_PRODUCT_SUBGROUPS_PILOT_PAYLOAD.label;
    try {
      const valueRows = runSupabaseDbQuery(
        `select count(*)::bigint as value_count from public.product_subgroups where value = '${escapeSqlLiteral(candidateValue)}'`,
      );
      productSubgroupsValueCollisionCount = Number(valueRows[0]?.value_count ?? 0);
      if (productSubgroupsValueCollisionCount > 0) {
        pushValidation(
          validations,
          "pilot.product_subgroups.value_collision",
          "PARTIAL",
          "Value exists; full idempotent payload match must be checked in future pilot write stage.",
        );
      } else {
        pushValidation(validations, "pilot.product_subgroups.value_collision", "PASS", "No value collision detected.");
      }
    } catch {
      noGoReasons.push("Unable to validate value collision for product_subgroups pilot payload.");
      pushValidation(validations, "pilot.product_subgroups.value_collision", "FAIL", "Failed to validate value collision.");
    }

    try {
      const labelRows = runSupabaseDbQuery(
        `select count(*)::bigint as label_count from public.product_subgroups where label = '${escapeSqlLiteral(candidateLabel)}'`,
      );
      productSubgroupsLabelCollisionCount = Number(labelRows[0]?.label_count ?? 0);
      if (productSubgroupsLabelCollisionCount > 0) {
        pushValidation(
          validations,
          "pilot.product_subgroups.label_collision",
          "PARTIAL",
          "Label exists; full idempotent payload match must be checked in future pilot write stage.",
        );
      } else {
        pushValidation(validations, "pilot.product_subgroups.label_collision", "PASS", "No label collision detected.");
      }
    } catch {
      noGoReasons.push("Unable to validate label collision for product_subgroups pilot payload.");
      pushValidation(validations, "pilot.product_subgroups.label_collision", "FAIL", "Failed to validate label collision.");
    }
  }

  const preflightDecision = classifyDecision(noGoReasons, partialReasons);
  const notWritableEntities = [...new Set([...blockedEntitiesFound, ...referenceOnlyEntitiesFound])].sort();

  const partialPolicy22NR2 = shouldAcceptPartialByPolicy22NR2({
    preflightDecision,
    noGoReasons,
    partialReasons,
    referenceOnlyEntitiesFound,
    blockedEntitiesFound,
    companyContactsWritePlanSignals: writePlanAnalysis.companyContactsWriteSignals,
    unknownEntitiesFound,
  });

  const fixedWriteOrder = buildPlannedWriteOrder();
  const inputCounts = inputJson?.simulated_records_count && typeof inputJson.simulated_records_count === "object"
    ? inputJson.simulated_records_count
    : {};
  const eligibleEntitiesForPlannedWrite = fixedWriteOrder.filter(
    (entity) => entity !== "tenant_context_validation_only" && inputEntities.includes(entity),
  );
  const ignoredEntities = inputEntities.filter((entity) => !eligibleEntitiesForPlannedWrite.includes(entity)).sort();
  const plannedCountsByEntity = {};
  const planGaps = [];
  eligibleEntitiesForPlannedWrite.forEach((entity) => {
    if (Object.prototype.hasOwnProperty.call(inputCounts, entity)) {
      plannedCountsByEntity[entity] = inputCounts[entity];
    } else {
      plannedCountsByEntity[entity] = null;
      planGaps.push(`Missing simulated_records_count for ${entity}`);
    }
  });

  const planNoGoReasons = [];
  const planPartialReasons = [];

  if (preflightDecision === "NO-GO") {
    planNoGoReasons.push("Preflight decision is NO-GO.");
  }
  if (!partialPolicy22NR2.accepted) {
    planNoGoReasons.push(partialPolicy22NR2.reason);
  }
  if (referenceOnlyEntitiesFound.includes("company_contacts") && !notWritableEntities.includes("company_contacts")) {
    planNoGoReasons.push("company_contacts is not enforced as non-writable.");
  }
  if (writePlanAnalysis.companyContactsWriteSignals.length > 0) {
    planNoGoReasons.push("company_contacts appears in write-plan fields.");
  }
  if (blockedEntitiesFound.length > 0) {
    planNoGoReasons.push(`Blocked entities found: ${blockedEntitiesFound.join(", ")}`);
  }
  if (planGaps.length > 0) {
    planPartialReasons.push("Some planned entity counts are unavailable in input metadata.");
  }

  let planDecision = classifyDecision(planNoGoReasons, planPartialReasons);
  const roundOneExcludedEntities = ["profiles", "company_contacts"];
  const executableEntitiesRoundOne22Q = eligibleEntitiesForPlannedWrite.filter((entity) =>
    FIRST_ROUND_EXECUTABLE_ENTITIES_22Q.has(entity),
  );
  const excludedEntitiesRoundOne22Q = [...new Set([...roundOneExcludedEntities, ...ignoredEntities])].sort();

  if (executableEntitiesRoundOne22Q.includes("profiles")) {
    planNoGoReasons.push("profiles cannot be executable in first round 22Q-R2.");
  }
  if (executableEntitiesRoundOne22Q.includes("company_contacts")) {
    planNoGoReasons.push("company_contacts cannot be executable in first round 22Q-R2.");
  }

  const blockedExecutableEntities22Q = executableEntitiesRoundOne22Q.filter((entity) => BLOCKED_ENTITIES.has(entity));
  if (blockedExecutableEntities22Q.length > 0) {
    planNoGoReasons.push(`Blocked entities in executable set: ${blockedExecutableEntities22Q.join(", ")}`);
  }
  planDecision = classifyDecision(planNoGoReasons, planPartialReasons);

  const plannedOperations = executableEntitiesRoundOne22Q.map((entity) => ({
    entity,
    action: "upsert_planned",
    executableIn22Q: false,
    reason: "Hard stop final active; no database mutation allowed in 22Q-R2",
    plannedCount: Object.prototype.hasOwnProperty.call(plannedCountsByEntity, entity) ? plannedCountsByEntity[entity] : null,
  }));

  const armedNoGoReasons = [];
  const armedPartialReasons = [];
  if (preflightDecision === "NO-GO") armedNoGoReasons.push("Preflight decision is NO-GO.");
  if (!writePlanParsed) armedNoGoReasons.push("Write plan is not parsed/validated.");
  if (writePlanValidationErrors.length > 0) armedNoGoReasons.push("Write plan compatibility errors detected.");
  if (blockedExecutableEntities22Q.length > 0) armedNoGoReasons.push("Executable set contains blocked entities.");
  if (planNoGoReasons.length > 0) armedNoGoReasons.push(...planNoGoReasons);
  if (plannedOperations.length === 0) armedPartialReasons.push("No executable entities available in round one.");

  const armedWriteDecision = classifyDecision(armedNoGoReasons, armedPartialReasons);

  const activePilotEntity = selectedPilotEntity || EXPECTED_PILOT_ENTITY;
  const pilotOperation =
    activePilotEntity === "product_types"
      ? {
          entity: "product_types",
          action: "insert_pilot_planned",
          value: EXPECTED_PRODUCT_TYPES_PILOT_PAYLOAD.value,
          label: EXPECTED_PRODUCT_TYPES_PILOT_PAYLOAD.label,
          tenant_id: null,
          executableIn22AE: false,
          realExecutionBlocked: true,
          reason: "Hard stop final active; no database mutation allowed in 22AE-R2",
        }
      : activePilotEntity === "product_groups"
        ? {
            entity: "product_groups",
            action: "insert_pilot_planned",
            value: EXPECTED_PRODUCT_GROUPS_PILOT_PAYLOAD.value,
            label: EXPECTED_PRODUCT_GROUPS_PILOT_PAYLOAD.label,
            tenant_id: null,
            created_by: null,
            defaultsExpected: {
              dimension_profile: "none",
              ficha_profile: "none",
            },
            executableIn22AL: false,
            realExecutionBlocked: true,
            reason: "Hard stop final active; no database mutation allowed in 22AL-R2",
          }
      : activePilotEntity === "product_subgroups"
        ? {
            entity: "product_subgroups",
            action: "insert_pilot_planned",
            value: EXPECTED_PRODUCT_SUBGROUPS_PILOT_PAYLOAD.value,
            label: EXPECTED_PRODUCT_SUBGROUPS_PILOT_PAYLOAD.label,
            tenant_id: null,
            created_by: null,
            defaultsExpected: {
              sort_order: 0,
              is_active: true,
              created_at: "now()",
            },
            productGroupLink: {
              technicallySupported: false,
              reason: "product_subgroups has no product_group_id column/FK in current schema",
            },
            executableIn22AT: true,
            realExecutionBlocked: true,
            reason: "Execution remains blocked unless beforeDecision is GO in 22AT-R2 real pilot path.",
          }
      : {
          entity: "legal_entities",
          action: "upsert_pilot_planned",
          executableIn22S: false,
          realExecutionBlocked: true,
          reason: "Hard stop final active; no database mutation allowed in 22S-R2",
        };

  const pilotNoGoReasons = [];
  const pilotPartialReasons = [];
  const writePlanEligibleEntities = Array.isArray(writePlanJson?.eligibleEntitiesForWrite)
    ? writePlanJson.eligibleEntitiesForWrite
    : [];
  const writePlanOrder = Array.isArray(writePlanJson?.plannedWriteOrder) ? writePlanJson.plannedWriteOrder : [];
  const pilotPlannedCount = Object.prototype.hasOwnProperty.call(plannedCountsByEntity, activePilotEntity)
    ? plannedCountsByEntity[activePilotEntity]
    : null;
  const pilotTmpPrefixCount =
    typeof writePlanJson?.batchTraceabilityStrategy?.tmpPrefixCounts?.[activePilotEntity] === "number"
      ? writePlanJson.batchTraceabilityStrategy.tmpPrefixCounts[activePilotEntity]
      : null;

  if (!args.executePilotWrite) {
    pilotPartialReasons.push("Pilot execution flag is absent; pilot checks were not fully armed.");
  }

  if (selectedPilotEntity && !ALLOWED_PILOT_ENTITIES.has(selectedPilotEntity)) {
    pilotNoGoReasons.push("Pilot entity must be legal_entities, product_types, product_groups or product_subgroups.");
  }
  if (args.pilotAuthorization && args.pilotAuthorization !== expectedPilotAuthorization) {
    pilotNoGoReasons.push("Pilot authorization phrase is invalid.");
  }

  if (args.executePilotWrite) {
    if (!selectedPilotEntity || !ALLOWED_PILOT_ENTITIES.has(selectedPilotEntity)) {
      pilotNoGoReasons.push("Pilot mode armed without an allowed pilot entity.");
    }
    if (args.pilotAuthorization !== expectedPilotAuthorization) {
      pilotNoGoReasons.push("Pilot mode armed without exact pilot authorization.");
    }
    if (
      (selectedPilotEntity === "product_types" ||
        selectedPilotEntity === "product_groups" ||
        selectedPilotEntity === "product_subgroups") &&
      (!args.pilotPayload || !pilotPayloadParsed)
    ) {
      pilotNoGoReasons.push(`Pilot mode armed for ${selectedPilotEntity} without validated --pilot-payload.`);
    }
  }

  if (!writePlanEligibleEntities.includes(activePilotEntity)) {
    pilotNoGoReasons.push(`${activePilotEntity} is missing from write plan eligible entities.`);
  }
  if (!executableEntitiesRoundOne22Q.includes(activePilotEntity)) {
    pilotNoGoReasons.push(`${activePilotEntity} is missing from first round executable entities.`);
  }
  if (executableEntitiesRoundOne22Q.includes("profiles")) {
    pilotNoGoReasons.push("profiles must remain excluded from first round pilot.");
  }
  if (executableEntitiesRoundOne22Q.includes("company_contacts")) {
    pilotNoGoReasons.push("company_contacts must remain excluded from first round pilot.");
  }
  if (BLOCKED_ENTITIES.has(activePilotEntity)) {
    pilotNoGoReasons.push(`${activePilotEntity} cannot be blocked or transactional.`);
  }
  if (writePlanOrder.length > 0 && !writePlanOrder.includes(activePilotEntity)) {
    pilotNoGoReasons.push(`${activePilotEntity} is missing from planned write order.`);
  }
  if (activePilotEntity === EXPECTED_PILOT_ENTITY && writePlanOrder.includes("profiles")) {
    const legalIdx = writePlanOrder.indexOf(activePilotEntity);
    const profilesIdx = writePlanOrder.indexOf("profiles");
    if (legalIdx > profilesIdx) {
      pilotNoGoReasons.push(`${activePilotEntity} appears after profiles in write order, violating pilot dependency rule.`);
    }
  }
  if (writePlanOrder.includes("company_contacts")) {
    pilotNoGoReasons.push("company_contacts must not appear in write order for pilot validation.");
  }
  if (pilotPlannedCount === null) {
    pilotPartialReasons.push(`Planned count for ${activePilotEntity} is unavailable.`);
  }
  if (selectedPilotEntity === "product_types" && pilotPayloadValidationErrors.length > 0) {
    pilotNoGoReasons.push("product_types pilot payload compatibility is invalid.");
  }
  if (selectedPilotEntity === "product_types" && productTypesUniqueValuePresent !== true) {
    pilotNoGoReasons.push("product_types requires UNIQUE(value) for pilot.");
  }
  if (selectedPilotEntity === "product_groups" && pilotPayloadValidationErrors.length > 0) {
    pilotNoGoReasons.push("product_groups pilot payload compatibility is invalid.");
  }
  if (selectedPilotEntity === "product_groups" && productGroupsUniqueValuePresent !== true) {
    pilotNoGoReasons.push("product_groups requires UNIQUE(value) for pilot.");
  }
  if (selectedPilotEntity === "product_subgroups" && pilotPayloadValidationErrors.length > 0) {
    pilotNoGoReasons.push("product_subgroups pilot payload compatibility is invalid.");
  }
  if (selectedPilotEntity === "product_subgroups" && productSubgroupsUniqueValuePresent !== true) {
    pilotNoGoReasons.push("product_subgroups requires UNIQUE(value) for pilot.");
  }

  const pilotDecisionFinal = classifyDecision(pilotNoGoReasons, pilotPartialReasons);

  const writeStatusMessage = args.write
    ? "WRITE MODE ARMED: execution remains restricted by phase-specific guard rails."
    : "--write ausente; nenhuma escrita sera executada.";
  const phase22OBlockingMessage = "WRITE PLAN GERADO, MAS EXECUÇÃO REAL CONTINUA BLOQUEADA NA FASE 22O-R2.";
  const phase22QHardStopMessage =
    "EXECUÇÃO REAL BLOQUEADA NA FASE 22Q-R2. Operações montadas em memória, mas nenhuma mutação foi executada.";
  const phase22SHardStopMessage =
    "EXECUÇÃO PILOTO REAL BLOQUEADA NA FASE 22S-R2. legal_entities validada como piloto, mas nenhuma mutação foi executada.";
  const phase22ALHardStopMessage =
    "EXECUÇÃO PILOTO product_groups BLOQUEADA NA FASE 22AL-R2. Payload validado, mas nenhuma mutação foi executada.";
  const phase22ASHardStopMessage =
    "EXECUÇÃO PILOTO product_subgroups BLOQUEADA NA FASE 22AS-R2. Payload validado, mas nenhuma mutação foi executada.";
  const phase22AMStopAfterPilotMessage =
    "ESCRITA PILOTO CONCLUÍDA SOMENTE EM product_groups. EXECUÇÃO AMPLIADA BLOQUEADA.";
  const phase22AFStopAfterPilotMessage =
    "ESCRITA PILOTO CONCLUÍDA SOMENTE EM product_types. EXECUÇÃO AMPLIADA BLOQUEADA.";
  const phase22ATStopAfterPilotMessage =
    "ESCRITA PILOTO CONCLUÍDA SOMENTE EM product_subgroups. EXECUÇÃO AMPLIADA BLOQUEADA.";
  const phase22TStopAfterPilotMessage =
    "ESCRITA PILOTO CONCLUÍDA SOMENTE EM legal_entities. EXECUÇÃO AMPLIADA BLOQUEADA.";

  const evidenceDir = path.resolve("artifacts/migration/phase-22k-r2-baseline-write");
  fs.mkdirSync(evidenceDir, { recursive: true });
  const evidencePath = path.join(evidenceDir, `preflight-${nowStamp()}.json`);

  const evidence = {
    phase: "22K-R2",
    timestamp: new Date().toISOString(),
    expectedTargetRef: EXPECTED_TARGET_REF,
    expectedTargetName: EXPECTED_TARGET_NAME,
    localTargetRef,
    localTargetName,
    expectedBatchId: EXPECTED_BATCH_ID,
    receivedBatchId: args.batch || null,
    authorizationValid: args.authorization === EXPECTED_AUTHORIZATION,
    pilotAuthorizationValid: args.pilotAuthorization === expectedPilotAuthorization,
    pilotEntity: selectedPilotEntity,
    pilotPayloadPath: args.pilotPayload || null,
    pilotPayloadExists,
    pilotPayloadParsed,
    pilotPayloadValidationErrors,
    productTypesUniqueValuePresent,
    productTypesCountCurrent,
    productTypesValueCollisionCount,
    productTypesLabelCollisionCount,
    productGroupsUniqueValuePresent,
    productGroupsCountCurrent,
    productGroupsValueCollisionCount,
    productGroupsLabelCollisionCount,
    productGroupsTenantNullable,
    productGroupsCreatedByNullable,
    productGroupsDimensionDefault,
    productGroupsFichaDefault,
    productSubgroupsUniqueValuePresent,
    productSubgroupsCountCurrent,
    productSubgroupsValueCollisionCount,
    productSubgroupsLabelCollisionCount,
    productSubgroupsTenantNullable,
    productSubgroupsCreatedByNullable,
    productSubgroupsSortOrderDefault,
    productSubgroupsIsActiveDefault,
    productSubgroupsCreatedAtDefault,
    productSubgroupsHasProductGroupIdColumn,
    productSubgroupsHasFkToProductGroups,
    inputProvided: args.input || null,
    inputExists,
    inputParsed,
    entitiesFound: inputEntities,
    allowedEntitiesFound,
    allowedEntities: [...ALLOWED_ENTITIES].sort(),
    blockedEntities: [...BLOCKED_ENTITIES].sort(),
    blockedEntitiesFound,
    referenceOnlyEntities: [...INPUT_REFERENCE_ONLY_ENTITIES].sort(),
    referenceOnlyEntitiesFound,
    unknownEntitiesFound,
    notWritableEntities,
    writePlanFieldsFound: writePlanAnalysis.fieldsFound,
    companyContactsWritePlanSignals: writePlanAnalysis.companyContactsWriteSignals,
    companyContactsHandling:
      "company_contacts is accepted only as reference-only input metadata and remains prohibited for write operations.",
    companyContactsWritable: false,
    companyContactsLinkStrategy: "contacts.company_id",
    receivedFlags: args.receivedFlags,
    forbiddenFlagsFound: args.forbiddenFlags,
    unknownFlagsFound: args.unknownFlags,
    validations,
    gaps,
    decision: preflightDecision,
    reasons: {
      noGoReasons,
      partialReasons,
    },
    partialPolicy22NR2,
    writePlanPreview: {
      fixedWriteOrder,
      eligibleEntitiesForPlannedWrite,
      ignoredEntities,
      referenceOnlyEntitiesFound,
      plannedCountsByEntity,
      planDecision,
      executableEntitiesRoundOne22Q,
      excludedEntitiesRoundOne22Q,
    },
    writePlanArg: args.writePlan || null,
    writePlanExists,
    writePlanParsed,
    writePlanValidationErrors,
    writeFunctionalEnabled: false,
    message: writeStatusMessage,
  };

  fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2), "utf8");

  const writePlanDir = path.resolve("artifacts/migration/phase-22o-r2-baseline-write-plan");
  fs.mkdirSync(writePlanDir, { recursive: true });
  const writePlanPath = path.join(writePlanDir, `write-plan-${nowStamp()}.json`);
  const writePlan = {
    phase: "22O-R2",
    timestamp: new Date().toISOString(),
    targetRef: EXPECTED_TARGET_REF,
    targetName: EXPECTED_TARGET_NAME,
    batchId: EXPECTED_BATCH_ID,
    inputPath: args.input || null,
    preflightDecision,
    partialAcceptedByPolicy22NR2: partialPolicy22NR2.accepted,
    partialPolicyReason: partialPolicy22NR2.reason,
    eligibleEntitiesForWrite: eligibleEntitiesForPlannedWrite,
    ignoredEntities,
    referenceOnlyEntities: referenceOnlyEntitiesFound,
    blockedEntitiesFound,
    unknownEntitiesFound,
    plannedWriteOrder: fixedWriteOrder,
    plannedCountsByEntity,
    batchTraceabilityStrategy: {
      batchId: EXPECTED_BATCH_ID,
      keyHint: "use batch id and temporary keys from 22F/22G evidence",
      tmpPrefixCounts: inputJson?.tmp_prefix_existing_count || {},
    },
    companyContactsHandling: {
      writable: false,
      linkStrategy: "contacts.company_id",
      includedInPlan: false,
      reason: "company_contacts is reference-only and never eligible for write.",
    },
    confirmations: {
      companyContactsWillNotBeWritten: true,
      transactionalEntitiesWillNotBeWritten: true,
      queueEntitiesWillNotBeWritten: true,
      externalIntegrationsWillNotBeCalled: true,
      writeExecutionBlocked: true,
    },
    planDecision,
    planReasons: {
      noGoReasons: planNoGoReasons,
      partialReasons: planPartialReasons,
    },
    planGaps,
    negativeConfirmations: {
      noSqlWriteExecuted: true,
      noDbWriteExecuted: true,
      noMigrationExecuted: true,
      noSeedCleanupRollbackExecuted: true,
      noErpApiWebhookN8nCalls: true,
      noQueueProcessing: true,
      noDeploy: true,
      noPush: true,
      noStagingProdChanges: true,
    },
    finalMessage: phase22OBlockingMessage,
  };
  fs.writeFileSync(writePlanPath, JSON.stringify(writePlan, null, 2), "utf8");

  const armedBeforeDir = path.resolve("artifacts/migration/phase-22q-r2-armed-write");
  fs.mkdirSync(armedBeforeDir, { recursive: true });
  const armedBeforePath = path.join(armedBeforeDir, `before-${nowStamp()}.json`);
  const armedBefore = {
    phase: "22Q-R2",
    timestamp: new Date().toISOString(),
    targetRef: EXPECTED_TARGET_REF,
    targetName: EXPECTED_TARGET_NAME,
    batchId: EXPECTED_BATCH_ID,
    inputPath: args.input || null,
    writePlanPath: args.writePlan || null,
    preflightDecision,
    writePlanDecisionFromInput: writePlanJson?.planDecision || null,
    partialPolicyAccepted: partialPolicy22NR2.accepted,
    partialPolicyReason: partialPolicy22NR2.reason,
    executableEntitiesFutureRoundOne: executableEntitiesRoundOne22Q,
    excludedEntitiesRoundOne22Q,
    exclusionsReason: {
      profiles: "profiles is conditional and excluded from first armed round in 22Q-R2.",
      company_contacts: "company_contacts is reference-only and not writable.",
    },
    plannedOperations,
    blockedEntitiesFound,
    referenceOnlyEntitiesFound,
    unknownEntitiesFound,
    validations,
    guardsConfirmation: {
      targetValidated: localTargetRef === EXPECTED_TARGET_REF && localTargetName === EXPECTED_TARGET_NAME,
      batchValidated: args.batch === EXPECTED_BATCH_ID,
      authorizationValidated: args.authorization === EXPECTED_AUTHORIZATION,
      forbiddenFlagsBlocked: args.forbiddenFlags.length === 0,
      unknownFlagsBlocked: args.unknownFlags.length === 0,
      writePlanValidated: writePlanParsed && writePlanValidationErrors.length === 0,
    },
    noOperationExecuted: true,
    realExecutionBlocked: true,
    armedWriteDecision,
    reasons: {
      noGoReasons: armedNoGoReasons,
      partialReasons: armedPartialReasons,
    },
    finalHardStopMessage: phase22QHardStopMessage,
  };
  fs.writeFileSync(armedBeforePath, JSON.stringify(armedBefore, null, 2), "utf8");

  const pilotEvidenceDir =
    selectedPilotEntity === "product_types"
      ? path.resolve("artifacts/migration/phase-22ae-r2-pilot-product-types")
      : selectedPilotEntity === "product_groups"
        ? path.resolve("artifacts/migration/phase-22al-r2-pilot-product-groups")
      : selectedPilotEntity === "product_subgroups"
        ? path.resolve("artifacts/migration/phase-22as-r2-pilot-product-subgroups")
      : path.resolve("artifacts/migration/phase-22s-r2-pilot-legal-entities");
  fs.mkdirSync(pilotEvidenceDir, { recursive: true });
  const pilotEvidencePath =
    selectedPilotEntity === "product_types"
      ? path.join(pilotEvidenceDir, `pilot-product-types-${nowStamp()}.json`)
      : selectedPilotEntity === "product_groups"
        ? path.join(pilotEvidenceDir, `pilot-product-groups-${nowStamp()}.json`)
      : selectedPilotEntity === "product_subgroups"
        ? path.join(pilotEvidenceDir, `pilot-product-subgroups-${nowStamp()}.json`)
      : path.join(pilotEvidenceDir, `pilot-legal-entities-${nowStamp()}.json`);
  const pilotEvidence = {
    phase:
      selectedPilotEntity === "product_types"
        ? "22AE-R2"
        : selectedPilotEntity === "product_groups"
          ? "22AM-R2"
          : selectedPilotEntity === "product_subgroups"
            ? "22AT-R2"
            : "22S-R2",
    timestamp: new Date().toISOString(),
    targetRef: EXPECTED_TARGET_REF,
    targetName: EXPECTED_TARGET_NAME,
    batchId: EXPECTED_BATCH_ID,
    inputPath: args.input || null,
    writePlanPath: args.writePlan || null,
    pilotPayloadPath: args.pilotPayload || null,
    generalAuthorizationValid: args.authorization === EXPECTED_AUTHORIZATION,
    pilotAuthorizationValid: args.pilotAuthorization === expectedPilotAuthorization,
    pilotEntity: selectedPilotEntity,
    pilotEntityValidated: selectedPilotEntity !== null && ALLOWED_PILOT_ENTITIES.has(selectedPilotEntity),
    pilotPayloadValidated:
      selectedPilotEntity === "product_types" ||
      selectedPilotEntity === "product_groups" ||
      selectedPilotEntity === "product_subgroups"
        ? pilotPayloadParsed && pilotPayloadValidationErrors.length === 0
        : null,
    pilotPlannedCount,
    pilotTmpPrefixCount,
    productTypesCurrentCount: selectedPilotEntity === "product_types" ? productTypesCountCurrent : null,
    productTypesValueCollisionCount: selectedPilotEntity === "product_types" ? productTypesValueCollisionCount : null,
    productTypesLabelCollisionCount: selectedPilotEntity === "product_types" ? productTypesLabelCollisionCount : null,
    productTypesUniqueValueValidated: selectedPilotEntity === "product_types" ? productTypesUniqueValuePresent : null,
    productGroupsCurrentCount: selectedPilotEntity === "product_groups" ? productGroupsCountCurrent : null,
    productGroupsValueCollisionCount: selectedPilotEntity === "product_groups" ? productGroupsValueCollisionCount : null,
    productGroupsLabelCollisionCount: selectedPilotEntity === "product_groups" ? productGroupsLabelCollisionCount : null,
    productGroupsUniqueValueValidated: selectedPilotEntity === "product_groups" ? productGroupsUniqueValuePresent : null,
    productGroupsTenantNullable: selectedPilotEntity === "product_groups" ? productGroupsTenantNullable : null,
    productGroupsCreatedByNullable: selectedPilotEntity === "product_groups" ? productGroupsCreatedByNullable : null,
    productGroupsDimensionDefault: selectedPilotEntity === "product_groups" ? productGroupsDimensionDefault : null,
    productGroupsFichaDefault: selectedPilotEntity === "product_groups" ? productGroupsFichaDefault : null,
    productSubgroupsCurrentCount: selectedPilotEntity === "product_subgroups" ? productSubgroupsCountCurrent : null,
    productSubgroupsValueCollisionCount:
      selectedPilotEntity === "product_subgroups" ? productSubgroupsValueCollisionCount : null,
    productSubgroupsLabelCollisionCount:
      selectedPilotEntity === "product_subgroups" ? productSubgroupsLabelCollisionCount : null,
    productSubgroupsUniqueValueValidated:
      selectedPilotEntity === "product_subgroups" ? productSubgroupsUniqueValuePresent : null,
    productSubgroupsTenantNullable:
      selectedPilotEntity === "product_subgroups" ? productSubgroupsTenantNullable : null,
    productSubgroupsCreatedByNullable:
      selectedPilotEntity === "product_subgroups" ? productSubgroupsCreatedByNullable : null,
    productSubgroupsSortOrderDefault:
      selectedPilotEntity === "product_subgroups" ? productSubgroupsSortOrderDefault : null,
    productSubgroupsIsActiveDefault:
      selectedPilotEntity === "product_subgroups" ? productSubgroupsIsActiveDefault : null,
    productSubgroupsCreatedAtDefault:
      selectedPilotEntity === "product_subgroups" ? productSubgroupsCreatedAtDefault : null,
    productSubgroupsHasProductGroupIdColumn:
      selectedPilotEntity === "product_subgroups" ? productSubgroupsHasProductGroupIdColumn : null,
    productSubgroupsHasFkToProductGroups:
      selectedPilotEntity === "product_subgroups" ? productSubgroupsHasFkToProductGroups : null,
    pilotOperation,
    pilotValidation: {
      existsInWritePlanEligibleEntities: writePlanEligibleEntities.includes(activePilotEntity),
      existsInFutureRoundOne: executableEntitiesRoundOne22Q.includes(activePilotEntity),
      noProfilesInFutureRoundOne: !executableEntitiesRoundOne22Q.includes("profiles"),
      noCompanyContactsInFutureRoundOne: !executableEntitiesRoundOne22Q.includes("company_contacts"),
      nonTransactionalEntity: !BLOCKED_ENTITIES.has(activePilotEntity),
      noQueueExecution: true,
      noExternalCalls: true,
      legalEntitiesWillNotBeTouchedAgain:
        selectedPilotEntity === "product_types" ||
        selectedPilotEntity === "product_groups" ||
        selectedPilotEntity === "product_subgroups",
      productTypesWillNotBeTouchedAgain:
        selectedPilotEntity === "product_groups" || selectedPilotEntity === "product_subgroups",
      productGroupsWillNotBeTouchedAgain: selectedPilotEntity === "product_subgroups",
      salesRepsBlocked: true,
      profilesExcluded: !executableEntitiesRoundOne22Q.includes("profiles"),
      companyContactsExcluded: !executableEntitiesRoundOne22Q.includes("company_contacts"),
      batchTraceabilityAvailable:
        typeof writePlanJson?.batchTraceabilityStrategy?.batchId === "string" &&
        writePlanJson.batchTraceabilityStrategy.batchId === EXPECTED_BATCH_ID,
    },
    confirmations: {
      noTransactionalExecution: true,
      noQueueProcessing: true,
      noErpApiN8nWebhookCalls: true,
      realExecutionBlocked: true,
      noMutationExecuted: true,
      noExpandedExecution: true,
    },
    preflightDecision,
    writePlanDecision: planDecision,
    armedWriteDecision,
    pilotDecision: pilotDecisionFinal,
    reasons: {
      noGoReasons: pilotNoGoReasons,
      partialReasons: pilotPartialReasons,
    },
    hardStopTriggered:
      selectedPilotEntity === "product_groups" || selectedPilotEntity === "product_subgroups"
        ? Boolean(args.executePilotWrite && args.write)
        : false,
    finalHardStopMessage:
      selectedPilotEntity === "product_types"
        ? phase22AFStopAfterPilotMessage
        : selectedPilotEntity === "product_groups"
          ? phase22AMStopAfterPilotMessage
        : selectedPilotEntity === "product_subgroups"
          ? phase22ATStopAfterPilotMessage
        : phase22SHardStopMessage,
  };
  fs.writeFileSync(pilotEvidencePath, JSON.stringify(pilotEvidence, null, 2), "utf8");

  const phase22TDir = path.resolve(PILOT_T_WRITE_DIR);
  fs.mkdirSync(phase22TDir, { recursive: true });
  const phase22AFDir = path.resolve("artifacts/migration/phase-22af-r2-pilot-product-types-write");
  fs.mkdirSync(phase22AFDir, { recursive: true });
  const phase22AMDir = path.resolve("artifacts/migration/phase-22am-r2-pilot-product-groups-write");
  fs.mkdirSync(phase22AMDir, { recursive: true });
  const phase22ATDir = path.resolve("artifacts/migration/phase-22at-r2-pilot-product-subgroups-write");
  fs.mkdirSync(phase22ATDir, { recursive: true });
  let pilotWriteBeforePath = "not_generated";
  let pilotWriteAfterPath = "not_generated";
  let pilotWriteBeforeDecision = "GO";
  let pilotWriteAfterDecision = "GO";
  let pilotWriteOperation = "not_applicable";
  let pilotWriteDelta = null;
  let pilotWriteRecord = null;
  let recordsAffected = [];
  const legalPilotMode = selectedPilotEntity === "legal_entities";
  const productTypesPilotMode = selectedPilotEntity === "product_types";
  const productGroupsPilotMode = selectedPilotEntity === "product_groups";
  const productSubgroupsPilotMode = selectedPilotEntity === "product_subgroups";

  if (productTypesPilotMode) {
    pilotWriteBeforePath = path.join(phase22AFDir, `before-${nowStamp()}.json`);
    pilotWriteAfterPath = path.join(phase22AFDir, `after-${nowStamp()}.json`);
    const beforeNoGoReasons = [];
    const beforePartialReasons = [];

    const generalAuthorizationValid = args.authorization === EXPECTED_AUTHORIZATION;
    const pilotAuthorizationValid = args.pilotAuthorization === EXPECTED_PRODUCT_TYPES_PILOT_AUTHORIZATION;
    const payloadValidated = pilotPayloadParsed && pilotPayloadValidationErrors.length === 0;
    const uniqueValueValidated = productTypesUniqueValuePresent === true;
    const candidateValue = EXPECTED_PRODUCT_TYPES_PILOT_PAYLOAD.value;
    const candidateLabel = EXPECTED_PRODUCT_TYPES_PILOT_PAYLOAD.label;

    let countBefore = null;
    let existingByValue = [];
    let labelCountBefore = null;
    try {
      const beforeRows = runSupabaseDbQuery("select count(*)::bigint as total_rows from public.product_types");
      countBefore = Number(beforeRows[0]?.total_rows || 0);
    } catch {
      beforeNoGoReasons.push("Unable to read product_types count before write.");
    }
    try {
      existingByValue = runSupabaseDbQuery(
        `select id, value, label, tenant_id from public.product_types where value = '${escapeSqlLiteral(candidateValue)}'`,
      );
    } catch {
      beforeNoGoReasons.push("Unable to lookup product_types by value before write.");
    }
    try {
      const labelRows = runSupabaseDbQuery(
        `select count(*)::bigint as label_count from public.product_types where label = '${escapeSqlLiteral(candidateLabel)}'`,
      );
      labelCountBefore = Number(labelRows[0]?.label_count || 0);
    } catch {
      beforeNoGoReasons.push("Unable to lookup product_types by label before write.");
    }

    if (!args.write) beforeNoGoReasons.push("--write is required for product_types pilot real execution.");
    if (!args.executePilotWrite) beforeNoGoReasons.push("--execute-pilot-write is required for product_types pilot real execution.");
    if (activePilotEntity !== "product_types") beforeNoGoReasons.push("Pilot entity must be product_types.");
    if (!generalAuthorizationValid) beforeNoGoReasons.push("General authorization is invalid.");
    if (!pilotAuthorizationValid) beforeNoGoReasons.push("Pilot authorization is invalid.");
    if (!payloadValidated) beforeNoGoReasons.push("Pilot payload is not validated.");
    if (!uniqueValueValidated) beforeNoGoReasons.push("UNIQUE(value) is not validated for product_types.");
    if (args.expectedTarget !== EXPECTED_TARGET_REF || localTargetRef !== EXPECTED_TARGET_REF) {
      beforeNoGoReasons.push("Target ref mismatch.");
    }
    if (localTargetName !== EXPECTED_TARGET_NAME) beforeNoGoReasons.push("Target name mismatch.");
    if (args.batch !== EXPECTED_BATCH_ID) beforeNoGoReasons.push("Batch mismatch.");
    if (pilotDecisionFinal !== "GO") beforeNoGoReasons.push("pilot_validation_decision is not GO.");
    if (blockedEntitiesFound.length > 0) beforeNoGoReasons.push("Blocked entities detected.");
    if (args.forbiddenFlags.length > 0 || args.unknownFlags.length > 0) beforeNoGoReasons.push("Forbidden/unknown flags detected.");
    if (existingByValue.length > 1) beforeNoGoReasons.push("More than one row found for product_types.value.");
    if (existingByValue.length === 0 && (labelCountBefore ?? 0) > 0) {
      beforeNoGoReasons.push("Label collision found without matching value for product_types pilot payload.");
    }
    if (executableEntitiesRoundOne22Q.includes("profiles")) beforeNoGoReasons.push("profiles must remain excluded.");
    if (executableEntitiesRoundOne22Q.includes("company_contacts")) beforeNoGoReasons.push("company_contacts must remain excluded.");

    pilotWriteBeforeDecision = classifyDecision(beforeNoGoReasons, beforePartialReasons);
    const beforeEvidence22AF = {
      phase: "22AF-R2",
      timestamp: new Date().toISOString(),
      targetRef: EXPECTED_TARGET_REF,
      targetName: EXPECTED_TARGET_NAME,
      batchId: EXPECTED_BATCH_ID,
      generalAuthorizationValid,
      pilotAuthorizationValid,
      pilotEntity: "product_types",
      pilotPayloadPath: args.pilotPayload || null,
      payloadUsed: {
        value: candidateValue,
        label: candidateLabel,
        tenant_id: EXPECTED_PRODUCT_TYPES_PILOT_PAYLOAD.tenant_id,
        temp_key: EXPECTED_PRODUCT_TYPES_PILOT_PAYLOAD.temp_key,
      },
      productTypesCountBefore: countBefore,
      lookupByValue: existingByValue,
      lookupByLabelCount: labelCountBefore,
      uniqueValueValidated,
      beforeDecision: pilotWriteBeforeDecision,
      reasons: {
        noGoReasons: beforeNoGoReasons,
        partialReasons: beforePartialReasons,
      },
    };
    fs.writeFileSync(pilotWriteBeforePath, JSON.stringify(beforeEvidence22AF, null, 2), "utf8");

    let writeResult = { operation: "aborted", record: null, inserted: false };
    if (pilotWriteBeforeDecision === "GO") {
      try {
        writeResult = executeProductTypesPilotWrite({
          value: candidateValue,
          label: candidateLabel,
          tenant_id: EXPECTED_PRODUCT_TYPES_PILOT_PAYLOAD.tenant_id,
          expectedTargetRef: args.expectedTarget,
          expectedTargetName: localTargetName,
          batchId: args.batch,
          localTargetRef,
          localTargetName,
        });
      } catch (error) {
        writeResult = {
          operation: "aborted",
          record: { error: error instanceof Error ? error.message : String(error) },
          inserted: false,
        };
      }
    }

    let countAfter = null;
    let rowsByValueAfter = [];
    let duplicateByValueCount = null;
    try {
      const afterRows = runSupabaseDbQuery("select count(*)::bigint as total_rows from public.product_types");
      countAfter = Number(afterRows[0]?.total_rows || 0);
    } catch {}
    try {
      rowsByValueAfter = runSupabaseDbQuery(
        `select id, value, label, tenant_id from public.product_types where value = '${escapeSqlLiteral(candidateValue)}'`,
      );
    } catch {}
    try {
      const dupRows = runSupabaseDbQuery(
        `select count(*)::bigint as duplicate_count from public.product_types where value = '${escapeSqlLiteral(candidateValue)}'`,
      );
      duplicateByValueCount = Number(dupRows[0]?.duplicate_count || 0);
    } catch {}

    pilotWriteOperation = writeResult.operation;
    pilotWriteRecord = rowsByValueAfter[0] || writeResult.record || null;
    pilotWriteDelta = countAfter !== null && countBefore !== null ? countAfter - countBefore : null;
    recordsAffected = writeResult.record ? [writeResult.record] : [];

    const afterNoGoReasons = [];
    const afterPartialReasons = [];
    if (pilotWriteBeforeDecision !== "GO") afterNoGoReasons.push("beforeDecision is not GO.");
    if (writeResult.operation === "aborted") afterNoGoReasons.push("Pilot operation aborted.");
    if (!["inserted", "idempotent_noop"].includes(writeResult.operation)) afterNoGoReasons.push("Unexpected pilot operation result.");
    if (writeResult.operation === "inserted" && pilotWriteDelta !== 1) afterNoGoReasons.push("Delta must be 1 for inserted operation.");
    if (writeResult.operation === "idempotent_noop" && pilotWriteDelta !== 0) afterNoGoReasons.push("Delta must be 0 for idempotent_noop.");
    if (!rowsByValueAfter.length) afterNoGoReasons.push("No row found by pilot value after execution.");
    if ((duplicateByValueCount ?? 0) !== 1) afterNoGoReasons.push("Expected exactly one row for pilot value after execution.");
    if (rowsByValueAfter.length === 1) {
      const row = rowsByValueAfter[0];
      if (row.value !== candidateValue) afterNoGoReasons.push("After value mismatch.");
      if (row.label !== candidateLabel) afterNoGoReasons.push("After label mismatch.");
      if (row.tenant_id !== null) afterNoGoReasons.push("After tenant_id must be null.");
    }
    pilotWriteAfterDecision = classifyDecision(afterNoGoReasons, afterPartialReasons);

    const afterEvidence22AF = {
      phase: "22AF-R2",
      timestamp: new Date().toISOString(),
      targetRef: EXPECTED_TARGET_REF,
      targetName: EXPECTED_TARGET_NAME,
      batchId: EXPECTED_BATCH_ID,
      operationExecuted: writeResult.operation,
      productTypesCountAfter: countAfter,
      delta: pilotWriteDelta,
      recordByValue: rowsByValueAfter,
      recordId: rowsByValueAfter[0]?.id || null,
      value: candidateValue,
      label: candidateLabel,
      tenant_id: EXPECTED_PRODUCT_TYPES_PILOT_PAYLOAD.tenant_id,
      uniqueValueDuplicateCount: duplicateByValueCount,
      scopeConfirmation: {
        singleEntityExecution: true,
        touchedEntity: "product_types",
        legalEntitiesTouchedAgain: false,
        salesRepsTouched: false,
        profilesTouched: false,
        companyContactsTouched: false,
        transactionalTouched: false,
        queueTouched: false,
        externalIntegrationsCalled: false,
        expandedExecutionBlocked: true,
      },
      afterDecision: pilotWriteAfterDecision,
      reasons: {
        noGoReasons: afterNoGoReasons,
        partialReasons: afterPartialReasons,
      },
      finalMessage: phase22AFStopAfterPilotMessage,
    };
    fs.writeFileSync(pilotWriteAfterPath, JSON.stringify(afterEvidence22AF, null, 2), "utf8");
  } else if (productGroupsPilotMode) {
    pilotWriteBeforePath = path.join(phase22AMDir, `before-${nowStamp()}.json`);
    pilotWriteAfterPath = path.join(phase22AMDir, `after-${nowStamp()}.json`);
    const beforeNoGoReasons = [];
    const beforePartialReasons = [];

    const generalAuthorizationValid = args.authorization === EXPECTED_AUTHORIZATION;
    const pilotAuthorizationValid = args.pilotAuthorization === EXPECTED_PRODUCT_GROUPS_PILOT_AUTHORIZATION;
    const payloadValidated = pilotPayloadParsed && pilotPayloadValidationErrors.length === 0;
    const uniqueValueValidated = productGroupsUniqueValuePresent === true;
    const candidateValue = EXPECTED_PRODUCT_GROUPS_PILOT_PAYLOAD.value;
    const candidateLabel = EXPECTED_PRODUCT_GROUPS_PILOT_PAYLOAD.label;

    let countBefore = null;
    let existingByValue = [];
    let labelCountBefore = null;
    try {
      const beforeRows = runSupabaseDbQuery("select count(*)::bigint as total_rows from public.product_groups");
      countBefore = Number(beforeRows[0]?.total_rows || 0);
    } catch {
      beforeNoGoReasons.push("Unable to read product_groups count before write.");
    }
    try {
      existingByValue = runSupabaseDbQuery(
        `select id, value, label, tenant_id, created_by, dimension_profile::text as dimension_profile, ficha_profile from public.product_groups where value = '${escapeSqlLiteral(candidateValue)}'`,
      );
    } catch {
      beforeNoGoReasons.push("Unable to lookup product_groups by value before write.");
    }
    try {
      const labelRows = runSupabaseDbQuery(
        `select count(*)::bigint as label_count from public.product_groups where label = '${escapeSqlLiteral(candidateLabel)}'`,
      );
      labelCountBefore = Number(labelRows[0]?.label_count || 0);
    } catch {
      beforeNoGoReasons.push("Unable to lookup product_groups by label before write.");
    }

    if (!args.write) beforeNoGoReasons.push("--write is required for product_groups pilot real execution.");
    if (!args.executePilotWrite) beforeNoGoReasons.push("--execute-pilot-write is required for product_groups pilot real execution.");
    if (activePilotEntity !== "product_groups") beforeNoGoReasons.push("Pilot entity must be product_groups.");
    if (!generalAuthorizationValid) beforeNoGoReasons.push("General authorization is invalid.");
    if (!pilotAuthorizationValid) beforeNoGoReasons.push("Pilot authorization is invalid.");
    if (!payloadValidated) beforeNoGoReasons.push("Pilot payload is not validated.");
    if (!uniqueValueValidated) beforeNoGoReasons.push("UNIQUE(value) is not validated for product_groups.");
    if (args.expectedTarget !== EXPECTED_TARGET_REF || localTargetRef !== EXPECTED_TARGET_REF) {
      beforeNoGoReasons.push("Target ref mismatch.");
    }
    if (localTargetName !== EXPECTED_TARGET_NAME) beforeNoGoReasons.push("Target name mismatch.");
    if (args.batch !== EXPECTED_BATCH_ID) beforeNoGoReasons.push("Batch mismatch.");
    if (pilotDecisionFinal !== "GO") beforeNoGoReasons.push("pilot_validation_decision is not GO.");
    if (blockedEntitiesFound.length > 0) beforeNoGoReasons.push("Blocked entities detected.");
    if (args.forbiddenFlags.length > 0 || args.unknownFlags.length > 0) beforeNoGoReasons.push("Forbidden/unknown flags detected.");
    if (existingByValue.length > 1) beforeNoGoReasons.push("More than one row found for product_groups.value.");
    if (existingByValue.length === 0 && (labelCountBefore ?? 0) > 0) {
      beforeNoGoReasons.push("Label collision found without matching value for product_groups pilot payload.");
    }
    if (executableEntitiesRoundOne22Q.includes("profiles")) beforeNoGoReasons.push("profiles must remain excluded.");
    if (executableEntitiesRoundOne22Q.includes("company_contacts")) beforeNoGoReasons.push("company_contacts must remain excluded.");
    if (productGroupsTenantNullable !== true) beforeNoGoReasons.push("product_groups.tenant_id must remain nullable.");
    if (productGroupsCreatedByNullable !== true) beforeNoGoReasons.push("product_groups.created_by must remain nullable.");
    if (!String(productGroupsDimensionDefault || "").toLowerCase().includes("'none'::dimension_profile")) {
      beforeNoGoReasons.push("product_groups.dimension_profile default must be none.");
    }
    if (!String(productGroupsFichaDefault || "").toLowerCase().includes("'none'::text")) {
      beforeNoGoReasons.push("product_groups.ficha_profile default must be none.");
    }

    pilotWriteBeforeDecision = classifyDecision(beforeNoGoReasons, beforePartialReasons);
    const beforeEvidence22AM = {
      phase: "22AM-R2",
      timestamp: new Date().toISOString(),
      targetRef: EXPECTED_TARGET_REF,
      targetName: EXPECTED_TARGET_NAME,
      batchId: EXPECTED_BATCH_ID,
      generalAuthorizationValid,
      pilotAuthorizationValid,
      pilotEntity: "product_groups",
      pilotPayloadPath: args.pilotPayload || null,
      payloadUsed: {
        value: candidateValue,
        label: candidateLabel,
        tenant_id: EXPECTED_PRODUCT_GROUPS_PILOT_PAYLOAD.tenant_id,
        created_by: EXPECTED_PRODUCT_GROUPS_PILOT_PAYLOAD.created_by,
        temp_key: EXPECTED_PRODUCT_GROUPS_PILOT_PAYLOAD.temp_key,
      },
      productGroupsCountBefore: countBefore,
      lookupByValue: existingByValue,
      lookupByLabelCount: labelCountBefore,
      uniqueValueValidated,
      tenantNullableValidated: productGroupsTenantNullable === true,
      createdByNullableValidated: productGroupsCreatedByNullable === true,
      defaultsValidated: {
        dimension_profile: productGroupsDimensionDefault,
        ficha_profile: productGroupsFichaDefault,
      },
      beforeDecision: pilotWriteBeforeDecision,
      reasons: {
        noGoReasons: beforeNoGoReasons,
        partialReasons: beforePartialReasons,
      },
    };
    fs.writeFileSync(pilotWriteBeforePath, JSON.stringify(beforeEvidence22AM, null, 2), "utf8");

    let writeResult = { operation: "aborted", record: null, inserted: false };
    if (pilotWriteBeforeDecision === "GO") {
      try {
        writeResult = executeProductGroupsPilotWrite({
          value: candidateValue,
          label: candidateLabel,
          tenant_id: EXPECTED_PRODUCT_GROUPS_PILOT_PAYLOAD.tenant_id,
          created_by: EXPECTED_PRODUCT_GROUPS_PILOT_PAYLOAD.created_by,
          expectedTargetRef: args.expectedTarget,
          expectedTargetName: localTargetName,
          batchId: args.batch,
          localTargetRef,
          localTargetName,
        });
      } catch (error) {
        writeResult = {
          operation: "aborted",
          record: { error: error instanceof Error ? error.message : String(error) },
          inserted: false,
        };
      }
    }

    let countAfter = null;
    let rowsByValueAfter = [];
    let duplicateByValueCount = null;
    try {
      const afterRows = runSupabaseDbQuery("select count(*)::bigint as total_rows from public.product_groups");
      countAfter = Number(afterRows[0]?.total_rows || 0);
    } catch {}
    try {
      rowsByValueAfter = runSupabaseDbQuery(
        `select id, value, label, tenant_id, created_by, dimension_profile::text as dimension_profile, ficha_profile from public.product_groups where value = '${escapeSqlLiteral(candidateValue)}'`,
      );
    } catch {}
    try {
      const dupRows = runSupabaseDbQuery(
        `select count(*)::bigint as duplicate_count from public.product_groups where value = '${escapeSqlLiteral(candidateValue)}'`,
      );
      duplicateByValueCount = Number(dupRows[0]?.duplicate_count || 0);
    } catch {}

    pilotWriteOperation = writeResult.operation;
    pilotWriteRecord = rowsByValueAfter[0] || writeResult.record || null;
    pilotWriteDelta = countAfter !== null && countBefore !== null ? countAfter - countBefore : null;
    recordsAffected = writeResult.record ? [writeResult.record] : [];

    const afterNoGoReasons = [];
    const afterPartialReasons = [];
    if (pilotWriteBeforeDecision !== "GO") afterNoGoReasons.push("beforeDecision is not GO.");
    if (writeResult.operation === "aborted") afterNoGoReasons.push("Pilot operation aborted.");
    if (!["inserted", "idempotent_noop"].includes(writeResult.operation)) afterNoGoReasons.push("Unexpected pilot operation result.");
    if (writeResult.operation === "inserted" && pilotWriteDelta !== 1) afterNoGoReasons.push("Delta must be 1 for inserted operation.");
    if (writeResult.operation === "idempotent_noop" && pilotWriteDelta !== 0) afterNoGoReasons.push("Delta must be 0 for idempotent_noop.");
    if (!rowsByValueAfter.length) afterNoGoReasons.push("No row found by pilot value after execution.");
    if ((duplicateByValueCount ?? 0) !== 1) afterNoGoReasons.push("Expected exactly one row for pilot value after execution.");
    if (rowsByValueAfter.length === 1) {
      const row = rowsByValueAfter[0];
      if (row.value !== candidateValue) afterNoGoReasons.push("After value mismatch.");
      if (row.label !== candidateLabel) afterNoGoReasons.push("After label mismatch.");
      if (row.tenant_id !== null) afterNoGoReasons.push("After tenant_id must be null.");
      if (row.created_by !== null) afterNoGoReasons.push("After created_by must be null.");
      if (row.dimension_profile !== EXPECTED_PRODUCT_GROUPS_PILOT_PAYLOAD.dimension_profile_default) {
        afterNoGoReasons.push("After dimension_profile default mismatch.");
      }
      if (row.ficha_profile !== EXPECTED_PRODUCT_GROUPS_PILOT_PAYLOAD.ficha_profile_default) {
        afterNoGoReasons.push("After ficha_profile default mismatch.");
      }
    }
    pilotWriteAfterDecision = classifyDecision(afterNoGoReasons, afterPartialReasons);

    const afterEvidence22AM = {
      phase: "22AM-R2",
      timestamp: new Date().toISOString(),
      targetRef: EXPECTED_TARGET_REF,
      targetName: EXPECTED_TARGET_NAME,
      batchId: EXPECTED_BATCH_ID,
      operationExecuted: writeResult.operation,
      productGroupsCountAfter: countAfter,
      delta: pilotWriteDelta,
      recordByValue: rowsByValueAfter,
      recordId: rowsByValueAfter[0]?.id || null,
      value: candidateValue,
      label: candidateLabel,
      tenant_id: EXPECTED_PRODUCT_GROUPS_PILOT_PAYLOAD.tenant_id,
      created_by: rowsByValueAfter[0]?.created_by ?? null,
      dimension_profile: rowsByValueAfter[0]?.dimension_profile || null,
      ficha_profile: rowsByValueAfter[0]?.ficha_profile || null,
      defaultsApplied: {
        dimension_profile: rowsByValueAfter[0]?.dimension_profile === EXPECTED_PRODUCT_GROUPS_PILOT_PAYLOAD.dimension_profile_default,
        ficha_profile: rowsByValueAfter[0]?.ficha_profile === EXPECTED_PRODUCT_GROUPS_PILOT_PAYLOAD.ficha_profile_default,
      },
      uniqueValueDuplicateCount: duplicateByValueCount,
      scopeConfirmation: {
        singleEntityExecution: true,
        touchedEntity: "product_groups",
        legalEntitiesTouchedAgain: false,
        productTypesTouchedAgain: false,
        salesRepsTouched: false,
        profilesTouched: false,
        companyContactsTouched: false,
        transactionalTouched: false,
        queueTouched: false,
        externalIntegrationsCalled: false,
        expandedExecutionBlocked: true,
      },
      afterDecision: pilotWriteAfterDecision,
      reasons: {
        noGoReasons: afterNoGoReasons,
        partialReasons: afterPartialReasons,
      },
      finalMessage: phase22AMStopAfterPilotMessage,
    };
    fs.writeFileSync(pilotWriteAfterPath, JSON.stringify(afterEvidence22AM, null, 2), "utf8");
  } else if (productSubgroupsPilotMode) {
    pilotWriteBeforePath = path.join(phase22ATDir, `before-${nowStamp()}.json`);
    pilotWriteAfterPath = path.join(phase22ATDir, `after-${nowStamp()}.json`);
    const beforeNoGoReasons = [];
    const beforePartialReasons = [];

    const generalAuthorizationValid = args.authorization === EXPECTED_AUTHORIZATION;
    const pilotAuthorizationValid = args.pilotAuthorization === EXPECTED_PRODUCT_SUBGROUPS_PILOT_AUTHORIZATION;
    const payloadValidated = pilotPayloadParsed && pilotPayloadValidationErrors.length === 0;
    const uniqueValueValidated = productSubgroupsUniqueValuePresent === true;
    const candidateValue = EXPECTED_PRODUCT_SUBGROUPS_PILOT_PAYLOAD.value;
    const candidateLabel = EXPECTED_PRODUCT_SUBGROUPS_PILOT_PAYLOAD.label;

    let countBefore = null;
    let existingByValue = [];
    let labelCountBefore = null;
    try {
      const beforeRows = runSupabaseDbQuery("select count(*)::bigint as total_rows from public.product_subgroups");
      countBefore = Number(beforeRows[0]?.total_rows || 0);
    } catch {
      beforeNoGoReasons.push("Unable to read product_subgroups count before write.");
    }
    try {
      existingByValue = runSupabaseDbQuery(
        `select id, value, label, tenant_id, created_by, sort_order, is_active, created_at::text as created_at from public.product_subgroups where value = '${escapeSqlLiteral(candidateValue)}'`,
      );
    } catch {
      beforeNoGoReasons.push("Unable to lookup product_subgroups by value before write.");
    }
    try {
      const labelRows = runSupabaseDbQuery(
        `select count(*)::bigint as label_count from public.product_subgroups where label = '${escapeSqlLiteral(candidateLabel)}'`,
      );
      labelCountBefore = Number(labelRows[0]?.label_count || 0);
    } catch {
      beforeNoGoReasons.push("Unable to lookup product_subgroups by label before write.");
    }

    if (!args.write) beforeNoGoReasons.push("--write is required for product_subgroups pilot real execution.");
    if (!args.executePilotWrite) beforeNoGoReasons.push("--execute-pilot-write is required for product_subgroups pilot real execution.");
    if (activePilotEntity !== "product_subgroups") beforeNoGoReasons.push("Pilot entity must be product_subgroups.");
    if (!generalAuthorizationValid) beforeNoGoReasons.push("General authorization is invalid.");
    if (!pilotAuthorizationValid) beforeNoGoReasons.push("Pilot authorization is invalid.");
    if (!payloadValidated) beforeNoGoReasons.push("Pilot payload is not validated.");
    if (!uniqueValueValidated) beforeNoGoReasons.push("UNIQUE(value) is not validated for product_subgroups.");
    if (args.expectedTarget !== EXPECTED_TARGET_REF || localTargetRef !== EXPECTED_TARGET_REF) {
      beforeNoGoReasons.push("Target ref mismatch.");
    }
    if (localTargetName !== EXPECTED_TARGET_NAME) beforeNoGoReasons.push("Target name mismatch.");
    if (args.batch !== EXPECTED_BATCH_ID) beforeNoGoReasons.push("Batch mismatch.");
    if (pilotDecisionFinal !== "GO") beforeNoGoReasons.push("pilot_validation_decision is not GO.");
    if (blockedEntitiesFound.length > 0) beforeNoGoReasons.push("Blocked entities detected.");
    if (args.forbiddenFlags.length > 0 || args.unknownFlags.length > 0) beforeNoGoReasons.push("Forbidden/unknown flags detected.");
    if (existingByValue.length > 1) beforeNoGoReasons.push("More than one row found for product_subgroups.value.");
    if (existingByValue.length === 0 && (labelCountBefore ?? 0) > 0) {
      beforeNoGoReasons.push("Label collision found without matching value for product_subgroups pilot payload.");
    }
    if (executableEntitiesRoundOne22Q.includes("profiles")) beforeNoGoReasons.push("profiles must remain excluded.");
    if (executableEntitiesRoundOne22Q.includes("company_contacts")) beforeNoGoReasons.push("company_contacts must remain excluded.");
    if (productSubgroupsTenantNullable !== true) beforeNoGoReasons.push("product_subgroups.tenant_id must remain nullable.");
    if (productSubgroupsCreatedByNullable !== true) beforeNoGoReasons.push("product_subgroups.created_by must remain nullable.");
    if (!String(productSubgroupsSortOrderDefault || "").trim().startsWith(EXPECTED_PRODUCT_SUBGROUPS_PILOT_PAYLOAD.sort_order_default)) {
      beforeNoGoReasons.push("product_subgroups.sort_order default must be 0.");
    }
    if (
      !String(productSubgroupsIsActiveDefault || "")
        .trim()
        .toLowerCase()
        .startsWith(EXPECTED_PRODUCT_SUBGROUPS_PILOT_PAYLOAD.is_active_default)
    ) {
      beforeNoGoReasons.push("product_subgroups.is_active default must be true.");
    }
    if (!String(productSubgroupsCreatedAtDefault || "").toLowerCase().includes(EXPECTED_PRODUCT_SUBGROUPS_PILOT_PAYLOAD.created_at_default)) {
      beforeNoGoReasons.push("product_subgroups.created_at default must be now().");
    }
    if (productSubgroupsHasProductGroupIdColumn) {
      beforeNoGoReasons.push("product_subgroups must not define product_group_id in current pilot contract.");
    }
    if (productSubgroupsHasFkToProductGroups) {
      beforeNoGoReasons.push("product_subgroups must not have FK to product_groups.");
    }

    pilotWriteBeforeDecision = classifyDecision(beforeNoGoReasons, beforePartialReasons);
    const beforeEvidence22AT = {
      phase: "22AT-R2",
      timestamp: new Date().toISOString(),
      targetRef: EXPECTED_TARGET_REF,
      targetName: EXPECTED_TARGET_NAME,
      batchId: EXPECTED_BATCH_ID,
      generalAuthorizationValid,
      pilotAuthorizationValid,
      pilotEntity: "product_subgroups",
      pilotPayloadPath: args.pilotPayload || null,
      payloadUsed: {
        value: candidateValue,
        label: candidateLabel,
        tenant_id: EXPECTED_PRODUCT_SUBGROUPS_PILOT_PAYLOAD.tenant_id,
        created_by: EXPECTED_PRODUCT_SUBGROUPS_PILOT_PAYLOAD.created_by,
        temp_key: EXPECTED_PRODUCT_SUBGROUPS_PILOT_PAYLOAD.temp_key,
      },
      productSubgroupsCountBefore: countBefore,
      lookupByValue: existingByValue,
      lookupByLabelCount: labelCountBefore,
      uniqueValueValidated,
      tenantNullableValidated: productSubgroupsTenantNullable === true,
      createdByNullableValidated: productSubgroupsCreatedByNullable === true,
      defaultsValidated: {
        sort_order: productSubgroupsSortOrderDefault,
        is_active: productSubgroupsIsActiveDefault,
        created_at: productSubgroupsCreatedAtDefault,
      },
      noTechnicalLinkToProductGroups: {
        product_group_id_column_absent: !productSubgroupsHasProductGroupIdColumn,
        fk_to_product_groups_absent: !productSubgroupsHasFkToProductGroups,
      },
      beforeDecision: pilotWriteBeforeDecision,
      reasons: {
        noGoReasons: beforeNoGoReasons,
        partialReasons: beforePartialReasons,
      },
    };
    fs.writeFileSync(pilotWriteBeforePath, JSON.stringify(beforeEvidence22AT, null, 2), "utf8");

    let writeResult = { operation: "aborted", record: null, inserted: false };
    if (pilotWriteBeforeDecision === "GO") {
      try {
        writeResult = executeProductSubgroupsPilotWrite({
          value: candidateValue,
          label: candidateLabel,
          tenant_id: EXPECTED_PRODUCT_SUBGROUPS_PILOT_PAYLOAD.tenant_id,
          created_by: EXPECTED_PRODUCT_SUBGROUPS_PILOT_PAYLOAD.created_by,
          expectedTargetRef: args.expectedTarget,
          expectedTargetName: localTargetName,
          batchId: args.batch,
          localTargetRef,
          localTargetName,
        });
      } catch (error) {
        writeResult = {
          operation: "aborted",
          record: { error: error instanceof Error ? error.message : String(error) },
          inserted: false,
        };
      }
    }

    let countAfter = null;
    let rowsByValueAfter = [];
    let duplicateByValueCount = null;
    try {
      const afterRows = runSupabaseDbQuery("select count(*)::bigint as total_rows from public.product_subgroups");
      countAfter = Number(afterRows[0]?.total_rows || 0);
    } catch {}
    try {
      rowsByValueAfter = runSupabaseDbQuery(
        `select id, value, label, tenant_id, created_by, sort_order, is_active, created_at::text as created_at from public.product_subgroups where value = '${escapeSqlLiteral(candidateValue)}'`,
      );
    } catch {}
    try {
      const dupRows = runSupabaseDbQuery(
        `select count(*)::bigint as duplicate_count from public.product_subgroups where value = '${escapeSqlLiteral(candidateValue)}'`,
      );
      duplicateByValueCount = Number(dupRows[0]?.duplicate_count || 0);
    } catch {}

    pilotWriteOperation = writeResult.operation;
    pilotWriteRecord = rowsByValueAfter[0] || writeResult.record || null;
    pilotWriteDelta = countAfter !== null && countBefore !== null ? countAfter - countBefore : null;
    recordsAffected = writeResult.record ? [writeResult.record] : [];

    const afterNoGoReasons = [];
    const afterPartialReasons = [];
    if (pilotWriteBeforeDecision !== "GO") afterNoGoReasons.push("beforeDecision is not GO.");
    if (writeResult.operation === "aborted") afterNoGoReasons.push("Pilot operation aborted.");
    if (!["inserted", "idempotent_noop"].includes(writeResult.operation)) afterNoGoReasons.push("Unexpected pilot operation result.");
    if (writeResult.operation === "inserted" && pilotWriteDelta !== 1) afterNoGoReasons.push("Delta must be 1 for inserted operation.");
    if (writeResult.operation === "idempotent_noop" && pilotWriteDelta !== 0) afterNoGoReasons.push("Delta must be 0 for idempotent_noop.");
    if (!rowsByValueAfter.length) afterNoGoReasons.push("No row found by pilot value after execution.");
    if ((duplicateByValueCount ?? 0) !== 1) afterNoGoReasons.push("Expected exactly one row for pilot value after execution.");
    if (rowsByValueAfter.length === 1) {
      const row = rowsByValueAfter[0];
      if (row.value !== candidateValue) afterNoGoReasons.push("After value mismatch.");
      if (row.label !== candidateLabel) afterNoGoReasons.push("After label mismatch.");
      if (row.tenant_id !== null) afterNoGoReasons.push("After tenant_id must be null.");
      if (row.created_by !== null) afterNoGoReasons.push("After created_by must be null.");
      if (Number(row.sort_order) !== 0) afterNoGoReasons.push("After sort_order default mismatch.");
      if (row.is_active !== true) afterNoGoReasons.push("After is_active default mismatch.");
      if (typeof row.created_at !== "string" || row.created_at.length === 0) {
        afterNoGoReasons.push("After created_at default mismatch.");
      }
    }
    if (productSubgroupsHasProductGroupIdColumn) {
      afterNoGoReasons.push("product_subgroups must not define product_group_id in current pilot contract.");
    }
    if (productSubgroupsHasFkToProductGroups) {
      afterNoGoReasons.push("product_subgroups must not have FK to product_groups.");
    }
    pilotWriteAfterDecision = classifyDecision(afterNoGoReasons, afterPartialReasons);

    const afterEvidence22AT = {
      phase: "22AT-R2",
      timestamp: new Date().toISOString(),
      targetRef: EXPECTED_TARGET_REF,
      targetName: EXPECTED_TARGET_NAME,
      batchId: EXPECTED_BATCH_ID,
      operationExecuted: writeResult.operation,
      productSubgroupsCountAfter: countAfter,
      delta: pilotWriteDelta,
      recordByValue: rowsByValueAfter,
      recordId: rowsByValueAfter[0]?.id || null,
      value: candidateValue,
      label: candidateLabel,
      tenant_id: EXPECTED_PRODUCT_SUBGROUPS_PILOT_PAYLOAD.tenant_id,
      created_by: rowsByValueAfter[0]?.created_by ?? null,
      sort_order: rowsByValueAfter[0]?.sort_order ?? null,
      is_active: rowsByValueAfter[0]?.is_active ?? null,
      created_at: rowsByValueAfter[0]?.created_at ?? null,
      defaultsApplied: {
        sort_order: Number(rowsByValueAfter[0]?.sort_order) === 0,
        is_active: rowsByValueAfter[0]?.is_active === true,
        created_at: typeof rowsByValueAfter[0]?.created_at === "string" && rowsByValueAfter[0]?.created_at.length > 0,
      },
      noTechnicalLinkToProductGroups: {
        product_group_id_column_absent: !productSubgroupsHasProductGroupIdColumn,
        fk_to_product_groups_absent: !productSubgroupsHasFkToProductGroups,
      },
      uniqueValueDuplicateCount: duplicateByValueCount,
      scopeConfirmation: {
        singleEntityExecution: true,
        touchedEntity: "product_subgroups",
        legalEntitiesTouchedAgain: false,
        productTypesTouchedAgain: false,
        productGroupsTouchedAgain: false,
        salesRepsTouched: false,
        profilesTouched: false,
        companyContactsTouched: false,
        transactionalTouched: false,
        queueTouched: false,
        externalIntegrationsCalled: false,
        expandedExecutionBlocked: true,
      },
      afterDecision: pilotWriteAfterDecision,
      reasons: {
        noGoReasons: afterNoGoReasons,
        partialReasons: afterPartialReasons,
      },
      finalMessage: phase22ATStopAfterPilotMessage,
    };
    fs.writeFileSync(pilotWriteAfterPath, JSON.stringify(afterEvidence22AT, null, 2), "utf8");
  } else if (legalPilotMode) {
    pilotWriteBeforePath = path.join(phase22TDir, `before-${nowStamp()}.json`);
    pilotWriteAfterPath = path.join(phase22TDir, `after-${nowStamp()}.json`);
    pilotWriteOperation = "legal_entities_branch_not_executed_in_22af";
    pilotWriteRecord = null;
    pilotWriteDelta = 0;
    pilotWriteBeforeDecision = "PARCIAL";
    pilotWriteAfterDecision = "PARCIAL";
  }

  console.log(`preflight_decision=${preflightDecision}`);
  console.log(`evidence_path=${evidencePath}`);
  console.log(`write_plan_decision=${planDecision}`);
  console.log(`write_plan_path=${writePlanPath}`);
  console.log(`armed_write_decision=${armedWriteDecision}`);
  console.log(`armed_before_path=${armedBeforePath}`);
  console.log(`pilot_validation_decision=${pilotDecisionFinal}`);
  console.log(
    `pilot_payload_validated=${
      selectedPilotEntity === "product_types" ||
      selectedPilotEntity === "product_groups" ||
      selectedPilotEntity === "product_subgroups"
        ? pilotPayloadParsed && pilotPayloadValidationErrors.length === 0
        : "not_applicable"
    }`,
  );
  console.log(`pilot_evidence_path=${pilotEvidencePath}`);
  console.log(`pilot_write_before_decision=${pilotWriteBeforeDecision}`);
  console.log(`pilot_write_before_path=${pilotWriteBeforePath}`);
  console.log(`pilot_write_after_decision=${pilotWriteAfterDecision}`);
  console.log(`pilot_write_after_path=${pilotWriteAfterPath}`);
  console.log(`pilot_write_operation=${pilotWriteOperation}`);
  console.log(`pilot_write_delta=${pilotWriteDelta === null ? "n/a" : pilotWriteDelta}`);
  console.log(`pilot_write_record_id=${pilotWriteRecord?.id || "n/a"}`);
  console.log(`pilot_write_records_affected=${recordsAffected.length}`);
  console.log(phase22OBlockingMessage);
  console.log(phase22QHardStopMessage);
  console.log(
    selectedPilotEntity === "product_types"
      ? phase22AFStopAfterPilotMessage
      : selectedPilotEntity === "product_groups"
        ? phase22AMStopAfterPilotMessage
      : selectedPilotEntity === "product_subgroups"
        ? phase22ATStopAfterPilotMessage
      : phase22SHardStopMessage,
  );
  console.log(
    selectedPilotEntity === "product_types"
      ? phase22AFStopAfterPilotMessage
      : selectedPilotEntity === "product_groups"
        ? phase22AMStopAfterPilotMessage
      : selectedPilotEntity === "product_subgroups"
        ? phase22ATStopAfterPilotMessage
      : phase22TStopAfterPilotMessage,
  );
  console.log(writeStatusMessage);

  if (
    preflightDecision === "NO-GO" ||
    planDecision === "NO-GO" ||
    armedWriteDecision === "NO-GO" ||
    pilotDecisionFinal === "NO-GO" ||
    pilotWriteBeforeDecision === "NO-GO" ||
    pilotWriteAfterDecision === "NO-GO"
  ) {
    process.exit(1);
  }
  process.exit(0);
}

main();
