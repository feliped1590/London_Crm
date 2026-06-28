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
const ALLOWED_PILOT_ENTITIES = new Set([
  "legal_entities",
  "product_types",
  "product_groups",
  "product_subgroups",
  "product_families",
  "product_classes",
  "companies",
  "contacts",
  "companies_contacts_wave",
]);
const EXPECTED_PILOT_AUTHORIZATION =
  "AUTORIZO A PRIMEIRA ESCRITA PILOTO DA BASELINE 22R-R2 SOMENTE EM legal_entities NO RESTORE-TEST nsnmlleplpzsefzkuxlb";
const EXPECTED_PRODUCT_TYPES_PILOT_AUTHORIZATION =
  "AUTORIZO A TERCEIRA ESCRITA PILOTO DA BASELINE 22AD-R2 SOMENTE EM product_types NO RESTORE-TEST nsnmlleplpzsefzkuxlb";
const EXPECTED_PRODUCT_GROUPS_PILOT_AUTHORIZATION =
  "AUTORIZO A QUARTA ESCRITA PILOTO DA BASELINE 22AK-R2 SOMENTE EM product_groups NO RESTORE-TEST nsnmlleplpzsefzkuxlb";
const EXPECTED_PRODUCT_SUBGROUPS_PILOT_AUTHORIZATION =
  "AUTORIZO A QUINTA ESCRITA PILOTO DA BASELINE 22AR-R2 SOMENTE EM product_subgroups NO RESTORE-TEST nsnmlleplpzsefzkuxlb";
const EXPECTED_PRODUCT_FAMILIES_PILOT_AUTHORIZATION =
  "AUTORIZO A SEXTA ESCRITA PILOTO DA BASELINE 22AY-R2 SOMENTE EM product_families NO RESTORE-TEST nsnmlleplpzsefzkuxlb";
const EXPECTED_PRODUCT_CLASSES_PILOT_AUTHORIZATION =
  "AUTORIZO A SÉTIMA ESCRITA PILOTO DA BASELINE 22BA-R2 SOMENTE EM product_classes NO RESTORE-TEST nsnmlleplpzsefzkuxlb";
const EXPECTED_COMPANIES_PILOT_AUTHORIZATION =
  "AUTORIZO A OITAVA ESCRITA PILOTO DA BASELINE 22BG-R2 SOMENTE EM companies NO RESTORE-TEST nsnmlleplpzsefzkuxlb";
const EXPECTED_CONTACTS_PILOT_AUTHORIZATION =
  "AUTORIZO A NONA ESCRITA PILOTO DA BASELINE 22BH-R2 SOMENTE EM contacts NO RESTORE-TEST nsnmlleplpzsefzkuxlb";
