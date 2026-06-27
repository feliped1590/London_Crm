#!/usr/bin/env node
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const AUTHORIZED_TARGET = "nsnmlleplpzsefzkuxlb";
const STAGING_TARGET = "cansbrrwrprcycjvgvqm";
const INVALID_TARGET = "nazymjfzjadfgovcfivs";
const BATCH_ID = "baseline_22f_r2_restore_test_qualyvac";
const TMP_PREFIX = "TMP-22F-R2-";

const BLOCKED_ENTITIES = [
  "deals",
  "deal_stage_history",
  "proposals",
  "sales_proposals",
  "proposal_items",
  "sales_proposal_items",
  "orders",
  "order_items",
  "product_sync_queue",
  "order_sync_queue",
  "audit_events",
  "user_sessions",
  "session_login_history",
];

const TABLE_FIELD_MAP = {
  legal_entities: {
    label: "name",
    code: "erp_company_code",
    required: ["tenant_id", "name"],
    warning: ["erp_company_code", "cnpj"],
  },
  profiles: {
    label: "full_name",
    code: "erp_user_code",
    required: ["user_id", "full_name"],
    warning: ["email", "active_tenant_id", "active_legal_entity_id", "erp_user_code"],
  },
  sales_reps: {
    label: "name",
    code: "erp_vendor_code",
    required: ["name", "tenant_id"],
    warning: ["email", "erp_vendor_code", "active"],
  },
  user_tenants: {
    label: "role",
    code: null,
    required: ["user_id", "tenant_id", "role"],
    warning: [],
  },
  user_legal_entities: {
    label: "role",
    code: null,
    required: ["user_id", "tenant_id", "legal_entity_id", "role"],
    warning: [],
  },
  user_sales_reps: {
    label: "is_default",
    code: null,
    required: ["user_id", "sales_rep_id"],
    warning: ["is_default"],
  },
  companies: {
    label: "name",
    code: "erp_code",
    required: ["name", "tenant_id"],
    warning: ["cnpj", "owner_id", "sales_rep_id", "legal_entity_id", "erp_code"],
  },
  contacts: {
    label: "first_name",
    code: "erp_contact_code",
    required: ["first_name", "tenant_id"],
    warning: ["last_name", "email", "company_id", "erp_contact_code"],
  },
  company_contacts: {
    label: null,
    code: null,
    required: ["company_id", "contact_id"],
    warning: [],
    optional_table: true,
  },
  product_types: {
    label: "label",
    code: "value",
    required: ["label", "value", "tenant_id"],
    warning: [],
  },
  product_groups: {
    label: "label",
    code: "value",
    required: ["label", "value", "tenant_id"],
    warning: [],
  },
  product_subgroups: {
    label: "label",
    code: "value",
    required: ["label", "value", "tenant_id"],
    warning: [],
  },
  product_families: {
    label: "label",
    code: "value",
    required: ["label", "value", "tenant_id"],
    warning: [],
  },
  product_classes: {
    label: "label",
    code: "value",
    required: ["label", "value", "tenant_id"],
    warning: [],
  },
  products: {
    label: "name",
    code: "erp_product_code",
    required: ["sku", "name", "tenant_id"],
    warning: ["erp_product_code", "tipo_id", "grupo_id", "subgrupo_id", "family_id", "class_id", "legal_entity_id"],
  },
};

const INCLUDED_TABLES = Object.keys(TABLE_FIELD_MAP);

const CANDIDATE_TMP_COLUMNS = [
  "name",
  "full_name",
  "first_name",
  "last_name",
  "label",
  "value",
  "code",
  "email",
  "erp_code",
  "erp_company_code",
  "erp_vendor_code",
  "erp_contact_code",
  "erp_user_code",
  "erp_product_code",
  "sku",
  "cnpj",
  "reference",
];

