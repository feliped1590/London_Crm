import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { order_id } = await req.json();

    if (!order_id) {
      return new Response(
        JSON.stringify({ error: "order_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch order with related data
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(`
        *,
        company:companies(id, name, cnpj, address, city, state, phone, email, address_number, neighborhood, zip_code),
        contact:contacts(id, first_name, last_name, email, phone),
        proposal:proposals(id, number),
        legal_entity:legal_entities(id, name, trade_name, cnpj, address, city, state, phone, email, logo_url)
      `)
      .eq("id", order_id)
      .single();

    if (orderError || !order) {
      console.error("Error fetching order:", orderError);
      return new Response(
        JSON.stringify({ error: "Order not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch order items
    const { data: items, error: itemsError } = await supabase
      .from("order_items")
      .select(`
        *,
        product:products(id, sku, name)
      `)
      .eq("order_id", order_id)
      .order("sort_order");

    if (itemsError) {
      console.error("Error fetching items:", itemsError);
    }

    // If no legal_entity on the order, fetch the default (headquarters) one
    let emitterEntity = order.legal_entity;
    if (!emitterEntity) {
      const { data: defaultEntity } = await supabase
        .from("legal_entities")
        .select("id, name, trade_name, cnpj, address, city, state, phone, email")
        .eq("active", true)
        .eq("is_headquarters", true)
        .limit(1)
        .maybeSingle();
      
      if (!defaultEntity) {
        // Fallback: get first active legal entity
        const { data: firstEntity } = await supabase
          .from("legal_entities")
          .select("id, name, trade_name, cnpj, address, city, state, phone, email")
          .eq("active", true)
          .order("name")
          .limit(1)
          .maybeSingle();
        emitterEntity = firstEntity;
      } else {
        emitterEntity = defaultEntity;
      }
    }

    const formatCurrency = (value: number) => {
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(value || 0);
    };

    const formatDate = (dateStr: string | null) => {
      if (!dateStr) return "-";
      return new Date(dateStr).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    };

    const todayBR = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

    const statusLabels: Record<string, string> = {
      pendente: "Pendente",
      confirmado: "Confirmado",
      em_producao: "Em Produção",
      pronto: "Pronto",
      enviado: "Enviado",
      entregue: "Entregue",
      cancelado: "Cancelado",
    };

    const statusColors: Record<string, string> = {
      pendente: "#f59e0b",
      confirmado: "#3b82f6",
      em_producao: "#8b5cf6",
      pronto: "#10b981",
      enviado: "#06b6d4",
      entregue: "#059669",
      cancelado: "#ef4444",
    };

    const statusLabel = statusLabels[order.status] || order.status;
    const statusColor = statusColors[order.status] || "#6b7280";

    const itemsHtml = (items || [])
      .map(
        (item: any, index: number) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${index + 1}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${item.product?.sku || "-"}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${item.description || item.product?.name || "-"}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">
          ${item.width || item.length || item.thickness ? `${item.width || "-"} x ${item.length || "-"} x ${item.thickness || "-"}` : "-"}
        </td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${item.quantity}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(item.unit_price)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold;">${formatCurrency(item.subtotal)}</td>
      </tr>
    `
      )
      .join("");

    // Use legal entity info (from order or default fallback)
    const emitter = emitterEntity
      ? {
          name: emitterEntity.name || emitterEntity.trade_name,
          cnpj: emitterEntity.cnpj,
          address: emitterEntity.address,
          city: emitterEntity.city,
          state: emitterEntity.state,
          phone: emitterEntity.phone,
          email: emitterEntity.email,
          logo_url: emitterEntity.logo_url,
        }
      : null;

    // Fetch seller name
    let sellerName = '';
    if (order.created_by) {
      const { data: sellerProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', order.created_by)
        .maybeSingle();
      sellerName = sellerProfile?.full_name || '';
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { 
            font-family: 'Helvetica', 'Arial', sans-serif; 
            margin: 0; 
            padding: 40px;
            color: #1f2937;
            font-size: 12px;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 40px;
            border-bottom: 3px solid #3b82f6;
            padding-bottom: 20px;
          }
          .logo img {
            max-height: 70px;
            width: auto;
          }
          .logo-text {
            margin-top: 5px;
            font-size: 10px;
            color: #1e3a5f;
            letter-spacing: 1px;
          }
          .order-info {
            text-align: right;
          }
          .order-number {
            font-size: 18px;
            font-weight: bold;
            color: #1f2937;
          }
          .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 4px;
            color: white;
            font-weight: bold;
            font-size: 11px;
            margin-top: 5px;
          }
          .section {
            margin-bottom: 30px;
          }
          .section-title {
            font-size: 14px;
            font-weight: bold;
            color: #3b82f6;
            margin-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
          }
          .info-box {
            background: #f9fafb;
            padding: 15px;
            border-radius: 8px;
          }
          .info-label {
            font-size: 10px;
            color: #6b7280;
            text-transform: uppercase;
            margin-bottom: 4px;
          }
          .info-value {
            font-size: 12px;
            color: #1f2937;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
          }
          th {
            background: #3b82f6;
            color: white;
            padding: 10px 8px;
            text-align: left;
            font-size: 11px;
            text-transform: uppercase;
          }
          .total-row {
            background: #f3f4f6;
          }
          .total-row td {
            padding: 12px 8px;
            font-weight: bold;
            font-size: 14px;
          }
          .terms {
            background: #f9fafb;
            padding: 20px;
            border-radius: 8px;
            margin-top: 30px;
          }
          .terms-title {
            font-weight: bold;
            margin-bottom: 10px;
          }
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            color: #6b7280;
            font-size: 10px;
          }
          .delivery-info {
            display: inline-block;
            background: #dbeafe;
            color: #1e40af;
            padding: 8px 16px;
            border-radius: 4px;
            font-weight: bold;
            margin-top: 10px;
          }
        </style>
      </head>
      <body>
        <div class="header">
           <div>
            ${emitter?.logo_url 
              ? `<div class="logo"><img src="${emitter.logo_url}" alt="${emitter.name || 'Logo'}" /></div>` 
              : `<div class="logo"><strong style="font-size: 18px;">${emitter?.name || 'CRMPro'}</strong></div>`
            }
            ${emitter ? `<p style="font-size: 10px; color: #6b7280; margin-top: 4px;">CNPJ: ${emitter.cnpj || "-"}</p>` : ""}
          </div>
          <div class="order-info">
            <div class="order-number">${order.number}</div>
            <p style="color: #6b7280; margin: 5px 0;">Data: ${todayBR}</p>
            <div class="status-badge" style="background-color: ${statusColor};">${statusLabel}</div>
            ${order.delivery_date ? `<div class="delivery-info">Entrega: ${formatDate(order.delivery_date)}</div>` : ""}
          </div>
        </div>

        ${order.proposal?.number ? `
        <div class="section">
          <div style="background: #f0fdf4; padding: 10px 15px; border-radius: 6px; border-left: 4px solid #22c55e;">
            <span style="font-size: 11px; color: #15803d;"><strong>Proposta de Origem:</strong> ${order.proposal.number}</span>
          </div>
        </div>
        ` : ""}

        <div class="section">
          <div class="section-title">Dados do Cliente</div>
          <div class="info-grid">
            <div class="info-box">
              <div class="info-label">Empresa</div>
              <div class="info-value" style="font-weight: bold; font-size: 14px;">
                ${order.company?.name || "Não informado"}
              </div>
              ${order.company?.cnpj ? `<div class="info-value">CNPJ: ${order.company.cnpj}</div>` : ""}
              ${order.company?.address ? `<div class="info-value">${order.company.address}${order.company.address_number ? ", " + order.company.address_number : ""}</div>` : ""}
              ${order.company?.neighborhood ? `<div class="info-value">${order.company.neighborhood}</div>` : ""}
              ${order.company?.city ? `<div class="info-value">${order.company.city}${order.company.state ? " - " + order.company.state : ""}${order.company.zip_code ? " | CEP: " + order.company.zip_code : ""}</div>` : ""}
              ${order.company?.phone ? `<div class="info-value">Tel: ${order.company.phone}</div>` : ""}
              ${order.company?.email ? `<div class="info-value">${order.company.email}</div>` : ""}
            </div>
            <div class="info-box">
              <div class="info-label">Contato</div>
              <div class="info-value" style="font-weight: bold; font-size: 14px;">
                ${order.contact ? `${order.contact.first_name} ${order.contact.last_name || ""}` : "Não informado"}
              </div>
              ${order.contact?.email ? `<div class="info-value">${order.contact.email}</div>` : ""}
              ${order.contact?.phone ? `<div class="info-value">${order.contact.phone}</div>` : ""}
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Itens do Pedido</div>
          <table>
            <thead>
              <tr>
                <th style="width: 30px;">#</th>
                <th style="width: 80px;">SKU</th>
                <th>Descrição</th>
                <th style="width: 100px; text-align: center;">Medidas (LxCxE)</th>
                <th style="width: 60px; text-align: right;">Qtd</th>
                <th style="width: 90px; text-align: right;">Preço Unit.</th>
                <th style="width: 100px; text-align: right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
              <tr class="total-row">
                <td colspan="6" style="text-align: right; border-top: 2px solid #3b82f6;">VALOR TOTAL:</td>
                <td style="text-align: right; border-top: 2px solid #3b82f6; color: #3b82f6;">
                  ${formatCurrency(order.total_value)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        ${order.observations ? `
        <div class="terms">
          <div class="terms-title">Observações</div>
          <p>${order.observations}</p>
        </div>
        ` : ""}

        ${sellerName ? `
        <div class="section" style="margin-top: 30px;">
          <div style="background: #f0f9ff; padding: 12px 16px; border-radius: 6px; border-left: 4px solid #3b82f6;">
            <span style="font-size: 11px; color: #1e40af;"><strong>Vendedor:</strong> ${sellerName}</span>
          </div>
        </div>
        ` : ''}

        <div class="footer">
          <p><strong>${emitter?.name || "FDK Personalizados"}</strong></p>
          ${emitter?.phone ? `<p>Tel: ${emitter.phone}</p>` : ""}
          ${emitter?.email ? `<p>${emitter.email}</p>` : ""}
          <p style="margin-top: 10px;">Documento gerado em ${todayBR}</p>
        </div>
      </body>
      </html>
    `;

    return new Response(
      JSON.stringify({
        success: true,
        html: html,
        order_number: order.number,
        message: "HTML gerado com sucesso. Use Ctrl+P no navegador para salvar como PDF.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error generating order PDF:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Internal server error", details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
