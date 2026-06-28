#!/usr/bin/env node
import { execSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001";
const ARTIFACT_DIR = path.resolve("artifacts/migration/phase-22cb-r2-imp-payload-pivot");
const EXPECTED_GROUP_BY_ENTITY = {
  companies: "IMP_CLIENTE_V4",
  products: "IMP_ITEM_VERSAO_TESTE",
  orders: "IMP_PEDIDO_ESPECIFICO",
};

function parseArgs(argv) {
  const args = {
    entity: "",
    input: "",
    noWrite: false,
    tenantId: DEFAULT_TENANT_ID,
    artifactDir: ARTIFACT_DIR,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--entity") {
      args.entity = String(argv[i + 1] || "").trim();
      i += 1;
      continue;
    }
    if (token === "--input") {
      args.input = String(argv[i + 1] || "").trim();
      i += 1;
      continue;
    }
    if (token === "--tenant-id") {
      args.tenantId = String(argv[i + 1] || "").trim();
      i += 1;
      continue;
    }
    if (token === "--no-write") {
      args.noWrite = true;
      continue;
    }
    if (token === "--artifact-dir") {
      args.artifactDir = path.resolve(String(argv[i + 1] || "").trim());
      i += 1;
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

function sha12(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex").slice(0, 12);
}

function maskPreview(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  if (text.length <= 4) return `${text[0] || ""}***`;
  return `${text.slice(0, 2)}***${text.slice(-2)}`;
}

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
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

function isPlaceholder(value) {
  if (value === null || value === undefined) return true;
  const s = String(value).trim();
  if (!s) return true;
  return /^<.*>$/.test(s) || /^DD\/MM\/AAAA/.test(s) || s.includes("...");
}

function presentFields(record) {
  return Object.keys(record || {}).filter((k) => record[k] !== undefined && record[k] !== null && String(record[k]).trim() !== "");
}

function readInputRecords(inputPath) {
  const text = fs.readFileSync(inputPath, "utf8");
  const parsed = JSON.parse(text);

  // Envelope ASDCOMANDO with json as serialized string.
  if (parsed && typeof parsed === "object" && typeof parsed.json === "string") {
    const inner = JSON.parse(parsed.json);
    return {
      records: [inner],
      envelope: parsed,
      arrayPath: "envelope.json",
      metadata: {
        tipoComando: parsed.tipoComando || null,
        grupoComando: parsed.grupoComando || null,
      },
    };
  }

  const metadata = {
    tipoComando: parsed?.tipoComando || null,
    grupoComando: parsed?.grupoComando || null,
  };
  if (Array.isArray(parsed)) return { records: parsed, envelope: null, arrayPath: "root", metadata };
  if (Array.isArray(parsed?.records)) return { records: parsed.records, envelope: null, arrayPath: "records", metadata };
  if (Array.isArray(parsed?.data)) return { records: parsed.data, envelope: null, arrayPath: "data", metadata };
  if (Array.isArray(parsed?.items)) return { records: parsed.items, envelope: null, arrayPath: "items", metadata };
  if (Array.isArray(parsed?.retorno)) return { records: parsed.retorno, envelope: null, arrayPath: "retorno", metadata };
  return { records: [parsed], envelope: null, arrayPath: "root_object", metadata };
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

function classifyCompany(record) {
  const cnpj = onlyDigits(firstNonEmpty(record, ["cnpj", "cnpj_cpf", "cpf_cnpj"]));
  const name = firstNonEmpty(record, ["nome", "name", "razao_social", "razao", "fantasia"]);
  const erpCode = firstNonEmpty(record, ["codigo_erp", "codigo", "cd_correntista", "erp_code"]);
  const cnpjPlaceholder = isPlaceholder(firstNonEmpty(record, ["cnpj", "cnpj_cpf", "cpf_cnpj"]));
  const namePlaceholder = isPlaceholder(firstNonEmpty(record, ["nome", "name", "razao_social", "razao", "fantasia"]));
  const recognized = [cnpj, name, erpCode].filter(Boolean).length;
  let status = "ready_candidate";
  if (recognized === 0) status = "blocked_unmapped";
  else if (!cnpj) status = "blocked_missing_cnpj";
  else if (!name) status = "blocked_missing_name";
  if (cnpjPlaceholder || namePlaceholder) status = "blocked_placeholder";
  return {
    status,
    cnpj,
    name,
    erpCode,
    placeholder_detected: cnpjPlaceholder || namePlaceholder,
    fields_present: presentFields(record),
  };
}

function classifyProduct(record) {
  const sku = firstNonEmpty(record, ["sku", "item", "codigo", "codigo_item", "produto", "cod_produto", "erp_product_code", "referencia"]);
  const erpCode = firstNonEmpty(record, ["erp_product_code", "item", "codigo", "codigo_item", "produto", "cod_produto"]);
  const name = firstNonEmpty(record, ["name", "nome", "descricao", "descricao_item", "desc_item", "desc_simples_item", "desc_completa_item", "denominacao"]);
  const version = firstNonEmpty(record, ["versao", "erp_versao", "versao_item", "seq_versao", "versao_numero"]) ||
    firstNonEmpty(record?.versoes?.[0] || {}, ["versao", "codigo"]);
  const classificationSignals = [
    firstNonEmpty(record, ["grupo", "codigo_grupo", "codigo_grupo_item"]),
    firstNonEmpty(record, ["subgrupo", "codigo_subgrupo", "codigo_subgrupo_item"]),
    firstNonEmpty(record, ["familia", "codigo_familia"]),
    firstNonEmpty(record, ["classe", "codigo_classe"]),
    firstNonEmpty(record, ["tipo", "codigo_tipo_item"]),
  ].filter(Boolean);
  const recognized = [sku, erpCode, name].filter(Boolean).length;
  const skuPlaceholder = isPlaceholder(firstNonEmpty(record, ["sku", "item", "codigo", "codigo_item", "produto", "cod_produto", "erp_product_code", "referencia"]));
  const namePlaceholder = isPlaceholder(firstNonEmpty(record, ["name", "nome", "descricao", "descricao_item", "desc_item", "desc_simples_item", "desc_completa_item", "denominacao"]));
  const versionPlaceholder = isPlaceholder(version);
  let status = "ready_candidate";
  if (recognized === 0) status = "blocked_unmapped";
  else if (!sku && !erpCode) status = "blocked_missing_sku_or_erp_code";
  else if (!name) status = "blocked_missing_name";
  else if (!version) status = "blocked_missing_version";
  else if (classificationSignals.length === 0) status = "blocked_missing_classification";
  if (skuPlaceholder || namePlaceholder || versionPlaceholder) status = "blocked_placeholder";
  return {
    status,
    sku,
    erpCode,
    name,
    version,
    placeholder_detected: skuPlaceholder || namePlaceholder || versionPlaceholder,
    fields_present: presentFields(record),
  };
}

function classifyOrder(record) {
  const orderNumberRaw = firstNonEmpty(record, ["pedido_terceiro", "numero_pedido", "number"]);
  const customerRaw = firstNonEmpty(record, ["cpf_cnpj_cliente", "cnpj", "company_cnpj"]);
  const orderNumber = orderNumberRaw;
  const customerCnpj = onlyDigits(customerRaw);
  const items = Array.isArray(record?.itens) ? record.itens : Array.isArray(record?.items) ? record.items : [];
  let status = "diagnostic_ready_structure";
  if (!orderNumber) status = "blocked_missing_order_number";
  else if (!customerCnpj) status = "blocked_missing_customer_cnpj";
  else if (!items.length) status = "blocked_missing_items";
  else if (!items.every((it) => firstNonEmpty(it || {}, ["item", "codigo", "produto", "erp_product_code"]))) {
    status = "blocked_missing_product_code";
  }
  const itemsHavePlaceholder = items.some((it) => {
    const itemCode = firstNonEmpty(it || {}, ["item", "codigo", "produto", "erp_product_code"]);
    const itemVersion = firstNonEmpty(it || {}, ["versao", "erp_versao", "version"]);
    return isPlaceholder(itemCode) || isPlaceholder(itemVersion);
  });
  const placeholderDetected =
    isPlaceholder(orderNumberRaw) ||
    isPlaceholder(customerRaw) ||
    itemsHavePlaceholder;
  if (placeholderDetected) status = "blocked_placeholder";
  return {
    status,
    orderNumber,
    customerCnpj,
    itemsCount: items.length,
    placeholder_detected: placeholderDetected,
    fields_present: presentFields(record),
  };
}

function buildMaskedRow(entity, idx, classified) {
  if (entity === "companies") {
    return {
      index: idx + 1,
      status: classified.status,
      cnpj_masked: classified.cnpj ? `cnpj_hash_${sha12(classified.cnpj)}` : null,
      name_masked: classified.name ? `name_hash_${sha12(classified.name)}` : null,
      erp_code_masked: classified.erpCode ? `erp_hash_${sha12(classified.erpCode)}` : null,
      cnpj_preview: classified.cnpj ? maskPreview(classified.cnpj) : null,
      fields_present: classified.fields_present,
    };
  }
  if (entity === "products") {
    return {
      index: idx + 1,
      status: classified.status,
      sku_masked: classified.sku ? `sku_hash_${sha12(classified.sku)}` : null,
      erp_code_masked: classified.erpCode ? `erp_hash_${sha12(classified.erpCode)}` : null,
      name_masked: classified.name ? `name_hash_${sha12(classified.name)}` : null,
      version_masked: classified.version ? `version_hash_${sha12(classified.version)}` : null,
      sku_preview: classified.sku ? maskPreview(classified.sku) : null,
      fields_present: classified.fields_present,
    };
  }
  return {
    index: idx + 1,
    status: classified.status,
    order_number_masked: classified.orderNumber ? `order_hash_${sha12(classified.orderNumber)}` : null,
    customer_cnpj_masked: classified.customerCnpj ? `cnpj_hash_${sha12(classified.customerCnpj)}` : null,
    items_count: classified.itemsCount,
    fields_present: classified.fields_present,
  };
}

function collisionsForCompanies(tenantId, classifiedRows) {
  const collisions = [];
  for (const row of classifiedRows.filter((r) => r.status === "ready_candidate" && r.cnpj)) {
    const cnpjEscaped = row.cnpj.replaceAll("'", "''");
    const query = `
      select count(*)::bigint as qty
      from public.companies
      where tenant_id = '${tenantId.replaceAll("'", "''")}'
        and regexp_replace(coalesce(cnpj, ''), '\\D', '', 'g') = '${cnpjEscaped}'
    `;
    const qty = Number(runSupabaseSelect(query)[0]?.qty || 0);
    collisions.push({
      cnpj_hash: sha12(row.cnpj),
      by_tenant_cnpj: qty,
    });
  }
  return collisions;
}

function collisionsForProducts(tenantId, classifiedRows) {
  const collisions = [];
  for (const row of classifiedRows.filter((r) => r.status === "ready_candidate")) {
    let byCodeVersion = 0;
    let bySkuUnique = 0;
    if (row.erpCode && row.version) {
      const codeEscaped = row.erpCode.replaceAll("'", "''");
      const verEscaped = row.version.replaceAll("'", "''");
      const query = `
        select count(*)::bigint as qty
        from public.products
        where tenant_id = '${tenantId.replaceAll("'", "''")}'
          and coalesce(erp_product_code::text, '') = '${codeEscaped}'
          and coalesce(versao_numero::text, '') = '${verEscaped}'
      `;
      byCodeVersion = Number(runSupabaseSelect(query)[0]?.qty || 0);
    }
    if (row.sku) {
      const skuEscaped = row.sku.replaceAll("'", "''");
      const query = `
        select count(*)::bigint as qty
        from public.products
        where coalesce(sku_unique::text, '') = '${skuEscaped}'
      `;
      bySkuUnique = Number(runSupabaseSelect(query)[0]?.qty || 0);
    }
    collisions.push({
      sku_hash: row.sku ? sha12(row.sku) : null,
      erp_code_hash: row.erpCode ? sha12(row.erpCode) : null,
      version_masked: row.version ? `version_hash_${sha12(row.version)}` : null,
      by_tenant_erp_code_version: byCodeVersion,
      by_sku_unique: bySkuUnique,
    });
  }
  return collisions;
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.noWrite) throw new Error("ABORTED: --no-write is mandatory.");
  if (!["companies", "products", "orders"].includes(args.entity)) throw new Error("ABORTED: --entity must be companies, products or orders.");
  if (!args.input) throw new Error("ABORTED: --input is required.");
  if (!fs.existsSync(args.input)) throw new Error(`ABORTED: input file not found: ${args.input}`);

  const stamp = nowCompact();
  fs.mkdirSync(args.artifactDir, { recursive: true });

  const { records, envelope, arrayPath, metadata } = readInputRecords(args.input);
  const sampled = records.slice(0, 50);
  const classifyFn = args.entity === "companies" ? classifyCompany : args.entity === "products" ? classifyProduct : classifyOrder;
  const classified = sampled.map((r) => classifyFn(r || {}));

  const blockedByStatus = {};
  let ready = 0;
  let placeholderDetectedCount = 0;
  for (const row of classified) {
    if (row.status === "ready_candidate" || row.status === "diagnostic_ready_structure") ready += 1;
    else blockedByStatus[row.status] = (blockedByStatus[row.status] || 0) + 1;
    if (row.placeholder_detected) placeholderDetectedCount += 1;
  }
  const expectedGroup = EXPECTED_GROUP_BY_ENTITY[args.entity];
  const commandGroup = envelope?.grupoComando || metadata?.grupoComando || null;
  const contractDetected = commandGroup === expectedGroup;
  const realPayloadReady = args.entity !== "orders" && ready > 0 && placeholderDetectedCount === 0;

  const maskedRows = classified.map((row, idx) => buildMaskedRow(args.entity, idx, row));
  let collisions = [];
  if (realPayloadReady && args.entity === "companies") collisions = collisionsForCompanies(args.tenantId, classified);
  if (realPayloadReady && args.entity === "products") collisions = collisionsForProducts(args.tenantId, classified);

  const validationArtifact = path.join(args.artifactDir, `imp-payload-validation-masked-${stamp}.json`);
  const collisionsArtifact = path.join(args.artifactDir, `imp-payload-collisions-masked-${stamp}.json`);
  const writePlanArtifact = path.join(args.artifactDir, `imp-payload-write-plan-masked-${stamp}.json`);

  writeJson(validationArtifact, {
    phase: "22CB-R2",
    entity: args.entity,
    input_path: args.input,
    array_path: arrayPath,
    command_group: commandGroup,
    expected_command_group: expectedGroup,
    contract_detected: contractDetected,
    placeholder_detected_count: placeholderDetectedCount,
    real_payload_ready: realPayloadReady,
    sample_size: sampled.length,
    ready_candidate: ready,
    blocked_total: sampled.length - ready,
    blocked_by_status: blockedByStatus,
    rows: maskedRows,
    safety: {
      no_db_write: true,
      no_erp_write_call: true,
      raw_payload_versioned: false,
    },
  });

  writeJson(collisionsArtifact, {
    phase: "22CB-R2",
    entity: args.entity,
    contract_detected: contractDetected,
    real_payload_ready: realPayloadReady,
    sample_size: sampled.length,
    collisions,
  });

  writeJson(writePlanArtifact, {
    phase: "22CB-R2",
    entity: args.entity,
    execute_write: false,
    contract_detected: contractDetected,
    real_payload_ready: realPayloadReady,
    ready_candidate: ready,
    blocked_total: sampled.length - ready,
    decision: realPayloadReady ? "candidate_ready_no_execution" : contractDetected ? "contract_only_requires_real_values" : "no_ready_candidates",
    idempotency_preferred:
      args.entity === "companies"
        ? "(tenant_id, cnpj)"
        : args.entity === "products"
          ? "(tenant_id, erp_product_code, versao_numero)"
          : "orders_diagnostic_only",
  });

  console.log(`entity=${args.entity}`);
  console.log(`sample_size=${sampled.length}`);
  console.log(`ready_candidate=${ready}`);
  console.log(`contract_detected=${contractDetected}`);
  console.log(`real_payload_ready=${realPayloadReady}`);
  console.log(`validation_artifact=${path.relative(process.cwd(), validationArtifact)}`);
  console.log(`collisions_artifact=${path.relative(process.cwd(), collisionsArtifact)}`);
  console.log(`write_plan_artifact=${path.relative(process.cwd(), writePlanArtifact)}`);
}

main().catch((error) => {
  console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