const BASELINE_SIMULATION = {
  legal_entities: [
    { temp_key: "TMP-22F-R2-LEGAL-QUALYVAC", code: "TMP-LE-001", name: "Qualyvac Baseline LE", document_cnpj: "TMP-CNPJ-LE-0001" },
  ],
  profiles: [
    { temp_key: "TMP-22F-R2-PROFILE-ADMIN", email: "tmp.admin.baseline@qualyvac.local", role: "admin" },
    { temp_key: "TMP-22F-R2-PROFILE-SALESOPS", email: "tmp.salesops.baseline@qualyvac.local", role: "sales_ops" },
    { temp_key: "TMP-22F-R2-PROFILE-SALESREP", email: "tmp.salesrep.baseline@qualyvac.local", role: "sales_rep" },
  ],
  sales_reps: [
    { temp_key: "TMP-22F-R2-SALESREP-01", code: "TMP-SR-001", profile_temp_key: "TMP-22F-R2-PROFILE-SALESREP" },
    { temp_key: "TMP-22F-R2-SALESREP-02", code: "TMP-SR-002", profile_temp_key: "TMP-22F-R2-PROFILE-SALESOPS" },
  ],
  user_tenants: [
    { temp_key: "TMP-22F-R2-USERTENANT-ADMIN", profile_temp_key: "TMP-22F-R2-PROFILE-ADMIN" },
    { temp_key: "TMP-22F-R2-USERTENANT-SALESOPS", profile_temp_key: "TMP-22F-R2-PROFILE-SALESOPS" },
    { temp_key: "TMP-22F-R2-USERTENANT-SALESREP", profile_temp_key: "TMP-22F-R2-PROFILE-SALESREP" },
  ],
  user_legal_entities: [
    { temp_key: "TMP-22F-R2-USERLE-ADMIN", profile_temp_key: "TMP-22F-R2-PROFILE-ADMIN", legal_temp_key: "TMP-22F-R2-LEGAL-QUALYVAC" },
    { temp_key: "TMP-22F-R2-USERLE-SALESOPS", profile_temp_key: "TMP-22F-R2-PROFILE-SALESOPS", legal_temp_key: "TMP-22F-R2-LEGAL-QUALYVAC" },
    { temp_key: "TMP-22F-R2-USERLE-SALESREP", profile_temp_key: "TMP-22F-R2-PROFILE-SALESREP", legal_temp_key: "TMP-22F-R2-LEGAL-QUALYVAC" },
  ],
  user_sales_reps: [
    { temp_key: "TMP-22F-R2-USR-SR-01", profile_temp_key: "TMP-22F-R2-PROFILE-SALESREP", sales_rep_temp_key: "TMP-22F-R2-SALESREP-01" },
    { temp_key: "TMP-22F-R2-USR-SR-02", profile_temp_key: "TMP-22F-R2-PROFILE-SALESOPS", sales_rep_temp_key: "TMP-22F-R2-SALESREP-02" },
  ],
  companies: [
    { temp_key: "TMP-22F-R2-COMPANY-01", document: "TMP-DOC-COMP-0001", owner: "TMP-22F-R2-SALESREP-01" },
    { temp_key: "TMP-22F-R2-COMPANY-02", document: "TMP-DOC-COMP-0002", owner: "TMP-22F-R2-SALESREP-01" },
    { temp_key: "TMP-22F-R2-COMPANY-03", document: "TMP-DOC-COMP-0003", owner: "TMP-22F-R2-SALESREP-02" },
    { temp_key: "TMP-22F-R2-COMPANY-04", document: "TMP-DOC-COMP-0004", owner: "TMP-22F-R2-SALESREP-01" },
    { temp_key: "TMP-22F-R2-COMPANY-05", document: "TMP-DOC-COMP-0005", owner: "TMP-22F-R2-SALESREP-02" },
  ],
  contacts: [
    { temp_key: "TMP-22F-R2-CONTACT-01", email: "tmp.contact01@qualyvac.local", company_temp_key: "TMP-22F-R2-COMPANY-01" },
    { temp_key: "TMP-22F-R2-CONTACT-02", email: "tmp.contact02@qualyvac.local", company_temp_key: "TMP-22F-R2-COMPANY-02" },
    { temp_key: "TMP-22F-R2-CONTACT-03", email: "tmp.contact03@qualyvac.local", company_temp_key: "TMP-22F-R2-COMPANY-03" },
    { temp_key: "TMP-22F-R2-CONTACT-04", email: "tmp.contact04@qualyvac.local", company_temp_key: "TMP-22F-R2-COMPANY-04" },
    { temp_key: "TMP-22F-R2-CONTACT-05", email: "tmp.contact05@qualyvac.local", company_temp_key: "TMP-22F-R2-COMPANY-05" },
  ],
  company_contacts: [
    { temp_key: "TMP-22F-R2-COMPANYCONTACT-01", company_temp_key: "TMP-22F-R2-COMPANY-01", contact_temp_key: "TMP-22F-R2-CONTACT-01" },
  ],
  product_types: [{ temp_key: "TMP-22F-R2-PRODTYPE-01", code: "TMP-PT-001", name: "TMP Product Type" }],
  product_groups: [{ temp_key: "TMP-22F-R2-PRODGROUP-01", code: "TMP-PG-001", name: "TMP Product Group" }],
  product_subgroups: [{ temp_key: "TMP-22F-R2-PRODSUBGROUP-01", code: "TMP-PSG-001", name: "TMP Product Subgroup" }],
  product_families: [{ temp_key: "TMP-22F-R2-PRODFAMILY-01", code: "TMP-PF-001", name: "TMP Product Family" }],
  product_classes: [{ temp_key: "TMP-22F-R2-PRODCLASS-01", code: "TMP-PC-001", name: "TMP Product Class" }],
  products: [
    { temp_key: "TMP-22F-R2-PRODUCT-01", sku: "TMP-SKU-0001", name: "TMP Product 01" },
    { temp_key: "TMP-22F-R2-PRODUCT-02", sku: "TMP-SKU-0002", name: "TMP Product 02" },
    { temp_key: "TMP-22F-R2-PRODUCT-03", sku: "TMP-SKU-0003", name: "TMP Product 03" },
    { temp_key: "TMP-22F-R2-PRODUCT-04", sku: "TMP-SKU-0004", name: "TMP Product 04" },
    { temp_key: "TMP-22F-R2-PRODUCT-05", sku: "TMP-SKU-0005", name: "TMP Product 05" },
  ],
};

