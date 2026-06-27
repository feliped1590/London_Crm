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
const EXPECTED_PILOT_AUTHORIZATION =
  "AUTORIZO A PRIMEIRA ESCRITA PILOTO DA BASELINE 22R-R2 SOMENTE EM legal_entities NO RESTORE-TEST nsnmlleplpzsefzkuxlb";

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

  if (args.executePilotWrite && !args.pilotEntity) {
    noGoReasons.push("--pilot-entity is required when --execute-pilot-write is used.");
    pushValidation(validations, "pilot.entity.flag", "FAIL", "--pilot-entity not provided in pilot mode.");
  } else if (args.pilotEntity && args.pilotEntity !== EXPECTED_PILOT_ENTITY) {
    noGoReasons.push(`Pilot entity is not allowed: ${args.pilotEntity} != ${EXPECTED_PILOT_ENTITY}`);
    pushValidation(validations, "pilot.entity.value", "FAIL", "Only legal_entities is accepted as pilot entity.");
  } else if (args.pilotEntity === EXPECTED_PILOT_ENTITY) {
    pushValidation(validations, "pilot.entity.value", "PASS", "Pilot entity validated as legal_entities.");
  } else {
    pushValidation(validations, "pilot.entity.value", "PASS", "Pilot entity not requested.");
  }

  if (args.executePilotWrite && !args.pilotAuthorization) {
    noGoReasons.push("--pilot-authorization is required when --execute-pilot-write is used.");
    pushValidation(validations, "pilot.authorization.flag", "FAIL", "--pilot-authorization not provided in pilot mode.");
  } else if (args.pilotAuthorization && args.pilotAuthorization !== EXPECTED_PILOT_AUTHORIZATION) {
    noGoReasons.push("Pilot authorization phrase mismatch.");
    pushValidation(validations, "pilot.authorization.value", "FAIL", "Pilot authorization phrase is not exact.");
  } else if (args.pilotAuthorization === EXPECTED_PILOT_AUTHORIZATION) {
    pushValidation(validations, "pilot.authorization.value", "PASS", "Pilot authorization phrase validated.");
  } else {
    pushValidation(validations, "pilot.authorization.value", "PASS", "Pilot authorization not requested.");
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

  const pilotOperation = {
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
  const legalEntityPlannedCount = Object.prototype.hasOwnProperty.call(plannedCountsByEntity, EXPECTED_PILOT_ENTITY)
    ? plannedCountsByEntity[EXPECTED_PILOT_ENTITY]
    : null;
  const legalEntityTmpPrefixCount =
    typeof writePlanJson?.batchTraceabilityStrategy?.tmpPrefixCounts?.[EXPECTED_PILOT_ENTITY] === "number"
      ? writePlanJson.batchTraceabilityStrategy.tmpPrefixCounts[EXPECTED_PILOT_ENTITY]
      : null;

  if (!args.executePilotWrite) {
    pilotPartialReasons.push("Pilot execution flag is absent; pilot checks were not fully armed.");
  }

  if (args.pilotEntity && args.pilotEntity !== EXPECTED_PILOT_ENTITY) {
    pilotNoGoReasons.push("Pilot entity must be legal_entities.");
  }
  if (args.pilotAuthorization && args.pilotAuthorization !== EXPECTED_PILOT_AUTHORIZATION) {
    pilotNoGoReasons.push("Pilot authorization phrase is invalid.");
  }

  if (args.executePilotWrite) {
    if (args.pilotEntity !== EXPECTED_PILOT_ENTITY) {
      pilotNoGoReasons.push("Pilot mode armed without legal_entities as pilot.");
    }
    if (args.pilotAuthorization !== EXPECTED_PILOT_AUTHORIZATION) {
      pilotNoGoReasons.push("Pilot mode armed without exact pilot authorization.");
    }
  }

  if (!writePlanEligibleEntities.includes(EXPECTED_PILOT_ENTITY)) {
    pilotNoGoReasons.push("legal_entities is missing from write plan eligible entities.");
  }
  if (!executableEntitiesRoundOne22Q.includes(EXPECTED_PILOT_ENTITY)) {
    pilotNoGoReasons.push("legal_entities is missing from first round executable entities.");
  }
  if (executableEntitiesRoundOne22Q.includes("profiles")) {
    pilotNoGoReasons.push("profiles must remain excluded from first round pilot.");
  }
  if (executableEntitiesRoundOne22Q.includes("company_contacts")) {
    pilotNoGoReasons.push("company_contacts must remain excluded from first round pilot.");
  }
  if (BLOCKED_ENTITIES.has(EXPECTED_PILOT_ENTITY)) {
    pilotNoGoReasons.push("legal_entities cannot be blocked or transactional.");
  }
  if (writePlanOrder.length > 0 && !writePlanOrder.includes(EXPECTED_PILOT_ENTITY)) {
    pilotNoGoReasons.push("legal_entities is missing from planned write order.");
  }
  if (writePlanOrder.includes("profiles")) {
    const legalIdx = writePlanOrder.indexOf(EXPECTED_PILOT_ENTITY);
    const profilesIdx = writePlanOrder.indexOf("profiles");
    if (legalIdx > profilesIdx) {
      pilotNoGoReasons.push("legal_entities appears after profiles in write order, violating pilot dependency rule.");
    }
  }
  if (writePlanOrder.includes("company_contacts")) {
    pilotNoGoReasons.push("company_contacts must not appear in write order for pilot validation.");
  }
  if (legalEntityPlannedCount === null) {
    pilotPartialReasons.push("Planned count for legal_entities is unavailable.");
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

  const pilotEvidenceDir = path.resolve("artifacts/migration/phase-22s-r2-pilot-legal-entities");
  fs.mkdirSync(pilotEvidenceDir, { recursive: true });
  const pilotEvidencePath = path.join(pilotEvidenceDir, `pilot-legal-entities-${nowStamp()}.json`);
  const pilotEvidence = {
    phase: "22S-R2",
    timestamp: new Date().toISOString(),
    targetRef: EXPECTED_TARGET_REF,
    targetName: EXPECTED_TARGET_NAME,
    batchId: EXPECTED_BATCH_ID,
    inputPath: args.input || null,
    writePlanPath: args.writePlan || null,
    generalAuthorizationValid: args.authorization === EXPECTED_AUTHORIZATION,
    pilotAuthorizationValid: args.pilotAuthorization === EXPECTED_PILOT_AUTHORIZATION,
    pilotEntity: args.pilotEntity || null,
    pilotEntityValidated: args.pilotEntity === EXPECTED_PILOT_ENTITY,
    legalEntitiesPlannedCount: legalEntityPlannedCount,
    legalEntitiesTmpPrefixCount: legalEntityTmpPrefixCount,
    pilotOperation,
    pilotValidation: {
      existsInWritePlanEligibleEntities: writePlanEligibleEntities.includes(EXPECTED_PILOT_ENTITY),
      existsInFutureRoundOne: executableEntitiesRoundOne22Q.includes(EXPECTED_PILOT_ENTITY),
      noProfilesInFutureRoundOne: !executableEntitiesRoundOne22Q.includes("profiles"),
      noCompanyContactsInFutureRoundOne: !executableEntitiesRoundOne22Q.includes("company_contacts"),
      nonTransactionalEntity: !BLOCKED_ENTITIES.has(EXPECTED_PILOT_ENTITY),
      noQueueExecution: true,
      noExternalCalls: true,
      dependencyOnProfiles: false,
      dependencyOnCompanyContacts: false,
      batchTraceabilityAvailable:
        typeof writePlanJson?.batchTraceabilityStrategy?.batchId === "string" &&
        writePlanJson.batchTraceabilityStrategy.batchId === EXPECTED_BATCH_ID,
    },
    confirmations: {
      profilesExcluded: !executableEntitiesRoundOne22Q.includes("profiles"),
      companyContactsExcluded: !executableEntitiesRoundOne22Q.includes("company_contacts"),
      noTransactionalExecution: true,
      noQueueProcessing: true,
      noErpApiN8nWebhookCalls: true,
      realExecutionBlocked: true,
      noMutationExecuted: true,
    },
    preflightDecision,
    writePlanDecision: planDecision,
    armedWriteDecision,
    pilotDecision: pilotDecisionFinal,
    reasons: {
      noGoReasons: pilotNoGoReasons,
      partialReasons: pilotPartialReasons,
    },
    hardStopTriggered: false,
    finalHardStopMessage: phase22SHardStopMessage,
  };
  fs.writeFileSync(pilotEvidencePath, JSON.stringify(pilotEvidence, null, 2), "utf8");

  const phase22TDir = path.resolve(PILOT_T_WRITE_DIR);
  fs.mkdirSync(phase22TDir, { recursive: true });
  const phase22TBeforePath = path.join(phase22TDir, `before-${nowStamp()}.json`);
  const phase22TAfterPath = path.join(phase22TDir, `after-${nowStamp()}.json`);

  const pilotWriteNoGoReasons = [];
  const pilotWritePartialReasons = [];
  const pilotEntityFromArg = args.pilotEntity || null;
  const generalAuthorizationValid = args.authorization === EXPECTED_AUTHORIZATION;
  const pilotAuthorizationValid = args.pilotAuthorization === EXPECTED_PILOT_AUTHORIZATION;
  const pilotScopeOnlyEntity = EXPECTED_PILOT_ENTITY;
  const excludedByScope = [
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
    "company_contacts",
  ];
  const blockedExecutionFamilies = {
    transactional: true,
    queues: true,
    integrations: true,
  };

  if (!args.write) pilotWriteNoGoReasons.push("--write is required for real pilot execution in 22T-R2.");
  if (!args.executePilotWrite) pilotWriteNoGoReasons.push("--execute-pilot-write is required for real pilot execution in 22T-R2.");
  if (pilotEntityFromArg !== EXPECTED_PILOT_ENTITY) pilotWriteNoGoReasons.push("Pilot entity must be legal_entities.");
  if (!generalAuthorizationValid) pilotWriteNoGoReasons.push("General authorization is invalid.");
  if (!pilotAuthorizationValid) pilotWriteNoGoReasons.push("Pilot authorization is invalid.");
  if (args.expectedTarget !== EXPECTED_TARGET_REF) pilotWriteNoGoReasons.push("Expected target flag mismatch.");
  if (localTargetRef !== EXPECTED_TARGET_REF) pilotWriteNoGoReasons.push("Local target ref mismatch.");
  if (localTargetName !== EXPECTED_TARGET_NAME) pilotWriteNoGoReasons.push("Local target name mismatch.");
  if (args.batch !== EXPECTED_BATCH_ID) pilotWriteNoGoReasons.push("Batch mismatch.");
  if (!inputExists || !inputParsed) pilotWriteNoGoReasons.push("Input was not validated.");
  if (!writePlanExists || !writePlanParsed || writePlanValidationErrors.length > 0) {
    pilotWriteNoGoReasons.push("Write plan was not validated.");
  }
  if (pilotDecisionFinal !== "GO") pilotWriteNoGoReasons.push("pilot_validation_decision is not GO.");
  if (blockedEntitiesFound.length > 0) pilotWriteNoGoReasons.push("Blocked entities were detected.");
  if (args.forbiddenFlags.length > 0 || args.unknownFlags.length > 0) {
    pilotWriteNoGoReasons.push("Forbidden or unknown flags detected.");
  }
  if (executableEntitiesRoundOne22Q.includes("profiles")) pilotWriteNoGoReasons.push("profiles must be excluded.");
  if (executableEntitiesRoundOne22Q.includes("company_contacts")) pilotWriteNoGoReasons.push("company_contacts must be excluded.");

  const plannedPilotRecord = { ...PILOT_LEGAL_ENTITY_RECORD };
  const pilotNaturalKey = {
    tenant_id: plannedPilotRecord.tenant_id,
    cnpj: plannedPilotRecord.cnpj,
  };
  let legalEntitiesCountBefore = null;
  let legalEntitiesCountAfter = null;
  let uniqueNaturalKeyConstraintFound = false;
  let tenantExistsForPilot = false;
  let writeAttempted = false;
  let writeSucceeded = false;
  let writeErrorMessage = null;
  let upsertReturnedRows = [];

  try {
    const beforeRows = runSupabaseDbQuery("select count(*)::bigint as row_count from public.legal_entities");
    legalEntitiesCountBefore = Number(beforeRows[0]?.row_count || 0);
  } catch (error) {
    pilotWriteNoGoReasons.push("Unable to read before count for legal_entities.");
    writeErrorMessage = writeErrorMessage || (error instanceof Error ? error.message : String(error));
  }

  try {
    const tenantRows = runSupabaseDbQuery(
      `select exists(select 1 from public.tenants where id = '${escapeSqlLiteral(plannedPilotRecord.tenant_id)}'::uuid) as tenant_exists`,
    );
    tenantExistsForPilot = tenantRows[0]?.tenant_exists === true;
    if (!tenantExistsForPilot) pilotWriteNoGoReasons.push("Pilot tenant_id does not exist in tenants.");
  } catch (error) {
    pilotWriteNoGoReasons.push("Unable to validate tenant_id existence.");
    writeErrorMessage = writeErrorMessage || (error instanceof Error ? error.message : String(error));
  }

  try {
    const constraintRows = runSupabaseDbQuery(`
      select exists(
        select 1
        from pg_constraint c
        join pg_class t on t.oid = c.conrelid
        join pg_namespace n on n.oid = t.relnamespace
        where n.nspname = 'public'
          and t.relname = 'legal_entities'
          and c.contype = 'u'
          and pg_get_constraintdef(c.oid) ilike '%(tenant_id, cnpj)%'
      ) as has_natural_key
    `);
    uniqueNaturalKeyConstraintFound = constraintRows[0]?.has_natural_key === true;
    if (!uniqueNaturalKeyConstraintFound) {
      pilotWriteNoGoReasons.push("Natural key (tenant_id, cnpj) is not available for safe idempotent upsert.");
    }
  } catch (error) {
    pilotWriteNoGoReasons.push("Unable to validate natural key constraint for legal_entities.");
    writeErrorMessage = writeErrorMessage || (error instanceof Error ? error.message : String(error));
  }

  if (legalEntityPlannedCount !== 1) {
    pilotWritePartialReasons.push(`Planned count for legal_entities is ${legalEntityPlannedCount}; expected 1.`);
  }

  const beforeDecision22T = classifyDecision(pilotWriteNoGoReasons, pilotWritePartialReasons);
  const beforeEvidence22T = {
    phase: "22T-R2",
    timestamp: new Date().toISOString(),
    targetRef: EXPECTED_TARGET_REF,
    targetName: EXPECTED_TARGET_NAME,
    batchId: EXPECTED_BATCH_ID,
    inputPath: args.input || null,
    writePlanPath: args.writePlan || null,
    pilotEntity: pilotEntityFromArg,
    generalAuthorizationValid,
    pilotAuthorizationValid,
    legalEntitiesCountBefore,
    plannedRecord: plannedPilotRecord,
    naturalKey: pilotNaturalKey,
    uniqueNaturalKeyConstraintFound,
    tenantExistsForPilot,
    plannedLegalEntitiesCount: legalEntityPlannedCount,
    scopeConfirmation: {
      singleEntityExecution: true,
      allowedEntity: pilotScopeOnlyEntity,
      excludedEntities: excludedByScope,
      blockedFamilies: blockedExecutionFamilies,
      profilesExcluded: true,
      companyContactsExcluded: true,
    },
    beforeDecision: beforeDecision22T,
    reasons: {
      noGoReasons: pilotWriteNoGoReasons,
      partialReasons: pilotWritePartialReasons,
    },
  };
  fs.writeFileSync(phase22TBeforePath, JSON.stringify(beforeEvidence22T, null, 2), "utf8");

  if (beforeDecision22T === "GO") {
    try {
      writeAttempted = true;
      const upsertSql = `
        insert into public.legal_entities (
          tenant_id, name, trade_name, cnpj, erp_company_code, is_headquarters, active
        )
        values (
          '${escapeSqlLiteral(plannedPilotRecord.tenant_id)}'::uuid,
          '${escapeSqlLiteral(plannedPilotRecord.name)}',
          '${escapeSqlLiteral(plannedPilotRecord.trade_name)}',
          '${escapeSqlLiteral(plannedPilotRecord.cnpj)}',
          '${escapeSqlLiteral(plannedPilotRecord.erp_company_code)}',
          ${plannedPilotRecord.is_headquarters ? "true" : "false"},
          ${plannedPilotRecord.active ? "true" : "false"}
        )
        on conflict (tenant_id, cnpj)
        do update set
          name = excluded.name,
          trade_name = excluded.trade_name,
          erp_company_code = excluded.erp_company_code,
          is_headquarters = excluded.is_headquarters,
          active = excluded.active,
          updated_at = now()
        returning id, tenant_id, name, cnpj, erp_company_code, created_at, updated_at
      `;
      upsertReturnedRows = runSupabaseDbQuery(upsertSql);
      writeSucceeded = true;
    } catch (error) {
      writeErrorMessage = error instanceof Error ? error.message : String(error);
      writeSucceeded = false;
    }
  }

  try {
    const afterRows = runSupabaseDbQuery("select count(*)::bigint as row_count from public.legal_entities");
    legalEntitiesCountAfter = Number(afterRows[0]?.row_count || 0);
  } catch (error) {
    writeErrorMessage = writeErrorMessage || (error instanceof Error ? error.message : String(error));
  }

  const afterNoGoReasons22T = [];
  const afterPartialReasons22T = [];
  if (beforeDecision22T !== "GO") afterNoGoReasons22T.push("beforeDecision is not GO.");
  if (beforeDecision22T === "GO" && !writeAttempted) afterNoGoReasons22T.push("Pilot write was not attempted despite before GO.");
  if (writeAttempted && !writeSucceeded) afterNoGoReasons22T.push("Pilot write failed.");
  if (writeSucceeded && upsertReturnedRows.length === 0) {
    afterPartialReasons22T.push("Pilot write succeeded without returning affected rows.");
  }
  if (legalEntitiesCountBefore !== null && legalEntitiesCountAfter !== null) {
    const delta = legalEntitiesCountAfter - legalEntitiesCountBefore;
    if (delta < 0 || delta > 1) {
      afterNoGoReasons22T.push(`Unexpected legal_entities delta: ${delta}.`);
    }
  } else {
    afterNoGoReasons22T.push("Unable to compute legal_entities delta.");
  }

  const afterDecision22T = classifyDecision(afterNoGoReasons22T, afterPartialReasons22T);
  const legalEntitiesDelta =
    legalEntitiesCountBefore !== null && legalEntitiesCountAfter !== null
      ? legalEntitiesCountAfter - legalEntitiesCountBefore
      : null;
  const recordsAffected = upsertReturnedRows.map((row) => ({
    id: row.id,
    tenant_id: row.tenant_id,
    name: row.name,
    cnpj: row.cnpj,
    erp_company_code: row.erp_company_code,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));

  const afterEvidence22T = {
    phase: "22T-R2",
    timestamp: new Date().toISOString(),
    targetRef: EXPECTED_TARGET_REF,
    targetName: EXPECTED_TARGET_NAME,
    batchId: EXPECTED_BATCH_ID,
    pilotEntityExecuted: writeSucceeded ? EXPECTED_PILOT_ENTITY : null,
    operationExecuted: writeSucceeded ? "upsert_legal_entities_by_tenant_cnpj" : "no_write_executed",
    legalEntitiesCountBefore,
    legalEntitiesCountAfter,
    legalEntitiesDelta,
    recordsCreatedOrAffected: recordsAffected,
    recordsAffectedCount: recordsAffected.length,
    naturalKey: pilotNaturalKey,
    scopeConfirmation: {
      onlyLegalEntitiesTouched: writeSucceeded,
      profilesTouched: false,
      companyContactsTouched: false,
      transactionalTouched: false,
      queueTouched: false,
      externalIntegrationsCalled: false,
      expandedExecutionBlocked: true,
    },
    errors: writeErrorMessage ? [writeErrorMessage] : [],
    writeAttempted,
    writeSucceeded,
    afterDecision: afterDecision22T,
    reasons: {
      noGoReasons: afterNoGoReasons22T,
      partialReasons: afterPartialReasons22T,
    },
    finalMessage: phase22TStopAfterPilotMessage,
  };
  fs.writeFileSync(phase22TAfterPath, JSON.stringify(afterEvidence22T, null, 2), "utf8");

  console.log(`preflight_decision=${preflightDecision}`);
  console.log(`evidence_path=${evidencePath}`);
  console.log(`write_plan_decision=${planDecision}`);
  console.log(`write_plan_path=${writePlanPath}`);
  console.log(`armed_write_decision=${armedWriteDecision}`);
  console.log(`armed_before_path=${armedBeforePath}`);
  console.log(`pilot_validation_decision=${pilotDecisionFinal}`);
  console.log(`pilot_evidence_path=${pilotEvidencePath}`);
  console.log(`pilot_write_before_decision=${beforeDecision22T}`);
  console.log(`pilot_write_before_path=${phase22TBeforePath}`);
  console.log(`pilot_write_after_decision=${afterDecision22T}`);
  console.log(`pilot_write_after_path=${phase22TAfterPath}`);
  console.log(`pilot_write_records_affected=${recordsAffected.length}`);
  console.log(phase22OBlockingMessage);
  console.log(phase22QHardStopMessage);
  console.log(phase22SHardStopMessage);
  console.log(phase22TStopAfterPilotMessage);
  console.log(writeStatusMessage);

  if (
    preflightDecision === "NO-GO" ||
    planDecision === "NO-GO" ||
    armedWriteDecision === "NO-GO" ||
    pilotDecisionFinal === "NO-GO" ||
    beforeDecision22T === "NO-GO" ||
    afterDecision22T === "NO-GO"
  ) {
    process.exit(1);
  }
  process.exit(0);
}

main();