const EXPECTED_COMPANIES_CONTACTS_WAVE_PILOT_AUTHORIZATION =
  "AUTORIZO A DÉCIMA ESCRITA CONTROLADA DA BASELINE 22BK-R2 SOMENTE EM companies E contacts, LIMITADA À ONDA CONGELADA, NO RESTORE-TEST nsnmlleplpzsefzkuxlb";
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
const EXPECTED_PRODUCT_FAMILIES_PILOT_PAYLOAD = {
  phase: "22AY-R2",
  entity: "product_families",
  source: "baseline_simulation_22g_r2",
  temp_key: "TMP-22F-R2-PRODFAMILY-01",
  value: "TMP-PF-001",
  label: "TMP Product Family",
  tenant_id: null,
  created_by: "not_applicable",
  sort_order_default: "0",
  is_active_default: "true",
  created_at_default: "now()",
};
const EXPECTED_PRODUCT_CLASSES_PILOT_PAYLOAD = {
  phase: "22BA-R2",
  entity: "product_classes",
  source: "baseline_simulation_22g_r2",
  temp_key: "TMP-22F-R2-PRODCLASS-01",
  value: "TMP-PC-001",
  label: "TMP Product Class",
  tenant_id: null,
  created_by: "not_applicable",
  sort_order_default: "0",
  is_active_default: "true",
  created_at_default: "now()",
};
const EXPECTED_COMPANIES_PILOT_PAYLOAD = {
  phase: "22BF-R2",
  entity: "companies",
  source: "baseline_simulation_22g_r2_sanitized",
  temp_key: "TMP-22F-R2-COMPANY-01",
  tenant_id: "00000000-0000-0000-0000-000000000001",
  name: "TMP Company 01",
  cnpj: "TMP-DOC-COMP-0001",
  source_document: "TMP-DOC-COMP-0001",
  owner_temp_key: "TMP-22F-R2-SALESREP-01",
  owner_write_policy: "reference_only_not_written",
  legal_entity_id_policy: "omit_or_null",
  sales_rep_id_policy: "omit_or_null",
  created_by_policy: "omit_or_null",
};
const EXPECTED_CONTACTS_PILOT_PAYLOAD = {
  phase: "22BF-R2",
  entity: "contacts",
  source: "baseline_simulation_22g_r2_sanitized",
  temp_key: "TMP-22F-R2-CONTACT-01",
  tenant_id: "00000000-0000-0000-0000-000000000001",
  first_name: "TMP Contact 01",
  email: "tmp.contact01@qualyvac.local",
  company_temp_key: "TMP-22F-R2-COMPANY-01",
  company_resolution_policy: "defer_until_company_exists",
  company_id_policy: "lookup_after_company_insert",
  write_contact_in_same_phase: false,
  company_lookup_cnpj: "TMP-DOC-COMP-0001",
  resolved_company_id: "9eb4ba07-d4d4-4b45-9902-39244d6ad52c",
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

function executeProductFamiliesPilotWrite(params) {
  const {
    pilotEntity,
    pilotAuthorization,
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

  if (pilotEntity !== "product_families") {
    throw new Error("Pilot entity must be product_families for 22AZ-R2 real pilot write.");
  }
  if (pilotAuthorization !== EXPECTED_PRODUCT_FAMILIES_PILOT_AUTHORIZATION) {
    throw new Error("Pilot authorization phrase mismatch for product_families pilot write.");
  }
  if (expectedTargetRef !== EXPECTED_TARGET_REF || localTargetRef !== EXPECTED_TARGET_REF) {
    throw new Error("Target ref mismatch for product_families pilot write.");
  }
  if (expectedTargetName !== EXPECTED_TARGET_NAME || localTargetName !== EXPECTED_TARGET_NAME) {
    throw new Error("Target name mismatch for product_families pilot write.");
  }
  if (batchId !== EXPECTED_BATCH_ID) {
    throw new Error("Batch mismatch for product_families pilot write.");
  }
  if (value !== EXPECTED_PRODUCT_FAMILIES_PILOT_PAYLOAD.value) {
    throw new Error("product_families pilot value mismatch.");
  }
  if (label !== EXPECTED_PRODUCT_FAMILIES_PILOT_PAYLOAD.label) {
    throw new Error("product_families pilot label mismatch.");
  }
  if (tenant_id !== null) {
    throw new Error("product_families pilot tenant_id must be null.");
  }
  if (created_by !== EXPECTED_PRODUCT_FAMILIES_PILOT_PAYLOAD.created_by) {
    throw new Error("product_families pilot created_by policy mismatch.");
  }

  const uniqueRows = runSupabaseDbQuery(`
    select exists(
      select 1
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public'
        and t.relname = 'product_families'
        and c.contype = 'u'
        and pg_get_constraintdef(c.oid) ilike '%(value)%'
    ) as has_unique_value
  `);
  if (uniqueRows[0]?.has_unique_value !== true) {
    throw new Error("UNIQUE(value) missing for product_families.");
  }

  const columnsRows = runSupabaseDbQuery(`
    select column_name, is_nullable, column_default
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'product_families'
  `);
  let tenantNullable = false;
  let hasCreatedByColumn = false;
  let sortOrderDefault = "";
  let isActiveDefault = "";
  let createdAtDefault = "";
  let hasProductGroupIdColumn = false;
  let hasProductSubgroupIdColumn = false;
  for (const row of columnsRows) {
    if (row.column_name === "tenant_id") tenantNullable = row.is_nullable === "YES";
    if (row.column_name === "created_by") hasCreatedByColumn = true;
    if (row.column_name === "sort_order") sortOrderDefault = String(row.column_default || "");
    if (row.column_name === "is_active") isActiveDefault = String(row.column_default || "");
    if (row.column_name === "created_at") createdAtDefault = String(row.column_default || "");
    if (row.column_name === "product_group_id") hasProductGroupIdColumn = true;
    if (row.column_name === "product_subgroup_id") hasProductSubgroupIdColumn = true;
  }
  if (hasCreatedByColumn) {
    throw new Error("product_families must not define created_by in current pilot contract.");
  }
  if (hasProductGroupIdColumn) {
    throw new Error("product_families must not define product_group_id in current pilot contract.");
  }
  if (hasProductSubgroupIdColumn) {
    throw new Error("product_families must not define product_subgroup_id in current pilot contract.");
  }
  if (!tenantNullable) {
    throw new Error("product_families.tenant_id must be nullable.");
  }
  if (!sortOrderDefault.trim().startsWith(EXPECTED_PRODUCT_FAMILIES_PILOT_PAYLOAD.sort_order_default)) {
    throw new Error("product_families.sort_order default must be 0.");
  }
  if (!isActiveDefault.trim().toLowerCase().startsWith(EXPECTED_PRODUCT_FAMILIES_PILOT_PAYLOAD.is_active_default)) {
    throw new Error("product_families.is_active default must be true.");
  }
  if (!createdAtDefault.toLowerCase().includes(EXPECTED_PRODUCT_FAMILIES_PILOT_PAYLOAD.created_at_default)) {
    throw new Error("product_families.created_at default must be now().");
  }

  const fkRows = runSupabaseDbQuery(`
    select pg_get_constraintdef(c.oid) as fk_def
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where c.contype = 'f'
      and n.nspname='public'
      and t.relname='product_families'
  `);
  const hasFkToProductGroups = fkRows.some((r) =>
    String(r.fk_def || "").toLowerCase().includes("product_groups"),
  );
  const hasFkToProductSubgroups = fkRows.some((r) =>
    String(r.fk_def || "").toLowerCase().includes("product_subgroups"),
  );
  if (hasFkToProductGroups) {
    throw new Error("product_families must not have FK to product_groups for 22AZ-R2 pilot.");
  }
  if (hasFkToProductSubgroups) {
    throw new Error("product_families must not have FK to product_subgroups for 22AZ-R2 pilot.");
  }

  const existingRows = runSupabaseDbQuery(`
    select id, value, label, tenant_id, sort_order, is_active, created_at::text as created_at
    from public.product_families
    where value = '${escapeSqlLiteral(value)}'
  `);
  if (existingRows.length > 1) {
    throw new Error("Unexpected duplicate rows for product_families.value during pilot.");
  }
  if (existingRows.length === 1) {
    const existing = existingRows[0];
    const samePayload =
      existing.value === value &&
      existing.label === label &&
      existing.tenant_id === null &&
      Number(existing.sort_order) === 0 &&
      existing.is_active === true &&
      typeof existing.created_at === "string" &&
      existing.created_at.length > 0;
    if (!samePayload) {
      throw new Error("Existing product_families row diverges from frozen pilot payload/defaults.");
    }
    return {
      operation: "idempotent_noop",
      record: existing,
      inserted: false,
    };
  }

  const labelRows = runSupabaseDbQuery(
    `select count(*)::bigint as label_count from public.product_families where label = '${escapeSqlLiteral(label)}'`,
  );
  const labelCount = Number(labelRows[0]?.label_count || 0);
  if (labelCount > 0) {
    throw new Error("Label collision detected without value match for product_families pilot.");
  }

  const insertedRows = runSupabaseDbQuery(`
    insert into public.product_families (value, label, tenant_id)
    values ('${escapeSqlLiteral(value)}', '${escapeSqlLiteral(label)}', null)
    returning id, value, label, tenant_id, sort_order, is_active, created_at::text as created_at
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
    throw new Error("product_families defaults were not applied as expected after insert.");
  }
  return {
    operation: "inserted",
    record: inserted,
    inserted: true,
  };
}

function executeProductClassesPilotWrite(params) {
  const {
    pilotEntity,
    pilotAuthorization,
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

  if (pilotEntity !== "product_classes") {
    throw new Error("Pilot entity must be product_classes for 22BB-R2 real pilot write.");
  }
  if (pilotAuthorization !== EXPECTED_PRODUCT_CLASSES_PILOT_AUTHORIZATION) {
    throw new Error("Pilot authorization phrase mismatch for product_classes pilot write.");
  }
  if (expectedTargetRef !== EXPECTED_TARGET_REF || localTargetRef !== EXPECTED_TARGET_REF) {
    throw new Error("Target ref mismatch for product_classes pilot write.");
  }
  if (expectedTargetName !== EXPECTED_TARGET_NAME || localTargetName !== EXPECTED_TARGET_NAME) {
    throw new Error("Target name mismatch for product_classes pilot write.");
  }
  if (batchId !== EXPECTED_BATCH_ID) {
    throw new Error("Batch mismatch for product_classes pilot write.");
  }
  if (value !== EXPECTED_PRODUCT_CLASSES_PILOT_PAYLOAD.value) {
    throw new Error("product_classes pilot value mismatch.");
  }
  if (label !== EXPECTED_PRODUCT_CLASSES_PILOT_PAYLOAD.label) {
    throw new Error("product_classes pilot label mismatch.");
  }
  if (tenant_id !== null) {
    throw new Error("product_classes pilot tenant_id must be null.");
  }
  if (created_by !== EXPECTED_PRODUCT_CLASSES_PILOT_PAYLOAD.created_by) {
    throw new Error("product_classes pilot created_by policy mismatch.");
  }

  const uniqueRows = runSupabaseDbQuery(`
    select exists(
      select 1
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public'
        and t.relname = 'product_classes'
        and c.contype = 'u'
        and pg_get_constraintdef(c.oid) ilike '%(value)%'
    ) as has_unique_value
  `);
  if (uniqueRows[0]?.has_unique_value !== true) {
    throw new Error("UNIQUE(value) missing for product_classes.");
  }

  const columnsRows = runSupabaseDbQuery(`
    select column_name, is_nullable, column_default
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'product_classes'
  `);
  let tenantNullable = false;
  let hasCreatedByColumn = false;
  let sortOrderDefault = "";
  let isActiveDefault = "";
  let createdAtDefault = "";
  let hasProductGroupIdColumn = false;
  let hasProductSubgroupIdColumn = false;
  let hasProductFamilyIdColumn = false;
  for (const row of columnsRows) {
    if (row.column_name === "tenant_id") tenantNullable = row.is_nullable === "YES";
    if (row.column_name === "created_by") hasCreatedByColumn = true;
    if (row.column_name === "sort_order") sortOrderDefault = String(row.column_default || "");
    if (row.column_name === "is_active") isActiveDefault = String(row.column_default || "");
    if (row.column_name === "created_at") createdAtDefault = String(row.column_default || "");
    if (row.column_name === "product_group_id") hasProductGroupIdColumn = true;
    if (row.column_name === "product_subgroup_id") hasProductSubgroupIdColumn = true;
    if (row.column_name === "product_family_id") hasProductFamilyIdColumn = true;
  }
  if (hasCreatedByColumn) {
    throw new Error("product_classes must not define created_by in current pilot contract.");
  }
  if (hasProductGroupIdColumn) {
    throw new Error("product_classes must not define product_group_id in current pilot contract.");
  }
  if (hasProductSubgroupIdColumn) {
    throw new Error("product_classes must not define product_subgroup_id in current pilot contract.");
  }
  if (hasProductFamilyIdColumn) {
    throw new Error("product_classes must not define product_family_id in current pilot contract.");
  }
  if (!tenantNullable) {
    throw new Error("product_classes.tenant_id must be nullable.");
  }
  if (!sortOrderDefault.trim().startsWith(EXPECTED_PRODUCT_CLASSES_PILOT_PAYLOAD.sort_order_default)) {
    throw new Error("product_classes.sort_order default must be 0.");
  }
  if (!isActiveDefault.trim().toLowerCase().startsWith(EXPECTED_PRODUCT_CLASSES_PILOT_PAYLOAD.is_active_default)) {
    throw new Error("product_classes.is_active default must be true.");
  }
  if (!createdAtDefault.toLowerCase().includes(EXPECTED_PRODUCT_CLASSES_PILOT_PAYLOAD.created_at_default)) {
    throw new Error("product_classes.created_at default must be now().");
  }

  const fkRows = runSupabaseDbQuery(`
    select pg_get_constraintdef(c.oid) as fk_def
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where c.contype = 'f'
      and n.nspname='public'
      and t.relname='product_classes'
  `);
  const hasFkToProductGroups = fkRows.some((r) =>
    String(r.fk_def || "").toLowerCase().includes("product_groups"),
  );
  const hasFkToProductSubgroups = fkRows.some((r) =>
    String(r.fk_def || "").toLowerCase().includes("product_subgroups"),
  );
  const hasFkToProductFamilies = fkRows.some((r) =>
    String(r.fk_def || "").toLowerCase().includes("product_families"),
  );
  if (hasFkToProductGroups) {
    throw new Error("product_classes must not have FK to product_groups for 22BB-R2 pilot.");
  }
  if (hasFkToProductSubgroups) {
    throw new Error("product_classes must not have FK to product_subgroups for 22BB-R2 pilot.");
  }
  if (hasFkToProductFamilies) {
    throw new Error("product_classes must not have FK to product_families for 22BB-R2 pilot.");
  }

  const existingRows = runSupabaseDbQuery(`
    select id, value, label, tenant_id, sort_order, is_active, created_at::text as created_at
    from public.product_classes
    where value = '${escapeSqlLiteral(value)}'
  `);
  if (existingRows.length > 1) {
    throw new Error("Unexpected duplicate rows for product_classes.value during pilot.");
  }
  if (existingRows.length === 1) {
    const existing = existingRows[0];
    const samePayload =
      existing.value === value &&
      existing.label === label &&
      existing.tenant_id === null &&
      Number(existing.sort_order) === 0 &&
      existing.is_active === true &&
      typeof existing.created_at === "string" &&
      existing.created_at.length > 0;
    if (!samePayload) {
      throw new Error("Existing product_classes row diverges from frozen pilot payload/defaults.");
    }
    return {
      operation: "idempotent_noop",
      record: existing,
      inserted: false,
    };
  }

  const labelRows = runSupabaseDbQuery(
    `select count(*)::bigint as label_count from public.product_classes where label = '${escapeSqlLiteral(label)}'`,
  );
  const labelCount = Number(labelRows[0]?.label_count || 0);
  if (labelCount > 0) {
    throw new Error("Label collision detected without value match for product_classes pilot.");
  }

  const insertedRows = runSupabaseDbQuery(`
    insert into public.product_classes (value, label, tenant_id)
    values ('${escapeSqlLiteral(value)}', '${escapeSqlLiteral(label)}', null)
    returning id, value, label, tenant_id, sort_order, is_active, created_at::text as created_at
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
    throw new Error("product_classes defaults were not applied as expected after insert.");
  }
  return {
    operation: "inserted",
    record: inserted,
    inserted: true,
  };
}

function executeCompaniesPilotWrite(params) {
  const {
    pilotEntity,
    pilotAuthorization,
    tenant_id,
    name,
    cnpj,
    owner_write_policy,
    sales_rep_id_policy,
    legal_entity_id_policy,
    created_by_policy,
    expectedTargetRef,
    expectedTargetName,
    batchId,
    localTargetRef,
    localTargetName,
  } = params;

  if (pilotEntity !== "companies") {
    throw new Error("Pilot entity must be companies for 22BG-R2 real pilot write.");
  }
  if (pilotAuthorization !== EXPECTED_COMPANIES_PILOT_AUTHORIZATION) {
    throw new Error("Pilot authorization phrase mismatch for companies pilot write.");
  }
  if (expectedTargetRef !== EXPECTED_TARGET_REF || localTargetRef !== EXPECTED_TARGET_REF) {
    throw new Error("Target ref mismatch for companies pilot write.");
  }
  if (expectedTargetName !== EXPECTED_TARGET_NAME || localTargetName !== EXPECTED_TARGET_NAME) {
    throw new Error("Target name mismatch for companies pilot write.");
  }
  if (batchId !== EXPECTED_BATCH_ID) {
    throw new Error("Batch mismatch for companies pilot write.");
  }
  if (tenant_id !== EXPECTED_COMPANIES_PILOT_PAYLOAD.tenant_id) {
    throw new Error("companies pilot tenant_id mismatch.");
  }
  if (name !== EXPECTED_COMPANIES_PILOT_PAYLOAD.name) {
    throw new Error("companies pilot name mismatch.");
  }
  if (cnpj !== EXPECTED_COMPANIES_PILOT_PAYLOAD.cnpj) {
    throw new Error("companies pilot cnpj mismatch.");
  }
  if (owner_write_policy !== EXPECTED_COMPANIES_PILOT_PAYLOAD.owner_write_policy) {
    throw new Error("companies pilot owner_write_policy mismatch.");
  }
  if (sales_rep_id_policy !== EXPECTED_COMPANIES_PILOT_PAYLOAD.sales_rep_id_policy) {
    throw new Error("companies pilot sales_rep_id_policy mismatch.");
  }
  if (legal_entity_id_policy !== EXPECTED_COMPANIES_PILOT_PAYLOAD.legal_entity_id_policy) {
    throw new Error("companies pilot legal_entity_id_policy mismatch.");
  }
  if (created_by_policy !== EXPECTED_COMPANIES_PILOT_PAYLOAD.created_by_policy) {
    throw new Error("companies pilot created_by_policy mismatch.");
  }
  const normalizedExpectedName = String(name).toUpperCase();

  const companyContactsRows = runSupabaseDbQuery("select to_regclass('public.company_contacts') as regclass");
  if (companyContactsRows[0]?.regclass !== null) {
    throw new Error("company_contacts must remain reference-only/non-writable in companies pilot.");
  }

  const uniqueRows = runSupabaseDbQuery(`
    select count(*)::bigint as matched_indexes
    from pg_indexes
    where schemaname='public'
      and tablename='companies'
      and indexname in ('idx_companies_tenant_cnpj','idx_companies_cnpj_unique')
  `);
  if (Number(uniqueRows[0]?.matched_indexes || 0) < 2) {
    throw new Error("Required unique indexes for companies idempotency are missing.");
  }

  const tenantRows = runSupabaseDbQuery(
    `select exists(select 1 from public.tenants where id='${escapeSqlLiteral(tenant_id)}') as tenant_exists`,
  );
  if (tenantRows[0]?.tenant_exists !== true) {
    throw new Error("Pilot tenant does not exist for companies pilot write.");
  }

  const existingRows = runSupabaseDbQuery(`
    select id, tenant_id, name, cnpj, cnpj_root, owner_id, sales_rep_id, legal_entity_id, created_by
    from public.companies
    where tenant_id = '${escapeSqlLiteral(tenant_id)}'
      and cnpj = '${escapeSqlLiteral(cnpj)}'
  `);
  if (existingRows.length > 1) {
    throw new Error("Unexpected duplicate rows for companies(tenant_id, cnpj) during pilot.");
  }
  if (existingRows.length === 1) {
    const existing = existingRows[0];
    const samePayload =
      existing.tenant_id === tenant_id &&
      (existing.name === name || existing.name === normalizedExpectedName) &&
      existing.cnpj === cnpj &&
      existing.owner_id === null &&
      existing.sales_rep_id === null &&
      existing.legal_entity_id === null &&
      existing.created_by === null;
    if (!samePayload) {
      throw new Error("Existing companies row diverges from frozen pilot payload.");
    }
    return {
      operation: "idempotent_noop",
      record: existing,
      inserted: false,
    };
  }

  const insertedRows = runSupabaseDbQuery(`
    insert into public.companies (tenant_id, name, cnpj)
    values ('${escapeSqlLiteral(tenant_id)}', '${escapeSqlLiteral(name)}', '${escapeSqlLiteral(cnpj)}')
    returning id, tenant_id, name, cnpj, cnpj_root, owner_id, sales_rep_id, legal_entity_id, created_by
  `);
  if (insertedRows.length !== 1) {
    throw new Error("Pilot insert did not return exactly one companies row.");
  }
  const inserted = insertedRows[0];
  if (inserted.owner_id !== null || inserted.sales_rep_id !== null || inserted.legal_entity_id !== null || inserted.created_by !== null) {
    throw new Error("Forbidden dependent fields were unexpectedly written in companies pilot.");
  }
  return {
    operation: "inserted",
    record: inserted,
    inserted: true,
  };
}

function executeContactsPilotWrite(params) {
  const {
    pilotEntity,
    pilotAuthorization,
    tenant_id,
    first_name,
    email,
    company_temp_key,
    company_id_policy,
    write_contact_in_same_phase,
    company_lookup_cnpj,
    expectedTargetRef,
    expectedTargetName,
    batchId,
    localTargetRef,
    localTargetName,
  } = params;

  if (pilotEntity !== "contacts") {
    throw new Error("Pilot entity must be contacts for 22BH-R2 real pilot write.");
  }
  if (pilotAuthorization !== EXPECTED_CONTACTS_PILOT_AUTHORIZATION) {
    throw new Error("Pilot authorization phrase mismatch for contacts pilot write.");
  }
  if (expectedTargetRef !== EXPECTED_TARGET_REF || localTargetRef !== EXPECTED_TARGET_REF) {
    throw new Error("Target ref mismatch for contacts pilot write.");
  }
  if (expectedTargetName !== EXPECTED_TARGET_NAME || localTargetName !== EXPECTED_TARGET_NAME) {
    throw new Error("Target name mismatch for contacts pilot write.");
  }
  if (batchId !== EXPECTED_BATCH_ID) {
    throw new Error("Batch mismatch for contacts pilot write.");
  }
  if (tenant_id !== EXPECTED_CONTACTS_PILOT_PAYLOAD.tenant_id) {
    throw new Error("contacts pilot tenant_id mismatch.");
  }
  if (first_name !== EXPECTED_CONTACTS_PILOT_PAYLOAD.first_name) {
    throw new Error("contacts pilot first_name mismatch.");
  }
  if (email !== EXPECTED_CONTACTS_PILOT_PAYLOAD.email) {
    throw new Error("contacts pilot email mismatch.");
  }
  if (company_temp_key !== EXPECTED_CONTACTS_PILOT_PAYLOAD.company_temp_key) {
    throw new Error("contacts pilot company_temp_key mismatch.");
  }
  if (company_id_policy !== EXPECTED_CONTACTS_PILOT_PAYLOAD.company_id_policy) {
    throw new Error("contacts pilot company_id_policy mismatch.");
  }
  if (write_contact_in_same_phase !== false) {
    throw new Error("contacts pilot payload must keep write_contact_in_same_phase=false.");
  }
  if (company_lookup_cnpj !== EXPECTED_CONTACTS_PILOT_PAYLOAD.company_lookup_cnpj) {
    throw new Error("contacts company lookup cnpj mismatch.");
  }

  const companyContactsRows = runSupabaseDbQuery("select to_regclass('public.company_contacts') as regclass");
  if (companyContactsRows[0]?.regclass !== null) {
    throw new Error("company_contacts must remain reference-only/non-writable in contacts pilot.");
  }

  const uniqueRows = runSupabaseDbQuery(`
    select count(*)::bigint as matched_indexes
    from pg_indexes
    where schemaname='public'
      and tablename='contacts'
      and indexname = 'idx_contacts_tenant_company_email_unique'
  `);
  if (Number(uniqueRows[0]?.matched_indexes || 0) < 1) {
    throw new Error("Required unique index for contacts idempotency is missing.");
  }

  const tenantRows = runSupabaseDbQuery(
    `select exists(select 1 from public.tenants where id='${escapeSqlLiteral(tenant_id)}') as tenant_exists`,
  );
  if (tenantRows[0]?.tenant_exists !== true) {
    throw new Error("Pilot tenant does not exist for contacts pilot write.");
  }

  const companyRows = runSupabaseDbQuery(`
    select id, tenant_id, cnpj, name, owner_id, sales_rep_id, legal_entity_id
    from public.companies
    where tenant_id = '${escapeSqlLiteral(tenant_id)}'
      and cnpj = '${escapeSqlLiteral(company_lookup_cnpj)}'
  `);
  if (companyRows.length !== 1) {
    throw new Error("Company lookup by (tenant_id, cnpj) must return exactly one row.");
  }
  const resolvedCompany = companyRows[0];
  if (resolvedCompany.id !== EXPECTED_CONTACTS_PILOT_PAYLOAD.resolved_company_id) {
    throw new Error("Resolved company id differs from frozen pilot contract.");
  }
  if (resolvedCompany.owner_id !== null || resolvedCompany.sales_rep_id !== null || resolvedCompany.legal_entity_id !== null) {
    throw new Error("Resolved company must keep owner/sales_rep/legal_entity null in this pilot.");
  }

  const normalizedExpectedFirstName = String(first_name).toUpperCase();
  const existingRows = runSupabaseDbQuery(`
    select id, tenant_id, company_id, first_name, email, owner_id, created_by
    from public.contacts
    where tenant_id = '${escapeSqlLiteral(tenant_id)}'
      and company_id = '${escapeSqlLiteral(resolvedCompany.id)}'
      and email = '${escapeSqlLiteral(email)}'
  `);
  if (existingRows.length > 1) {
    throw new Error("Unexpected duplicate rows for contacts(tenant_id, company_id, email) during pilot.");
  }
  if (existingRows.length === 1) {
    const existing = existingRows[0];
    const samePayload =
      existing.tenant_id === tenant_id &&
      existing.company_id === resolvedCompany.id &&
      (existing.first_name === first_name || existing.first_name === normalizedExpectedFirstName) &&
      existing.email === email &&
      existing.owner_id === null &&
      existing.created_by === null;
    if (!samePayload) {
      throw new Error("Existing contacts row diverges from frozen pilot payload.");
    }
    return {
      operation: "idempotent_noop",
      record: existing,
      resolvedCompany,
      inserted: false,
    };
  }

  const insertedRows = runSupabaseDbQuery(`
    insert into public.contacts (tenant_id, company_id, first_name, email)
    values (
      '${escapeSqlLiteral(tenant_id)}',
      '${escapeSqlLiteral(resolvedCompany.id)}',
      '${escapeSqlLiteral(first_name)}',
      '${escapeSqlLiteral(email)}'
    )
    returning id, tenant_id, company_id, first_name, email, owner_id, created_by
  `);
  if (insertedRows.length !== 1) {
    throw new Error("Pilot insert did not return exactly one contacts row.");
  }
  const inserted = insertedRows[0];
  if (inserted.owner_id !== null || inserted.created_by !== null) {
    throw new Error("Forbidden dependent fields were unexpectedly written in contacts pilot.");
  }
  return {
    operation: "inserted",
    record: inserted,
    resolvedCompany,
    inserted: true,
  };
}

function executeCompaniesContactsWaveWrite(params) {
  const {
    pilotEntity,
    pilotAuthorization,
    expectedTargetRef,
    expectedTargetName,
    batchId,
    localTargetRef,
    localTargetName,
    wavePayload,
  } = params;

  if (pilotEntity !== "companies_contacts_wave") {
    throw new Error("Pilot entity must be companies_contacts_wave for 22BL-R2 wave write.");
  }
  if (pilotAuthorization !== EXPECTED_COMPANIES_CONTACTS_WAVE_PILOT_AUTHORIZATION) {
    throw new Error("Pilot authorization phrase mismatch for companies_contacts_wave.");
  }
  if (expectedTargetRef !== EXPECTED_TARGET_REF || localTargetRef !== EXPECTED_TARGET_REF) {
    throw new Error("Target ref mismatch for companies_contacts_wave.");
  }
  if (expectedTargetName !== EXPECTED_TARGET_NAME || localTargetName !== EXPECTED_TARGET_NAME) {
    throw new Error("Target name mismatch for companies_contacts_wave.");
  }
  if (batchId !== EXPECTED_BATCH_ID) {
    throw new Error("Batch mismatch for companies_contacts_wave.");
  }
  if (!wavePayload || typeof wavePayload !== "object") {
    throw new Error("Wave payload must be a valid object.");
  }

  const wave = wavePayload.selectedWave;
  if (!wave || typeof wave !== "object") {
    throw new Error("selectedWave section is required in wave payload.");
  }

  const companies = Array.isArray(wave.companiesSelected) ? wave.companiesSelected : [];
  const contacts = Array.isArray(wave.contactsSelected) ? wave.contactsSelected : [];
  const pairs = Array.isArray(wave.pairs) ? wave.pairs : [];

  const expectedCompanyKeys = [
    "TMP-22F-R2-COMPANY-02",
    "TMP-22F-R2-COMPANY-03",
    "TMP-22F-R2-COMPANY-04",
    "TMP-22F-R2-COMPANY-05",
  ];
  const expectedContactKeys = [
    "TMP-22F-R2-CONTACT-02",
    "TMP-22F-R2-CONTACT-03",
    "TMP-22F-R2-CONTACT-04",
    "TMP-22F-R2-CONTACT-05",
  ];
  const expectedTenantId = "00000000-0000-0000-0000-000000000001";

  if (Number(wave.limit) !== 4 || companies.length !== 4 || contacts.length !== 4 || pairs.length !== 4) {
    throw new Error("Frozen wave must contain exactly 4 companies, 4 contacts and 4 pairs.");
  }

  const byCompanyKey = new Map(companies.map((item) => [item.temp_key, item]));
  const byContactKey = new Map(contacts.map((item) => [item.temp_key, item]));
  const expectedPairSet = new Set(expectedCompanyKeys.map((companyKey, idx) => `${companyKey}|${expectedContactKeys[idx]}`));

  const written = {
    insertedCompanies: [],
    insertedContacts: [],
    companyIds: {},
    contactIds: {},
    pairOperations: [],
  };

  const companyContactsRows = runSupabaseDbQuery("select to_regclass('public.company_contacts') as regclass");
  if (companyContactsRows[0]?.regclass !== null) {
    throw new Error("company_contacts must remain reference-only/non-writable in 22BL-R2.");
  }

  const companiesIndexRows = runSupabaseDbQuery(`
    select count(*)::bigint as matched_indexes
    from pg_indexes
    where schemaname='public'
      and tablename='companies'
      and indexname in ('idx_companies_tenant_cnpj','idx_companies_cnpj_unique')
  `);
  if (Number(companiesIndexRows[0]?.matched_indexes || 0) < 2) {
    throw new Error("Required companies idempotency indexes are missing.");
  }

  const contactsIndexRows = runSupabaseDbQuery(`
    select count(*)::bigint as matched_indexes
    from pg_indexes
    where schemaname='public'
      and tablename='contacts'
      and indexname='idx_contacts_tenant_company_email_unique'
  `);
  if (Number(contactsIndexRows[0]?.matched_indexes || 0) < 1) {
    throw new Error("Required contacts idempotency index is missing.");
  }

  const tenantRows = runSupabaseDbQuery(
    `select exists(select 1 from public.tenants where id='${escapeSqlLiteral(expectedTenantId)}') as tenant_exists`,
  );
  if (tenantRows[0]?.tenant_exists !== true) {
    throw new Error("Pilot tenant does not exist for companies_contacts_wave.");
  }

  for (const pair of pairs) {
    const companyTempKey = String(pair?.company_temp_key || "");
    const contactTempKey = String(pair?.contact_temp_key || "");
    const pairKey = `${companyTempKey}|${contactTempKey}`;
    if (!expectedPairSet.has(pairKey)) {
      throw new Error(`Invalid pair in frozen wave payload: ${pairKey}`);
    }
    const company = byCompanyKey.get(companyTempKey);
    const contact = byContactKey.get(contactTempKey);
    if (!company || !contact) {
      throw new Error(`Missing company/contact payload for pair ${pairKey}.`);
    }

    if (!expectedCompanyKeys.includes(companyTempKey) || !expectedContactKeys.includes(contactTempKey)) {
      throw new Error(`Pair temp keys out of allowed range 02..05: ${pairKey}`);
    }
    if (company.tenant_id !== expectedTenantId || contact.tenant_id !== expectedTenantId) {
      throw new Error(`tenant_id mismatch for pair ${pairKey}.`);
    }
    if (company.cnpj !== `TMP-DOC-COMP-${companyTempKey.slice(-2).padStart(4, "0")}`) {
      throw new Error(`Unexpected cnpj for ${companyTempKey}.`);
    }
    if (company.name !== `TMP Company ${companyTempKey.slice(-2)}`) {
      throw new Error(`Unexpected name for ${companyTempKey}.`);
    }
    if (company.expected_persisted_name !== String(company.name).toUpperCase()) {
      throw new Error(`expected_persisted_name mismatch for ${companyTempKey}.`);
    }
    if (contact.email !== `tmp.contact${contactTempKey.slice(-2)}@qualyvac.local`) {
      throw new Error(`Unexpected email for ${contactTempKey}.`);
    }
    if (contact.first_name !== `TMP Contact ${contactTempKey.slice(-2)}`) {
      throw new Error(`Unexpected first_name for ${contactTempKey}.`);
    }
    if (contact.expected_persisted_first_name !== String(contact.first_name).toUpperCase()) {
      throw new Error(`expected_persisted_first_name mismatch for ${contactTempKey}.`);
    }
    if (company.owner_write_policy !== "reference_only_not_written") {
      throw new Error(`owner_write_policy mismatch for ${companyTempKey}.`);
    }
    if (company.sales_rep_id_policy !== "omit_or_null") {
      throw new Error(`sales_rep_id_policy mismatch for ${companyTempKey}.`);
    }
    if (company.legal_entity_id_policy !== "omit_or_null") {
      throw new Error(`legal_entity_id_policy mismatch for ${companyTempKey}.`);
    }
    if (company.created_by_policy !== "omit_or_null") {
      throw new Error(`created_by_policy mismatch for ${companyTempKey}.`);
    }
    if (contact.company_temp_key !== companyTempKey) {
      throw new Error(`contact.company_temp_key mismatch for ${contactTempKey}.`);
    }
    if (contact.company_resolution_policy !== "lookup_after_company_insert") {
      throw new Error(`company_resolution_policy mismatch for ${contactTempKey}.`);
    }
    if (contact.write_after_company !== true) {
      throw new Error(`write_after_company must be true for ${contactTempKey}.`);
    }
  }

  for (const pair of pairs) {
    const company = byCompanyKey.get(pair.company_temp_key);
    const contact = byContactKey.get(pair.contact_temp_key);
    const pairState = {
      company_temp_key: company.temp_key,
      contact_temp_key: contact.temp_key,
      company_operation: "not_started",
      contact_operation: "not_started",
      company_id: null,
      contact_id: null,
      error: null,
    };

    try {
      const normalizedExpectedName = String(company.name).toUpperCase();
      const existingCompanies = runSupabaseDbQuery(`
        select id, tenant_id, name, cnpj, owner_id, sales_rep_id, legal_entity_id, created_by
        from public.companies
        where tenant_id='${escapeSqlLiteral(company.tenant_id)}'
          and cnpj='${escapeSqlLiteral(company.cnpj)}'
      `);
      if (existingCompanies.length > 1) {
        throw new Error(`Duplicate companies rows for ${company.temp_key}.`);
      }

      let resolvedCompany = null;
      if (existingCompanies.length === 1) {
        const row = existingCompanies[0];
        const sameCompany =
          row.tenant_id === company.tenant_id &&
          row.cnpj === company.cnpj &&
          (row.name === company.name || row.name === normalizedExpectedName) &&
          row.owner_id === null &&
          row.sales_rep_id === null &&
          row.legal_entity_id === null &&
          row.created_by === null;
        if (!sameCompany) {
          throw new Error(`Existing company diverges from frozen payload for ${company.temp_key}.`);
        }
        pairState.company_operation = "idempotent_noop";
        resolvedCompany = row;
      } else {
        const insertedCompanyRows = runSupabaseDbQuery(`
          insert into public.companies (tenant_id, name, cnpj)
          values (
            '${escapeSqlLiteral(company.tenant_id)}',
            '${escapeSqlLiteral(company.name)}',
            '${escapeSqlLiteral(company.cnpj)}'
          )
          returning id, tenant_id, name, cnpj, owner_id, sales_rep_id, legal_entity_id, created_by
        `);
        if (insertedCompanyRows.length !== 1) {
          throw new Error(`Company insert failed for ${company.temp_key}.`);
        }
        resolvedCompany = insertedCompanyRows[0];
        pairState.company_operation = "inserted";
        written.insertedCompanies.push(company.temp_key);
      }

      const companyLookupRows = runSupabaseDbQuery(`
        select id, tenant_id, name, cnpj, owner_id, sales_rep_id, legal_entity_id, created_by
        from public.companies
        where tenant_id='${escapeSqlLiteral(company.tenant_id)}'
          and cnpj='${escapeSqlLiteral(company.cnpj)}'
      `);
      if (companyLookupRows.length !== 1) {
        throw new Error(`Company lookup cardinality must be 1 for ${company.temp_key}.`);
      }
      resolvedCompany = companyLookupRows[0];
      if (
        resolvedCompany.owner_id !== null ||
        resolvedCompany.sales_rep_id !== null ||
        resolvedCompany.legal_entity_id !== null ||
        resolvedCompany.created_by !== null
      ) {
        throw new Error(`Forbidden company dependent fields changed for ${company.temp_key}.`);
      }

      pairState.company_id = resolvedCompany.id;
      written.companyIds[company.temp_key] = resolvedCompany.id;

      const normalizedExpectedFirstName = String(contact.first_name).toUpperCase();
      const existingContacts = runSupabaseDbQuery(`
        select id, tenant_id, company_id, first_name, email, owner_id, created_by
        from public.contacts
        where tenant_id='${escapeSqlLiteral(contact.tenant_id)}'
          and company_id='${escapeSqlLiteral(resolvedCompany.id)}'
          and email='${escapeSqlLiteral(contact.email)}'
      `);
      if (existingContacts.length > 1) {
        throw new Error(`Duplicate contacts rows for ${contact.temp_key}.`);
      }

      if (existingContacts.length === 1) {
        const row = existingContacts[0];
        const sameContact =
          row.tenant_id === contact.tenant_id &&
          row.company_id === resolvedCompany.id &&
          row.email === contact.email &&
          (row.first_name === contact.first_name || row.first_name === normalizedExpectedFirstName) &&
          row.owner_id === null &&
          row.created_by === null;
        if (!sameContact) {
          throw new Error(`Existing contact diverges from frozen payload for ${contact.temp_key}.`);
        }
        pairState.contact_operation = "idempotent_noop";
        pairState.contact_id = row.id;
      } else {
        const insertedContactRows = runSupabaseDbQuery(`
          insert into public.contacts (tenant_id, company_id, first_name, email)
          values (
            '${escapeSqlLiteral(contact.tenant_id)}',
            '${escapeSqlLiteral(resolvedCompany.id)}',
            '${escapeSqlLiteral(contact.first_name)}',
            '${escapeSqlLiteral(contact.email)}'
          )
          returning id, tenant_id, company_id, first_name, email, owner_id, created_by
        `);
        if (insertedContactRows.length !== 1) {
          throw new Error(`Contact insert failed for ${contact.temp_key}.`);
        }
        pairState.contact_operation = "inserted";
        pairState.contact_id = insertedContactRows[0].id;
        written.insertedContacts.push(contact.temp_key);
      }

      const contactLookupRows = runSupabaseDbQuery(`
        select id, tenant_id, company_id, first_name, email, owner_id, created_by
        from public.contacts
        where tenant_id='${escapeSqlLiteral(contact.tenant_id)}'
          and company_id='${escapeSqlLiteral(resolvedCompany.id)}'
          and email='${escapeSqlLiteral(contact.email)}'
      `);
      if (contactLookupRows.length !== 1) {
        throw new Error(`Contact lookup cardinality must be 1 for ${contact.temp_key}.`);
      }
      if (contactLookupRows[0].owner_id !== null || contactLookupRows[0].created_by !== null) {
        throw new Error(`Forbidden contact dependent fields changed for ${contact.temp_key}.`);
      }
      pairState.contact_id = contactLookupRows[0].id;
      written.contactIds[contact.temp_key] = contactLookupRows[0].id;
      written.pairOperations.push(pairState);
    } catch (error) {
      pairState.error = error instanceof Error ? error.message : String(error);
      written.pairOperations.push(pairState);
      const hasWrites = written.insertedCompanies.length > 0 || written.insertedContacts.length > 0;
      return {
        operation: hasWrites ? "partial_aborted" : "aborted",
        error: pairState.error,
        failedPair: pairState,
        ...written,
      };
    }
  }

  return {
    operation: "completed",
    error: null,
    failedPair: null,
    ...written,
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
      : selectedPilotEntity === "product_families"
        ? EXPECTED_PRODUCT_FAMILIES_PILOT_AUTHORIZATION
      : selectedPilotEntity === "product_classes"
        ? EXPECTED_PRODUCT_CLASSES_PILOT_AUTHORIZATION
      : selectedPilotEntity === "companies"
        ? EXPECTED_COMPANIES_PILOT_AUTHORIZATION
      : selectedPilotEntity === "contacts"
        ? EXPECTED_CONTACTS_PILOT_AUTHORIZATION
      : selectedPilotEntity === "companies_contacts_wave"
        ? EXPECTED_COMPANIES_CONTACTS_WAVE_PILOT_AUTHORIZATION
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
      "Pilot entity must be legal_entities, product_types, product_groups, product_subgroups, product_families, product_classes, companies, contacts or companies_contacts_wave.",
    );
  } else if (selectedPilotEntity === "legal_entities") {
    pushValidation(validations, "pilot.entity.value", "PASS", "Pilot entity validated as legal_entities.");
  } else if (selectedPilotEntity === "product_types") {
    pushValidation(validations, "pilot.entity.value", "PASS", "Pilot entity validated as product_types.");
  } else if (selectedPilotEntity === "product_groups") {
    pushValidation(validations, "pilot.entity.value", "PASS", "Pilot entity validated as product_groups.");
  } else if (selectedPilotEntity === "product_subgroups") {
    pushValidation(validations, "pilot.entity.value", "PASS", "Pilot entity validated as product_subgroups.");
  } else if (selectedPilotEntity === "product_families") {
    pushValidation(validations, "pilot.entity.value", "PASS", "Pilot entity validated as product_families.");
  } else if (selectedPilotEntity === "product_classes") {
    pushValidation(validations, "pilot.entity.value", "PASS", "Pilot entity validated as product_classes.");
  } else if (selectedPilotEntity === "companies") {
    pushValidation(validations, "pilot.entity.value", "PASS", "Pilot entity validated as companies.");
  } else if (selectedPilotEntity === "contacts") {
    pushValidation(validations, "pilot.entity.value", "PASS", "Pilot entity validated as contacts.");
  } else if (selectedPilotEntity === "companies_contacts_wave") {
    pushValidation(validations, "pilot.entity.value", "PASS", "Pilot entity validated as companies_contacts_wave.");
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
      selectedPilotEntity === "product_subgroups" ||
      selectedPilotEntity === "product_families" ||
      selectedPilotEntity === "product_classes" ||
      selectedPilotEntity === "companies" ||
      selectedPilotEntity === "companies_contacts_wave" ||
      selectedPilotEntity === "contacts") &&
    !args.pilotPayload
  ) {
    noGoReasons.push(`--pilot-payload is required when --pilot-entity ${selectedPilotEntity} is used.`);
    pushValidation(validations, "pilot.payload.flag", "FAIL", `--pilot-payload not provided for ${selectedPilotEntity} pilot.`);
  } else if (
    (selectedPilotEntity === "product_types" ||
      selectedPilotEntity === "product_groups" ||
      selectedPilotEntity === "product_subgroups" ||
      selectedPilotEntity === "product_families" ||
      selectedPilotEntity === "product_classes" ||
      selectedPilotEntity === "companies" ||
      selectedPilotEntity === "companies_contacts_wave" ||
      selectedPilotEntity === "contacts") &&
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
  let productFamiliesCountCurrent = null;
  let productFamiliesValueCollisionCount = null;
  let productFamiliesLabelCollisionCount = null;
  let productFamiliesUniqueValuePresent = false;
  let productFamiliesTenantNullable = null;
  let productFamiliesCreatedByColumnPresent = false;
  let productFamiliesSortOrderDefault = null;
  let productFamiliesIsActiveDefault = null;
  let productFamiliesCreatedAtDefault = null;
  let productFamiliesHasProductGroupIdColumn = false;
  let productFamiliesHasProductSubgroupIdColumn = false;
  let productFamiliesHasFkToProductGroups = false;
  let productFamiliesHasFkToProductSubgroups = false;
  let productClassesCountCurrent = null;
  let productClassesValueCollisionCount = null;
  let productClassesLabelCollisionCount = null;
  let productClassesUniqueValuePresent = false;
  let productClassesTenantNullable = null;
  let productClassesCreatedByColumnPresent = false;
  let productClassesSortOrderDefault = null;
  let productClassesIsActiveDefault = null;
  let productClassesCreatedAtDefault = null;
  let productClassesHasProductGroupIdColumn = false;
  let productClassesHasProductSubgroupIdColumn = false;
  let productClassesHasProductFamilyIdColumn = false;
  let productClassesHasFkToProductGroups = false;
  let productClassesHasFkToProductSubgroups = false;
  let productClassesHasFkToProductFamilies = false;
  let companiesCountCurrent = null;
  let companiesTenantRequired = null;
  let companiesNameRequired = null;
  let companiesCnpjIsText = null;
  let companiesUniqueTenantCnpjPresent = false;
  let companiesUniqueCnpjPresent = false;
  let companiesTenantExists = null;
  let companiesNameCollisionCount = null;
  let companiesCnpjCollisionCount = null;
  let companiesOwnerNullable = null;
  let companiesSalesRepNullable = null;
  let companiesLegalEntityNullable = null;
  let companiesCreatedByNullable = null;
  let companiesCompanyContactsRegclass = null;
  let companiesContactsCountCurrent = null;
  let contactsCountCurrent = null;
  let contactsTenantRequired = null;
  let contactsFirstNameRequired = null;
  let contactsEmailPresent = null;
  let contactsCompanyIdPresent = null;
  let contactsCompanyIdNullable = null;
  let contactsUniqueTenantCompanyEmailPresent = false;
  let contactsTenantExists = null;
  let contactsEmailCollisionCount = null;
  let contactsFirstNameCollisionCount = null;
  let contactsCompanyFkPresent = false;
  let contactsCompanyLookupCount = null;
  let contactsResolvedCompanyId = null;
  let contactsCompanyContactsRegclass = null;
  let contactsCompaniesCountCurrent = null;

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

  if (selectedPilotEntity === "product_families") {
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
      if (pilotPayloadJson?.phase !== EXPECTED_PRODUCT_FAMILIES_PILOT_PAYLOAD.phase) {
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
        pilotPayloadJson.frozenPayload.source === EXPECTED_PRODUCT_FAMILIES_PILOT_PAYLOAD.source;
      if (!sourceOk) {
        pilotPayloadValidationErrors.push("payload origin source mismatch");
      }
      const sectionOk = String(pilotPayloadJson?.payloadOrigin?.section || "").includes("BASELINE_SIMULATION.product_families");
      if (!sectionOk) {
        pilotPayloadValidationErrors.push("payload origin section mismatch");
      }

      const frozenRecords = pilotPayloadJson?.frozenPayload?.records;
      if (!Array.isArray(frozenRecords) || frozenRecords.length !== 1) {
        pilotPayloadValidationErrors.push("frozen payload must contain exactly 1 record");
      } else {
        const [record] = frozenRecords;
        if (pilotPayloadJson?.frozenPayload?.entity !== EXPECTED_PRODUCT_FAMILIES_PILOT_PAYLOAD.entity) {
          pilotPayloadValidationErrors.push("frozen payload entity mismatch");
        }
        if (record?.temp_key !== EXPECTED_PRODUCT_FAMILIES_PILOT_PAYLOAD.temp_key) {
          pilotPayloadValidationErrors.push("temp_key mismatch");
        }
        if (record?.value !== EXPECTED_PRODUCT_FAMILIES_PILOT_PAYLOAD.value) {
          pilotPayloadValidationErrors.push("value mismatch");
        }
        if (record?.label !== EXPECTED_PRODUCT_FAMILIES_PILOT_PAYLOAD.label) {
          pilotPayloadValidationErrors.push("label mismatch");
        }
        if (record?.tenant_id !== EXPECTED_PRODUCT_FAMILIES_PILOT_PAYLOAD.tenant_id) {
          pilotPayloadValidationErrors.push("tenant_id mismatch");
        }
        if (record?.created_by !== EXPECTED_PRODUCT_FAMILIES_PILOT_PAYLOAD.created_by) {
          pilotPayloadValidationErrors.push("created_by policy mismatch");
        }
      }

      const tenantPolicyIsNull =
        pilotPayloadJson?.tenantPolicy?.tenant_id === null &&
        String(pilotPayloadJson?.tenantPolicy?.mode || "").toLowerCase().includes("null");
      if (!tenantPolicyIsNull) {
        pilotPayloadValidationErrors.push("tenant policy must be null scope");
      }

      const createdByNotApplicable =
        pilotPayloadJson?.createdByPolicy?.created_by === EXPECTED_PRODUCT_FAMILIES_PILOT_PAYLOAD.created_by &&
        String(pilotPayloadJson?.createdByPolicy?.mode || "").toLowerCase().includes("not_applicable");
      if (!createdByNotApplicable) {
        pilotPayloadValidationErrors.push("created_by policy must be not_applicable");
      }

      const sortOrderDefaultOk = String(pilotPayloadJson?.defaultsPolicy?.sort_order?.default || "")
        .trim()
        .toLowerCase() === EXPECTED_PRODUCT_FAMILIES_PILOT_PAYLOAD.sort_order_default;
      const isActiveDefaultOk = String(pilotPayloadJson?.defaultsPolicy?.is_active?.default || "")
        .trim()
        .toLowerCase() === EXPECTED_PRODUCT_FAMILIES_PILOT_PAYLOAD.is_active_default;
      const createdAtDefaultOk = String(pilotPayloadJson?.defaultsPolicy?.created_at?.default || "")
        .toLowerCase()
        .includes(EXPECTED_PRODUCT_FAMILIES_PILOT_PAYLOAD.created_at_default);
      if (!sortOrderDefaultOk) pilotPayloadValidationErrors.push("sort_order default must be 0");
      if (!isActiveDefaultOk) pilotPayloadValidationErrors.push("is_active default must be true");
      if (!createdAtDefaultOk) pilotPayloadValidationErrors.push("created_at default must be now()");

      const noTechnicalLinkToProductGroups =
        pilotPayloadJson?.technicalLinks?.toProductGroups?.hasProductGroupIdColumn === false &&
        pilotPayloadJson?.technicalLinks?.toProductGroups?.hasForeignKey === false;
      const noTechnicalLinkToProductSubgroups =
        pilotPayloadJson?.technicalLinks?.toProductSubgroups?.hasProductSubgroupIdColumn === false &&
        pilotPayloadJson?.technicalLinks?.toProductSubgroups?.hasForeignKey === false;
      if (!noTechnicalLinkToProductGroups) {
        pilotPayloadValidationErrors.push("technical link to product_groups must be absent");
      }
      if (!noTechnicalLinkToProductSubgroups) {
        pilotPayloadValidationErrors.push("technical link to product_subgroups must be absent");
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
            and t.relname = 'product_families'
            and c.contype = 'u'
            and pg_get_constraintdef(c.oid) ilike '%(value)%'
        ) as has_unique_value
      `);
      productFamiliesUniqueValuePresent = uniqueRows[0]?.has_unique_value === true;
      if (!productFamiliesUniqueValuePresent) {
        noGoReasons.push("UNIQUE(value) was not found for public.product_families.");
        pushValidation(validations, "pilot.product_families.unique_value", "FAIL", "UNIQUE(value) is required.");
      } else {
        pushValidation(validations, "pilot.product_families.unique_value", "PASS", "UNIQUE(value) validated.");
      }
    } catch {
      noGoReasons.push("Unable to validate UNIQUE(value) for public.product_families.");
      pushValidation(validations, "pilot.product_families.unique_value", "FAIL", "Failed to validate UNIQUE(value).");
    }

    try {
      const cols = runSupabaseDbQuery(`
        select column_name, is_nullable, column_default
        from information_schema.columns
        where table_schema = 'public' and table_name = 'product_families'
      `);
      const colNames = new Set(cols.map((r) => r.column_name));
      productFamiliesHasProductGroupIdColumn = colNames.has("product_group_id");
      productFamiliesHasProductSubgroupIdColumn = colNames.has("product_subgroup_id");
      productFamiliesCreatedByColumnPresent = colNames.has("created_by");
      for (const row of cols) {
        if (row.column_name === "tenant_id") productFamiliesTenantNullable = row.is_nullable === "YES";
        if (row.column_name === "sort_order") productFamiliesSortOrderDefault = row.column_default || null;
        if (row.column_name === "is_active") productFamiliesIsActiveDefault = row.column_default || null;
        if (row.column_name === "created_at") productFamiliesCreatedAtDefault = row.column_default || null;
      }
      if (productFamiliesTenantNullable !== true) noGoReasons.push("product_families.tenant_id must be nullable.");
      if (productFamiliesCreatedByColumnPresent) noGoReasons.push("product_families must not define created_by in current pilot contract.");
      if (productFamiliesHasProductGroupIdColumn) noGoReasons.push("product_families must not define product_group_id in current pilot contract.");
      if (productFamiliesHasProductSubgroupIdColumn) noGoReasons.push("product_families must not define product_subgroup_id in current pilot contract.");
      if (!String(productFamiliesSortOrderDefault || "").trim().startsWith("0")) noGoReasons.push("product_families.sort_order default must be 0.");
      if (!String(productFamiliesIsActiveDefault || "").trim().toLowerCase().startsWith("true")) {
        noGoReasons.push("product_families.is_active default must be true.");
      }
      if (!String(productFamiliesCreatedAtDefault || "").toLowerCase().includes("now()")) {
        noGoReasons.push("product_families.created_at default must be now().");
      }
      pushValidation(validations, "pilot.product_families.defaults_and_nullable", "PASS", "Defaults and nullable policies validated.");
    } catch {
      noGoReasons.push("Unable to validate product_families defaults/nullable metadata.");
      pushValidation(
        validations,
        "pilot.product_families.defaults_and_nullable",
        "FAIL",
        "Failed to validate product_families defaults/nullable metadata.",
      );
    }

    try {
      const fkRows = runSupabaseDbQuery(`
        select pg_get_constraintdef(c.oid) as fk_def
        from pg_constraint c
        join pg_class t on t.oid = c.conrelid
        join pg_namespace n on n.oid = t.relnamespace
        where n.nspname='public'
          and t.relname='product_families'
          and c.contype='f'
      `);
      productFamiliesHasFkToProductGroups = fkRows.some((r) =>
        String(r.fk_def || "").toLowerCase().includes("product_groups"),
      );
      productFamiliesHasFkToProductSubgroups = fkRows.some((r) =>
        String(r.fk_def || "").toLowerCase().includes("product_subgroups"),
      );
      if (productFamiliesHasFkToProductGroups) {
        noGoReasons.push("product_families must not have FK to product_groups for 22AZ-R2 assumptions.");
      }
      if (productFamiliesHasFkToProductSubgroups) {
        noGoReasons.push("product_families must not have FK to product_subgroups for 22AZ-R2 assumptions.");
      }
      pushValidation(validations, "pilot.product_families.no_fk_product_groups", "PASS", "No FK to product_groups detected.");
      pushValidation(
        validations,
        "pilot.product_families.no_fk_product_subgroups",
        "PASS",
        "No FK to product_subgroups detected.",
      );
    } catch {
      noGoReasons.push("Unable to validate FK absence to product_groups/product_subgroups for product_families.");
      pushValidation(validations, "pilot.product_families.no_fk_product_groups", "FAIL", "Failed FK absence validation.");
      pushValidation(validations, "pilot.product_families.no_fk_product_subgroups", "FAIL", "Failed FK absence validation.");
    }

    try {
      const countRows = runSupabaseDbQuery("select count(*)::bigint as total_rows from public.product_families");
      productFamiliesCountCurrent = Number(countRows[0]?.total_rows ?? 0);
      pushValidation(validations, "pilot.product_families.current_count", "PASS", "Current product_families count collected.");
    } catch {
      noGoReasons.push("Unable to read current count from public.product_families.");
      pushValidation(validations, "pilot.product_families.current_count", "FAIL", "Failed to read product_families count.");
    }

    const candidateValue = EXPECTED_PRODUCT_FAMILIES_PILOT_PAYLOAD.value;
    const candidateLabel = EXPECTED_PRODUCT_FAMILIES_PILOT_PAYLOAD.label;
    try {
      const valueRows = runSupabaseDbQuery(
        `select count(*)::bigint as value_count from public.product_families where value = '${escapeSqlLiteral(candidateValue)}'`,
      );
      productFamiliesValueCollisionCount = Number(valueRows[0]?.value_count ?? 0);
      if (productFamiliesValueCollisionCount > 0) {
        pushValidation(
          validations,
          "pilot.product_families.value_collision",
          "PASS",
          "Value exists; full idempotent payload/default match must be checked in pilot write stage.",
        );
      } else {
        pushValidation(validations, "pilot.product_families.value_collision", "PASS", "No value collision detected.");
      }
    } catch {
      noGoReasons.push("Unable to validate value collision for product_families pilot payload.");
      pushValidation(validations, "pilot.product_families.value_collision", "FAIL", "Failed to validate value collision.");
    }

    try {
      const labelRows = runSupabaseDbQuery(
        `select count(*)::bigint as label_count from public.product_families where label = '${escapeSqlLiteral(candidateLabel)}'`,
      );
      productFamiliesLabelCollisionCount = Number(labelRows[0]?.label_count ?? 0);
      if (productFamiliesLabelCollisionCount > 0) {
        pushValidation(
          validations,
          "pilot.product_families.label_collision",
          "PASS",
          "Label exists; collision will be validated against value/idempotency in pilot write stage.",
        );
      } else {
        pushValidation(validations, "pilot.product_families.label_collision", "PASS", "No label collision detected.");
      }
    } catch {
      noGoReasons.push("Unable to validate label collision for product_families pilot payload.");
      pushValidation(validations, "pilot.product_families.label_collision", "FAIL", "Failed to validate label collision.");
    }
  }

  if (selectedPilotEntity === "product_classes") {
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
      if (pilotPayloadJson?.phase !== EXPECTED_PRODUCT_CLASSES_PILOT_PAYLOAD.phase) {
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
      if (!["GO", "PARCIAL"].includes(String(pilotPayloadJson?.finalDecision || "").toUpperCase())) {
        pilotPayloadValidationErrors.push("final decision is not GO/PARCIAL");
      }
      const sourceOk =
        typeof pilotPayloadJson?.frozenPayload?.source === "string" &&
        pilotPayloadJson.frozenPayload.source === EXPECTED_PRODUCT_CLASSES_PILOT_PAYLOAD.source;
      if (!sourceOk) {
        pilotPayloadValidationErrors.push("payload origin source mismatch");
      }
      const sectionOk = String(pilotPayloadJson?.productClassesGate?.payloadOrigin?.section || "").includes(
        "BASELINE_SIMULATION.product_classes",
      );
      if (!sectionOk) {
        pilotPayloadValidationErrors.push("payload origin section mismatch");
      }

      const frozenRecords = pilotPayloadJson?.frozenPayload?.records;
      if (!Array.isArray(frozenRecords) || frozenRecords.length !== 1) {
        pilotPayloadValidationErrors.push("frozen payload must contain exactly 1 record");
      } else {
        const [record] = frozenRecords;
        if (pilotPayloadJson?.frozenPayload?.entity !== EXPECTED_PRODUCT_CLASSES_PILOT_PAYLOAD.entity) {
          pilotPayloadValidationErrors.push("frozen payload entity mismatch");
        }
        if (record?.temp_key !== EXPECTED_PRODUCT_CLASSES_PILOT_PAYLOAD.temp_key) {
          pilotPayloadValidationErrors.push("temp_key mismatch");
        }
        if (record?.value !== EXPECTED_PRODUCT_CLASSES_PILOT_PAYLOAD.value) {
          pilotPayloadValidationErrors.push("value mismatch");
        }
        if (record?.label !== EXPECTED_PRODUCT_CLASSES_PILOT_PAYLOAD.label) {
          pilotPayloadValidationErrors.push("label mismatch");
        }
        if (record?.tenant_id !== EXPECTED_PRODUCT_CLASSES_PILOT_PAYLOAD.tenant_id) {
          pilotPayloadValidationErrors.push("tenant_id mismatch");
        }
        if (record?.created_by !== EXPECTED_PRODUCT_CLASSES_PILOT_PAYLOAD.created_by) {
          pilotPayloadValidationErrors.push("created_by policy mismatch");
        }
      }

      const tenantPolicyIsNull =
        pilotPayloadJson?.productClassesGate?.policies?.tenant_id?.value === null &&
        String(pilotPayloadJson?.productClassesGate?.policies?.tenant_id?.mode || "").toLowerCase().includes("null");
      if (!tenantPolicyIsNull) {
        pilotPayloadValidationErrors.push("tenant policy must be null scope");
      }

      const createdByNotApplicable =
        pilotPayloadJson?.productClassesGate?.policies?.created_by?.value === EXPECTED_PRODUCT_CLASSES_PILOT_PAYLOAD.created_by &&
        String(pilotPayloadJson?.productClassesGate?.policies?.created_by?.mode || "").toLowerCase().includes("not_applicable");
      if (!createdByNotApplicable) {
        pilotPayloadValidationErrors.push("created_by policy must be not_applicable");
      }

      const sortOrderDefaultOk = String(pilotPayloadJson?.productClassesGate?.policies?.defaults?.sort_order || "")
        .trim()
        .toLowerCase() === EXPECTED_PRODUCT_CLASSES_PILOT_PAYLOAD.sort_order_default;
      const isActiveDefaultOk = String(pilotPayloadJson?.productClassesGate?.policies?.defaults?.is_active || "")
        .trim()
        .toLowerCase() === EXPECTED_PRODUCT_CLASSES_PILOT_PAYLOAD.is_active_default;
      const createdAtDefaultOk = String(pilotPayloadJson?.productClassesGate?.policies?.defaults?.created_at || "")
        .toLowerCase()
        .includes(EXPECTED_PRODUCT_CLASSES_PILOT_PAYLOAD.created_at_default);
      if (!sortOrderDefaultOk) pilotPayloadValidationErrors.push("sort_order default must be 0");
      if (!isActiveDefaultOk) pilotPayloadValidationErrors.push("is_active default must be true");
      if (!createdAtDefaultOk) pilotPayloadValidationErrors.push("created_at default must be now()");

      const noTechnicalLinkToProductGroups =
        pilotPayloadJson?.productClassesGate?.dependenciesAndFks?.has_product_group_id_column === false &&
        pilotPayloadJson?.productClassesGate?.dependenciesAndFks?.fk_to_product_groups === false;
      const noTechnicalLinkToProductSubgroups =
        pilotPayloadJson?.productClassesGate?.dependenciesAndFks?.has_product_subgroup_id_column === false &&
        pilotPayloadJson?.productClassesGate?.dependenciesAndFks?.fk_to_product_subgroups === false;
      const noTechnicalLinkToProductFamilies =
        pilotPayloadJson?.productClassesGate?.dependenciesAndFks?.has_product_family_id_column === false &&
        pilotPayloadJson?.productClassesGate?.dependenciesAndFks?.fk_to_product_families === false;
      if (!noTechnicalLinkToProductGroups) {
        pilotPayloadValidationErrors.push("technical link to product_groups must be absent");
      }
      if (!noTechnicalLinkToProductSubgroups) {
        pilotPayloadValidationErrors.push("technical link to product_subgroups must be absent");
      }
      if (!noTechnicalLinkToProductFamilies) {
        pilotPayloadValidationErrors.push("technical link to product_families must be absent");
      }

      const idempotencyByValue = String(pilotPayloadJson?.productClassesGate?.idempotencyRule?.key || "") === "value";
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
            and t.relname = 'product_classes'
            and c.contype = 'u'
            and pg_get_constraintdef(c.oid) ilike '%(value)%'
        ) as has_unique_value
      `);
      productClassesUniqueValuePresent = uniqueRows[0]?.has_unique_value === true;
      if (!productClassesUniqueValuePresent) {
        noGoReasons.push("UNIQUE(value) was not found for public.product_classes.");
        pushValidation(validations, "pilot.product_classes.unique_value", "FAIL", "UNIQUE(value) is required.");
      } else {
        pushValidation(validations, "pilot.product_classes.unique_value", "PASS", "UNIQUE(value) validated.");
      }
    } catch {
      noGoReasons.push("Unable to validate UNIQUE(value) for public.product_classes.");
      pushValidation(validations, "pilot.product_classes.unique_value", "FAIL", "Failed to validate UNIQUE(value).");
    }

    try {
      const cols = runSupabaseDbQuery(`
        select column_name, is_nullable, column_default
        from information_schema.columns
        where table_schema = 'public' and table_name = 'product_classes'
      `);
      const colNames = new Set(cols.map((r) => r.column_name));
      productClassesHasProductGroupIdColumn = colNames.has("product_group_id");
      productClassesHasProductSubgroupIdColumn = colNames.has("product_subgroup_id");
      productClassesHasProductFamilyIdColumn = colNames.has("product_family_id");
      productClassesCreatedByColumnPresent = colNames.has("created_by");
      for (const row of cols) {
        if (row.column_name === "tenant_id") productClassesTenantNullable = row.is_nullable === "YES";
        if (row.column_name === "sort_order") productClassesSortOrderDefault = row.column_default || null;
        if (row.column_name === "is_active") productClassesIsActiveDefault = row.column_default || null;
        if (row.column_name === "created_at") productClassesCreatedAtDefault = row.column_default || null;
      }
      if (productClassesTenantNullable !== true) noGoReasons.push("product_classes.tenant_id must be nullable.");
      if (productClassesCreatedByColumnPresent) noGoReasons.push("product_classes must not define created_by in current pilot contract.");
      if (productClassesHasProductGroupIdColumn) noGoReasons.push("product_classes must not define product_group_id in current pilot contract.");
      if (productClassesHasProductSubgroupIdColumn) noGoReasons.push("product_classes must not define product_subgroup_id in current pilot contract.");
      if (productClassesHasProductFamilyIdColumn) noGoReasons.push("product_classes must not define product_family_id in current pilot contract.");
      if (!String(productClassesSortOrderDefault || "").trim().startsWith("0")) noGoReasons.push("product_classes.sort_order default must be 0.");
      if (!String(productClassesIsActiveDefault || "").trim().toLowerCase().startsWith("true")) {
        noGoReasons.push("product_classes.is_active default must be true.");
      }
      if (!String(productClassesCreatedAtDefault || "").toLowerCase().includes("now()")) {
        noGoReasons.push("product_classes.created_at default must be now().");
      }
      pushValidation(validations, "pilot.product_classes.defaults_and_nullable", "PASS", "Defaults and nullable policies validated.");
    } catch {
      noGoReasons.push("Unable to validate product_classes defaults/nullable metadata.");
      pushValidation(
        validations,
        "pilot.product_classes.defaults_and_nullable",
        "FAIL",
        "Failed to validate product_classes defaults/nullable metadata.",
      );
    }

    try {
      const fkRows = runSupabaseDbQuery(`
        select pg_get_constraintdef(c.oid) as fk_def
        from pg_constraint c
        join pg_class t on t.oid = c.conrelid
        join pg_namespace n on n.oid = t.relnamespace
        where n.nspname='public'
          and t.relname='product_classes'
          and c.contype='f'
      `);
      productClassesHasFkToProductGroups = fkRows.some((r) =>
        String(r.fk_def || "").toLowerCase().includes("product_groups"),
      );
      productClassesHasFkToProductSubgroups = fkRows.some((r) =>
        String(r.fk_def || "").toLowerCase().includes("product_subgroups"),
      );
      productClassesHasFkToProductFamilies = fkRows.some((r) =>
        String(r.fk_def || "").toLowerCase().includes("product_families"),
      );
      if (productClassesHasFkToProductGroups) {
        noGoReasons.push("product_classes must not have FK to product_groups for 22BB-R2 assumptions.");
      }
      if (productClassesHasFkToProductSubgroups) {
        noGoReasons.push("product_classes must not have FK to product_subgroups for 22BB-R2 assumptions.");
      }
      if (productClassesHasFkToProductFamilies) {
        noGoReasons.push("product_classes must not have FK to product_families for 22BB-R2 assumptions.");
      }
      pushValidation(validations, "pilot.product_classes.no_fk_product_groups", "PASS", "No FK to product_groups detected.");
      pushValidation(validations, "pilot.product_classes.no_fk_product_subgroups", "PASS", "No FK to product_subgroups detected.");
      pushValidation(validations, "pilot.product_classes.no_fk_product_families", "PASS", "No FK to product_families detected.");
    } catch {
      noGoReasons.push("Unable to validate FK absence to product groups/subgroups/families for product_classes.");
      pushValidation(validations, "pilot.product_classes.no_fk_product_groups", "FAIL", "Failed FK absence validation.");
      pushValidation(validations, "pilot.product_classes.no_fk_product_subgroups", "FAIL", "Failed FK absence validation.");
      pushValidation(validations, "pilot.product_classes.no_fk_product_families", "FAIL", "Failed FK absence validation.");
    }

    try {
      const countRows = runSupabaseDbQuery("select count(*)::bigint as total_rows from public.product_classes");
      productClassesCountCurrent = Number(countRows[0]?.total_rows ?? 0);
      pushValidation(validations, "pilot.product_classes.current_count", "PASS", "Current product_classes count collected.");
    } catch {
      noGoReasons.push("Unable to read current count from public.product_classes.");
      pushValidation(validations, "pilot.product_classes.current_count", "FAIL", "Failed to read product_classes count.");
    }

    const candidateValue = EXPECTED_PRODUCT_CLASSES_PILOT_PAYLOAD.value;
    const candidateLabel = EXPECTED_PRODUCT_CLASSES_PILOT_PAYLOAD.label;
    try {
      const valueRows = runSupabaseDbQuery(
        `select count(*)::bigint as value_count from public.product_classes where value = '${escapeSqlLiteral(candidateValue)}'`,
      );
      productClassesValueCollisionCount = Number(valueRows[0]?.value_count ?? 0);
      if (productClassesValueCollisionCount > 0) {
        pushValidation(
          validations,
          "pilot.product_classes.value_collision",
          "PASS",
          "Value exists; full idempotent payload/default match must be checked in pilot write stage.",
        );
      } else {
        pushValidation(validations, "pilot.product_classes.value_collision", "PASS", "No value collision detected.");
      }
    } catch {
      noGoReasons.push("Unable to validate value collision for product_classes pilot payload.");
      pushValidation(validations, "pilot.product_classes.value_collision", "FAIL", "Failed to validate value collision.");
    }

    try {
      const labelRows = runSupabaseDbQuery(
        `select count(*)::bigint as label_count from public.product_classes where label = '${escapeSqlLiteral(candidateLabel)}'`,
      );
      productClassesLabelCollisionCount = Number(labelRows[0]?.label_count ?? 0);
      if (productClassesLabelCollisionCount > 0) {
        pushValidation(
          validations,
          "pilot.product_classes.label_collision",
          "PASS",
          "Label exists; collision will be validated against value/idempotency in pilot write stage.",
        );
      } else {
        pushValidation(validations, "pilot.product_classes.label_collision", "PASS", "No label collision detected.");
      }
    } catch {
      noGoReasons.push("Unable to validate label collision for product_classes pilot payload.");
      pushValidation(validations, "pilot.product_classes.label_collision", "FAIL", "Failed to validate label collision.");
    }
  }

  if (selectedPilotEntity === "companies") {
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
      if (pilotPayloadJson?.phase !== EXPECTED_COMPANIES_PILOT_PAYLOAD.phase) pilotPayloadValidationErrors.push("phase mismatch");
      if (pilotPayloadJson?.targetRef !== EXPECTED_TARGET_REF) pilotPayloadValidationErrors.push("targetRef mismatch");
      if (pilotPayloadJson?.targetName !== EXPECTED_TARGET_NAME) pilotPayloadValidationErrors.push("targetName mismatch");
      if (pilotPayloadJson?.batchId !== EXPECTED_BATCH_ID) pilotPayloadValidationErrors.push("batchId mismatch");
      if (!["GO", "PARCIAL"].includes(String(pilotPayloadJson?.finalDecision || "").toUpperCase())) {
        pilotPayloadValidationErrors.push("final decision is not GO/PARCIAL");
      }

      const payload = pilotPayloadJson?.sanitizedCompanyPayload?.payload;
      if (!payload || typeof payload !== "object") {
        pilotPayloadValidationErrors.push("sanitizedCompanyPayload.payload missing");
      } else {
        if (payload.source !== EXPECTED_COMPANIES_PILOT_PAYLOAD.source) pilotPayloadValidationErrors.push("source mismatch");
        if (payload.temp_key !== EXPECTED_COMPANIES_PILOT_PAYLOAD.temp_key) pilotPayloadValidationErrors.push("temp_key mismatch");
        if (payload.tenant_id !== EXPECTED_COMPANIES_PILOT_PAYLOAD.tenant_id) pilotPayloadValidationErrors.push("tenant_id mismatch");
        if (payload.name !== EXPECTED_COMPANIES_PILOT_PAYLOAD.name) pilotPayloadValidationErrors.push("name mismatch");
        if (payload.cnpj !== EXPECTED_COMPANIES_PILOT_PAYLOAD.cnpj) pilotPayloadValidationErrors.push("cnpj mismatch");
        if (payload.source_document !== EXPECTED_COMPANIES_PILOT_PAYLOAD.source_document) {
          pilotPayloadValidationErrors.push("source_document mismatch");
        }
        if (payload.owner_temp_key !== EXPECTED_COMPANIES_PILOT_PAYLOAD.owner_temp_key) {
          pilotPayloadValidationErrors.push("owner_temp_key mismatch");
        }
        if (payload.owner_write_policy !== EXPECTED_COMPANIES_PILOT_PAYLOAD.owner_write_policy) {
          pilotPayloadValidationErrors.push("owner_write_policy mismatch");
        }
        if (payload.sales_rep_id_policy !== EXPECTED_COMPANIES_PILOT_PAYLOAD.sales_rep_id_policy) {
          pilotPayloadValidationErrors.push("sales_rep_id_policy mismatch");
        }
        if (payload.legal_entity_id_policy !== EXPECTED_COMPANIES_PILOT_PAYLOAD.legal_entity_id_policy) {
          pilotPayloadValidationErrors.push("legal_entity_id_policy mismatch");
        }
        if (payload.created_by_policy !== EXPECTED_COMPANIES_PILOT_PAYLOAD.created_by_policy) {
          pilotPayloadValidationErrors.push("created_by_policy mismatch");
        }
      }

      const idempotencyPrimary = pilotPayloadJson?.idempotencyRules?.companies?.primaryKey;
      if (!Array.isArray(idempotencyPrimary) || idempotencyPrimary.join(",") !== "tenant_id,cnpj") {
        pilotPayloadValidationErrors.push("idempotency primary key must be tenant_id,cnpj");
      }
      const contactsDeferred = pilotPayloadJson?.sanitizedContactPayload?.payload?.write_contact_in_same_phase === false;
      if (!contactsDeferred) {
        pilotPayloadValidationErrors.push("sanitized contact payload must keep write_contact_in_same_phase=false");
      }

      if (pilotPayloadValidationErrors.length > 0) {
        noGoReasons.push(`Pilot payload validation failed: ${pilotPayloadValidationErrors.join(", ")}`);
        pushValidation(validations, "pilot.payload.compatibility", "FAIL", "Pilot payload metadata incompatible.");
      } else {
        pushValidation(validations, "pilot.payload.compatibility", "PASS", "Pilot payload metadata validated.");
      }
    }

    try {
      const rows = runSupabaseDbQuery(`
        select column_name, data_type, is_nullable
        from information_schema.columns
        where table_schema='public'
          and table_name='companies'
          and column_name in ('tenant_id','name','cnpj','owner_id','sales_rep_id','legal_entity_id','created_by')
      `);
      const byColumn = new Map(rows.map((r) => [r.column_name, r]));
      companiesTenantRequired = byColumn.get("tenant_id")?.is_nullable === "NO";
      companiesNameRequired = byColumn.get("name")?.is_nullable === "NO";
      companiesCnpjIsText = byColumn.get("cnpj")?.data_type === "text";
      companiesOwnerNullable = byColumn.get("owner_id")?.is_nullable === "YES";
      companiesSalesRepNullable = byColumn.get("sales_rep_id")?.is_nullable === "YES";
      companiesLegalEntityNullable = byColumn.get("legal_entity_id")?.is_nullable === "YES";
      companiesCreatedByNullable = byColumn.get("created_by")?.is_nullable === "YES";
      if (companiesTenantRequired !== true) noGoReasons.push("companies.tenant_id must be required.");
      if (companiesNameRequired !== true) noGoReasons.push("companies.name must be required.");
      if (companiesCnpjIsText !== true) noGoReasons.push("companies.cnpj must be text.");
      if (companiesOwnerNullable !== true) noGoReasons.push("companies.owner_id must be nullable.");
      if (companiesSalesRepNullable !== true) noGoReasons.push("companies.sales_rep_id must be nullable.");
      if (companiesLegalEntityNullable !== true) noGoReasons.push("companies.legal_entity_id must be nullable.");
      if (companiesCreatedByNullable !== true) noGoReasons.push("companies.created_by must be nullable.");
      pushValidation(validations, "pilot.companies.columns_and_nullable", "PASS", "Columns and nullable policies validated.");
    } catch {
      noGoReasons.push("Unable to validate companies columns and nullable policies.");
      pushValidation(validations, "pilot.companies.columns_and_nullable", "FAIL", "Failed companies columns validation.");
    }

    try {
      const indexRows = runSupabaseDbQuery(`
        select indexname, indexdef
        from pg_indexes
        where schemaname='public'
          and tablename='companies'
          and indexname in ('idx_companies_tenant_cnpj','idx_companies_cnpj_unique')
      `);
      companiesUniqueTenantCnpjPresent = indexRows.some((r) => r.indexname === "idx_companies_tenant_cnpj");
      companiesUniqueCnpjPresent = indexRows.some((r) => r.indexname === "idx_companies_cnpj_unique");
      if (!companiesUniqueTenantCnpjPresent) noGoReasons.push("idx_companies_tenant_cnpj is required.");
      if (!companiesUniqueCnpjPresent) noGoReasons.push("idx_companies_cnpj_unique is required.");
      pushValidation(validations, "pilot.companies.unique_indexes", "PASS", "Unique indexes validated.");
    } catch {
      noGoReasons.push("Unable to validate companies unique indexes.");
      pushValidation(validations, "pilot.companies.unique_indexes", "FAIL", "Failed companies unique index validation.");
    }

    try {
      const tenantRows = runSupabaseDbQuery(`
        select exists(select 1 from public.tenants where id = '${escapeSqlLiteral(EXPECTED_COMPANIES_PILOT_PAYLOAD.tenant_id)}') as tenant_exists
      `);
      companiesTenantExists = tenantRows[0]?.tenant_exists === true;
      if (companiesTenantExists !== true) noGoReasons.push("Pilot tenant does not exist.");
      pushValidation(validations, "pilot.companies.tenant_exists", "PASS", "Pilot tenant existence validated.");
    } catch {
      noGoReasons.push("Unable to validate pilot tenant existence.");
      pushValidation(validations, "pilot.companies.tenant_exists", "FAIL", "Failed pilot tenant existence validation.");
    }

    try {
      const countRows = runSupabaseDbQuery("select count(*)::bigint as total_rows from public.companies");
      companiesCountCurrent = Number(countRows[0]?.total_rows ?? 0);
      pushValidation(validations, "pilot.companies.current_count", "PASS", "Current companies count collected.");
    } catch {
      noGoReasons.push("Unable to read current count from public.companies.");
      pushValidation(validations, "pilot.companies.current_count", "FAIL", "Failed to read companies count.");
    }

    try {
      const nameRows = runSupabaseDbQuery(
        `select count(*)::bigint as collision_count from public.companies where name = '${escapeSqlLiteral(EXPECTED_COMPANIES_PILOT_PAYLOAD.name)}'`,
      );
      companiesNameCollisionCount = Number(nameRows[0]?.collision_count ?? 0);
      pushValidation(validations, "pilot.companies.name_collision", "PASS", "Company name collision check executed.");
    } catch {
      noGoReasons.push("Unable to validate name collision for companies pilot payload.");
      pushValidation(validations, "pilot.companies.name_collision", "FAIL", "Failed company name collision validation.");
    }

    try {
      const cnpjRows = runSupabaseDbQuery(
        `select count(*)::bigint as collision_count from public.companies where cnpj = '${escapeSqlLiteral(EXPECTED_COMPANIES_PILOT_PAYLOAD.cnpj)}'`,
      );
      companiesCnpjCollisionCount = Number(cnpjRows[0]?.collision_count ?? 0);
      if (companiesCnpjCollisionCount > 1) {
        noGoReasons.push("More than one existing row found for companies.cnpj candidate.");
      }
      pushValidation(validations, "pilot.companies.cnpj_collision", "PASS", "Company cnpj collision check executed.");
    } catch {
      noGoReasons.push("Unable to validate cnpj collision for companies pilot payload.");
      pushValidation(validations, "pilot.companies.cnpj_collision", "FAIL", "Failed company cnpj collision validation.");
    }

    try {
      const regRows = runSupabaseDbQuery("select to_regclass('public.company_contacts') as regclass");
      companiesCompanyContactsRegclass = regRows[0]?.regclass ?? null;
      if (companiesCompanyContactsRegclass !== null) {
        noGoReasons.push("company_contacts must remain absent/reference-only for companies pilot.");
      }
      pushValidation(validations, "pilot.companies.company_contacts_reference_only", "PASS", "company_contacts reference-only validated.");
    } catch {
      noGoReasons.push("Unable to validate company_contacts reference-only status.");
      pushValidation(
        validations,
        "pilot.companies.company_contacts_reference_only",
        "FAIL",
        "Failed company_contacts reference-only validation.",
      );
    }

    try {
      const contactRows = runSupabaseDbQuery("select count(*)::bigint as total_rows from public.contacts");
      companiesContactsCountCurrent = Number(contactRows[0]?.total_rows ?? 0);
      if (companiesContactsCountCurrent !== 0) {
        noGoReasons.push("contacts must remain zero before companies pilot execution.");
      }
      pushValidation(validations, "pilot.companies.contacts_pre_count", "PASS", "Contacts pre-count validated.");
    } catch {
      noGoReasons.push("Unable to validate contacts pre-count for companies pilot.");
      pushValidation(validations, "pilot.companies.contacts_pre_count", "FAIL", "Failed contacts pre-count validation.");
    }
  }

  if (selectedPilotEntity === "contacts") {
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
      if (pilotPayloadJson?.phase !== EXPECTED_CONTACTS_PILOT_PAYLOAD.phase) pilotPayloadValidationErrors.push("phase mismatch");
      if (pilotPayloadJson?.targetRef !== EXPECTED_TARGET_REF) pilotPayloadValidationErrors.push("targetRef mismatch");
      if (pilotPayloadJson?.targetName !== EXPECTED_TARGET_NAME) pilotPayloadValidationErrors.push("targetName mismatch");
      if (pilotPayloadJson?.batchId !== EXPECTED_BATCH_ID) pilotPayloadValidationErrors.push("batchId mismatch");

      const payload = pilotPayloadJson?.sanitizedContactPayload?.payload;
      if (!payload || typeof payload !== "object") {
        pilotPayloadValidationErrors.push("sanitizedContactPayload.payload missing");
      } else {
        if (payload.source !== EXPECTED_CONTACTS_PILOT_PAYLOAD.source) pilotPayloadValidationErrors.push("source mismatch");
        if (payload.temp_key !== EXPECTED_CONTACTS_PILOT_PAYLOAD.temp_key) pilotPayloadValidationErrors.push("temp_key mismatch");
        if (payload.tenant_id !== EXPECTED_CONTACTS_PILOT_PAYLOAD.tenant_id) pilotPayloadValidationErrors.push("tenant_id mismatch");
        if (payload.first_name !== EXPECTED_CONTACTS_PILOT_PAYLOAD.first_name) pilotPayloadValidationErrors.push("first_name mismatch");
        if (payload.email !== EXPECTED_CONTACTS_PILOT_PAYLOAD.email) pilotPayloadValidationErrors.push("email mismatch");
        if (payload.company_temp_key !== EXPECTED_CONTACTS_PILOT_PAYLOAD.company_temp_key) {
          pilotPayloadValidationErrors.push("company_temp_key mismatch");
        }
        if (payload.company_resolution_policy !== EXPECTED_CONTACTS_PILOT_PAYLOAD.company_resolution_policy) {
          pilotPayloadValidationErrors.push("company_resolution_policy mismatch");
        }
        if (payload.company_id_policy !== EXPECTED_CONTACTS_PILOT_PAYLOAD.company_id_policy) {
          pilotPayloadValidationErrors.push("company_id_policy mismatch");
        }
        if (payload.write_contact_in_same_phase !== EXPECTED_CONTACTS_PILOT_PAYLOAD.write_contact_in_same_phase) {
          pilotPayloadValidationErrors.push("write_contact_in_same_phase mismatch");
        }
      }

      const companyPayload = pilotPayloadJson?.sanitizedCompanyPayload?.payload;
      if (!companyPayload || typeof companyPayload !== "object") {
        pilotPayloadValidationErrors.push("sanitizedCompanyPayload.payload missing");
      } else if (companyPayload.cnpj !== EXPECTED_CONTACTS_PILOT_PAYLOAD.company_lookup_cnpj) {
        pilotPayloadValidationErrors.push("company lookup cnpj mismatch");
      }

      const idempotencyPrimary = pilotPayloadJson?.idempotencyRules?.contacts?.primaryKey;
      if (!Array.isArray(idempotencyPrimary) || idempotencyPrimary.join(",") !== "tenant_id,company_id,email") {
        pilotPayloadValidationErrors.push("idempotency primary key must be tenant_id,company_id,email");
      }

      if (pilotPayloadValidationErrors.length > 0) {
        noGoReasons.push(`Pilot payload validation failed: ${pilotPayloadValidationErrors.join(", ")}`);
        pushValidation(validations, "pilot.payload.compatibility", "FAIL", "Pilot payload metadata incompatible.");
      } else {
        pushValidation(validations, "pilot.payload.compatibility", "PASS", "Pilot payload metadata validated.");
      }
    }

    try {
      const rows = runSupabaseDbQuery(`
        select column_name, data_type, is_nullable
        from information_schema.columns
        where table_schema='public'
          and table_name='contacts'
          and column_name in ('tenant_id','first_name','email','company_id')
      `);
      const byColumn = new Map(rows.map((r) => [r.column_name, r]));
      contactsTenantRequired = byColumn.get("tenant_id")?.is_nullable === "NO";
      contactsFirstNameRequired = byColumn.get("first_name")?.is_nullable === "NO";
      contactsEmailPresent = byColumn.has("email");
      contactsCompanyIdPresent = byColumn.has("company_id");
      contactsCompanyIdNullable = byColumn.get("company_id")?.is_nullable === "YES";
      if (contactsTenantRequired !== true) noGoReasons.push("contacts.tenant_id must be required.");
      if (contactsFirstNameRequired !== true) noGoReasons.push("contacts.first_name must be required.");
      if (contactsEmailPresent !== true) noGoReasons.push("contacts.email column must exist.");
      if (contactsCompanyIdPresent !== true) noGoReasons.push("contacts.company_id column must exist.");
      if (contactsCompanyIdNullable !== true) noGoReasons.push("contacts.company_id must be nullable.");
      pushValidation(validations, "pilot.contacts.columns_and_nullable", "PASS", "Contacts columns and nullable policies validated.");
    } catch {
      noGoReasons.push("Unable to validate contacts columns and nullable policies.");
      pushValidation(validations, "pilot.contacts.columns_and_nullable", "FAIL", "Failed contacts columns validation.");
    }

    try {
      const indexRows = runSupabaseDbQuery(`
        select indexname
        from pg_indexes
        where schemaname='public'
          and tablename='contacts'
          and indexname='idx_contacts_tenant_company_email_unique'
      `);
      contactsUniqueTenantCompanyEmailPresent = indexRows.some((r) => r.indexname === "idx_contacts_tenant_company_email_unique");
      if (!contactsUniqueTenantCompanyEmailPresent) noGoReasons.push("idx_contacts_tenant_company_email_unique is required.");
      pushValidation(validations, "pilot.contacts.unique_index", "PASS", "Contacts idempotency unique index validated.");
    } catch {
      noGoReasons.push("Unable to validate contacts idempotency unique index.");
      pushValidation(validations, "pilot.contacts.unique_index", "FAIL", "Failed contacts unique index validation.");
    }

    try {
      const fkRows = runSupabaseDbQuery(`
        select count(*)::bigint as fk_count
        from information_schema.table_constraints tc
        join information_schema.key_column_usage kcu
          on tc.constraint_name=kcu.constraint_name and tc.table_schema=kcu.table_schema
        join information_schema.constraint_column_usage ccu
          on tc.constraint_name=ccu.constraint_name and tc.table_schema=ccu.table_schema
        where tc.table_schema='public'
          and tc.table_name='contacts'
          and tc.constraint_type='FOREIGN KEY'
          and kcu.column_name='company_id'
          and ccu.table_name='companies'
          and ccu.column_name='id'
      `);
      contactsCompanyFkPresent = Number(fkRows[0]?.fk_count || 0) > 0;
      if (!contactsCompanyFkPresent) noGoReasons.push("contacts.company_id FK to companies.id is required.");
      pushValidation(validations, "pilot.contacts.company_fk", "PASS", "contacts.company_id FK validated.");
    } catch {
      noGoReasons.push("Unable to validate contacts.company_id FK.");
      pushValidation(validations, "pilot.contacts.company_fk", "FAIL", "Failed contacts.company_id FK validation.");
    }

    try {
      const tenantRows = runSupabaseDbQuery(
        `select exists(select 1 from public.tenants where id = '${escapeSqlLiteral(EXPECTED_CONTACTS_PILOT_PAYLOAD.tenant_id)}') as tenant_exists`,
      );
      contactsTenantExists = tenantRows[0]?.tenant_exists === true;
      if (contactsTenantExists !== true) noGoReasons.push("Pilot tenant does not exist.");
      pushValidation(validations, "pilot.contacts.tenant_exists", "PASS", "Pilot tenant existence validated.");
    } catch {
      noGoReasons.push("Unable to validate pilot tenant existence for contacts.");
      pushValidation(validations, "pilot.contacts.tenant_exists", "FAIL", "Failed pilot tenant existence validation.");
    }

    try {
      const countRows = runSupabaseDbQuery("select count(*)::bigint as total_rows from public.contacts");
      contactsCountCurrent = Number(countRows[0]?.total_rows ?? 0);
      pushValidation(validations, "pilot.contacts.current_count", "PASS", "Current contacts count collected.");
    } catch {
      noGoReasons.push("Unable to read current count from public.contacts.");
      pushValidation(validations, "pilot.contacts.current_count", "FAIL", "Failed to read contacts count.");
    }

    try {
      const companyRows = runSupabaseDbQuery("select count(*)::bigint as total_rows from public.companies");
      contactsCompaniesCountCurrent = Number(companyRows[0]?.total_rows ?? 0);
      pushValidation(validations, "pilot.contacts.companies_pre_count", "PASS", "Current companies count collected.");
    } catch {
      noGoReasons.push("Unable to read current count from public.companies.");
      pushValidation(validations, "pilot.contacts.companies_pre_count", "FAIL", "Failed to read companies count.");
    }

    try {
      const emailRows = runSupabaseDbQuery(
        `select count(*)::bigint as collision_count from public.contacts where email = '${escapeSqlLiteral(EXPECTED_CONTACTS_PILOT_PAYLOAD.email)}'`,
      );
      contactsEmailCollisionCount = Number(emailRows[0]?.collision_count ?? 0);
      pushValidation(validations, "pilot.contacts.email_collision", "PASS", "Contacts email collision check executed.");
    } catch {
      noGoReasons.push("Unable to validate email collision for contacts pilot payload.");
      pushValidation(validations, "pilot.contacts.email_collision", "FAIL", "Failed contacts email collision validation.");
    }

    try {
      const firstNameRows = runSupabaseDbQuery(
        `select count(*)::bigint as collision_count from public.contacts where first_name = '${escapeSqlLiteral(EXPECTED_CONTACTS_PILOT_PAYLOAD.first_name)}'`,
      );
      contactsFirstNameCollisionCount = Number(firstNameRows[0]?.collision_count ?? 0);
      pushValidation(validations, "pilot.contacts.first_name_collision", "PASS", "Contacts first_name check executed.");
    } catch {
      noGoReasons.push("Unable to validate first_name check for contacts pilot payload.");
      pushValidation(validations, "pilot.contacts.first_name_collision", "FAIL", "Failed contacts first_name check.");
    }

    try {
      const companyRows = runSupabaseDbQuery(`
        select id
        from public.companies
        where tenant_id='${escapeSqlLiteral(EXPECTED_CONTACTS_PILOT_PAYLOAD.tenant_id)}'
          and cnpj='${escapeSqlLiteral(EXPECTED_CONTACTS_PILOT_PAYLOAD.company_lookup_cnpj)}'
      `);
      contactsCompanyLookupCount = companyRows.length;
      contactsResolvedCompanyId = companyRows[0]?.id || null;
      if (contactsCompanyLookupCount !== 1) {
        noGoReasons.push("Company lookup cardinality must be exactly 1.");
      } else if (contactsResolvedCompanyId !== EXPECTED_CONTACTS_PILOT_PAYLOAD.resolved_company_id) {
        noGoReasons.push("Resolved company id mismatch.");
      }
      pushValidation(validations, "pilot.contacts.company_lookup_cardinality", "PASS", "Company lookup cardinality validated.");
    } catch {
      noGoReasons.push("Unable to resolve company lookup for contacts pilot payload.");
      pushValidation(validations, "pilot.contacts.company_lookup_cardinality", "FAIL", "Failed company lookup resolution.");
    }

    try {
      const regRows = runSupabaseDbQuery("select to_regclass('public.company_contacts') as regclass");
      contactsCompanyContactsRegclass = regRows[0]?.regclass ?? null;
      if (contactsCompanyContactsRegclass !== null) {
        noGoReasons.push("company_contacts must remain absent/reference-only for contacts pilot.");
      }
      pushValidation(validations, "pilot.contacts.company_contacts_reference_only", "PASS", "company_contacts reference-only validated.");
    } catch {
      noGoReasons.push("Unable to validate company_contacts reference-only status.");
      pushValidation(
        validations,
        "pilot.contacts.company_contacts_reference_only",
        "FAIL",
        "Failed company_contacts reference-only validation.",
      );
    }
  }

  if (selectedPilotEntity === "companies_contacts_wave") {
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
      if (pilotPayloadJson?.phase !== "22BK-R2") pilotPayloadValidationErrors.push("phase mismatch");
      if (pilotPayloadJson?.targetRef !== EXPECTED_TARGET_REF) pilotPayloadValidationErrors.push("targetRef mismatch");
      if (pilotPayloadJson?.targetName !== EXPECTED_TARGET_NAME) pilotPayloadValidationErrors.push("targetName mismatch");
      if (pilotPayloadJson?.batchId !== EXPECTED_BATCH_ID) pilotPayloadValidationErrors.push("batchId mismatch");
      if (String(pilotPayloadJson?.decision || "").toUpperCase() !== "GO") pilotPayloadValidationErrors.push("payload decision must be GO");

      const wave = pilotPayloadJson?.selectedWave;
      const companies = Array.isArray(wave?.companiesSelected) ? wave.companiesSelected : [];
      const contacts = Array.isArray(wave?.contactsSelected) ? wave.contactsSelected : [];
      const pairs = Array.isArray(wave?.pairs) ? wave.pairs : [];
      const expectedCompanyKeys = [
        "TMP-22F-R2-COMPANY-02",
        "TMP-22F-R2-COMPANY-03",
        "TMP-22F-R2-COMPANY-04",
        "TMP-22F-R2-COMPANY-05",
      ];
      const expectedContactKeys = [
        "TMP-22F-R2-CONTACT-02",
        "TMP-22F-R2-CONTACT-03",
        "TMP-22F-R2-CONTACT-04",
        "TMP-22F-R2-CONTACT-05",
      ];
      const companyMap = new Map(companies.map((item) => [item.temp_key, item]));
      const contactMap = new Map(contacts.map((item) => [item.temp_key, item]));

      if (Number(wave?.limit) !== 4) pilotPayloadValidationErrors.push("wave limit must be 4");
      if (Number(pilotPayloadJson?.waveLimitDecision) !== 4) pilotPayloadValidationErrors.push("waveLimitDecision must be 4");
      if (companies.length !== 4 || contacts.length !== 4 || pairs.length !== 4) {
        pilotPayloadValidationErrors.push("frozen wave must contain exactly 4 pairs");
      }
      if (pilotPayloadJson?.humanGateAuthorizationForNextPhase !== EXPECTED_COMPANIES_CONTACTS_WAVE_PILOT_AUTHORIZATION) {
        pilotPayloadValidationErrors.push("wave authorization mismatch");
      }

      for (const key of expectedCompanyKeys) {
        const row = companyMap.get(key);
        const suffix2 = key.slice(-2);
        const suffix4 = key.slice(-2).padStart(4, "0");
        if (!row) {
          pilotPayloadValidationErrors.push(`missing company ${key}`);
          continue;
        }
        if (row.tenant_id !== "00000000-0000-0000-0000-000000000001") pilotPayloadValidationErrors.push(`${key} tenant mismatch`);
        if (row.name !== `TMP Company ${suffix2}`) pilotPayloadValidationErrors.push(`${key} name mismatch`);
        if (row.expected_persisted_name !== `TMP COMPANY ${suffix2}`) pilotPayloadValidationErrors.push(`${key} expected_persisted_name mismatch`);
        if (row.cnpj !== `TMP-DOC-COMP-${suffix4}`) pilotPayloadValidationErrors.push(`${key} cnpj mismatch`);
        if (row.owner_write_policy !== "reference_only_not_written") pilotPayloadValidationErrors.push(`${key} owner_write_policy mismatch`);
        if (row.sales_rep_id_policy !== "omit_or_null") pilotPayloadValidationErrors.push(`${key} sales_rep_id_policy mismatch`);
        if (row.legal_entity_id_policy !== "omit_or_null") pilotPayloadValidationErrors.push(`${key} legal_entity_id_policy mismatch`);
        if (row.created_by_policy !== "omit_or_null") pilotPayloadValidationErrors.push(`${key} created_by_policy mismatch`);
      }

      for (const key of expectedContactKeys) {
        const row = contactMap.get(key);
        const suffix2 = key.slice(-2);
        if (!row) {
          pilotPayloadValidationErrors.push(`missing contact ${key}`);
          continue;
        }
        if (row.tenant_id !== "00000000-0000-0000-0000-000000000001") pilotPayloadValidationErrors.push(`${key} tenant mismatch`);
        if (row.first_name !== `TMP Contact ${suffix2}`) pilotPayloadValidationErrors.push(`${key} first_name mismatch`);
        if (row.expected_persisted_first_name !== `TMP CONTACT ${suffix2}`) {
          pilotPayloadValidationErrors.push(`${key} expected_persisted_first_name mismatch`);
        }
        if (row.email !== `tmp.contact${suffix2}@qualyvac.local`) pilotPayloadValidationErrors.push(`${key} email mismatch`);
        if (row.company_temp_key !== `TMP-22F-R2-COMPANY-${suffix2}`) pilotPayloadValidationErrors.push(`${key} company_temp_key mismatch`);
        if (row.company_resolution_policy !== "lookup_after_company_insert") {
          pilotPayloadValidationErrors.push(`${key} company_resolution_policy mismatch`);
        }
        if (row.write_after_company !== true) pilotPayloadValidationErrors.push(`${key} write_after_company must be true`);
      }

      const expectedPairSet = new Set(expectedCompanyKeys.map((companyKey, idx) => `${companyKey}|${expectedContactKeys[idx]}`));
      for (const pair of pairs) {
        const pairKey = `${pair?.company_temp_key || ""}|${pair?.contact_temp_key || ""}`;
        if (!expectedPairSet.has(pairKey)) {
          pilotPayloadValidationErrors.push(`invalid pair ${pairKey}`);
        }
      }

      const companiesPrimary = pilotPayloadJson?.idempotencyKeys?.companies;
      const contactsPrimary = pilotPayloadJson?.idempotencyKeys?.contacts;
      if (!Array.isArray(companiesPrimary) || companiesPrimary.join(",") !== "tenant_id,cnpj") {
        pilotPayloadValidationErrors.push("companies idempotency key mismatch");
      }
      if (!Array.isArray(contactsPrimary) || contactsPrimary.join(",") !== "tenant_id,company_id,email") {
        pilotPayloadValidationErrors.push("contacts idempotency key mismatch");
      }

      if (pilotPayloadValidationErrors.length > 0) {
        noGoReasons.push(`Pilot payload validation failed: ${pilotPayloadValidationErrors.join(", ")}`);
        pushValidation(validations, "pilot.payload.compatibility", "FAIL", "Pilot wave payload metadata incompatible.");
      } else {
        pushValidation(validations, "pilot.payload.compatibility", "PASS", "Pilot wave payload metadata validated.");
      }
    }

    try {
      const rows = runSupabaseDbQuery(`
        select column_name, data_type, is_nullable
        from information_schema.columns
        where table_schema='public'
          and table_name='companies'
          and column_name in ('tenant_id','name','cnpj','owner_id','sales_rep_id','legal_entity_id','created_by')
      `);
      const byColumn = new Map(rows.map((r) => [r.column_name, r]));
      companiesTenantRequired = byColumn.get("tenant_id")?.is_nullable === "NO";
      companiesNameRequired = byColumn.get("name")?.is_nullable === "NO";
      companiesCnpjIsText = byColumn.get("cnpj")?.data_type === "text";
      companiesOwnerNullable = byColumn.get("owner_id")?.is_nullable === "YES";
      companiesSalesRepNullable = byColumn.get("sales_rep_id")?.is_nullable === "YES";
      companiesLegalEntityNullable = byColumn.get("legal_entity_id")?.is_nullable === "YES";
      companiesCreatedByNullable = byColumn.get("created_by")?.is_nullable === "YES";
      pushValidation(validations, "pilot.wave.companies.columns_and_nullable", "PASS", "Wave companies columns validated.");
    } catch {
      noGoReasons.push("Unable to validate companies columns for wave payload.");
      pushValidation(validations, "pilot.wave.companies.columns_and_nullable", "FAIL", "Failed wave companies column validation.");
    }

    try {
      const rows = runSupabaseDbQuery(`
        select column_name, data_type, is_nullable
        from information_schema.columns
        where table_schema='public'
          and table_name='contacts'
          and column_name in ('tenant_id','first_name','email','company_id')
      `);
      const byColumn = new Map(rows.map((r) => [r.column_name, r]));
      contactsTenantRequired = byColumn.get("tenant_id")?.is_nullable === "NO";
      contactsFirstNameRequired = byColumn.get("first_name")?.is_nullable === "NO";
      contactsEmailPresent = byColumn.has("email");
      contactsCompanyIdPresent = byColumn.has("company_id");
      contactsCompanyIdNullable = byColumn.get("company_id")?.is_nullable === "YES";
      pushValidation(validations, "pilot.wave.contacts.columns_and_nullable", "PASS", "Wave contacts columns validated.");
    } catch {
      noGoReasons.push("Unable to validate contacts columns for wave payload.");
      pushValidation(validations, "pilot.wave.contacts.columns_and_nullable", "FAIL", "Failed wave contacts column validation.");
    }

    try {
      const companyIndexRows = runSupabaseDbQuery(`
        select indexname
        from pg_indexes
        where schemaname='public'
          and tablename='companies'
          and indexname in ('idx_companies_tenant_cnpj','idx_companies_cnpj_unique')
      `);
      companiesUniqueTenantCnpjPresent = companyIndexRows.some((r) => r.indexname === "idx_companies_tenant_cnpj");
      companiesUniqueCnpjPresent = companyIndexRows.some((r) => r.indexname === "idx_companies_cnpj_unique");
      const contactIndexRows = runSupabaseDbQuery(`
        select indexname
        from pg_indexes
        where schemaname='public'
          and tablename='contacts'
          and indexname='idx_contacts_tenant_company_email_unique'
      `);
      contactsUniqueTenantCompanyEmailPresent = contactIndexRows.some(
        (r) => r.indexname === "idx_contacts_tenant_company_email_unique",
      );
      pushValidation(validations, "pilot.wave.idempotency_indexes", "PASS", "Wave idempotency indexes validated.");
    } catch {
      noGoReasons.push("Unable to validate wave idempotency indexes.");
      pushValidation(validations, "pilot.wave.idempotency_indexes", "FAIL", "Failed wave idempotency index validation.");
    }

    try {
      const fkRows = runSupabaseDbQuery(`
        select count(*)::bigint as fk_count
        from information_schema.table_constraints tc
        join information_schema.key_column_usage kcu
          on tc.constraint_name=kcu.constraint_name and tc.table_schema=kcu.table_schema
        join information_schema.constraint_column_usage ccu
          on tc.constraint_name=ccu.constraint_name and tc.table_schema=ccu.table_schema
        where tc.table_schema='public'
          and tc.table_name='contacts'
          and tc.constraint_type='FOREIGN KEY'
          and kcu.column_name='company_id'
          and ccu.table_name='companies'
          and ccu.column_name='id'
      `);
      contactsCompanyFkPresent = Number(fkRows[0]?.fk_count || 0) > 0;
      pushValidation(validations, "pilot.wave.contacts_company_fk", "PASS", "Wave contacts FK validated.");
    } catch {
      noGoReasons.push("Unable to validate contacts.company_id FK for wave.");
      pushValidation(validations, "pilot.wave.contacts_company_fk", "FAIL", "Failed wave contacts FK validation.");
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
      : activePilotEntity === "product_families"
        ? {
            entity: "product_families",
            action: "insert_pilot_planned",
            value: EXPECTED_PRODUCT_FAMILIES_PILOT_PAYLOAD.value,
            label: EXPECTED_PRODUCT_FAMILIES_PILOT_PAYLOAD.label,
            tenant_id: null,
            created_by: EXPECTED_PRODUCT_FAMILIES_PILOT_PAYLOAD.created_by,
            defaultsExpected: {
              sort_order: 0,
              is_active: true,
              created_at: "now()",
            },
            productGroupLink: {
              technicallySupported: false,
              reason: "product_families has no product_group_id column/FK in current schema",
            },
            productSubgroupLink: {
              technicallySupported: false,
              reason: "product_families has no product_subgroup_id column/FK in current schema",
            },
            executableIn22AZ: true,
            realExecutionBlocked: true,
            reason: "Execution remains blocked unless beforeDecision is GO in 22AZ-R2 real pilot path.",
          }
      : activePilotEntity === "product_classes"
        ? {
            entity: "product_classes",
            action: "insert_pilot_planned",
            value: EXPECTED_PRODUCT_CLASSES_PILOT_PAYLOAD.value,
            label: EXPECTED_PRODUCT_CLASSES_PILOT_PAYLOAD.label,
            tenant_id: null,
            created_by: EXPECTED_PRODUCT_CLASSES_PILOT_PAYLOAD.created_by,
            defaultsExpected: {
              sort_order: 0,
              is_active: true,
              created_at: "now()",
            },
            productGroupLink: {
              technicallySupported: false,
              reason: "product_classes has no product_group_id column/FK in current schema",
            },
            productSubgroupLink: {
              technicallySupported: false,
              reason: "product_classes has no product_subgroup_id column/FK in current schema",
            },
            productFamilyLink: {
              technicallySupported: false,
              reason: "product_classes has no product_family_id column/FK in current schema",
            },
            executableIn22BB: true,
            realExecutionBlocked: true,
            reason: "Execution remains blocked unless beforeDecision is GO in 22BB-R2 real pilot path.",
          }
      : activePilotEntity === "companies"
        ? {
            entity: "companies",
            action: "insert_pilot_planned",
            tenant_id: EXPECTED_COMPANIES_PILOT_PAYLOAD.tenant_id,
            name: EXPECTED_COMPANIES_PILOT_PAYLOAD.name,
            cnpj: EXPECTED_COMPANIES_PILOT_PAYLOAD.cnpj,
            omittedFields: ["owner_id", "sales_rep_id", "legal_entity_id", "created_by"],
            idempotencyKey: ["tenant_id", "cnpj"],
            executableIn22BG: true,
            realExecutionBlocked: true,
            reason: "Execution remains blocked unless beforeDecision is GO in 22BG-R2 real pilot path.",
          }
      : activePilotEntity === "contacts"
        ? {
            entity: "contacts",
            action: "insert_pilot_planned",
            tenant_id: EXPECTED_CONTACTS_PILOT_PAYLOAD.tenant_id,
            first_name: EXPECTED_CONTACTS_PILOT_PAYLOAD.first_name,
            email: EXPECTED_CONTACTS_PILOT_PAYLOAD.email,
            company_lookup: {
              tenant_id: EXPECTED_CONTACTS_PILOT_PAYLOAD.tenant_id,
              cnpj: EXPECTED_CONTACTS_PILOT_PAYLOAD.company_lookup_cnpj,
            },
            idempotencyKey: ["tenant_id", "company_id", "email"],
            executableIn22BH: true,
            realExecutionBlocked: true,
            reason: "Execution remains blocked unless beforeDecision is GO in 22BH-R2 real pilot path.",
          }
      : activePilotEntity === "companies_contacts_wave"
        ? {
            entity: "companies_contacts_wave",
            action: "insert_wave_planned",
            waveLimit: 4,
            entitiesTouched: ["companies", "contacts"],
            omittedFields: ["owner_id", "sales_rep_id", "legal_entity_id", "created_by", "company_contacts"],
            idempotencyKeys: {
              companies: ["tenant_id", "cnpj"],
              contacts: ["tenant_id", "company_id", "email"],
            },
            executableIn22BL: true,
            realExecutionBlocked: true,
            reason: "Execution remains blocked unless beforeDecision is GO in 22BL-R2 real wave path.",
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
    pilotNoGoReasons.push(
      "Pilot entity must be legal_entities, product_types, product_groups, product_subgroups, product_families, product_classes, companies, contacts or companies_contacts_wave.",
    );
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
        selectedPilotEntity === "product_subgroups" ||
        selectedPilotEntity === "product_families" ||
        selectedPilotEntity === "product_classes" ||
        selectedPilotEntity === "companies" ||
        selectedPilotEntity === "companies_contacts_wave" ||
        selectedPilotEntity === "contacts") &&
      (!args.pilotPayload || !pilotPayloadParsed)
    ) {
      pilotNoGoReasons.push(`Pilot mode armed for ${selectedPilotEntity} without validated --pilot-payload.`);
    }
  }

  if (
    activePilotEntity !== "companies_contacts_wave" &&
    !writePlanEligibleEntities.includes(activePilotEntity)
  ) {
    pilotNoGoReasons.push(`${activePilotEntity} is missing from write plan eligible entities.`);
  }
  if (
    activePilotEntity !== "companies_contacts_wave" &&
    !executableEntitiesRoundOne22Q.includes(activePilotEntity)
  ) {
    pilotNoGoReasons.push(`${activePilotEntity} is missing from first round executable entities.`);
  }
  if (activePilotEntity === "companies_contacts_wave") {
    if (!writePlanEligibleEntities.includes("companies") || !writePlanEligibleEntities.includes("contacts")) {
      pilotNoGoReasons.push("companies_contacts_wave requires companies and contacts in write plan eligible entities.");
    }
    if (!executableEntitiesRoundOne22Q.includes("companies") || !executableEntitiesRoundOne22Q.includes("contacts")) {
      pilotNoGoReasons.push("companies_contacts_wave requires companies and contacts in first round executable entities.");
    }
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
  if (
    activePilotEntity !== "companies_contacts_wave" &&
    writePlanOrder.length > 0 &&
    !writePlanOrder.includes(activePilotEntity)
  ) {
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
  if (selectedPilotEntity === "product_families" && pilotPayloadValidationErrors.length > 0) {
    pilotNoGoReasons.push("product_families pilot payload compatibility is invalid.");
  }
  if (selectedPilotEntity === "product_families" && productFamiliesUniqueValuePresent !== true) {
    pilotNoGoReasons.push("product_families requires UNIQUE(value) for pilot.");
  }
  if (selectedPilotEntity === "product_classes" && pilotPayloadValidationErrors.length > 0) {
    pilotNoGoReasons.push("product_classes pilot payload compatibility is invalid.");
  }
  if (selectedPilotEntity === "product_classes" && productClassesUniqueValuePresent !== true) {
    pilotNoGoReasons.push("product_classes requires UNIQUE(value) for pilot.");
  }
  if (selectedPilotEntity === "companies" && pilotPayloadValidationErrors.length > 0) {
    pilotNoGoReasons.push("companies pilot payload compatibility is invalid.");
  }
  if (selectedPilotEntity === "companies" && companiesUniqueTenantCnpjPresent !== true) {
    pilotNoGoReasons.push("companies requires UNIQUE(tenant_id, cnpj) for pilot.");
  }
  if (selectedPilotEntity === "contacts" && pilotPayloadValidationErrors.length > 0) {
    pilotNoGoReasons.push("contacts pilot payload compatibility is invalid.");
  }
  if (selectedPilotEntity === "contacts" && contactsUniqueTenantCompanyEmailPresent !== true) {
    pilotNoGoReasons.push("contacts requires idx_contacts_tenant_company_email_unique for pilot.");
  }
  if (selectedPilotEntity === "companies_contacts_wave" && pilotPayloadValidationErrors.length > 0) {
    pilotNoGoReasons.push("companies_contacts_wave payload compatibility is invalid.");
  }
  if (selectedPilotEntity === "companies_contacts_wave" && companiesUniqueTenantCnpjPresent !== true) {
    pilotNoGoReasons.push("companies_contacts_wave requires idx_companies_tenant_cnpj.");
  }
  if (selectedPilotEntity === "companies_contacts_wave" && contactsUniqueTenantCompanyEmailPresent !== true) {
    pilotNoGoReasons.push("companies_contacts_wave requires idx_contacts_tenant_company_email_unique.");
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
  const phase22AZStopAfterPilotMessage =
    "ESCRITA PILOTO CONCLUÍDA SOMENTE EM product_families. EXECUÇÃO AMPLIADA BLOQUEADA.";
  const phase22BBStopAfterPilotMessage =
    "ESCRITA PILOTO CONCLUÍDA SOMENTE EM product_classes. EXECUÇÃO AMPLIADA BLOQUEADA.";
  const phase22BGStopAfterPilotMessage =
    "ESCRITA PILOTO CONCLUÍDA SOMENTE EM companies. EXECUÇÃO AMPLIADA BLOQUEADA.";
  const phase22BHStopAfterPilotMessage =
    "ESCRITA PILOTO CONCLUÍDA SOMENTE EM contacts. EXECUÇÃO AMPLIADA BLOQUEADA.";
  const phase22BLStopAfterPilotMessage =
    "ESCRITA CONTROLADA CONCLUÍDA SOMENTE EM companies E contacts, LIMITADA À ONDA 22BK-R2. EXECUÇÃO AMPLIADA BLOQUEADA.";
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
    productFamiliesUniqueValuePresent,
    productFamiliesCountCurrent,
    productFamiliesValueCollisionCount,
    productFamiliesLabelCollisionCount,
    productFamiliesTenantNullable,
    productFamiliesCreatedByColumnPresent,
    productFamiliesSortOrderDefault,
    productFamiliesIsActiveDefault,
    productFamiliesCreatedAtDefault,
    productFamiliesHasProductGroupIdColumn,
    productFamiliesHasProductSubgroupIdColumn,
    productFamiliesHasFkToProductGroups,
    productFamiliesHasFkToProductSubgroups,
    productClassesUniqueValuePresent,
    productClassesCountCurrent,
    productClassesValueCollisionCount,
    productClassesLabelCollisionCount,
    productClassesTenantNullable,
    productClassesCreatedByColumnPresent,
    productClassesSortOrderDefault,
    productClassesIsActiveDefault,
    productClassesCreatedAtDefault,
    productClassesHasProductGroupIdColumn,
    productClassesHasProductSubgroupIdColumn,
    productClassesHasProductFamilyIdColumn,
    productClassesHasFkToProductGroups,
    productClassesHasFkToProductSubgroups,
    productClassesHasFkToProductFamilies,
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
      : selectedPilotEntity === "product_families"
        ? path.resolve("artifacts/migration/phase-22az-r2-pilot-product-families-write")
      : selectedPilotEntity === "product_classes"
        ? path.resolve("artifacts/migration/phase-22bb-r2-pilot-product-classes-write")
      : selectedPilotEntity === "contacts"
        ? path.resolve("artifacts/migration/phase-22bh-r2-pilot-contacts-write")
      : selectedPilotEntity === "companies_contacts_wave"
        ? path.resolve("artifacts/migration/phase-22bl-r2-companies-contacts-wave-write")
      : path.resolve("artifacts/migration/phase-22s-r2-pilot-legal-entities");
  fs.mkdirSync(pilotEvidenceDir, { recursive: true });
  const pilotEvidencePath =
    selectedPilotEntity === "product_types"
      ? path.join(pilotEvidenceDir, `pilot-product-types-${nowStamp()}.json`)
      : selectedPilotEntity === "product_groups"
        ? path.join(pilotEvidenceDir, `pilot-product-groups-${nowStamp()}.json`)
      : selectedPilotEntity === "product_subgroups"
        ? path.join(pilotEvidenceDir, `pilot-product-subgroups-${nowStamp()}.json`)
      : selectedPilotEntity === "product_families"
        ? path.join(pilotEvidenceDir, `pilot-product-families-${nowStamp()}.json`)
      : selectedPilotEntity === "product_classes"
        ? path.join(pilotEvidenceDir, `pilot-product-classes-${nowStamp()}.json`)
      : selectedPilotEntity === "contacts"
        ? path.join(pilotEvidenceDir, `pilot-contacts-${nowStamp()}.json`)
      : selectedPilotEntity === "companies_contacts_wave"
        ? path.join(pilotEvidenceDir, `pilot-companies-contacts-wave-${nowStamp()}.json`)
      : path.join(pilotEvidenceDir, `pilot-legal-entities-${nowStamp()}.json`);
  const pilotEvidence = {
    phase:
      selectedPilotEntity === "product_types"
        ? "22AE-R2"
        : selectedPilotEntity === "product_groups"
          ? "22AM-R2"
          : selectedPilotEntity === "product_subgroups"
            ? "22AT-R2"
            : selectedPilotEntity === "product_families"
              ? "22AZ-R2"
            : selectedPilotEntity === "product_classes"
              ? "22BB-R2"
            : selectedPilotEntity === "contacts"
              ? "22BH-R2"
            : selectedPilotEntity === "companies_contacts_wave"
              ? "22BL-R2"
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
      selectedPilotEntity === "product_subgroups" ||
      selectedPilotEntity === "product_families" ||
      selectedPilotEntity === "product_classes"
      || selectedPilotEntity === "companies"
      || selectedPilotEntity === "companies_contacts_wave"
      || selectedPilotEntity === "contacts"
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
    productFamiliesCurrentCount: selectedPilotEntity === "product_families" ? productFamiliesCountCurrent : null,
    productFamiliesValueCollisionCount:
      selectedPilotEntity === "product_families" ? productFamiliesValueCollisionCount : null,
    productFamiliesLabelCollisionCount:
      selectedPilotEntity === "product_families" ? productFamiliesLabelCollisionCount : null,
    productFamiliesUniqueValueValidated:
      selectedPilotEntity === "product_families" ? productFamiliesUniqueValuePresent : null,
    productFamiliesTenantNullable:
      selectedPilotEntity === "product_families" ? productFamiliesTenantNullable : null,
    productFamiliesCreatedByColumnPresent:
      selectedPilotEntity === "product_families" ? productFamiliesCreatedByColumnPresent : null,
    productFamiliesSortOrderDefault:
      selectedPilotEntity === "product_families" ? productFamiliesSortOrderDefault : null,
    productFamiliesIsActiveDefault:
      selectedPilotEntity === "product_families" ? productFamiliesIsActiveDefault : null,
    productFamiliesCreatedAtDefault:
      selectedPilotEntity === "product_families" ? productFamiliesCreatedAtDefault : null,
    productFamiliesHasProductGroupIdColumn:
      selectedPilotEntity === "product_families" ? productFamiliesHasProductGroupIdColumn : null,
    productFamiliesHasProductSubgroupIdColumn:
      selectedPilotEntity === "product_families" ? productFamiliesHasProductSubgroupIdColumn : null,
    productFamiliesHasFkToProductGroups:
      selectedPilotEntity === "product_families" ? productFamiliesHasFkToProductGroups : null,
    productFamiliesHasFkToProductSubgroups:
      selectedPilotEntity === "product_families" ? productFamiliesHasFkToProductSubgroups : null,
    productClassesCurrentCount: selectedPilotEntity === "product_classes" ? productClassesCountCurrent : null,
    productClassesValueCollisionCount:
      selectedPilotEntity === "product_classes" ? productClassesValueCollisionCount : null,
    productClassesLabelCollisionCount:
      selectedPilotEntity === "product_classes" ? productClassesLabelCollisionCount : null,
    productClassesUniqueValueValidated:
      selectedPilotEntity === "product_classes" ? productClassesUniqueValuePresent : null,
    productClassesTenantNullable:
      selectedPilotEntity === "product_classes" ? productClassesTenantNullable : null,
    productClassesCreatedByColumnPresent:
      selectedPilotEntity === "product_classes" ? productClassesCreatedByColumnPresent : null,
    productClassesSortOrderDefault:
      selectedPilotEntity === "product_classes" ? productClassesSortOrderDefault : null,
    productClassesIsActiveDefault:
      selectedPilotEntity === "product_classes" ? productClassesIsActiveDefault : null,
    productClassesCreatedAtDefault:
      selectedPilotEntity === "product_classes" ? productClassesCreatedAtDefault : null,
    productClassesHasProductGroupIdColumn:
      selectedPilotEntity === "product_classes" ? productClassesHasProductGroupIdColumn : null,
    productClassesHasProductSubgroupIdColumn:
      selectedPilotEntity === "product_classes" ? productClassesHasProductSubgroupIdColumn : null,
    productClassesHasProductFamilyIdColumn:
      selectedPilotEntity === "product_classes" ? productClassesHasProductFamilyIdColumn : null,
    productClassesHasFkToProductGroups:
      selectedPilotEntity === "product_classes" ? productClassesHasFkToProductGroups : null,
    productClassesHasFkToProductSubgroups:
      selectedPilotEntity === "product_classes" ? productClassesHasFkToProductSubgroups : null,
    productClassesHasFkToProductFamilies:
      selectedPilotEntity === "product_classes" ? productClassesHasFkToProductFamilies : null,
    companiesCurrentCount: selectedPilotEntity === "companies" ? companiesCountCurrent : null,
    companiesTenantRequired: selectedPilotEntity === "companies" ? companiesTenantRequired : null,
    companiesNameRequired: selectedPilotEntity === "companies" ? companiesNameRequired : null,
    companiesCnpjIsText: selectedPilotEntity === "companies" ? companiesCnpjIsText : null,
    companiesUniqueTenantCnpjPresent: selectedPilotEntity === "companies" ? companiesUniqueTenantCnpjPresent : null,
    companiesUniqueCnpjPresent: selectedPilotEntity === "companies" ? companiesUniqueCnpjPresent : null,
    companiesTenantExists: selectedPilotEntity === "companies" ? companiesTenantExists : null,
    companiesNameCollisionCount: selectedPilotEntity === "companies" ? companiesNameCollisionCount : null,
    companiesCnpjCollisionCount: selectedPilotEntity === "companies" ? companiesCnpjCollisionCount : null,
    companiesOwnerNullable: selectedPilotEntity === "companies" ? companiesOwnerNullable : null,
    companiesSalesRepNullable: selectedPilotEntity === "companies" ? companiesSalesRepNullable : null,
    companiesLegalEntityNullable: selectedPilotEntity === "companies" ? companiesLegalEntityNullable : null,
    companiesCreatedByNullable: selectedPilotEntity === "companies" ? companiesCreatedByNullable : null,
    companiesCompanyContactsRegclass: selectedPilotEntity === "companies" ? companiesCompanyContactsRegclass : null,
    companiesContactsCountCurrent: selectedPilotEntity === "companies" ? companiesContactsCountCurrent : null,
    contactsCurrentCount: selectedPilotEntity === "contacts" ? contactsCountCurrent : null,
    contactsTenantRequired: selectedPilotEntity === "contacts" ? contactsTenantRequired : null,
    contactsFirstNameRequired: selectedPilotEntity === "contacts" ? contactsFirstNameRequired : null,
    contactsEmailPresent: selectedPilotEntity === "contacts" ? contactsEmailPresent : null,
    contactsCompanyIdPresent: selectedPilotEntity === "contacts" ? contactsCompanyIdPresent : null,
    contactsCompanyIdNullable: selectedPilotEntity === "contacts" ? contactsCompanyIdNullable : null,
    contactsUniqueTenantCompanyEmailPresent: selectedPilotEntity === "contacts" ? contactsUniqueTenantCompanyEmailPresent : null,
    contactsTenantExists: selectedPilotEntity === "contacts" ? contactsTenantExists : null,
    contactsEmailCollisionCount: selectedPilotEntity === "contacts" ? contactsEmailCollisionCount : null,
    contactsFirstNameCollisionCount: selectedPilotEntity === "contacts" ? contactsFirstNameCollisionCount : null,
    contactsCompanyFkPresent: selectedPilotEntity === "contacts" ? contactsCompanyFkPresent : null,
    contactsCompanyLookupCount: selectedPilotEntity === "contacts" ? contactsCompanyLookupCount : null,
    contactsResolvedCompanyId: selectedPilotEntity === "contacts" ? contactsResolvedCompanyId : null,
    contactsCompanyContactsRegclass: selectedPilotEntity === "contacts" ? contactsCompanyContactsRegclass : null,
    contactsCompaniesCountCurrent: selectedPilotEntity === "contacts" ? contactsCompaniesCountCurrent : null,
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
        selectedPilotEntity === "product_subgroups" ||
        selectedPilotEntity === "product_families" ||
        selectedPilotEntity === "product_classes" ||
        selectedPilotEntity === "companies" ||
        selectedPilotEntity === "contacts",
      productTypesWillNotBeTouchedAgain:
        selectedPilotEntity === "product_groups" ||
        selectedPilotEntity === "product_subgroups" ||
        selectedPilotEntity === "product_families" ||
        selectedPilotEntity === "product_classes" ||
        selectedPilotEntity === "companies" ||
        selectedPilotEntity === "contacts",
      productGroupsWillNotBeTouchedAgain:
        selectedPilotEntity === "product_subgroups" ||
        selectedPilotEntity === "product_families" ||
        selectedPilotEntity === "product_classes" ||
        selectedPilotEntity === "companies" ||
        selectedPilotEntity === "contacts",
      productSubgroupsWillNotBeTouchedAgain:
        selectedPilotEntity === "product_families" ||
        selectedPilotEntity === "product_classes" ||
        selectedPilotEntity === "companies" ||
        selectedPilotEntity === "contacts",
      productFamiliesWillNotBeTouchedAgain:
        selectedPilotEntity === "product_classes" || selectedPilotEntity === "companies" || selectedPilotEntity === "contacts",
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
      selectedPilotEntity === "product_groups" ||
      selectedPilotEntity === "product_subgroups" ||
      selectedPilotEntity === "product_families" ||
      selectedPilotEntity === "product_classes" ||
        selectedPilotEntity === "companies" ||
        selectedPilotEntity === "contacts"
        ? Boolean(args.executePilotWrite && args.write)
        : false,
    finalHardStopMessage:
      selectedPilotEntity === "product_types"
        ? phase22AFStopAfterPilotMessage
        : selectedPilotEntity === "product_groups"
          ? phase22AMStopAfterPilotMessage
        : selectedPilotEntity === "product_subgroups"
          ? phase22ATStopAfterPilotMessage
        : selectedPilotEntity === "product_families"
          ? phase22AZStopAfterPilotMessage
        : selectedPilotEntity === "product_classes"
          ? phase22BBStopAfterPilotMessage
        : selectedPilotEntity === "companies"
          ? phase22BGStopAfterPilotMessage
        : selectedPilotEntity === "contacts"
          ? phase22BHStopAfterPilotMessage
        : selectedPilotEntity === "companies_contacts_wave"
          ? phase22BLStopAfterPilotMessage
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
  const phase22AZDir = path.resolve("artifacts/migration/phase-22az-r2-pilot-product-families-write");
  fs.mkdirSync(phase22AZDir, { recursive: true });
  const phase22BBDir = path.resolve("artifacts/migration/phase-22bb-r2-pilot-product-classes-write");
  fs.mkdirSync(phase22BBDir, { recursive: true });
  const phase22BGDir = path.resolve("artifacts/migration/phase-22bg-r2-pilot-companies-write");
  fs.mkdirSync(phase22BGDir, { recursive: true });
  const phase22BHDir = path.resolve("artifacts/migration/phase-22bh-r2-pilot-contacts-write");
  fs.mkdirSync(phase22BHDir, { recursive: true });
  const phase22BLDir = path.resolve("artifacts/migration/phase-22bl-r2-companies-contacts-wave-write");
  fs.mkdirSync(phase22BLDir, { recursive: true });
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
  const productFamiliesPilotMode = selectedPilotEntity === "product_families";
  const productClassesPilotMode = selectedPilotEntity === "product_classes";
  const companiesPilotMode = selectedPilotEntity === "companies";
  const contactsPilotMode = selectedPilotEntity === "contacts";
  const companiesContactsWavePilotMode = selectedPilotEntity === "companies_contacts_wave";

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
    if (pilotDecisionFinal === "NO-GO") beforeNoGoReasons.push("pilot_validation_decision is NO-GO.");
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
    if (pilotDecisionFinal === "NO-GO") beforeNoGoReasons.push("pilot_validation_decision is NO-GO.");
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
    if (pilotDecisionFinal === "NO-GO") beforeNoGoReasons.push("pilot_validation_decision is NO-GO.");
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
  } else if (productFamiliesPilotMode) {
    pilotWriteBeforePath = path.join(phase22AZDir, `before-${nowStamp()}.json`);
    pilotWriteAfterPath = path.join(phase22AZDir, `after-${nowStamp()}.json`);
    const beforeNoGoReasons = [];
    const beforePartialReasons = [];

    const generalAuthorizationValid = args.authorization === EXPECTED_AUTHORIZATION;
    const pilotAuthorizationValid = args.pilotAuthorization === EXPECTED_PRODUCT_FAMILIES_PILOT_AUTHORIZATION;
    const payloadValidated = pilotPayloadParsed && pilotPayloadValidationErrors.length === 0;
    const uniqueValueValidated = productFamiliesUniqueValuePresent === true;
    const candidateValue = EXPECTED_PRODUCT_FAMILIES_PILOT_PAYLOAD.value;
    const candidateLabel = EXPECTED_PRODUCT_FAMILIES_PILOT_PAYLOAD.label;

    let countBefore = null;
    let existingByValue = [];
    let labelCountBefore = null;
    let lookupByLabel = [];
    try {
      const beforeRows = runSupabaseDbQuery("select count(*)::bigint as total_rows from public.product_families");
      countBefore = Number(beforeRows[0]?.total_rows || 0);
    } catch {
      beforeNoGoReasons.push("Unable to read product_families count before write.");
    }
    try {
      existingByValue = runSupabaseDbQuery(
        `select id, value, label, tenant_id, sort_order, is_active, created_at::text as created_at from public.product_families where value = '${escapeSqlLiteral(candidateValue)}'`,
      );
    } catch {
      beforeNoGoReasons.push("Unable to lookup product_families by value before write.");
    }
    try {
      const labelRows = runSupabaseDbQuery(
        `select count(*)::bigint as label_count from public.product_families where label = '${escapeSqlLiteral(candidateLabel)}'`,
      );
      labelCountBefore = Number(labelRows[0]?.label_count || 0);
      lookupByLabel = runSupabaseDbQuery(
        `select id, value, label, tenant_id, sort_order, is_active, created_at::text as created_at from public.product_families where label = '${escapeSqlLiteral(candidateLabel)}'`,
      );
    } catch {
      beforeNoGoReasons.push("Unable to lookup product_families by label before write.");
    }

    if (!args.write) beforeNoGoReasons.push("--write is required for product_families pilot real execution.");
    if (!args.executePilotWrite) beforeNoGoReasons.push("--execute-pilot-write is required for product_families pilot real execution.");
    if (activePilotEntity !== "product_families") beforeNoGoReasons.push("Pilot entity must be product_families.");
    if (!generalAuthorizationValid) beforeNoGoReasons.push("General authorization is invalid.");
    if (!pilotAuthorizationValid) beforeNoGoReasons.push("Pilot authorization is invalid.");
    if (!payloadValidated) beforeNoGoReasons.push("Pilot payload is not validated.");
    if (!uniqueValueValidated) beforeNoGoReasons.push("UNIQUE(value) is not validated for product_families.");
    if (args.expectedTarget !== EXPECTED_TARGET_REF || localTargetRef !== EXPECTED_TARGET_REF) {
      beforeNoGoReasons.push("Target ref mismatch.");
    }
    if (localTargetName !== EXPECTED_TARGET_NAME) beforeNoGoReasons.push("Target name mismatch.");
    if (args.batch !== EXPECTED_BATCH_ID) beforeNoGoReasons.push("Batch mismatch.");
    if (pilotDecisionFinal !== "GO") beforeNoGoReasons.push("pilot_validation_decision is not GO.");
    if (blockedEntitiesFound.length > 0) beforeNoGoReasons.push("Blocked entities detected.");
    if (args.forbiddenFlags.length > 0 || args.unknownFlags.length > 0) beforeNoGoReasons.push("Forbidden/unknown flags detected.");
    if (existingByValue.length > 1) beforeNoGoReasons.push("More than one row found for product_families.value.");
    if (existingByValue.length === 0 && (labelCountBefore ?? 0) > 0) {
      beforeNoGoReasons.push("Label collision found without matching value for product_families pilot payload.");
    }
    if (executableEntitiesRoundOne22Q.includes("profiles")) beforeNoGoReasons.push("profiles must remain excluded.");
    if (executableEntitiesRoundOne22Q.includes("company_contacts")) beforeNoGoReasons.push("company_contacts must remain excluded.");
    if (productFamiliesTenantNullable !== true) beforeNoGoReasons.push("product_families.tenant_id must remain nullable.");
    if (productFamiliesCreatedByColumnPresent) beforeNoGoReasons.push("product_families must not define created_by in current pilot contract.");
    if (!String(productFamiliesSortOrderDefault || "").trim().startsWith(EXPECTED_PRODUCT_FAMILIES_PILOT_PAYLOAD.sort_order_default)) {
      beforeNoGoReasons.push("product_families.sort_order default must be 0.");
    }
    if (
      !String(productFamiliesIsActiveDefault || "")
        .trim()
        .toLowerCase()
        .startsWith(EXPECTED_PRODUCT_FAMILIES_PILOT_PAYLOAD.is_active_default)
    ) {
      beforeNoGoReasons.push("product_families.is_active default must be true.");
    }
    if (!String(productFamiliesCreatedAtDefault || "").toLowerCase().includes(EXPECTED_PRODUCT_FAMILIES_PILOT_PAYLOAD.created_at_default)) {
      beforeNoGoReasons.push("product_families.created_at default must be now().");
    }
    if (productFamiliesHasProductGroupIdColumn) {
      beforeNoGoReasons.push("product_families must not define product_group_id in current pilot contract.");
    }
    if (productFamiliesHasProductSubgroupIdColumn) {
      beforeNoGoReasons.push("product_families must not define product_subgroup_id in current pilot contract.");
    }
    if (productFamiliesHasFkToProductGroups) {
      beforeNoGoReasons.push("product_families must not have FK to product_groups.");
    }
    if (productFamiliesHasFkToProductSubgroups) {
      beforeNoGoReasons.push("product_families must not have FK to product_subgroups.");
    }

    pilotWriteBeforeDecision = classifyDecision(beforeNoGoReasons, beforePartialReasons);
    const beforeEvidence22AZ = {
      phase: "22AZ-R2",
      timestamp: new Date().toISOString(),
      targetRef: EXPECTED_TARGET_REF,
      targetName: EXPECTED_TARGET_NAME,
      batchId: EXPECTED_BATCH_ID,
      generalAuthorizationValid,
      pilotAuthorizationValid,
      pilotEntity: "product_families",
      pilotPayloadPath: args.pilotPayload || null,
      payloadUsed: {
        value: candidateValue,
        label: candidateLabel,
        tenant_id: EXPECTED_PRODUCT_FAMILIES_PILOT_PAYLOAD.tenant_id,
        created_by: EXPECTED_PRODUCT_FAMILIES_PILOT_PAYLOAD.created_by,
        temp_key: EXPECTED_PRODUCT_FAMILIES_PILOT_PAYLOAD.temp_key,
      },
      productFamiliesCountBefore: countBefore,
      lookupByValue: existingByValue,
      lookupByLabel,
      lookupByLabelCount: labelCountBefore,
      uniqueValueValidated,
      tenantNullableValidated: productFamiliesTenantNullable === true,
      createdByNotApplicable: EXPECTED_PRODUCT_FAMILIES_PILOT_PAYLOAD.created_by,
      createdByColumnAbsent: !productFamiliesCreatedByColumnPresent,
      defaultsValidated: {
        sort_order: productFamiliesSortOrderDefault,
        is_active: productFamiliesIsActiveDefault,
        created_at: productFamiliesCreatedAtDefault,
      },
      noTechnicalLinkToProductGroups: {
        product_group_id_column_absent: !productFamiliesHasProductGroupIdColumn,
        fk_to_product_groups_absent: !productFamiliesHasFkToProductGroups,
      },
      noTechnicalLinkToProductSubgroups: {
        product_subgroup_id_column_absent: !productFamiliesHasProductSubgroupIdColumn,
        fk_to_product_subgroups_absent: !productFamiliesHasFkToProductSubgroups,
      },
      beforeDecision: pilotWriteBeforeDecision,
      reasons: {
        noGoReasons: beforeNoGoReasons,
        partialReasons: beforePartialReasons,
      },
    };
    fs.writeFileSync(pilotWriteBeforePath, JSON.stringify(beforeEvidence22AZ, null, 2), "utf8");

    let writeResult = { operation: "aborted", record: null, inserted: false };
    if (pilotWriteBeforeDecision === "GO") {
      try {
        writeResult = executeProductFamiliesPilotWrite({
          pilotEntity: selectedPilotEntity,
          pilotAuthorization: args.pilotAuthorization,
          value: candidateValue,
          label: candidateLabel,
          tenant_id: EXPECTED_PRODUCT_FAMILIES_PILOT_PAYLOAD.tenant_id,
          created_by: EXPECTED_PRODUCT_FAMILIES_PILOT_PAYLOAD.created_by,
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
      const afterRows = runSupabaseDbQuery("select count(*)::bigint as total_rows from public.product_families");
      countAfter = Number(afterRows[0]?.total_rows || 0);
    } catch {}
    try {
      rowsByValueAfter = runSupabaseDbQuery(
        `select id, value, label, tenant_id, sort_order, is_active, created_at::text as created_at from public.product_families where value = '${escapeSqlLiteral(candidateValue)}'`,
      );
    } catch {}
    try {
      const dupRows = runSupabaseDbQuery(
        `select count(*)::bigint as duplicate_count from public.product_families where value = '${escapeSqlLiteral(candidateValue)}'`,
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
      if (Number(row.sort_order) !== 0) afterNoGoReasons.push("After sort_order default mismatch.");
      if (row.is_active !== true) afterNoGoReasons.push("After is_active default mismatch.");
      if (typeof row.created_at !== "string" || row.created_at.length === 0) {
        afterNoGoReasons.push("After created_at default mismatch.");
      }
    }
    if (productFamiliesHasProductGroupIdColumn) {
      afterNoGoReasons.push("product_families must not define product_group_id in current pilot contract.");
    }
    if (productFamiliesHasProductSubgroupIdColumn) {
      afterNoGoReasons.push("product_families must not define product_subgroup_id in current pilot contract.");
    }
    if (productFamiliesHasFkToProductGroups) {
      afterNoGoReasons.push("product_families must not have FK to product_groups.");
    }
    if (productFamiliesHasFkToProductSubgroups) {
      afterNoGoReasons.push("product_families must not have FK to product_subgroups.");
    }
    pilotWriteAfterDecision = classifyDecision(afterNoGoReasons, afterPartialReasons);

    const afterEvidence22AZ = {
      phase: "22AZ-R2",
      timestamp: new Date().toISOString(),
      targetRef: EXPECTED_TARGET_REF,
      targetName: EXPECTED_TARGET_NAME,
      batchId: EXPECTED_BATCH_ID,
      operationExecuted: writeResult.operation,
      productFamiliesCountAfter: countAfter,
      delta: pilotWriteDelta,
      recordByValue: rowsByValueAfter,
      recordId: rowsByValueAfter[0]?.id || null,
      value: candidateValue,
      label: candidateLabel,
      tenant_id: EXPECTED_PRODUCT_FAMILIES_PILOT_PAYLOAD.tenant_id,
      sort_order: rowsByValueAfter[0]?.sort_order ?? null,
      is_active: rowsByValueAfter[0]?.is_active ?? null,
      created_at: rowsByValueAfter[0]?.created_at ?? null,
      defaultsApplied: {
        sort_order: Number(rowsByValueAfter[0]?.sort_order) === 0,
        is_active: rowsByValueAfter[0]?.is_active === true,
        created_at: typeof rowsByValueAfter[0]?.created_at === "string" && rowsByValueAfter[0]?.created_at.length > 0,
      },
      noTechnicalLinkToProductGroups: {
        product_group_id_column_absent: !productFamiliesHasProductGroupIdColumn,
        fk_to_product_groups_absent: !productFamiliesHasFkToProductGroups,
      },
      noTechnicalLinkToProductSubgroups: {
        product_subgroup_id_column_absent: !productFamiliesHasProductSubgroupIdColumn,
        fk_to_product_subgroups_absent: !productFamiliesHasFkToProductSubgroups,
      },
      uniqueValueDuplicateCount: duplicateByValueCount,
      scopeConfirmation: {
        singleEntityExecution: true,
        touchedEntity: "product_families",
        legalEntitiesTouchedAgain: false,
        productTypesTouchedAgain: false,
        productGroupsTouchedAgain: false,
        productSubgroupsTouchedAgain: false,
        salesRepsTouched: false,
        profilesTouched: false,
        companyContactsTouched: false,
        transactionalTouched: false,
        queueTouched: false,
        externalIntegrationsCalled: false,
        expandedExecutionBlocked: true,
        noOtherEntityTouched: true,
      },
      executionExpandedBlocked: true,
      afterDecision: pilotWriteAfterDecision,
      reasons: {
        noGoReasons: afterNoGoReasons,
        partialReasons: afterPartialReasons,
      },
      finalMessage: phase22AZStopAfterPilotMessage,
    };
    fs.writeFileSync(pilotWriteAfterPath, JSON.stringify(afterEvidence22AZ, null, 2), "utf8");
  } else if (productClassesPilotMode) {
    pilotWriteBeforePath = path.join(phase22BBDir, `before-${nowStamp()}.json`);
    pilotWriteAfterPath = path.join(phase22BBDir, `after-${nowStamp()}.json`);
    const beforeNoGoReasons = [];
    const beforePartialReasons = [];

    const generalAuthorizationValid = args.authorization === EXPECTED_AUTHORIZATION;
    const pilotAuthorizationValid = args.pilotAuthorization === EXPECTED_PRODUCT_CLASSES_PILOT_AUTHORIZATION;
    const payloadValidated = pilotPayloadParsed && pilotPayloadValidationErrors.length === 0;
    const uniqueValueValidated = productClassesUniqueValuePresent === true;
    const candidateValue = EXPECTED_PRODUCT_CLASSES_PILOT_PAYLOAD.value;
    const candidateLabel = EXPECTED_PRODUCT_CLASSES_PILOT_PAYLOAD.label;

    let countBefore = null;
    let existingByValue = [];
    let labelCountBefore = null;
    let lookupByLabel = [];
    try {
      const beforeRows = runSupabaseDbQuery("select count(*)::bigint as total_rows from public.product_classes");
      countBefore = Number(beforeRows[0]?.total_rows || 0);
    } catch {
      beforeNoGoReasons.push("Unable to read product_classes count before write.");
    }
    try {
      existingByValue = runSupabaseDbQuery(
        `select id, value, label, tenant_id, sort_order, is_active, created_at::text as created_at from public.product_classes where value = '${escapeSqlLiteral(candidateValue)}'`,
      );
    } catch {
      beforeNoGoReasons.push("Unable to lookup product_classes by value before write.");
    }
    try {
      const labelRows = runSupabaseDbQuery(
        `select count(*)::bigint as label_count from public.product_classes where label = '${escapeSqlLiteral(candidateLabel)}'`,
      );
      labelCountBefore = Number(labelRows[0]?.label_count || 0);
      lookupByLabel = runSupabaseDbQuery(
        `select id, value, label, tenant_id, sort_order, is_active, created_at::text as created_at from public.product_classes where label = '${escapeSqlLiteral(candidateLabel)}'`,
      );
    } catch {
      beforeNoGoReasons.push("Unable to lookup product_classes by label before write.");
    }

    if (!args.write) beforeNoGoReasons.push("--write is required for product_classes pilot real execution.");
    if (!args.executePilotWrite) beforeNoGoReasons.push("--execute-pilot-write is required for product_classes pilot real execution.");
    if (activePilotEntity !== "product_classes") beforeNoGoReasons.push("Pilot entity must be product_classes.");
    if (!generalAuthorizationValid) beforeNoGoReasons.push("General authorization is invalid.");
    if (!pilotAuthorizationValid) beforeNoGoReasons.push("Pilot authorization is invalid.");
    if (!payloadValidated) beforeNoGoReasons.push("Pilot payload is not validated.");
    if (!uniqueValueValidated) beforeNoGoReasons.push("UNIQUE(value) is not validated for product_classes.");
    if (args.expectedTarget !== EXPECTED_TARGET_REF || localTargetRef !== EXPECTED_TARGET_REF) {
      beforeNoGoReasons.push("Target ref mismatch.");
    }
    if (localTargetName !== EXPECTED_TARGET_NAME) beforeNoGoReasons.push("Target name mismatch.");
    if (args.batch !== EXPECTED_BATCH_ID) beforeNoGoReasons.push("Batch mismatch.");
    if (pilotDecisionFinal !== "GO") beforeNoGoReasons.push("pilot_validation_decision is not GO.");
    if (blockedEntitiesFound.length > 0) beforeNoGoReasons.push("Blocked entities detected.");
    if (args.forbiddenFlags.length > 0 || args.unknownFlags.length > 0) beforeNoGoReasons.push("Forbidden/unknown flags detected.");
    if (existingByValue.length > 1) beforeNoGoReasons.push("More than one row found for product_classes.value.");
    if (existingByValue.length === 0 && (labelCountBefore ?? 0) > 0) {
      beforeNoGoReasons.push("Label collision found without matching value for product_classes pilot payload.");
    }
    if (executableEntitiesRoundOne22Q.includes("profiles")) beforeNoGoReasons.push("profiles must remain excluded.");
    if (executableEntitiesRoundOne22Q.includes("company_contacts")) beforeNoGoReasons.push("company_contacts must remain excluded.");
    if (productClassesTenantNullable !== true) beforeNoGoReasons.push("product_classes.tenant_id must remain nullable.");
    if (productClassesCreatedByColumnPresent) beforeNoGoReasons.push("product_classes must not define created_by in current pilot contract.");
    if (!String(productClassesSortOrderDefault || "").trim().startsWith(EXPECTED_PRODUCT_CLASSES_PILOT_PAYLOAD.sort_order_default)) {
      beforeNoGoReasons.push("product_classes.sort_order default must be 0.");
    }
    if (
      !String(productClassesIsActiveDefault || "")
        .trim()
        .toLowerCase()
        .startsWith(EXPECTED_PRODUCT_CLASSES_PILOT_PAYLOAD.is_active_default)
    ) {
      beforeNoGoReasons.push("product_classes.is_active default must be true.");
    }
    if (!String(productClassesCreatedAtDefault || "").toLowerCase().includes(EXPECTED_PRODUCT_CLASSES_PILOT_PAYLOAD.created_at_default)) {
      beforeNoGoReasons.push("product_classes.created_at default must be now().");
    }
    if (productClassesHasProductGroupIdColumn) {
      beforeNoGoReasons.push("product_classes must not define product_group_id in current pilot contract.");
    }
    if (productClassesHasProductSubgroupIdColumn) {
      beforeNoGoReasons.push("product_classes must not define product_subgroup_id in current pilot contract.");
    }
    if (productClassesHasProductFamilyIdColumn) {
      beforeNoGoReasons.push("product_classes must not define product_family_id in current pilot contract.");
    }
    if (productClassesHasFkToProductGroups) {
      beforeNoGoReasons.push("product_classes must not have FK to product_groups.");
    }
    if (productClassesHasFkToProductSubgroups) {
      beforeNoGoReasons.push("product_classes must not have FK to product_subgroups.");
    }
    if (productClassesHasFkToProductFamilies) {
      beforeNoGoReasons.push("product_classes must not have FK to product_families.");
    }

    pilotWriteBeforeDecision = classifyDecision(beforeNoGoReasons, beforePartialReasons);
    const beforeEvidence22BB = {
      phase: "22BB-R2",
      timestamp: new Date().toISOString(),
      targetRef: EXPECTED_TARGET_REF,
      targetName: EXPECTED_TARGET_NAME,
      batchId: EXPECTED_BATCH_ID,
      generalAuthorizationValid,
      pilotAuthorizationValid,
      pilotEntity: "product_classes",
      pilotPayloadPath: args.pilotPayload || null,
      payloadUsed: {
        value: candidateValue,
        label: candidateLabel,
        tenant_id: EXPECTED_PRODUCT_CLASSES_PILOT_PAYLOAD.tenant_id,
        created_by: EXPECTED_PRODUCT_CLASSES_PILOT_PAYLOAD.created_by,
        temp_key: EXPECTED_PRODUCT_CLASSES_PILOT_PAYLOAD.temp_key,
      },
      productClassesCountBefore: countBefore,
      lookupByValue: existingByValue,
      lookupByLabel,
      lookupByLabelCount: labelCountBefore,
      uniqueValueValidated,
      tenantNullableValidated: productClassesTenantNullable === true,
      createdByNotApplicable: EXPECTED_PRODUCT_CLASSES_PILOT_PAYLOAD.created_by,
      createdByColumnAbsent: !productClassesCreatedByColumnPresent,
      defaultsValidated: {
        sort_order: productClassesSortOrderDefault,
        is_active: productClassesIsActiveDefault,
        created_at: productClassesCreatedAtDefault,
      },
      noTechnicalLinkToProductGroups: {
        product_group_id_column_absent: !productClassesHasProductGroupIdColumn,
        fk_to_product_groups_absent: !productClassesHasFkToProductGroups,
      },
      noTechnicalLinkToProductSubgroups: {
        product_subgroup_id_column_absent: !productClassesHasProductSubgroupIdColumn,
        fk_to_product_subgroups_absent: !productClassesHasFkToProductSubgroups,
      },
      noTechnicalLinkToProductFamilies: {
        product_family_id_column_absent: !productClassesHasProductFamilyIdColumn,
        fk_to_product_families_absent: !productClassesHasFkToProductFamilies,
      },
      beforeDecision: pilotWriteBeforeDecision,
      reasons: {
        noGoReasons: beforeNoGoReasons,
        partialReasons: beforePartialReasons,
      },
    };
    fs.writeFileSync(pilotWriteBeforePath, JSON.stringify(beforeEvidence22BB, null, 2), "utf8");

    let writeResult = { operation: "aborted", record: null, inserted: false };
    if (pilotWriteBeforeDecision === "GO") {
      try {
        writeResult = executeProductClassesPilotWrite({
          pilotEntity: selectedPilotEntity,
          pilotAuthorization: args.pilotAuthorization,
          value: candidateValue,
          label: candidateLabel,
          tenant_id: EXPECTED_PRODUCT_CLASSES_PILOT_PAYLOAD.tenant_id,
          created_by: EXPECTED_PRODUCT_CLASSES_PILOT_PAYLOAD.created_by,
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
      const afterRows = runSupabaseDbQuery("select count(*)::bigint as total_rows from public.product_classes");
      countAfter = Number(afterRows[0]?.total_rows || 0);
    } catch {}
    try {
      rowsByValueAfter = runSupabaseDbQuery(
        `select id, value, label, tenant_id, sort_order, is_active, created_at::text as created_at from public.product_classes where value = '${escapeSqlLiteral(candidateValue)}'`,
      );
    } catch {}
    try {
      const dupRows = runSupabaseDbQuery(
        `select count(*)::bigint as duplicate_count from public.product_classes where value = '${escapeSqlLiteral(candidateValue)}'`,
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
      if (Number(row.sort_order) !== 0) afterNoGoReasons.push("After sort_order default mismatch.");
      if (row.is_active !== true) afterNoGoReasons.push("After is_active default mismatch.");
      if (typeof row.created_at !== "string" || row.created_at.length === 0) {
        afterNoGoReasons.push("After created_at default mismatch.");
      }
    }
    if (productClassesHasProductGroupIdColumn) {
      afterNoGoReasons.push("product_classes must not define product_group_id in current pilot contract.");
    }
    if (productClassesHasProductSubgroupIdColumn) {
      afterNoGoReasons.push("product_classes must not define product_subgroup_id in current pilot contract.");
    }
    if (productClassesHasProductFamilyIdColumn) {
      afterNoGoReasons.push("product_classes must not define product_family_id in current pilot contract.");
    }
    if (productClassesHasFkToProductGroups) {
      afterNoGoReasons.push("product_classes must not have FK to product_groups.");
    }
    if (productClassesHasFkToProductSubgroups) {
      afterNoGoReasons.push("product_classes must not have FK to product_subgroups.");
    }
    if (productClassesHasFkToProductFamilies) {
      afterNoGoReasons.push("product_classes must not have FK to product_families.");
    }
    pilotWriteAfterDecision = classifyDecision(afterNoGoReasons, afterPartialReasons);

    const afterEvidence22BB = {
      phase: "22BB-R2",
      timestamp: new Date().toISOString(),
      targetRef: EXPECTED_TARGET_REF,
      targetName: EXPECTED_TARGET_NAME,
      batchId: EXPECTED_BATCH_ID,
      operationExecuted: writeResult.operation,
      productClassesCountAfter: countAfter,
      delta: pilotWriteDelta,
      recordByValue: rowsByValueAfter,
      recordId: rowsByValueAfter[0]?.id || null,
      value: candidateValue,
      label: candidateLabel,
      tenant_id: EXPECTED_PRODUCT_CLASSES_PILOT_PAYLOAD.tenant_id,
      sort_order: rowsByValueAfter[0]?.sort_order ?? null,
      is_active: rowsByValueAfter[0]?.is_active ?? null,
      created_at: rowsByValueAfter[0]?.created_at ?? null,
      defaultsApplied: {
        sort_order: Number(rowsByValueAfter[0]?.sort_order) === 0,
        is_active: rowsByValueAfter[0]?.is_active === true,
        created_at: typeof rowsByValueAfter[0]?.created_at === "string" && rowsByValueAfter[0]?.created_at.length > 0,
      },
      noTechnicalLinkToProductGroups: {
        product_group_id_column_absent: !productClassesHasProductGroupIdColumn,
        fk_to_product_groups_absent: !productClassesHasFkToProductGroups,
      },
      noTechnicalLinkToProductSubgroups: {
        product_subgroup_id_column_absent: !productClassesHasProductSubgroupIdColumn,
        fk_to_product_subgroups_absent: !productClassesHasFkToProductSubgroups,
      },
      noTechnicalLinkToProductFamilies: {
        product_family_id_column_absent: !productClassesHasProductFamilyIdColumn,
        fk_to_product_families_absent: !productClassesHasFkToProductFamilies,
      },
      uniqueValueDuplicateCount: duplicateByValueCount,
      scopeConfirmation: {
        singleEntityExecution: true,
        touchedEntity: "product_classes",
        legalEntitiesTouchedAgain: false,
        productTypesTouchedAgain: false,
        productGroupsTouchedAgain: false,
        productSubgroupsTouchedAgain: false,
        productFamiliesTouchedAgain: false,
        salesRepsTouched: false,
        profilesTouched: false,
        companyContactsTouched: false,
        transactionalTouched: false,
        queueTouched: false,
        externalIntegrationsCalled: false,
        expandedExecutionBlocked: true,
        noOtherEntityTouched: true,
      },
      executionExpandedBlocked: true,
      afterDecision: pilotWriteAfterDecision,
      reasons: {
        noGoReasons: afterNoGoReasons,
        partialReasons: afterPartialReasons,
      },
      finalMessage: phase22BBStopAfterPilotMessage,
    };
    fs.writeFileSync(pilotWriteAfterPath, JSON.stringify(afterEvidence22BB, null, 2), "utf8");
  } else if (companiesPilotMode) {
    pilotWriteBeforePath = path.join(phase22BGDir, `before-${nowStamp()}.json`);
    pilotWriteAfterPath = path.join(phase22BGDir, `after-${nowStamp()}.json`);
    const beforeNoGoReasons = [];
    const beforePartialReasons = [];

    const generalAuthorizationValid = args.authorization === EXPECTED_AUTHORIZATION;
    const pilotAuthorizationValid = args.pilotAuthorization === EXPECTED_COMPANIES_PILOT_AUTHORIZATION;
    const payloadValidated = pilotPayloadParsed && pilotPayloadValidationErrors.length === 0;
    const uniqueTenantCnpjValidated = companiesUniqueTenantCnpjPresent === true && companiesUniqueCnpjPresent === true;

    const candidateTenantId = EXPECTED_COMPANIES_PILOT_PAYLOAD.tenant_id;
    const candidateName = EXPECTED_COMPANIES_PILOT_PAYLOAD.name;
    const candidateCnpj = EXPECTED_COMPANIES_PILOT_PAYLOAD.cnpj;

    let countBefore = null;
    let contactsCountBefore = null;
    let existingByTenantCnpj = [];
    let lookupByName = [];
    let tenantLookup = [];
    let companyContactsLookup = [];
    try {
      const beforeRows = runSupabaseDbQuery("select count(*)::bigint as total_rows from public.companies");
      countBefore = Number(beforeRows[0]?.total_rows || 0);
    } catch {
      beforeNoGoReasons.push("Unable to read companies count before write.");
    }
    try {
      const contactsRows = runSupabaseDbQuery("select count(*)::bigint as total_rows from public.contacts");
      contactsCountBefore = Number(contactsRows[0]?.total_rows || 0);
    } catch {
      beforeNoGoReasons.push("Unable to read contacts count before write.");
    }
    try {
      existingByTenantCnpj = runSupabaseDbQuery(`
        select id, tenant_id, name, cnpj, cnpj_root, owner_id, sales_rep_id, legal_entity_id, created_by
        from public.companies
        where tenant_id='${escapeSqlLiteral(candidateTenantId)}'
          and cnpj='${escapeSqlLiteral(candidateCnpj)}'
      `);
    } catch {
      beforeNoGoReasons.push("Unable to lookup companies by (tenant_id, cnpj) before write.");
    }
    try {
      lookupByName = runSupabaseDbQuery(
        `select id, tenant_id, name, cnpj from public.companies where name='${escapeSqlLiteral(candidateName)}'`,
      );
    } catch {
      beforeNoGoReasons.push("Unable to lookup companies by name before write.");
    }
    try {
      tenantLookup = runSupabaseDbQuery(
        `select id from public.tenants where id='${escapeSqlLiteral(candidateTenantId)}'`,
      );
    } catch {
      beforeNoGoReasons.push("Unable to validate tenant existence before write.");
    }
    try {
      companyContactsLookup = runSupabaseDbQuery("select to_regclass('public.company_contacts') as regclass");
    } catch {
      beforeNoGoReasons.push("Unable to validate company_contacts reference-only status before write.");
    }

    if (!args.write) beforeNoGoReasons.push("--write is required for companies pilot real execution.");
    if (!args.executePilotWrite) beforeNoGoReasons.push("--execute-pilot-write is required for companies pilot real execution.");
    if (activePilotEntity !== "companies") beforeNoGoReasons.push("Pilot entity must be companies.");
    if (!generalAuthorizationValid) beforeNoGoReasons.push("General authorization is invalid.");
    if (!pilotAuthorizationValid) beforeNoGoReasons.push("Pilot authorization is invalid.");
    if (!payloadValidated) beforeNoGoReasons.push("Pilot payload is not validated.");
    if (!uniqueTenantCnpjValidated) beforeNoGoReasons.push("Idempotency key indexes for companies are not validated.");
    if (args.expectedTarget !== EXPECTED_TARGET_REF || localTargetRef !== EXPECTED_TARGET_REF) {
      beforeNoGoReasons.push("Target ref mismatch.");
    }
    if (localTargetName !== EXPECTED_TARGET_NAME) beforeNoGoReasons.push("Target name mismatch.");
    if (args.batch !== EXPECTED_BATCH_ID) beforeNoGoReasons.push("Batch mismatch.");
    if (pilotDecisionFinal !== "GO") beforeNoGoReasons.push("pilot_validation_decision is not GO.");
    if (blockedEntitiesFound.length > 0) beforeNoGoReasons.push("Blocked entities detected.");
    if (args.forbiddenFlags.length > 0 || args.unknownFlags.length > 0) beforeNoGoReasons.push("Forbidden/unknown flags detected.");
    if (existingByTenantCnpj.length > 1) beforeNoGoReasons.push("More than one row found for companies(tenant_id, cnpj).");
    if (tenantLookup.length !== 1) beforeNoGoReasons.push("Pilot tenant must exist with cardinality 1.");
    if (companyContactsLookup[0]?.regclass !== null) beforeNoGoReasons.push("company_contacts must remain reference-only/non-writable.");
    if (contactsCountBefore !== 0) beforeNoGoReasons.push("contacts must remain zero before companies pilot.");
    if (companiesTenantRequired !== true) beforeNoGoReasons.push("companies.tenant_id must remain required.");
    if (companiesNameRequired !== true) beforeNoGoReasons.push("companies.name must remain required.");
    if (companiesCnpjIsText !== true) beforeNoGoReasons.push("companies.cnpj must remain text.");
    if (companiesOwnerNullable !== true) beforeNoGoReasons.push("companies.owner_id must be nullable/omittable.");
    if (companiesSalesRepNullable !== true) beforeNoGoReasons.push("companies.sales_rep_id must be nullable/omittable.");
    if (companiesLegalEntityNullable !== true) beforeNoGoReasons.push("companies.legal_entity_id must be nullable/omittable.");
    if (companiesCreatedByNullable !== true) beforeNoGoReasons.push("companies.created_by must be nullable/omittable.");

    pilotWriteBeforeDecision = classifyDecision(beforeNoGoReasons, beforePartialReasons);
    const beforeEvidence22BG = {
      phase: "22BG-R2",
      timestamp: new Date().toISOString(),
      targetRef: EXPECTED_TARGET_REF,
      targetName: EXPECTED_TARGET_NAME,
      batchId: EXPECTED_BATCH_ID,
      generalAuthorizationValid,
      pilotAuthorizationValid,
      pilotEntity: "companies",
      pilotPayloadPath: args.pilotPayload || null,
      payloadUsed: {
        source: EXPECTED_COMPANIES_PILOT_PAYLOAD.source,
        temp_key: EXPECTED_COMPANIES_PILOT_PAYLOAD.temp_key,
        tenant_id: candidateTenantId,
        name: candidateName,
        cnpj: candidateCnpj,
        source_document: EXPECTED_COMPANIES_PILOT_PAYLOAD.source_document,
        owner_temp_key: EXPECTED_COMPANIES_PILOT_PAYLOAD.owner_temp_key,
        owner_write_policy: EXPECTED_COMPANIES_PILOT_PAYLOAD.owner_write_policy,
        sales_rep_id_policy: EXPECTED_COMPANIES_PILOT_PAYLOAD.sales_rep_id_policy,
        legal_entity_id_policy: EXPECTED_COMPANIES_PILOT_PAYLOAD.legal_entity_id_policy,
        created_by_policy: EXPECTED_COMPANIES_PILOT_PAYLOAD.created_by_policy,
      },
      companiesCountBefore: countBefore,
      contactsCountBefore,
      lookupByTenantCnpj: existingByTenantCnpj,
      lookupByName,
      tenantLookup,
      idempotencyKeyValidation: {
        unique_tenant_cnpj_index: companiesUniqueTenantCnpjPresent,
        unique_cnpj_index: companiesUniqueCnpjPresent,
      },
      requiredFieldsValidation: {
        tenant_id_required: companiesTenantRequired === true,
        name_required: companiesNameRequired === true,
        cnpj_text: companiesCnpjIsText === true,
      },
      omittedFieldsValidation: {
        owner_id_omitted_or_null: companiesOwnerNullable === true,
        sales_rep_id_omitted_or_null: companiesSalesRepNullable === true,
        legal_entity_id_omitted_or_null: companiesLegalEntityNullable === true,
        created_by_omitted_or_null: companiesCreatedByNullable === true,
      },
      companyContactsReferenceOnly: {
        regclass: companyContactsLookup[0]?.regclass ?? null,
        reference_only: companyContactsLookup[0]?.regclass === null,
      },
      contactsWriteBlocked: true,
      beforeDecision: pilotWriteBeforeDecision,
      reasons: {
        noGoReasons: beforeNoGoReasons,
        partialReasons: beforePartialReasons,
      },
    };
    fs.writeFileSync(pilotWriteBeforePath, JSON.stringify(beforeEvidence22BG, null, 2), "utf8");

    let writeResult = { operation: "aborted", record: null, inserted: false };
    if (pilotWriteBeforeDecision === "GO") {
      try {
        writeResult = executeCompaniesPilotWrite({
          pilotEntity: selectedPilotEntity,
          pilotAuthorization: args.pilotAuthorization,
          tenant_id: candidateTenantId,
          name: candidateName,
          cnpj: candidateCnpj,
          owner_write_policy: EXPECTED_COMPANIES_PILOT_PAYLOAD.owner_write_policy,
          sales_rep_id_policy: EXPECTED_COMPANIES_PILOT_PAYLOAD.sales_rep_id_policy,
          legal_entity_id_policy: EXPECTED_COMPANIES_PILOT_PAYLOAD.legal_entity_id_policy,
          created_by_policy: EXPECTED_COMPANIES_PILOT_PAYLOAD.created_by_policy,
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
    let contactsCountAfter = null;
    let rowsByTenantCnpjAfter = [];
    let duplicateByTenantCnpjCount = null;
    let companyContactsAfter = [];
    try {
      const afterRows = runSupabaseDbQuery("select count(*)::bigint as total_rows from public.companies");
      countAfter = Number(afterRows[0]?.total_rows || 0);
    } catch {}
    try {
      const contactsRows = runSupabaseDbQuery("select count(*)::bigint as total_rows from public.contacts");
      contactsCountAfter = Number(contactsRows[0]?.total_rows || 0);
    } catch {}
    try {
      rowsByTenantCnpjAfter = runSupabaseDbQuery(`
        select id, tenant_id, name, cnpj, cnpj_root, owner_id, sales_rep_id, legal_entity_id, created_by
        from public.companies
        where tenant_id='${escapeSqlLiteral(candidateTenantId)}'
          and cnpj='${escapeSqlLiteral(candidateCnpj)}'
      `);
    } catch {}
    try {
      const dupRows = runSupabaseDbQuery(`
        select count(*)::bigint as duplicate_count
        from public.companies
        where tenant_id='${escapeSqlLiteral(candidateTenantId)}'
          and cnpj='${escapeSqlLiteral(candidateCnpj)}'
      `);
      duplicateByTenantCnpjCount = Number(dupRows[0]?.duplicate_count || 0);
    } catch {}
    try {
      companyContactsAfter = runSupabaseDbQuery("select to_regclass('public.company_contacts') as regclass");
    } catch {}

    pilotWriteOperation = writeResult.operation;
    pilotWriteRecord = rowsByTenantCnpjAfter[0] || writeResult.record || null;
    pilotWriteDelta = countAfter !== null && countBefore !== null ? countAfter - countBefore : null;
    recordsAffected = writeResult.record ? [writeResult.record] : [];

    const afterNoGoReasons = [];
    const afterPartialReasons = [];
    if (pilotWriteBeforeDecision !== "GO") afterNoGoReasons.push("beforeDecision is not GO.");
    if (writeResult.operation === "aborted") afterNoGoReasons.push("Pilot operation aborted.");
    if (!["inserted", "idempotent_noop"].includes(writeResult.operation)) afterNoGoReasons.push("Unexpected pilot operation result.");
    if (writeResult.operation === "inserted" && pilotWriteDelta !== 1) afterNoGoReasons.push("Delta must be 1 for inserted operation.");
    if (writeResult.operation === "idempotent_noop" && pilotWriteDelta !== 0) afterNoGoReasons.push("Delta must be 0 for idempotent_noop.");
    if (!rowsByTenantCnpjAfter.length) afterNoGoReasons.push("No row found by (tenant_id, cnpj) after execution.");
    if ((duplicateByTenantCnpjCount ?? 0) !== 1) afterNoGoReasons.push("Expected exactly one row for (tenant_id, cnpj) after execution.");
    if (contactsCountBefore !== contactsCountAfter) afterNoGoReasons.push("contacts count changed unexpectedly.");
    if (companyContactsAfter[0]?.regclass !== null) afterNoGoReasons.push("company_contacts must remain non-writable.");
    if (rowsByTenantCnpjAfter.length === 1) {
      const row = rowsByTenantCnpjAfter[0];
      if (row.tenant_id !== candidateTenantId) afterNoGoReasons.push("After tenant_id mismatch.");
      if (row.name !== candidateName && row.name !== candidateName.toUpperCase()) afterNoGoReasons.push("After name mismatch.");
      if (row.cnpj !== candidateCnpj) afterNoGoReasons.push("After cnpj mismatch.");
      if (row.owner_id !== null) afterNoGoReasons.push("owner_id must remain null.");
      if (row.sales_rep_id !== null) afterNoGoReasons.push("sales_rep_id must remain null.");
      if (row.legal_entity_id !== null) afterNoGoReasons.push("legal_entity_id must remain null.");
      if (row.created_by !== null) afterNoGoReasons.push("created_by must remain null.");
    }
    pilotWriteAfterDecision = classifyDecision(afterNoGoReasons, afterPartialReasons);

    const afterEvidence22BG = {
      phase: "22BG-R2",
      timestamp: new Date().toISOString(),
      targetRef: EXPECTED_TARGET_REF,
      targetName: EXPECTED_TARGET_NAME,
      batchId: EXPECTED_BATCH_ID,
      operationExecuted: writeResult.operation,
      companiesCountAfter: countAfter,
      contactsCountAfter,
      delta: pilotWriteDelta,
      recordByTenantCnpj: rowsByTenantCnpjAfter,
      recordId: rowsByTenantCnpjAfter[0]?.id || null,
      tenant_id: candidateTenantId,
      name: candidateName,
      cnpj: candidateCnpj,
      cnpj_root: rowsByTenantCnpjAfter[0]?.cnpj_root ?? null,
      owner_id: rowsByTenantCnpjAfter[0]?.owner_id ?? null,
      sales_rep_id: rowsByTenantCnpjAfter[0]?.sales_rep_id ?? null,
      legal_entity_id: rowsByTenantCnpjAfter[0]?.legal_entity_id ?? null,
      created_by: rowsByTenantCnpjAfter[0]?.created_by ?? null,
      omittedFieldsConfirmed: {
        owner_id_not_written: rowsByTenantCnpjAfter[0]?.owner_id === null,
        sales_rep_id_not_written: rowsByTenantCnpjAfter[0]?.sales_rep_id === null,
        legal_entity_id_not_written: rowsByTenantCnpjAfter[0]?.legal_entity_id === null,
        created_by_not_written: rowsByTenantCnpjAfter[0]?.created_by === null,
      },
      contactsNotWritten: contactsCountBefore === contactsCountAfter,
      companyContactsNotWritten: companyContactsAfter[0]?.regclass === null,
      uniqueTenantCnpjDuplicateCount: duplicateByTenantCnpjCount,
      scopeConfirmation: {
        singleEntityExecution: true,
        touchedEntity: "companies",
        contactsTouched: false,
        companyContactsTouched: false,
        salesRepsTouched: false,
        profilesTouched: false,
        transactionalTouched: false,
        queueTouched: false,
        externalIntegrationsCalled: false,
        expandedExecutionBlocked: true,
        noOtherEntityTouched: true,
      },
      executionExpandedBlocked: true,
      afterDecision: pilotWriteAfterDecision,
      reasons: {
        noGoReasons: afterNoGoReasons,
        partialReasons: afterPartialReasons,
      },
      finalMessage: phase22BGStopAfterPilotMessage,
    };
    fs.writeFileSync(pilotWriteAfterPath, JSON.stringify(afterEvidence22BG, null, 2), "utf8");
  } else if (contactsPilotMode) {
    pilotWriteBeforePath = path.join(phase22BHDir, `before-${nowStamp()}.json`);
    pilotWriteAfterPath = path.join(phase22BHDir, `after-${nowStamp()}.json`);
    const beforeNoGoReasons = [];
    const beforePartialReasons = [];

    const generalAuthorizationValid = args.authorization === EXPECTED_AUTHORIZATION;
    const pilotAuthorizationValid = args.pilotAuthorization === EXPECTED_CONTACTS_PILOT_AUTHORIZATION;
    const payloadValidated = pilotPayloadParsed && pilotPayloadValidationErrors.length === 0;
    const uniqueIndexValidated = contactsUniqueTenantCompanyEmailPresent === true;

    const candidateTenantId = EXPECTED_CONTACTS_PILOT_PAYLOAD.tenant_id;
    const candidateFirstName = EXPECTED_CONTACTS_PILOT_PAYLOAD.first_name;
    const candidateEmail = EXPECTED_CONTACTS_PILOT_PAYLOAD.email;
    const candidateCompanyCnpj = EXPECTED_CONTACTS_PILOT_PAYLOAD.company_lookup_cnpj;
    const candidateCompanyId = EXPECTED_CONTACTS_PILOT_PAYLOAD.resolved_company_id;

    let contactsCountBefore = null;
    let companiesCountBefore = null;
    let companyLookupRows = [];
    let companyIdLookupRows = [];
    let lookupByKeyBefore = [];
    let lookupByEmailBefore = [];
    let tenantLookup = [];
    let companyContactsLookup = [];
    try {
      const beforeRows = runSupabaseDbQuery("select count(*)::bigint as total_rows from public.contacts");
      contactsCountBefore = Number(beforeRows[0]?.total_rows || 0);
    } catch {
      beforeNoGoReasons.push("Unable to read contacts count before write.");
    }
    try {
      const companyCountRows = runSupabaseDbQuery("select count(*)::bigint as total_rows from public.companies");
      companiesCountBefore = Number(companyCountRows[0]?.total_rows || 0);
    } catch {
      beforeNoGoReasons.push("Unable to read companies count before write.");
    }
    try {
      companyLookupRows = runSupabaseDbQuery(`
        select id, tenant_id, cnpj, name, owner_id, sales_rep_id, legal_entity_id
        from public.companies
        where tenant_id='${escapeSqlLiteral(candidateTenantId)}'
          and cnpj='${escapeSqlLiteral(candidateCompanyCnpj)}'
      `);
    } catch {
      beforeNoGoReasons.push("Unable to lookup company by (tenant_id, cnpj) before write.");
    }
    if (companyLookupRows.length === 1) {
      try {
        lookupByKeyBefore = runSupabaseDbQuery(`
          select id, tenant_id, company_id, first_name, email, owner_id, created_by
          from public.contacts
          where tenant_id='${escapeSqlLiteral(candidateTenantId)}'
            and company_id='${escapeSqlLiteral(companyLookupRows[0].id)}'
            and email='${escapeSqlLiteral(candidateEmail)}'
        `);
      } catch {
        beforeNoGoReasons.push("Unable to lookup contacts by (tenant_id, company_id, email) before write.");
      }
    }
    try {
      lookupByEmailBefore = runSupabaseDbQuery(
        `select id, tenant_id, company_id, first_name, email from public.contacts where email='${escapeSqlLiteral(candidateEmail)}'`,
      );
    } catch {
      beforeNoGoReasons.push("Unable to lookup contacts by email before write.");
    }
    try {
      tenantLookup = runSupabaseDbQuery(
        `select id from public.tenants where id='${escapeSqlLiteral(candidateTenantId)}'`,
      );
    } catch {
      beforeNoGoReasons.push("Unable to validate tenant existence before write.");
    }
    try {
      companyContactsLookup = runSupabaseDbQuery("select to_regclass('public.company_contacts') as regclass");
    } catch {
      beforeNoGoReasons.push("Unable to validate company_contacts reference-only status before write.");
    }
    try {
      companyIdLookupRows = runSupabaseDbQuery(
        `select id from public.companies where id='${escapeSqlLiteral(candidateCompanyId)}'`,
      );
    } catch {
      beforeNoGoReasons.push("Unable to validate resolved company_id existence before write.");
    }

    if (!args.write) beforeNoGoReasons.push("--write is required for contacts pilot real execution.");
    if (!args.executePilotWrite) beforeNoGoReasons.push("--execute-pilot-write is required for contacts pilot real execution.");
    if (activePilotEntity !== "contacts") beforeNoGoReasons.push("Pilot entity must be contacts.");
    if (!generalAuthorizationValid) beforeNoGoReasons.push("General authorization is invalid.");
    if (!pilotAuthorizationValid) beforeNoGoReasons.push("Pilot authorization is invalid.");
    if (!payloadValidated) beforeNoGoReasons.push("Pilot payload is not validated.");
    if (!uniqueIndexValidated) beforeNoGoReasons.push("Idempotency index for contacts is not validated.");
    if (args.expectedTarget !== EXPECTED_TARGET_REF || localTargetRef !== EXPECTED_TARGET_REF) {
      beforeNoGoReasons.push("Target ref mismatch.");
    }
    if (localTargetName !== EXPECTED_TARGET_NAME) beforeNoGoReasons.push("Target name mismatch.");
    if (args.batch !== EXPECTED_BATCH_ID) beforeNoGoReasons.push("Batch mismatch.");
    if (pilotDecisionFinal !== "GO") beforeNoGoReasons.push("pilot_validation_decision is not GO.");
    if (blockedEntitiesFound.length > 0) beforeNoGoReasons.push("Blocked entities detected.");
    if (args.forbiddenFlags.length > 0 || args.unknownFlags.length > 0) beforeNoGoReasons.push("Forbidden/unknown flags detected.");
    if (tenantLookup.length !== 1) beforeNoGoReasons.push("Pilot tenant must exist with cardinality 1.");
    if (contactsTenantRequired !== true) beforeNoGoReasons.push("contacts.tenant_id must remain required.");
    if (contactsFirstNameRequired !== true) beforeNoGoReasons.push("contacts.first_name must remain required.");
    if (contactsEmailPresent !== true) beforeNoGoReasons.push("contacts.email column must exist.");
    if (contactsCompanyIdPresent !== true) beforeNoGoReasons.push("contacts.company_id column must exist.");
    if (contactsCompanyIdNullable !== true) beforeNoGoReasons.push("contacts.company_id must remain nullable.");
    if (contactsCompanyFkPresent !== true) beforeNoGoReasons.push("contacts.company_id FK must exist.");
    if (companyContactsLookup[0]?.regclass !== null) beforeNoGoReasons.push("company_contacts must remain reference-only/non-writable.");
    if (companyLookupRows.length !== 1) beforeNoGoReasons.push("Company lookup by (tenant_id, cnpj) must return cardinality 1.");
    if (companyLookupRows.length === 1 && companyLookupRows[0].id !== candidateCompanyId) {
      beforeNoGoReasons.push("Resolved company_id mismatch against deterministic lookup.");
    }
    if (companyLookupRows.length === 1 && companyLookupRows[0].name !== "TMP COMPANY 01") {
      beforeNoGoReasons.push("Resolved company name mismatch.");
    }
    if (companyLookupRows.length === 1 && companyLookupRows[0].owner_id !== null) beforeNoGoReasons.push("Company owner_id must remain null.");
    if (companyLookupRows.length === 1 && companyLookupRows[0].sales_rep_id !== null) beforeNoGoReasons.push("Company sales_rep_id must remain null.");
    if (companyLookupRows.length === 1 && companyLookupRows[0].legal_entity_id !== null) beforeNoGoReasons.push("Company legal_entity_id must remain null.");
    if (companyIdLookupRows.length !== 1) beforeNoGoReasons.push("Resolved company_id must exist with cardinality 1.");

    pilotWriteBeforeDecision = classifyDecision(beforeNoGoReasons, beforePartialReasons);
    const beforeEvidence22BH = {
      phase: "22BH-R2",
      timestamp: new Date().toISOString(),
      targetRef: EXPECTED_TARGET_REF,
      targetName: EXPECTED_TARGET_NAME,
      batchId: EXPECTED_BATCH_ID,
      generalAuthorizationValid,
      pilotAuthorizationValid,
      pilotEntity: "contacts",
      pilotPayloadPath: args.pilotPayload || null,
      payloadUsed: {
        source: EXPECTED_CONTACTS_PILOT_PAYLOAD.source,
        temp_key: EXPECTED_CONTACTS_PILOT_PAYLOAD.temp_key,
        tenant_id: candidateTenantId,
        first_name: candidateFirstName,
        email: candidateEmail,
        company_temp_key: EXPECTED_CONTACTS_PILOT_PAYLOAD.company_temp_key,
        company_id_policy: EXPECTED_CONTACTS_PILOT_PAYLOAD.company_id_policy,
        write_contact_in_same_phase: EXPECTED_CONTACTS_PILOT_PAYLOAD.write_contact_in_same_phase,
      },
      contactsCountBefore,
      companiesCountBefore,
      lookupCompanyByTenantCnpj: companyLookupRows,
      resolvedCompanyId: companyLookupRows[0]?.id || null,
      lookupByTenantCompanyEmail: lookupByKeyBefore,
      lookupByEmail: lookupByEmailBefore,
      tenantLookup,
      idempotencyKeyValidation: {
        unique_tenant_company_email_index: contactsUniqueTenantCompanyEmailPresent,
      },
      requiredFieldsValidation: {
        tenant_id_required: contactsTenantRequired === true,
        first_name_required: contactsFirstNameRequired === true,
        email_present: contactsEmailPresent === true,
        company_id_present: contactsCompanyIdPresent === true,
      },
      omittedFieldsValidation: {
        owner_id_omitted_or_null: true,
        created_by_omitted_or_null: true,
      },
      companyContactsReferenceOnly: {
        regclass: companyContactsLookup[0]?.regclass ?? null,
        reference_only: companyContactsLookup[0]?.regclass === null,
      },
      companiesWriteBlocked: true,
      beforeDecision: pilotWriteBeforeDecision,
      reasons: {
        noGoReasons: beforeNoGoReasons,
        partialReasons: beforePartialReasons,
      },
    };
    fs.writeFileSync(pilotWriteBeforePath, JSON.stringify(beforeEvidence22BH, null, 2), "utf8");

    let writeResult = { operation: "aborted", record: null, resolvedCompany: null, inserted: false };
    if (pilotWriteBeforeDecision === "GO") {
      try {
        writeResult = executeContactsPilotWrite({
          pilotEntity: selectedPilotEntity,
          pilotAuthorization: args.pilotAuthorization,
          tenant_id: candidateTenantId,
          first_name: candidateFirstName,
          email: candidateEmail,
          company_temp_key: EXPECTED_CONTACTS_PILOT_PAYLOAD.company_temp_key,
          company_id_policy: EXPECTED_CONTACTS_PILOT_PAYLOAD.company_id_policy,
          write_contact_in_same_phase: EXPECTED_CONTACTS_PILOT_PAYLOAD.write_contact_in_same_phase,
          company_lookup_cnpj: candidateCompanyCnpj,
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
          resolvedCompany: null,
          inserted: false,
        };
      }
    }

    let contactsCountAfter = null;
    let companiesCountAfter = null;
    let rowsByKeyAfter = [];
    let duplicateByKeyCount = null;
    let companyContactsAfter = [];
    let companyLookupAfter = [];
    try {
      const afterRows = runSupabaseDbQuery("select count(*)::bigint as total_rows from public.contacts");
      contactsCountAfter = Number(afterRows[0]?.total_rows || 0);
    } catch {}
    try {
      const companyAfterRows = runSupabaseDbQuery("select count(*)::bigint as total_rows from public.companies");
      companiesCountAfter = Number(companyAfterRows[0]?.total_rows || 0);
    } catch {}
    try {
      rowsByKeyAfter = runSupabaseDbQuery(`
        select id, tenant_id, company_id, first_name, email, owner_id, created_by
        from public.contacts
        where tenant_id='${escapeSqlLiteral(candidateTenantId)}'
          and company_id='${escapeSqlLiteral(candidateCompanyId)}'
          and email='${escapeSqlLiteral(candidateEmail)}'
      `);
    } catch {}
    try {
      const dupRows = runSupabaseDbQuery(`
        select count(*)::bigint as duplicate_count
        from public.contacts
        where tenant_id='${escapeSqlLiteral(candidateTenantId)}'
          and company_id='${escapeSqlLiteral(candidateCompanyId)}'
          and email='${escapeSqlLiteral(candidateEmail)}'
      `);
      duplicateByKeyCount = Number(dupRows[0]?.duplicate_count || 0);
    } catch {}
    try {
      companyLookupAfter = runSupabaseDbQuery(`
        select id, tenant_id, cnpj, name, owner_id, sales_rep_id, legal_entity_id
        from public.companies
        where id='${escapeSqlLiteral(candidateCompanyId)}'
      `);
    } catch {}
    try {
      companyContactsAfter = runSupabaseDbQuery("select to_regclass('public.company_contacts') as regclass");
    } catch {}

    pilotWriteOperation = writeResult.operation;
    pilotWriteRecord = rowsByKeyAfter[0] || writeResult.record || null;
    pilotWriteDelta = contactsCountAfter !== null && contactsCountBefore !== null ? contactsCountAfter - contactsCountBefore : null;
    recordsAffected = writeResult.record ? [writeResult.record] : [];

    const afterNoGoReasons = [];
    const afterPartialReasons = [];
    if (pilotWriteBeforeDecision !== "GO") afterNoGoReasons.push("beforeDecision is not GO.");
    if (writeResult.operation === "aborted") afterNoGoReasons.push("Pilot operation aborted.");
    if (!["inserted", "idempotent_noop"].includes(writeResult.operation)) afterNoGoReasons.push("Unexpected pilot operation result.");
    if (writeResult.operation === "inserted" && pilotWriteDelta !== 1) afterNoGoReasons.push("Delta must be 1 for inserted operation.");
    if (writeResult.operation === "idempotent_noop" && pilotWriteDelta !== 0) afterNoGoReasons.push("Delta must be 0 for idempotent_noop.");
    if (!rowsByKeyAfter.length) afterNoGoReasons.push("No row found by (tenant_id, company_id, email) after execution.");
    if ((duplicateByKeyCount ?? 0) !== 1) afterNoGoReasons.push("Expected exactly one row for (tenant_id, company_id, email) after execution.");
    if (companiesCountAfter !== companiesCountBefore) afterNoGoReasons.push("companies count changed unexpectedly.");
    if (companyLookupAfter.length !== 1) afterNoGoReasons.push("Referenced company_id must still exist with cardinality 1.");
    if (companyContactsAfter[0]?.regclass !== null) afterNoGoReasons.push("company_contacts must remain non-writable.");
    if (rowsByKeyAfter.length === 1) {
      const row = rowsByKeyAfter[0];
      if (row.tenant_id !== candidateTenantId) afterNoGoReasons.push("After tenant_id mismatch.");
      if (row.company_id !== candidateCompanyId) afterNoGoReasons.push("After company_id mismatch.");
      if (row.first_name !== candidateFirstName && row.first_name !== candidateFirstName.toUpperCase()) {
        afterNoGoReasons.push("After first_name mismatch.");
      }
      if (row.email !== candidateEmail) afterNoGoReasons.push("After email mismatch.");
      if (row.owner_id !== null) afterNoGoReasons.push("owner_id must remain null.");
      if (row.created_by !== null) afterNoGoReasons.push("created_by must remain null.");
    }
    pilotWriteAfterDecision = classifyDecision(afterNoGoReasons, afterPartialReasons);

    const afterEvidence22BH = {
      phase: "22BH-R2",
      timestamp: new Date().toISOString(),
      targetRef: EXPECTED_TARGET_REF,
      targetName: EXPECTED_TARGET_NAME,
      batchId: EXPECTED_BATCH_ID,
      operationExecuted: writeResult.operation,
      contactsCountAfter,
      companiesCountAfter,
      delta: pilotWriteDelta,
      recordByTenantCompanyEmail: rowsByKeyAfter,
      recordId: rowsByKeyAfter[0]?.id || null,
      tenant_id: candidateTenantId,
      company_id: candidateCompanyId,
      first_name: candidateFirstName,
      email: candidateEmail,
      referencedCompanyExists: companyLookupAfter.length === 1,
      companiesNotWritten: companiesCountAfter === companiesCountBefore,
      companyContactsNotWritten: companyContactsAfter[0]?.regclass === null,
      uniqueTenantCompanyEmailDuplicateCount: duplicateByKeyCount,
      scopeConfirmation: {
        singleEntityExecution: true,
        touchedEntity: "contacts",
        companiesTouched: false,
        companyContactsTouched: false,
        salesRepsTouched: false,
        profilesTouched: false,
        transactionalTouched: false,
        queueTouched: false,
        externalIntegrationsCalled: false,
        expandedExecutionBlocked: true,
        noOtherEntityTouched: true,
      },
      executionExpandedBlocked: true,
      afterDecision: pilotWriteAfterDecision,
      reasons: {
        noGoReasons: afterNoGoReasons,
        partialReasons: afterPartialReasons,
      },
      finalMessage: phase22BHStopAfterPilotMessage,
    };
    fs.writeFileSync(pilotWriteAfterPath, JSON.stringify(afterEvidence22BH, null, 2), "utf8");
  } else if (companiesContactsWavePilotMode) {
    pilotWriteBeforePath = path.join(phase22BLDir, `before-${nowStamp()}.json`);
    pilotWriteAfterPath = path.join(phase22BLDir, `after-${nowStamp()}.json`);
    const beforeNoGoReasons = [];
    const beforePartialReasons = [];

    const generalAuthorizationValid = args.authorization === EXPECTED_AUTHORIZATION;
    const pilotAuthorizationValid = args.pilotAuthorization === EXPECTED_COMPANIES_CONTACTS_WAVE_PILOT_AUTHORIZATION;
    const payloadValidated = pilotPayloadParsed && pilotPayloadValidationErrors.length === 0;
    const frozenWave = pilotPayloadJson?.selectedWave;
    const selectedPairs = Array.isArray(frozenWave?.pairs) ? frozenWave.pairs : [];
    const expectedTenantId = "00000000-0000-0000-0000-000000000001";

    let companiesCountBefore = null;
    let contactsCountBefore = null;
    let tenantLookup = [];
    let companyContactsLookup = [];
    let companiesIndexesLookup = [];
    let contactsIndexesLookup = [];
    let companyLookupsByTenantCnpj = [];
    let contactLookupsByEmail = [];
    let negativeScopeBefore = {};

    try {
      const rows = runSupabaseDbQuery("select count(*)::bigint as total_rows from public.companies");
      companiesCountBefore = Number(rows[0]?.total_rows || 0);
    } catch {
      beforeNoGoReasons.push("Unable to read companies count before wave write.");
    }
    try {
      const rows = runSupabaseDbQuery("select count(*)::bigint as total_rows from public.contacts");
      contactsCountBefore = Number(rows[0]?.total_rows || 0);
    } catch {
      beforeNoGoReasons.push("Unable to read contacts count before wave write.");
    }
    try {
      tenantLookup = runSupabaseDbQuery(
        `select id from public.tenants where id='${escapeSqlLiteral(expectedTenantId)}'`,
      );
    } catch {
      beforeNoGoReasons.push("Unable to validate tenant existence before wave write.");
    }
    try {
      companyContactsLookup = runSupabaseDbQuery("select to_regclass('public.company_contacts') as regclass");
    } catch {
      beforeNoGoReasons.push("Unable to validate company_contacts reference-only status before wave write.");
    }
    try {
      companiesIndexesLookup = runSupabaseDbQuery(`
        select indexname
        from pg_indexes
        where schemaname='public'
          and tablename='companies'
          and indexname in ('idx_companies_tenant_cnpj','idx_companies_cnpj_unique')
      `);
      contactsIndexesLookup = runSupabaseDbQuery(`
        select indexname
        from pg_indexes
        where schemaname='public'
          and tablename='contacts'
          and indexname='idx_contacts_tenant_company_email_unique'
      `);
    } catch {
      beforeNoGoReasons.push("Unable to validate idempotency indexes before wave write.");
    }
    try {
      negativeScopeBefore = {
        sales_reps: Number(runSupabaseDbQuery("select count(*)::bigint as total_rows from public.sales_reps")[0]?.total_rows || 0),
        products: Number(runSupabaseDbQuery("select count(*)::bigint as total_rows from public.products")[0]?.total_rows || 0),
        deals: Number(runSupabaseDbQuery("select count(*)::bigint as total_rows from public.deals")[0]?.total_rows || 0),
        orders: Number(runSupabaseDbQuery("select count(*)::bigint as total_rows from public.orders")[0]?.total_rows || 0),
        proposals: Number(runSupabaseDbQuery("select count(*)::bigint as total_rows from public.proposals")[0]?.total_rows || 0),
      };
    } catch {
      beforeNoGoReasons.push("Unable to collect negative scope baseline counts before wave write.");
    }

    const companiesSelected = Array.isArray(frozenWave?.companiesSelected) ? frozenWave.companiesSelected : [];
    const contactsSelected = Array.isArray(frozenWave?.contactsSelected) ? frozenWave.contactsSelected : [];
    const companiesByTempKey = new Map(companiesSelected.map((row) => [row.temp_key, row]));
    const contactsByTempKey = new Map(contactsSelected.map((row) => [row.temp_key, row]));
    for (const pair of selectedPairs) {
      const company = companiesByTempKey.get(pair.company_temp_key);
      const contact = contactsByTempKey.get(pair.contact_temp_key);
      let lookupCompanyByKey = [];
      let lookupContactByEmail = [];
      try {
        lookupCompanyByKey = runSupabaseDbQuery(`
          select id, tenant_id, name, cnpj, owner_id, sales_rep_id, legal_entity_id, created_by
          from public.companies
          where tenant_id='${escapeSqlLiteral(company?.tenant_id || "")}'
            and cnpj='${escapeSqlLiteral(company?.cnpj || "")}'
        `);
      } catch {
        beforeNoGoReasons.push(`Unable to lookup company by (tenant_id, cnpj) for ${pair.company_temp_key}.`);
      }
      try {
        lookupContactByEmail = runSupabaseDbQuery(`
          select id, tenant_id, company_id, first_name, email, owner_id, created_by
          from public.contacts
          where email='${escapeSqlLiteral(contact?.email || "")}'
        `);
      } catch {
        beforeNoGoReasons.push(`Unable to lookup contact by email for ${pair.contact_temp_key}.`);
      }
      companyLookupsByTenantCnpj.push({
        company_temp_key: pair.company_temp_key,
        rows: lookupCompanyByKey,
        cardinality: lookupCompanyByKey.length,
      });
      contactLookupsByEmail.push({
        contact_temp_key: pair.contact_temp_key,
        rows: lookupContactByEmail,
        cardinality: lookupContactByEmail.length,
      });
    }

    if (!args.write) beforeNoGoReasons.push("--write is required for 22BL-R2 wave execution.");
    if (!args.executePilotWrite) beforeNoGoReasons.push("--execute-pilot-write is required for 22BL-R2 wave execution.");
    if (activePilotEntity !== "companies_contacts_wave") beforeNoGoReasons.push("Pilot entity must be companies_contacts_wave.");
    if (!generalAuthorizationValid) beforeNoGoReasons.push("General authorization is invalid.");
    if (!pilotAuthorizationValid) beforeNoGoReasons.push("Wave authorization is invalid.");
    if (!payloadValidated) beforeNoGoReasons.push("Frozen wave payload is not validated.");
    if (args.expectedTarget !== EXPECTED_TARGET_REF || localTargetRef !== EXPECTED_TARGET_REF) {
      beforeNoGoReasons.push("Target ref mismatch.");
    }
    if (localTargetName !== EXPECTED_TARGET_NAME) beforeNoGoReasons.push("Target name mismatch.");
    if (args.batch !== EXPECTED_BATCH_ID) beforeNoGoReasons.push("Batch mismatch.");
    if (pilotDecisionFinal === "NO-GO") beforeNoGoReasons.push("pilot_validation_decision is NO-GO.");
    if (blockedEntitiesFound.length > 0) beforeNoGoReasons.push("Blocked entities detected.");
    if (args.forbiddenFlags.length > 0 || args.unknownFlags.length > 0) beforeNoGoReasons.push("Forbidden/unknown flags detected.");
    if (tenantLookup.length !== 1) beforeNoGoReasons.push("Pilot tenant must exist with cardinality 1.");
    if (companyContactsLookup[0]?.regclass !== null) beforeNoGoReasons.push("company_contacts must remain reference-only/non-writable.");
    if (companiesCountBefore !== 1) beforeNoGoReasons.push("companies count before wave must be exactly 1.");
    if (contactsCountBefore !== 1) beforeNoGoReasons.push("contacts count before wave must be exactly 1.");
    if (Number(frozenWave?.limit) !== 4) beforeNoGoReasons.push("Wave limit must be 4.");
    if (selectedPairs.length !== 4) beforeNoGoReasons.push("Wave must include exactly 4 pairs.");
    if (companiesIndexesLookup.length < 2) beforeNoGoReasons.push("Required companies idempotency indexes are missing.");
    if (contactsIndexesLookup.length < 1) beforeNoGoReasons.push("Required contacts idempotency index is missing.");
    if (companyLookupsByTenantCnpj.some((item) => item.cardinality !== 0)) {
      beforeNoGoReasons.push("Initial company collision detected for frozen wave candidates.");
    }
    if (contactLookupsByEmail.some((item) => item.cardinality !== 0)) {
      beforeNoGoReasons.push("Initial contact collision detected for frozen wave candidates.");
    }
    if (companiesTenantRequired !== true) beforeNoGoReasons.push("companies.tenant_id must remain required.");
    if (companiesNameRequired !== true) beforeNoGoReasons.push("companies.name must remain required.");
    if (companiesCnpjIsText !== true) beforeNoGoReasons.push("companies.cnpj must remain text.");
    if (companiesOwnerNullable !== true) beforeNoGoReasons.push("companies.owner_id must remain nullable/omittable.");
    if (companiesSalesRepNullable !== true) beforeNoGoReasons.push("companies.sales_rep_id must remain nullable/omittable.");
    if (companiesLegalEntityNullable !== true) beforeNoGoReasons.push("companies.legal_entity_id must remain nullable/omittable.");
    if (companiesCreatedByNullable !== true) beforeNoGoReasons.push("companies.created_by must remain nullable/omittable.");
    if (contactsTenantRequired !== true) beforeNoGoReasons.push("contacts.tenant_id must remain required.");
    if (contactsFirstNameRequired !== true) beforeNoGoReasons.push("contacts.first_name must remain required.");
    if (contactsEmailPresent !== true) beforeNoGoReasons.push("contacts.email column must exist.");
    if (contactsCompanyIdPresent !== true) beforeNoGoReasons.push("contacts.company_id column must exist.");
    if (contactsCompanyFkPresent !== true) beforeNoGoReasons.push("contacts.company_id FK must exist.");

    pilotWriteBeforeDecision = classifyDecision(beforeNoGoReasons, beforePartialReasons);
    const beforeEvidence22BL = {
      phase: "22BL-R2",
      timestamp: new Date().toISOString(),
      targetRef: EXPECTED_TARGET_REF,
      targetName: EXPECTED_TARGET_NAME,
      batchId: EXPECTED_BATCH_ID,
      generalAuthorizationValid,
      pilotAuthorizationValid,
      pilotEntity: "companies_contacts_wave",
      pilotPayloadPath: args.pilotPayload || null,
      payloadFrozen: pilotPayloadJson || null,
      waveLimit: Number(frozenWave?.limit ?? null),
      selectedPairs,
      companiesCountBefore,
      contactsCountBefore,
      lookupCompaniesByTenantCnpj: companyLookupsByTenantCnpj,
      lookupContactsByEmail: contactLookupsByEmail,
      idempotencyKeyValidation: {
        companies_unique_tenant_cnpj: companiesIndexesLookup.some((r) => r.indexname === "idx_companies_tenant_cnpj"),
        companies_unique_cnpj: companiesIndexesLookup.some((r) => r.indexname === "idx_companies_cnpj_unique"),
        contacts_unique_tenant_company_email: contactsIndexesLookup.some(
          (r) => r.indexname === "idx_contacts_tenant_company_email_unique",
        ),
      },
      tenantValidation: {
        tenant_id: expectedTenantId,
        cardinality: tenantLookup.length,
      },
      requiredFieldsValidation: {
        companies_tenant_required: companiesTenantRequired === true,
        companies_name_required: companiesNameRequired === true,
        contacts_tenant_required: contactsTenantRequired === true,
        contacts_first_name_required: contactsFirstNameRequired === true,
        contacts_email_present: contactsEmailPresent === true,
        contacts_company_id_present: contactsCompanyIdPresent === true,
      },
      omittedFieldsValidation: {
        companies_owner_id_omitted_or_null: companiesOwnerNullable === true,
        companies_sales_rep_id_omitted_or_null: companiesSalesRepNullable === true,
        companies_legal_entity_id_omitted_or_null: companiesLegalEntityNullable === true,
        companies_created_by_omitted_or_null: companiesCreatedByNullable === true,
        contacts_owner_id_omitted_or_null: true,
        contacts_created_by_omitted_or_null: true,
      },
      companyContactsReferenceOnly: {
        regclass: companyContactsLookup[0]?.regclass ?? null,
        reference_only: companyContactsLookup[0]?.regclass === null,
      },
      negativeScopeBefore,
      beforeDecision: pilotWriteBeforeDecision,
      reasons: {
        noGoReasons: beforeNoGoReasons,
        partialReasons: beforePartialReasons,
      },
    };
    fs.writeFileSync(pilotWriteBeforePath, JSON.stringify(beforeEvidence22BL, null, 2), "utf8");

    let writeResult = {
      operation: "aborted",
      error: "beforeDecision_not_go",
      pairOperations: [],
      insertedCompanies: [],
      insertedContacts: [],
      companyIds: {},
      contactIds: {},
      failedPair: null,
    };
    if (pilotWriteBeforeDecision === "GO") {
      try {
        writeResult = executeCompaniesContactsWaveWrite({
          pilotEntity: selectedPilotEntity,
          pilotAuthorization: args.pilotAuthorization,
          expectedTargetRef: args.expectedTarget,
          expectedTargetName: localTargetName,
          batchId: args.batch,
          localTargetRef,
          localTargetName,
          wavePayload: pilotPayloadJson,
        });
      } catch (error) {
        writeResult = {
          operation: "aborted",
          error: error instanceof Error ? error.message : String(error),
          pairOperations: [],
          insertedCompanies: [],
          insertedContacts: [],
          companyIds: {},
          contactIds: {},
          failedPair: null,
        };
      }
    }

    let companiesCountAfter = null;
    let contactsCountAfter = null;
    let companyContactsAfter = [];
    let negativeScopeAfter = {};
    const recordsByCompany = [];
    const recordsByContact = [];
    const linksValidation = [];
    const companiesSelectedAfter = Array.isArray(frozenWave?.companiesSelected) ? frozenWave.companiesSelected : [];
    const contactsSelectedAfter = Array.isArray(frozenWave?.contactsSelected) ? frozenWave.contactsSelected : [];
    const contactByTempKey = new Map(contactsSelectedAfter.map((row) => [row.temp_key, row]));

    try {
      const rows = runSupabaseDbQuery("select count(*)::bigint as total_rows from public.companies");
      companiesCountAfter = Number(rows[0]?.total_rows || 0);
    } catch {}
    try {
      const rows = runSupabaseDbQuery("select count(*)::bigint as total_rows from public.contacts");
      contactsCountAfter = Number(rows[0]?.total_rows || 0);
    } catch {}
    try {
      companyContactsAfter = runSupabaseDbQuery("select to_regclass('public.company_contacts') as regclass");
    } catch {}
    try {
      negativeScopeAfter = {
        sales_reps: Number(runSupabaseDbQuery("select count(*)::bigint as total_rows from public.sales_reps")[0]?.total_rows || 0),
        products: Number(runSupabaseDbQuery("select count(*)::bigint as total_rows from public.products")[0]?.total_rows || 0),
        deals: Number(runSupabaseDbQuery("select count(*)::bigint as total_rows from public.deals")[0]?.total_rows || 0),
        orders: Number(runSupabaseDbQuery("select count(*)::bigint as total_rows from public.orders")[0]?.total_rows || 0),
        proposals: Number(runSupabaseDbQuery("select count(*)::bigint as total_rows from public.proposals")[0]?.total_rows || 0),
      };
    } catch {}

    for (const row of companiesSelectedAfter) {
      try {
        const fetched = runSupabaseDbQuery(`
          select id, tenant_id, name, cnpj, owner_id, sales_rep_id, legal_entity_id, created_by
          from public.companies
          where tenant_id='${escapeSqlLiteral(row.tenant_id)}'
            and cnpj='${escapeSqlLiteral(row.cnpj)}'
        `);
        recordsByCompany.push({
          temp_key: row.temp_key,
          expected_persisted_name: row.expected_persisted_name,
          cardinality: fetched.length,
          rows: fetched,
        });
      } catch {
        recordsByCompany.push({ temp_key: row.temp_key, expected_persisted_name: row.expected_persisted_name, cardinality: -1, rows: [] });
      }
    }
    for (const row of contactsSelectedAfter) {
      try {
        const companyId = writeResult.companyIds?.[row.company_temp_key] || null;
        const fetched = companyId
          ? runSupabaseDbQuery(`
              select id, tenant_id, company_id, first_name, email, owner_id, created_by
              from public.contacts
              where tenant_id='${escapeSqlLiteral(row.tenant_id)}'
                and company_id='${escapeSqlLiteral(companyId)}'
                and email='${escapeSqlLiteral(row.email)}'
            `)
          : runSupabaseDbQuery(`
              select id, tenant_id, company_id, first_name, email, owner_id, created_by
              from public.contacts
              where tenant_id='${escapeSqlLiteral(row.tenant_id)}'
                and email='${escapeSqlLiteral(row.email)}'
            `);
        recordsByContact.push({
          temp_key: row.temp_key,
          company_temp_key: row.company_temp_key,
          expected_persisted_first_name: row.expected_persisted_first_name,
          cardinality: fetched.length,
          rows: fetched,
        });
      } catch {
        recordsByContact.push({
          temp_key: row.temp_key,
          company_temp_key: row.company_temp_key,
          expected_persisted_first_name: row.expected_persisted_first_name,
          cardinality: -1,
          rows: [],
        });
      }
    }
    for (const pairState of writeResult.pairOperations || []) {
      const contactMeta = contactByTempKey.get(pairState.contact_temp_key);
      if (!pairState.company_id || !contactMeta) continue;
      try {
        const linkRows = runSupabaseDbQuery(`
          select c.id as contact_id, c.company_id, co.id as company_id_ref
          from public.contacts c
          left join public.companies co on co.id = c.company_id
          where c.id='${escapeSqlLiteral(pairState.contact_id || "")}'
            and c.company_id='${escapeSqlLiteral(pairState.company_id)}'
            and c.email='${escapeSqlLiteral(contactMeta.email)}'
        `);
        linksValidation.push({
          company_temp_key: pairState.company_temp_key,
          contact_temp_key: pairState.contact_temp_key,
          linked: linkRows.length === 1 && linkRows[0]?.company_id_ref === pairState.company_id,
          rows: linkRows,
        });
      } catch {
        linksValidation.push({
          company_temp_key: pairState.company_temp_key,
          contact_temp_key: pairState.contact_temp_key,
          linked: false,
          rows: [],
        });
      }
    }

    pilotWriteOperation = writeResult.operation;
    pilotWriteRecord = writeResult.failedPair || null;
    pilotWriteDelta =
      companiesCountAfter !== null && companiesCountBefore !== null
        ? companiesCountAfter - companiesCountBefore
        : null;
    recordsAffected = Array.isArray(writeResult.pairOperations) ? writeResult.pairOperations : [];
    const contactsDelta =
      contactsCountAfter !== null && contactsCountBefore !== null
        ? contactsCountAfter - contactsCountBefore
        : null;

    const afterNoGoReasons = [];
    const afterPartialReasons = [];
    if (pilotWriteBeforeDecision !== "GO") afterNoGoReasons.push("beforeDecision is not GO.");
    if (writeResult.operation === "aborted") afterNoGoReasons.push(writeResult.error || "Wave operation aborted.");
    if (writeResult.operation === "partial_aborted") afterPartialReasons.push(writeResult.error || "Wave operation stopped with partial writes.");
    if (!["completed", "partial_aborted", "aborted"].includes(writeResult.operation)) {
      afterNoGoReasons.push("Unexpected wave operation result.");
    }
    if (writeResult.operation === "completed" && pilotWriteDelta !== 4) afterNoGoReasons.push("companies delta must be +4 for completed wave.");
    if (writeResult.operation === "completed" && contactsDelta !== 4) afterNoGoReasons.push("contacts delta must be +4 for completed wave.");
    if (writeResult.operation === "partial_aborted" && (pilotWriteDelta === null || contactsDelta === null)) {
      afterNoGoReasons.push("Unable to compute deltas for partial wave result.");
    }
    if (companyContactsAfter[0]?.regclass !== null) afterNoGoReasons.push("company_contacts must remain non-writable.");
    if (recordsByCompany.some((item) => item.cardinality !== 1)) afterNoGoReasons.push("Each wave company must have cardinality 1 after execution.");
    if (recordsByContact.some((item) => item.cardinality !== 1)) afterNoGoReasons.push("Each wave contact must have cardinality 1 after execution.");
    for (const item of recordsByCompany) {
      const row = item.rows[0];
      if (!row) continue;
      if (row.name !== item.expected_persisted_name) afterNoGoReasons.push(`Uppercase name validation failed for ${item.temp_key}.`);
      if (row.owner_id !== null || row.sales_rep_id !== null || row.legal_entity_id !== null || row.created_by !== null) {
        afterNoGoReasons.push(`Forbidden company dependent fields changed for ${item.temp_key}.`);
      }
    }
    for (const item of recordsByContact) {
      const row = item.rows[0];
      if (!row) continue;
      if (row.first_name !== item.expected_persisted_first_name) {
        afterNoGoReasons.push(`Uppercase first_name validation failed for ${item.temp_key}.`);
      }
      if (row.owner_id !== null || row.created_by !== null) {
        afterNoGoReasons.push(`Forbidden contact dependent fields changed for ${item.temp_key}.`);
      }
    }
    if (linksValidation.some((item) => item.linked !== true)) afterNoGoReasons.push("At least one contact->company link is invalid.");
    if (
      Object.keys(negativeScopeBefore).length > 0 &&
      Object.keys(negativeScopeAfter).length > 0 &&
      JSON.stringify(negativeScopeBefore) !== JSON.stringify(negativeScopeAfter)
    ) {
      afterNoGoReasons.push("Negative scope counts changed unexpectedly.");
    }

    pilotWriteAfterDecision = classifyDecision(afterNoGoReasons, afterPartialReasons);
    const afterEvidence22BL = {
      phase: "22BL-R2",
      timestamp: new Date().toISOString(),
      targetRef: EXPECTED_TARGET_REF,
      targetName: EXPECTED_TARGET_NAME,
      batchId: EXPECTED_BATCH_ID,
      operationByPair: writeResult.pairOperations || [],
      companiesIds: writeResult.companyIds || {},
      contactsIds: writeResult.contactIds || {},
      companiesDelta: pilotWriteDelta,
      contactsDelta,
      companiesCountAfter,
      contactsCountAfter,
      recordsByCompany,
      recordsByContact,
      uppercaseValidation: {
        companies_name_uppercase: recordsByCompany.every((item) => item.rows[0]?.name === item.expected_persisted_name),
        contacts_first_name_uppercase: recordsByContact.every(
          (item) => item.rows[0]?.first_name === item.expected_persisted_first_name,
        ),
      },
      idempotencyValidation: {
        companies: recordsByCompany.map((item) => ({
          temp_key: item.temp_key,
          cardinality: item.cardinality,
          operation: (writeResult.pairOperations || []).find((x) => x.company_temp_key === item.temp_key)?.company_operation || "unknown",
        })),
        contacts: recordsByContact.map((item) => ({
          temp_key: item.temp_key,
          cardinality: item.cardinality,
          operation: (writeResult.pairOperations || []).find((x) => x.contact_temp_key === item.temp_key)?.contact_operation || "unknown",
        })),
      },
      linksValidation,
      companyContactsNotWritten: companyContactsAfter[0]?.regclass === null,
      negativeScopeBefore,
      negativeScopeAfter,
      executionExpandedBlocked: true,
      afterDecision: pilotWriteAfterDecision,
      reasons: {
        noGoReasons: afterNoGoReasons,
        partialReasons: afterPartialReasons,
      },
      finalMessage: phase22BLStopAfterPilotMessage,
    };
    fs.writeFileSync(pilotWriteAfterPath, JSON.stringify(afterEvidence22BL, null, 2), "utf8");
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
      selectedPilotEntity === "product_subgroups" ||
      selectedPilotEntity === "product_families" ||
      selectedPilotEntity === "product_classes" ||
      selectedPilotEntity === "companies" ||
      selectedPilotEntity === "companies_contacts_wave" ||
      selectedPilotEntity === "contacts"
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
      : selectedPilotEntity === "product_families"
        ? phase22AZStopAfterPilotMessage
      : selectedPilotEntity === "product_classes"
        ? phase22BBStopAfterPilotMessage
      : selectedPilotEntity === "companies"
        ? phase22BGStopAfterPilotMessage
      : selectedPilotEntity === "contacts"
        ? phase22BHStopAfterPilotMessage
      : selectedPilotEntity === "companies_contacts_wave"
        ? phase22BLStopAfterPilotMessage
      : phase22SHardStopMessage,
  );
  console.log(
    selectedPilotEntity === "product_types"
      ? phase22AFStopAfterPilotMessage
      : selectedPilotEntity === "product_groups"
        ? phase22AMStopAfterPilotMessage
      : selectedPilotEntity === "product_subgroups"
        ? phase22ATStopAfterPilotMessage
      : selectedPilotEntity === "product_families"
        ? phase22AZStopAfterPilotMessage
      : selectedPilotEntity === "product_classes"
        ? phase22BBStopAfterPilotMessage
      : selectedPilotEntity === "companies"
        ? phase22BGStopAfterPilotMessage
      : selectedPilotEntity === "contacts"
        ? phase22BHStopAfterPilotMessage
      : selectedPilotEntity === "companies_contacts_wave"
        ? phase22BLStopAfterPilotMessage
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