function parseArgs(argv) {
  const args = { dryRun: false, expectedTarget: "", out: "" };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (token === "--expected-target") {
      args.expectedTarget = argv[i + 1] || "";
      i += 1;
      continue;
    }
    if (token === "--out") {
      args.out = argv[i + 1] || "";
      i += 1;
      continue;
    }
  }
  return args;
}

function nowTimestampCompact(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function readTextFileStrict(filePath) {
  return fs.readFileSync(filePath, "utf8").trim();
}

function runLocalCommand(command) {
  return execSync(command, { encoding: "utf8" }).trim();
}

function isReadOnlySql(sql) {
  const text = sql.trim().toLowerCase();
  if (!(text.startsWith("select") || text.startsWith("with"))) return false;
  const blocked = /\b(insert|update|upsert|delete|truncate|drop|alter|create|grant|revoke|comment|vacuum|analyze|refresh|merge|call|execute)\b/i;
  return !blocked.test(text);
}

function runSupabaseSelect(sql) {
  if (!isReadOnlySql(sql)) {
    throw new Error(`ABORTED: blocked non-read-only SQL -> ${sql}`);
  }
  const normalizedSql = sql.replace(/\s+/g, " ").trim();
  const escapedSql = normalizedSql.replaceAll('"', '\\"');
  const output = execSync(`npx supabase db query --linked -o json "${escapedSql}"`, {
    encoding: "utf8",
  });
  const firstBrace = output.indexOf("{");
  const lastBrace = output.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("Unable to parse Supabase JSON output.");
  }
  const jsonSlice = output.slice(firstBrace, lastBrace + 1);
  const parsed = JSON.parse(jsonSlice);
  if (!parsed || !Array.isArray(parsed.rows)) {
    throw new Error("Supabase JSON output missing rows array.");
  }
  return parsed.rows;
}

function quotedCsv(values) {
  return values.map((v) => `'${v.replaceAll("'", "''")}'`).join(", ");
}

