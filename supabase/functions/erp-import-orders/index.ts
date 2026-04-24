import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkAccessWindowForTenant, AccessWindowError, AccessCheckUnavailableError } from "../_shared/accessControl.ts";

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

function normalizeDatetime(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const dateStr = normalizeDate(raw);
  if (!dateStr) return null;
  return `${dateStr}T00:00:00.000Z`;
}

function trimOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function toNumeric(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
  return isNaN(n) ? null : n;
}

function toInt(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? Math.round(v) : parseInt(String(v), 10);
  return isNaN(n) ? null : n;
}

// ── Types ───────────────────────────────────────────────────────────────────

interface ERPOrderItem {
  sequencia?: unknown;
  cd_material?: string;
  dt_item?: string;
  quantidade?: unknown;
  pr_unitario?: unknown;
  pe_desconto?: unknown;
  pe_comissao?: unknown;
  controle?: string;       // situacao item
  dt_aprovacao?: string;
  dt_prazo_entreg?: string;
  // ERP auxiliary fields
  cd_unidade_me?: string;
  pr_custo?: unknown;
  cd_centro_custo?: string;
  cd_conta?: string;
  cd_cfop?: string;
  pr_lista?: unknown;
  cd_detalhe?: string;
  lote?: string;
  numero_romaneio?: string;
  [key: string]: unknown;
}

interface ERPOrderRecord {
  cd_pedido?: string;
  dt_pedido?: string;
  cd_cliente?: string;
  cd_empresa?: unknown;  // ERP company code → legal_entity lookup
  dt_entrega?: string;
  total_pedido?: unknown;
  situacao?: string;
  observacao?: string;
  cd_representant?: string;
  total_de_mercad?: unknown;
  vl_total_descon?: unknown;
  vl_frete?: unknown;
  tipo_frete?: string;
  dt_aprovacao?: string;
  dt_validade?: string;
  dt_modificacao?: string;
  // ERP auxiliary fields
  tipo_operacao?: string;
  cd_condicao_pg?: string;
  cd_transportad?: string;
  cd_vendedor?: string;
  cd_tipo_pedido?: string;
  numero_nota_fis?: string;
  moeda?: string;
  pe_comissao?: unknown;
  cd_mercado?: string;
  cd_unidade_neg?: string;
  sessao?: unknown;
  dt_cadastro?: string;
  // Items
  items?: ERPOrderItem[];
  [key: string]: unknown;
}

interface Summary {
  total_received: number;
  total_processed: number;
  inserted: number;
  updated: number;
  skipped: number;
  items_inserted: number;
  items_updated: number;
  conflicts_detected: number;
  errors: { index: number; erp_code: string | null; message: string }[];
}

// ── Main handler ────────────────────────────────────────────────────────────