function decideOutcome(input) {
  const reasons = [];
  let decision = "GO";

  if (input.noGoReasons.length > 0) {
    decision = "NO-GO";
    reasons.push(...input.noGoReasons);
    return { decision, reasons };
  }
  if (input.partialReasons.length > 0) {
    decision = "PARCIAL";
    reasons.push(...input.partialReasons);
    return { decision, reasons };
  }
  reasons.push("All dry-run validations passed with read-only checks only.");
  return { decision, reasons };
}

function printSection(title) {
  console.log(`\n=== ${title} ===`);
}

function ensureTargetName(linkedProject) {
  if (linkedProject?.name !== "crm-qualyvac-restore-test") {
    throw new Error(`ABORTED: linked project name is ${linkedProject?.name || "unknown"}, expected crm-qualyvac-restore-test`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.dryRun) {
    console.error("ABORTED: this script only runs with --dry-run");
    process.exit(1);
  }
  if (!args.expectedTarget) {
    console.error("ABORTED: --expected-target is required");
    process.exit(1);
  }
  if (args.expectedTarget !== AUTHORIZED_TARGET) {
    console.error(`ABORTED: --expected-target must be ${AUTHORIZED_TARGET}`);
    process.exit(1);
  }

  const noGoReasons = [];
  const partialReasons = [];
  const warningNotes = [];

  const projectRefPath = path.resolve("supabase/.temp/project-ref");
  const linkedProjectPath = path.resolve("supabase/.temp/linked-project.json");
  if (!fs.existsSync(projectRefPath) || !fs.existsSync(linkedProjectPath)) {
    console.error("ABORTED: missing supabase linked target files in supabase/.temp");
    process.exit(2);
  }

  const linkedTarget = readTextFileStrict(projectRefPath);
  if (linkedTarget !== AUTHORIZED_TARGET) {
    console.error(`ABORTED: linked target is ${linkedTarget}, expected ${AUTHORIZED_TARGET}`);
    process.exit(1);
  }
  if (linkedTarget === STAGING_TARGET || linkedTarget === INVALID_TARGET) {
    console.error(`ABORTED: prohibited linked target detected: ${linkedTarget}`);
    process.exit(1);
  }

  const baselineEntityNames = Object.keys(BASELINE_SIMULATION);
  const blockedInBaseline = baselineEntityNames.filter((e) => BLOCKED_ENTITIES.includes(e));
  if (blockedInBaseline.length > 0) {
    console.error(`ABORTED: blocked transactional entities detected in baseline: ${blockedInBaseline.join(", ")}`);
    process.exit(1);
  }

  const simulatedRecordsCount = {};
  for (const [entity, records] of Object.entries(BASELINE_SIMULATION)) {
    simulatedRecordsCount[entity] = records.length;
  }

  const schemaValidation = {
    found_tables: [],
    missing_tables: [],
    optional_missing_tables: [],
    column_checks: {},
    table_field_map: TABLE_FIELD_MAP,
  };
  const currentCounts = {};
  const tmpPrefixExistingCount = {};

  try {
    const linkedProject = JSON.parse(readTextFileStrict(linkedProjectPath));
    ensureTargetName(linkedProject);
    const branch = runLocalCommand("git branch --show-current");
    const gitStatus = runLocalCommand("git status --short");

    printSection("TARGET");
    console.log(`target_confirmed=${linkedTarget}`);
    console.log(`target_name=${linkedProject?.name || "unknown"}`);
    console.log(`batch_id=${BATCH_ID}`);
    console.log(`dry_run=true`);

    printSection("ENTITIES SIMULATED");
    for (const [entity, count] of Object.entries(simulatedRecordsCount)) {
      console.log(`${entity}: ${count}`);
    }

    const tableSql = `
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_name in (${quotedCsv(INCLUDED_TABLES)})
      order by table_name
    `;
    const tableRows = runSupabaseSelect(tableSql);
    const foundSet = new Set(tableRows.map((r) => r.table_name));
    schemaValidation.found_tables = [...foundSet].sort();
    const missingTables = INCLUDED_TABLES.filter((t) => !foundSet.has(t));
    schemaValidation.missing_tables = missingTables.filter((table) => !TABLE_FIELD_MAP[table]?.optional_table);
    schemaValidation.optional_missing_tables = missingTables.filter((table) => TABLE_FIELD_MAP[table]?.optional_table);

    if (schemaValidation.optional_missing_tables.length > 0) {
      warningNotes.push(`Optional missing tables: ${schemaValidation.optional_missing_tables.join(", ")}`);
    }

    const criticalTables = ["legal_entities", "profiles", "companies", "products"];
    const missingCriticalTables = criticalTables.filter((t) => schemaValidation.missing_tables.includes(t));
    if (missingCriticalTables.length > 0) {
      noGoReasons.push(`Missing critical tables: ${missingCriticalTables.join(", ")}`);
    }

    const columnSql = `
      select table_name, column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name in (${quotedCsv(INCLUDED_TABLES)})
      order by table_name, ordinal_position
    `;
    const columnRows = runSupabaseSelect(columnSql);
    const columnsByTable = new Map();
    for (const row of columnRows) {
      if (!columnsByTable.has(row.table_name)) {
        columnsByTable.set(row.table_name, new Set());
      }
      columnsByTable.get(row.table_name).add(row.column_name);
    }

    for (const table of INCLUDED_TABLES) {
      const mapConfig = TABLE_FIELD_MAP[table];
      if (!foundSet.has(table)) {
        schemaValidation.column_checks[table] = {
          label_field: mapConfig?.label ?? null,
          code_field: mapConfig?.code ?? null,
          required_missing: mapConfig?.required || [],
          warning_missing: mapConfig?.warning || [],
          optional_table: Boolean(mapConfig?.optional_table),
          table_missing: true,
        };
        continue;
      }
      const existing = columnsByTable.get(table) || new Set();
      const required = mapConfig?.required || [];
      const warning = mapConfig?.warning || [];

      const requiredMissing = required.filter((c) => !existing.has(c));
      const warningMissing = warning.filter((c) => !existing.has(c));

      schemaValidation.column_checks[table] = {
        label_field: mapConfig?.label ?? null,
        code_field: mapConfig?.code ?? null,
        required_missing: requiredMissing,
        warning_missing: warningMissing,
        optional_table: Boolean(mapConfig?.optional_table),
      };

      if (requiredMissing.length > 0) {
        if (mapConfig?.optional_table) {
          partialReasons.push(`Optional table ${table} missing required columns: ${requiredMissing.join(", ")}`);
        } else if (criticalTables.includes(table)) {
          partialReasons.push(`Blocking columns missing in ${table}: ${requiredMissing.join(", ")}`);
        } else {
          partialReasons.push(`Required columns missing in ${table}: ${requiredMissing.join(", ")}`);
        }
      }
      if (warningMissing.length > 0) {
        warningNotes.push(`Warning columns missing in ${table}: ${warningMissing.join(", ")}`);
      }
    }

    const contactsCols = columnsByTable.get("contacts") || new Set();
    const hasContactsCompanyId = contactsCols.has("company_id");
    const hasCompanyContacts = foundSet.has("company_contacts");
    const contactsRelationMode = hasCompanyContacts
      ? "join_table_company_contacts"
      : hasContactsCompanyId
        ? "direct_contacts_company_id"
        : "contacts_link_missing_optional";

    if (!hasCompanyContacts && !hasContactsCompanyId) {
      partialReasons.push("No company-contact link table and no contacts.company_id. Contacts kept optional.");
    }

    for (const table of schemaValidation.found_tables) {
      const countRows = runSupabaseSelect(`select count(*)::bigint as row_count from public.${table}`);
      currentCounts[table] = Number(countRows[0]?.row_count || 0);

      const existingCols = columnsByTable.get(table) || new Set();
      const tmpCols = CANDIDATE_TMP_COLUMNS.filter((c) => existingCols.has(c));
      if (tmpCols.length === 0) {
        tmpPrefixExistingCount[table] = null;
        continue;
      }
      const condition = tmpCols.map((c) => `coalesce(${c}::text, '') ilike '${TMP_PREFIX}%'`).join(" or ");
      const tmpRows = runSupabaseSelect(`select count(*)::bigint as tmp_count from public.${table} where ${condition}`);
      tmpPrefixExistingCount[table] = Number(tmpRows[0]?.tmp_count || 0);
    }

    const dependencyOrder = [
      "tenant_context",
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
      "contacts_or_company_contacts",
    ];

    const dependencyValidation = {
      order: dependencyOrder,
      contacts_relation_mode: contactsRelationMode,
      checks: {
        legal_entities_before_companies: foundSet.has("legal_entities") && foundSet.has("companies"),
        profiles_before_sales_reps: foundSet.has("profiles") && foundSet.has("sales_reps"),
        product_aux_before_products:
          foundSet.has("product_types") &&
          foundSet.has("product_groups") &&
          foundSet.has("product_subgroups") &&
          foundSet.has("product_families") &&
          foundSet.has("product_classes") &&
          foundSet.has("products"),
        contacts_path_available: foundSet.has("contacts") && (hasCompanyContacts || hasContactsCompanyId),
      },
    };

    if (!dependencyValidation.checks.contacts_path_available) {
      partialReasons.push("Neither contacts nor company_contacts are available.");
    }

    const writeIntentSignals = false;
    if (writeIntentSignals) {
      noGoReasons.push("Write intent signal detected.");
    }

    const { decision, reasons } = decideOutcome({ noGoReasons, partialReasons });

    printSection("SCHEMA VALIDATION");
    console.log(`found_tables=${schemaValidation.found_tables.join(", ")}`);
    console.log(`missing_tables=${schemaValidation.missing_tables.join(", ") || "-"}`);
    console.log(`optional_missing_tables=${schemaValidation.optional_missing_tables.join(", ") || "-"}`);
    console.log(`column_checks_tables=${Object.keys(schemaValidation.column_checks).length}`);

    printSection("CURRENT COUNTS");
    for (const [table, count] of Object.entries(currentCounts)) {
      console.log(`${table}: ${count}`);
    }

    printSection("TMP PREFIX PRESENCE");
    for (const [table, count] of Object.entries(tmpPrefixExistingCount)) {
      console.log(`${table}: ${count === null ? "n/a" : count}`);
    }

    printSection("DEPENDENCIES");
    console.log(JSON.stringify(dependencyValidation, null, 2));

    printSection("TABLE FIELD MAP");
    console.log(JSON.stringify(TABLE_FIELD_MAP, null, 2));

    if (warningNotes.length > 0) {
      printSection("WARNINGS");
      warningNotes.forEach((note) => console.log(`- ${note}`));
    }

    printSection("DECISION");
    console.log(`decision=${decision}`);
    console.log(`reasons=${reasons.join(" | ")}`);

    const timestamp = new Date().toISOString();
    const outputPath = args.out
      ? path.resolve(args.out)
      : path.resolve(`C:/Users/Felipe Duarte/backups/qualyvac-migration/preflight/phase-22g-r2a-baseline-dry-run_${nowTimestampCompact()}.json`);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });

    const evidence = {
      timestamp,
      branch,
      git_status: gitStatus,
      expected_target: args.expectedTarget,
      linked_target: linkedTarget,
      linked_target_name: linkedProject?.name || null,
      batch_id: BATCH_ID,
      dry_run: true,
      baseline_entities: baselineEntityNames,
      simulated_records_count: simulatedRecordsCount,
      schema_validation: schemaValidation,
      current_counts: currentCounts,
      tmp_prefix_existing_count: tmpPrefixExistingCount,
      dependency_validation: dependencyValidation,
      contacts_relation_mode: contactsRelationMode,
      blocked_entities: BLOCKED_ENTITIES,
      decision,
      reasons,
      warnings: warningNotes,
      confirmations: {
        no_db_write: true,
        no_sql_write: true,
        no_migration: true,
        no_seed: true,
        no_cleanup: true,
        no_erp_api: true,
        no_queue_processing: true,
        no_deploy: true,
        no_staging_prod_changes: true,
      },
    };

    fs.writeFileSync(outputPath, JSON.stringify(evidence, null, 2), "utf8");
    console.log(`\nevidence_path=${outputPath}`);

    if (decision === "NO-GO") {
      process.exit(1);
    }
    process.exit(0);
  } catch (error) {
    console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(2);
  }
}

main();