const BATCH_SIZE = 50;

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

    // ⏰ Janela de acesso por tenant (strict — importações pesadas só dentro do horário)
    try {
      await checkAccessWindowForTenant(supabase, tenant_id, {
        mode: "strict",
        context: "erp-import-orders",
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
      items_inserted: 0,
      items_updated: 0,
      conflicts_detected: 0,
      errors: [],
    };

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);

      for (let j = 0; j < batch.length; j++) {
        const globalIdx = i + j;
        const raw = batch[j] as ERPOrderRecord;

        try {
          const erpOrderCode = trimOrNull(raw.cd_pedido);

          if (!erpOrderCode) {
            summary.skipped++;
            summary.errors.push({ index: globalIdx, erp_code: null, message: "Missing required field: cd_pedido" });
            continue;
          }

          // ── Lookup company ──────────────────────────────────────
          const clientCode = trimOrNull(raw.cd_cliente);
          if (!clientCode) {
            summary.skipped++;
            await logConflict(supabase, tenant_id, "order", null, erpOrderCode, "company_id", null, clientCode, "company_not_found");
            summary.conflicts_detected++;
            summary.errors.push({ index: globalIdx, erp_code: erpOrderCode, message: "Missing cd_cliente" });
            continue;
          }

          const { data: company } = await supabase
            .from("companies")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("erp_code", clientCode)
            .maybeSingle();

          if (!company) {
            summary.skipped++;
            await logConflict(supabase, tenant_id, "order", null, erpOrderCode, "company_id", null, clientCode, "company_not_found");
            summary.conflicts_detected++;
            summary.errors.push({ index: globalIdx, erp_code: erpOrderCode, message: `Company not found for erp_code: ${clientCode}` });
            continue;
          }

          // ── Lookup legal_entity ────────────────────────────────
          const erpCompanyCode = trimOrNull(raw.cd_empresa);
          let legalEntityId: string | null = null;

          if (erpCompanyCode) {
            const { data: legalEntity } = await supabase
              .from("legal_entities")
              .select("id")
              .eq("tenant_id", tenant_id)
              .eq("erp_company_code", erpCompanyCode)
              .maybeSingle();

            if (!legalEntity) {
              summary.skipped++;
              await logConflict(supabase, tenant_id, "order", null, erpOrderCode, "legal_entity_id", null, erpCompanyCode, "legal_entity_not_found");
              summary.conflicts_detected++;
              summary.errors.push({ index: globalIdx, erp_code: erpOrderCode, message: `Legal entity not found for erp_company_code: ${erpCompanyCode}` });
              continue;
            }
            legalEntityId = legalEntity.id;
          }
          // If ERP doesn't send cd_empresa, legal_entity_id stays null (acceptable for now)

          // ── Normalize order fields ──────────────────────────────
          const orderDate = normalizeDate(raw.dt_pedido);
          const erpModDate = normalizeDatetime(raw.dt_modificacao);

          // ── Lookup existing order ───────────────────────────────
          let existing: Record<string, unknown> | null = null;

          // Priority 1: (tenant_id, number)
          const { data: byNumber } = await supabase
            .from("orders")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("number", erpOrderCode)
            .maybeSingle();
          if (byNumber) existing = byNumber;

          // Priority 2: (tenant_id, erp_order_code)
          if (!existing) {
            const { data: byErpCode } = await supabase
              .from("orders")
              .select("*")
              .eq("tenant_id", tenant_id)
              .eq("erp_order_code", erpOrderCode)
              .maybeSingle();
            if (byErpCode) existing = byErpCode;
          }

          let orderId: string;

          if (existing) {
            // ── UPDATE path ─────────────────────────────────────

            // Version regression check
            if (existing.erp_last_update_date && erpModDate) {
              const currentDate = new Date(existing.erp_last_update_date as string);
              const incomingDate = new Date(erpModDate);
              if (currentDate > incomingDate) {
                summary.skipped++;
                summary.errors.push({ index: globalIdx, erp_code: erpOrderCode, message: "Version regression: existing data is newer" });
                continue;
              }
            }

            orderId = existing.id as string;
            const origin = existing.origin as string;
            const fieldsToUpdate: Record<string, unknown> = {};

            // Always update ERP metadata
            fieldsToUpdate.erp_order_code = erpOrderCode;
            fieldsToUpdate.erp_synced_at = new Date().toISOString();
            fieldsToUpdate.erp_last_update_date = erpModDate ?? existing.erp_last_update_date;
            fieldsToUpdate.erp_status = trimOrNull(raw.situacao) ?? existing.erp_status;
            fieldsToUpdate.erp_rep_code = trimOrNull(raw.cd_representant) ?? existing.erp_rep_code;

            if (origin === "ERP") {
              // ERP origin: can update totals, company, commercial fields
              if (legalEntityId) fieldsToUpdate.legal_entity_id = legalEntityId;
              fieldsToUpdate.total_value = toNumeric(raw.total_pedido) ?? existing.total_value;
              fieldsToUpdate.total_discount = toNumeric(raw.vl_total_descon) ?? existing.total_discount;
              fieldsToUpdate.freight_value = toNumeric(raw.vl_frete) ?? existing.freight_value;
              fieldsToUpdate.freight_type = trimOrNull(raw.tipo_frete) ?? existing.freight_type;
              fieldsToUpdate.company_id = company.id;
              fieldsToUpdate.order_date = orderDate ?? existing.order_date;
              fieldsToUpdate.delivery_date = normalizeDate(raw.dt_entrega) ?? existing.delivery_date;
              fieldsToUpdate.approved_at = normalizeDatetime(raw.dt_aprovacao) ?? existing.approved_at;
              fieldsToUpdate.valid_until = normalizeDate(raw.dt_validade) ?? existing.valid_until;
              fieldsToUpdate.observations = trimOrNull(raw.observacao) ?? existing.observations;
            }
            // CRM origin: only ERP metadata updated (already set above)

            const { error: updateErr } = await supabase
              .from("orders")
              .update(fieldsToUpdate)
              .eq("id", orderId);
            if (updateErr) throw new Error(`Order update failed: ${updateErr.message}`);

            summary.updated++;
          } else {
            // ── INSERT path ─────────────────────────────────────
            const orderData: Record<string, unknown> = {
              tenant_id,
              number: erpOrderCode,
              origin: "ERP",
              company_id: company.id,
              legal_entity_id: legalEntityId,
              status: "pendente",
              order_date: orderDate,
              delivery_date: normalizeDate(raw.dt_entrega),
              total_value: toNumeric(raw.total_pedido) ?? 0,
              total_goods: toNumeric(raw.total_de_mercad),
              total_discount: toNumeric(raw.vl_total_descon),
              freight_value: toNumeric(raw.vl_frete),
              freight_type: trimOrNull(raw.tipo_frete),
              observations: trimOrNull(raw.observacao),
              erp_status: trimOrNull(raw.situacao),
              erp_rep_code: trimOrNull(raw.cd_representant),
              approved_at: normalizeDatetime(raw.dt_aprovacao),
              valid_until: normalizeDate(raw.dt_validade),
              erp_order_code: erpOrderCode,
              erp_synced_at: new Date().toISOString(),
              erp_last_update_date: erpModDate,
            };

            const { data: inserted, error: insertErr } = await supabase
              .from("orders")
              .insert(orderData)
              .select("id")
              .single();

            if (insertErr) throw new Error(`Order insert failed: ${insertErr.message}`);
            orderId = inserted.id;
            summary.inserted++;
          }

          // ── Upsert order_erp_data ───────────────────────────────
          await upsertOrderErpData(supabase, orderId, tenant_id, raw);

          // ── Process items ───────────────────────────────────────
          const items = raw.items ?? [];
          for (const item of items) {
            try {
              const seq = toInt(item.sequencia);
              const materialCode = trimOrNull(item.cd_material);

              // Lookup product
              let productId: string | null = null;
              if (materialCode) {
                const { data: product } = await supabase
                  .from("products")
                  .select("id")
                  .eq("tenant_id", tenant_id)
                  .eq("erp_product_code", materialCode)
                  .maybeSingle();
                if (product) productId = product.id;
              }

              const quantity = toNumeric(item.quantidade) ?? 0;
              const unitPrice = toNumeric(item.pr_unitario) ?? 0;
              const discountPct = toNumeric(item.pe_desconto) ?? 0;
              // CRM always recalculates subtotal
              const subtotal = quantity * unitPrice * (1 - discountPct / 100);

              // Lookup existing item
              let existingItem: Record<string, unknown> | null = null;
              if (seq !== null) {
                const { data: bySeq } = await supabase
                  .from("order_items")
                  .select("*")
                  .eq("order_id", orderId)
                  .eq("erp_item_sequence", seq)
                  .maybeSingle();
                if (bySeq) existingItem = bySeq;
              }

              if (existingItem) {
                const itemUpdate: Record<string, unknown> = {
                  product_id: productId ?? existingItem.product_id,
                  quantity,
                  unit_price: unitPrice,
                  discount_percent: discountPct,
                  subtotal,
                  erp_status: trimOrNull(item.controle) ?? existingItem.erp_status,
                  item_date: normalizeDate(item.dt_item) ?? existingItem.item_date,
                  approved_at: normalizeDatetime(item.dt_aprovacao) ?? existingItem.approved_at,
                  commission_pct: toNumeric(item.pe_comissao) ?? existingItem.commission_pct,
                  delivery_date: normalizeDate(item.dt_prazo_entreg) ?? existingItem.delivery_date,
                  erp_synced_at: new Date().toISOString(),
                };

                const { error } = await supabase
                  .from("order_items")
                  .update(itemUpdate)
                  .eq("id", existingItem.id);
                if (error) throw new Error(`Item update failed: ${error.message}`);

                await upsertOrderItemErpData(supabase, existingItem.id as string, tenant_id, item);
                summary.items_updated++;
              } else {
                const itemData = {
                  tenant_id,
                  order_id: orderId,
                  product_id: productId,
                  description: materialCode ?? "Item ERP",
                  quantity,
                  unit_price: unitPrice,
                  discount_percent: discountPct,
                  subtotal,
                  sort_order: seq ?? 0,
                  erp_status: trimOrNull(item.controle),
                  item_date: normalizeDate(item.dt_item),
                  approved_at: normalizeDatetime(item.dt_aprovacao),
                  commission_pct: toNumeric(item.pe_comissao),
                  delivery_date: normalizeDate(item.dt_prazo_entreg),
                  erp_item_sequence: seq,
                  erp_synced_at: new Date().toISOString(),
                };

                const { data: insertedItem, error } = await supabase
                  .from("order_items")
                  .insert(itemData)
                  .select("id")
                  .single();
                if (error) throw new Error(`Item insert failed: ${error.message}`);

                await upsertOrderItemErpData(supabase, insertedItem.id, tenant_id, item);
                summary.items_inserted++;
              }
            } catch (itemErr) {
              summary.errors.push({
                index: globalIdx,
                erp_code: erpOrderCode,
                message: `Item error: ${itemErr instanceof Error ? itemErr.message : String(itemErr)}`,
              });
            }
          }

          summary.total_processed++;
        } catch (err) {
          summary.errors.push({
            index: globalIdx,
            erp_code: trimOrNull(raw.cd_pedido),
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

// ── Conflict logger ─────────────────────────────────────────────────────────

async function logConflict(
  supabase: any,
  tenantId: string,
  entityType: string,
  entityId: string | null,
  erpCode: string | null,
  fieldName: string,
  crmValue: string | null,
  erpValue: string | null,
  resolution: string
) {
  await supabase.from("import_conflict_log").insert({
    tenant_id: tenantId,
    entity_type: entityType,
    entity_id: entityId,
    erp_code: erpCode,
    field_name: fieldName,
    crm_value: crmValue,
    erp_value: erpValue,
    auto_resolved: resolution === "auto_erp_fill",
    resolution,
  });
}

// ── Order ERP Data upsert ───────────────────────────────────────────────────

async function upsertOrderErpData(
  supabase: any,
  orderId: string,
  tenantId: string,
  raw: ERPOrderRecord
) {
  const erpData = {
    order_id: orderId,
    tenant_id: tenantId,
    operation_type: trimOrNull(raw.tipo_operacao),
    payment_condition: trimOrNull(raw.cd_condicao_pg),
    carrier_code: trimOrNull(raw.cd_transportad),
    seller_code: trimOrNull(raw.cd_vendedor),
    erp_order_type: trimOrNull(raw.cd_tipo_pedido),
    invoice_number: trimOrNull(raw.numero_nota_fis),
    currency_code: trimOrNull(raw.moeda),
    commission_pct: toNumeric(raw.pe_comissao),
    market_code: trimOrNull(raw.cd_mercado),
    business_unit: trimOrNull(raw.cd_unidade_neg),
    session_id: toInt(raw.sessao),
    erp_registered_at: normalizeDate(raw.dt_cadastro),
    erp_modified_at: normalizeDate(raw.dt_modificacao),
  };

  const { data: existing } = await supabase
    .from("order_erp_data")
    .select("id")
    .eq("order_id", orderId)
    .maybeSingle();

  if (existing) {
    await supabase.from("order_erp_data").update(erpData).eq("id", existing.id);
  } else {
    await supabase.from("order_erp_data").insert(erpData);
  }
}

// ── Order Item ERP Data upsert ──────────────────────────────────────────────

async function upsertOrderItemErpData(
  supabase: any,
  orderItemId: string,
  tenantId: string,
  raw: ERPOrderItem
) {
  const erpData = {
    order_item_id: orderItemId,
    tenant_id: tenantId,
    unit_measure: trimOrNull(raw.cd_unidade_me),
    cost_price: toNumeric(raw.pr_custo),
    cost_center: trimOrNull(raw.cd_centro_custo),
    account_code: trimOrNull(raw.cd_conta),
    cfop: trimOrNull(raw.cd_cfop),
    list_price: toNumeric(raw.pr_lista),
    detail_code: trimOrNull(raw.cd_detalhe),
    batch_code: trimOrNull(raw.lote),
    packing_list_number: trimOrNull(raw.numero_romaneio),
  };

  const { data: existing } = await supabase
    .from("order_item_erp_data")
    .select("id")
    .eq("order_item_id", orderItemId)
    .maybeSingle();

  if (existing) {
    await supabase.from("order_item_erp_data").update(erpData).eq("id", existing.id);
  } else {
    await supabase.from("order_item_erp_data").insert(erpData);
  }
}
