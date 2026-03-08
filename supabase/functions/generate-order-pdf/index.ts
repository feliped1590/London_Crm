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

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(`
        *,
        company:companies(id, name, cnpj, inscricao_estadual, address, city, state, phone, email, address_number, neighborhood, zip_code, sales_rep:sales_reps(id, name, phone, email)),
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

    let emitterEntity = order.legal_entity;
    if (!emitterEntity) {
      const { data: defaultEntity } = await supabase
        .from("legal_entities")
        .select("id, name, trade_name, cnpj, address, city, state, phone, email, logo_url")
        .eq("active", true)
        .eq("is_headquarters", true)
        .limit(1)
        .maybeSingle();
      
      if (!defaultEntity) {
        const { data: firstEntity } = await supabase
          .from("legal_entities")
          .select("id, name, trade_name, cnpj, address, city, state, phone, email, logo_url")
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

    const ipiMode = order.ipi_mode || 'isento';
    const showIpi = ipiMode !== 'isento';
    const ipiModeLabels: Record<string, string> = {
      destacar: 'IPI Destacado',
      incluso: 'IPI Incluso',
      isento: 'Isento de IPI',
    };

    const calculateIpiValue = (subtotalItem: number, ipiRate: number) => {
      if (ipiMode === 'isento' || ipiRate <= 0) return 0;
      if (ipiMode === 'destacar') return subtotalItem * (ipiRate / 100);
      if (ipiMode === 'incluso') return subtotalItem * (ipiRate / (100 + ipiRate));
      return 0;
    };

    const itemsData = (items || []).map((item: any) => {
      const ipiRate = item.ipi_rate || 0;
      const ipiValue = item.ipi_value || calculateIpiValue(item.subtotal || 0, ipiRate);
      const totalItem = ipiMode === 'destacar' ? (item.subtotal || 0) + ipiValue : (item.subtotal || 0);
      return { ...item, ipiRate, ipiValue, totalItem };
    });

    const subtotalProducts = order.subtotal_products || itemsData.reduce((sum: number, i: any) => sum + (i.subtotal || 0), 0);
    const totalIpi = order.total_ipi || itemsData.reduce((sum: number, i: any) => sum + i.ipiValue, 0);

    const emitter = emitterEntity
      ? {
          name: emitterEntity.name || emitterEntity.trade_name,
          cnpj: emitterEntity.cnpj,
          phone: emitterEntity.phone,
          email: emitterEntity.email,
          logo_url: emitterEntity.logo_url,
        }
      : null;

    const sellerName = order.company?.sales_rep?.name || '';
    const sellerPhone = order.company?.sales_rep?.phone || '';
    const sellerEmail = order.company?.sales_rep?.email || '';

    const companyIE = order.company?.inscricao_estadual || order.company?.state_registration || order.company?.ie || '-';

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
      pendente: "#d69e2e",
      confirmado: "#3182ce",
      em_producao: "#805ad5",
      pronto: "#38a169",
      enviado: "#0891b2",
      entregue: "#059669",
      cancelado: "#e53e3e",
    };

    const statusLabel = statusLabels[order.status] || order.status;
    const statusColor = statusColors[order.status] || "#718096";

    const itemsHtml = itemsData.map((item: any, index: number) => {
      const unitMeasure = item.unit_measure || item.product?.unit_measure || 'UN';
      return `
      <tr>
        <td>${index + 1}</td>
        <td>${item.product?.sku || "-"}</td>
        <td class="desc-col">${item.description || item.product?.name || "-"}</td>
        <td class="center">${item.width || item.length || item.thickness ? `${item.width || "-"} x ${item.length || "-"} x ${item.thickness || "-"}` : "-"}</td>
        <td class="right">${item.quantity}</td>
        <td class="center">${unitMeasure}</td>
        <td class="right">${formatCurrency(item.unit_price)}</td>
        <td class="right">${formatCurrency(item.subtotal)}</td>
        ${showIpi ? `
          <td class="right">${(item.ipiRate || 0).toFixed(2)}%</td>
          <td class="right">${formatCurrency(item.ipiValue)}</td>
        ` : ''}
      </tr>
    `}).join("");

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Pedido ${order.number}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; 
            padding: 30px 35px;
            color: #1a1a2e;
            font-size: 11px;
            line-height: 1.4;
          }
          
          /* ===== PRINT ===== */
          @media print {
            body { padding: 15px 20px; }
            .page-break { page-break-before: always; }
          }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          thead { display: table-header-group; }
          
          /* ===== HEADER ===== */
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            padding-bottom: 15px;
            border-bottom: 2px solid #2d3748;
            margin-bottom: 20px;
          }
          .header-left { display: flex; align-items: center; gap: 15px; }
          .header-logo img { max-height: 60px; width: auto; }
          .header-company { font-size: 10px; color: #4a5568; }
          .header-company .company-name { font-size: 15px; font-weight: 700; color: #1a1a2e; margin-bottom: 2px; }
          .header-right { text-align: right; }
          .doc-title { font-size: 16px; font-weight: 700; color: #2d3748; text-transform: uppercase; letter-spacing: 1px; }
          .doc-number { font-size: 20px; font-weight: 700; color: #2d3748; margin: 4px 0; }
          .doc-meta { font-size: 10px; color: #4a5568; margin: 2px 0; }
          .badge { display: inline-block; padding: 3px 10px; border-radius: 3px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }
          .badge-status { color: #fff; }
          .badge-ipi { background: #dbeafe; color: #1e40af; margin-left: 4px; }
          .badge-delivery { background: #c6f6d5; color: #22543d; }
          
          /* ===== SECTIONS ===== */
          .section { margin-bottom: 18px; }
          .section-title {
            font-size: 11px; font-weight: 700; color: #2d3748;
            text-transform: uppercase; letter-spacing: 0.8px;
            padding: 5px 10px; background: #edf2f7; border-left: 3px solid #2d3748;
            margin-bottom: 10px;
          }
          
          /* ===== CLIENT GRID ===== */
          .client-grid { display: flex; gap: 15px; }
          .client-box { flex: 1; border: 1px solid #e2e8f0; border-radius: 4px; padding: 12px; }
          .client-box .label { font-size: 9px; color: #718096; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; font-weight: 600; }
          .client-box .name { font-size: 13px; font-weight: 700; color: #1a1a2e; margin-bottom: 4px; }
          .client-box .detail { font-size: 10px; color: #4a5568; margin: 2px 0; }
          
          /* ===== ORIGIN ===== */
          .origin-box { background: #f0fdf4; padding: 8px 14px; border-radius: 4px; border-left: 3px solid #38a169; font-size: 11px; color: #22543d; margin-bottom: 18px; }
          
          /* ===== SELLER BOX ===== */
          .seller-box { margin-top: 10px; border: 1px solid #e2e8f0; border-radius: 4px; padding: 10px 12px; background: #f7fafc; display: flex; gap: 25px; align-items: center; }
          .seller-box .label { font-size: 9px; color: #718096; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
          .seller-box .value { font-size: 11px; color: #1a1a2e; font-weight: 600; }
          .seller-box .sub { font-size: 10px; color: #4a5568; }
          
          /* ===== TABLE ===== */
          table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 10px; }
          thead th {
            background: #2d3748; color: #fff;
            padding: 7px 6px; text-align: left;
            font-size: 9px; text-transform: uppercase;
            letter-spacing: 0.5px; font-weight: 600;
          }
          tbody tr:nth-child(even) { background: #f7fafc; }
          tbody td { padding: 6px; border-bottom: 1px solid #e2e8f0; }
          .center { text-align: center; }
          .right { text-align: right; }
          .bold { font-weight: 700; }
          .desc-col { max-width: 200px; }
          
          /* ===== TOTALS ===== */
          .totals-wrapper { display: flex; justify-content: flex-end; margin-top: 12px; }
          .totals-box {
            min-width: 280px; border: 1px solid #e2e8f0; border-radius: 4px;
            overflow: hidden;
          }
          .totals-row { display: flex; justify-content: space-between; padding: 7px 14px; font-size: 11px; }
          .totals-row:nth-child(even) { background: #f7fafc; }
          .totals-row.grand {
            background: #2d3748; color: #fff;
            font-size: 14px; font-weight: 700; padding: 10px 14px;
          }
          
          /* ===== CONDITIONS ===== */
          .conditions-box { border: 1px solid #e2e8f0; border-radius: 4px; padding: 14px; }
          .conditions-box p { margin: 4px 0; font-size: 11px; }
          .conditions-box strong { color: #2d3748; }
          
          /* ===== ACCEPTANCE ===== */
          .acceptance { margin-top: 25px; border: 1px solid #e2e8f0; border-radius: 4px; padding: 20px; }
          .acceptance-title { font-size: 11px; font-weight: 700; color: #2d3748; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 20px; }
          .acceptance-grid { display: flex; justify-content: space-between; gap: 30px; margin-top: 30px; }
          .acceptance-field { flex: 1; text-align: center; }
          .acceptance-line { border-top: 1px solid #1a1a2e; padding-top: 6px; font-size: 10px; color: #4a5568; }
          
          /* ===== FOOTER ===== */
          .footer {
            margin-top: 25px; padding-top: 12px;
            border-top: 2px solid #2d3748;
            text-align: center; font-size: 9px; color: #718096;
          }
          .footer strong { color: #2d3748; font-size: 10px; }
        </style>
      </head>
      <body>
        <!-- CABEÇALHO -->
        <div class="header">
          <div class="header-left">
            ${emitter?.logo_url 
              ? `<div class="header-logo"><img src="${emitter.logo_url}" alt="${emitter.name || 'Logo'}" /></div>` 
              : ''
            }
            <div class="header-company">
              <div class="company-name">${emitter?.name || 'Empresa'}</div>
              ${emitter?.cnpj ? `<div>CNPJ: ${emitter.cnpj}</div>` : ''}
              ${emitter?.phone ? `<div>Tel: ${emitter.phone}</div>` : ''}
              ${emitter?.email ? `<div>${emitter.email}</div>` : ''}
            </div>
          </div>
          <div class="header-right">
            <div class="doc-title">Pedido de Venda</div>
            <div class="doc-number">${order.number}</div>
            <div class="doc-meta">Emissão: ${todayBR}</div>
            ${order.delivery_date ? `<div class="doc-meta">Entrega: ${formatDate(order.delivery_date)}</div>` : ''}
            ${sellerName ? `<div class="doc-meta">Vendedor: ${sellerName}</div>` : ''}
            <span class="badge badge-status" style="background-color: ${statusColor};">${statusLabel}</span>
            ${showIpi ? `<span class="badge badge-ipi">${ipiModeLabels[ipiMode] || ipiMode}</span>` : ''}
          </div>
        </div>

        <!-- PROPOSTA DE ORIGEM -->
        ${order.proposal?.number ? `
        <div class="origin-box">
          <strong>Proposta de Origem:</strong> ${order.proposal.number}
        </div>
        ` : ""}

        <!-- DADOS DO CLIENTE -->
        <div class="section">
          <div class="section-title">Dados do Cliente</div>
          <div class="client-grid">
            <div class="client-box">
              <div class="label">Empresa</div>
              <div class="name">${order.company?.name || "Não informado"}</div>
              ${order.company?.cnpj ? `<div class="detail">CNPJ: ${order.company.cnpj}</div>` : ""}
              <div class="detail">IE: ${companyIE}</div>
              ${order.company?.address ? `<div class="detail">${order.company.address}${order.company.address_number ? ", " + order.company.address_number : ""}</div>` : ""}
              ${order.company?.neighborhood ? `<div class="detail">${order.company.neighborhood}</div>` : ""}
              ${order.company?.city ? `<div class="detail">${order.company.city}${order.company.state ? " / " + order.company.state : ""}${order.company.zip_code ? " - CEP: " + order.company.zip_code : ""}</div>` : ""}
              ${order.company?.phone ? `<div class="detail">Tel: ${order.company.phone}</div>` : ""}
              ${order.company?.email ? `<div class="detail">${order.company.email}</div>` : ""}
            </div>
            <div class="client-box">
              <div class="label">Contato</div>
              <div class="name">${order.contact ? `${order.contact.first_name} ${order.contact.last_name || ""}` : "Não informado"}</div>
              ${order.contact?.phone ? `<div class="detail">Tel: ${order.contact.phone}</div>` : ""}
              ${order.contact?.email ? `<div class="detail">${order.contact.email}</div>` : ""}
            </div>
          </div>
          ${sellerName ? `
          <div class="seller-box">
            <div>
              <div class="label">Vendedor Responsável</div>
              <div class="value">${sellerName}</div>
            </div>
            ${sellerEmail ? `<div class="sub">${sellerEmail}</div>` : ''}
            ${sellerPhone ? `<div class="sub">Tel: ${sellerPhone}</div>` : ''}
          </div>
          ` : ''}
        </div>

        <!-- TABELA DE ITENS -->
        <div class="section">
          <div class="section-title">Itens do Pedido</div>
          <table>
            <thead>
              <tr>
                <th style="width:28px;">Item</th>
                <th style="width:70px;">Código</th>
                <th>Descrição</th>
                <th style="width:90px;" class="center">Medidas</th>
                <th style="width:40px;" class="right">Qtd</th>
                <th style="width:35px;" class="center">Un</th>
                <th style="width:80px;" class="right">Preço Unit.</th>
                <th style="width:85px;" class="right">Subtotal</th>
                ${showIpi ? `
                  <th style="width:45px;" class="right">IPI%</th>
                  <th style="width:70px;" class="right">IPI R$</th>
                ` : ''}
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <!-- TOTAIS -->
          <div class="totals-wrapper">
            <div class="totals-box">
              ${showIpi ? `
                <div class="totals-row">
                  <span>Subtotal Produtos:</span>
                  <span>${formatCurrency(subtotalProducts)}</span>
                </div>
                <div class="totals-row">
                  <span>IPI Total${ipiMode === 'incluso' ? ' (informativo)' : ''}:</span>
                  <span>${formatCurrency(totalIpi)}</span>
                </div>
              ` : ''}
              <div class="totals-row grand">
                <span>VALOR TOTAL:</span>
                <span>${formatCurrency(order.total_value)}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- OBSERVAÇÕES -->
        ${order.observations ? `
        <div class="section">
          <div class="section-title">Observações</div>
          <div class="conditions-box">
            <p>${order.observations}</p>
          </div>
        </div>
        ` : ""}

        <!-- ACEITE DO CLIENTE -->
        <div class="acceptance">
          <div class="acceptance-title">Aceite do Cliente</div>
          <p style="font-size: 10px; color: #4a5568; margin-bottom: 10px;">
            Declaro que li e concordo com todas as condições descritas neste pedido de venda.
          </p>
          <div class="acceptance-grid">
            <div class="acceptance-field">
              <div class="acceptance-line">Assinatura do Responsável</div>
            </div>
            <div class="acceptance-field">
              <div class="acceptance-line">Carimbo da Empresa</div>
            </div>
            <div class="acceptance-field">
              <div class="acceptance-line">Data: ____/____/________</div>
            </div>
          </div>
        </div>

        <!-- RODAPÉ -->
        <div class="footer">
          <strong>${emitter?.name || 'Empresa'}</strong>
          ${emitter?.cnpj ? ` &nbsp;|&nbsp; CNPJ: ${emitter.cnpj}` : ''}
          ${emitter?.phone ? ` &nbsp;|&nbsp; Tel: ${emitter.phone}` : ''}
          ${emitter?.email ? ` &nbsp;|&nbsp; ${emitter.email}` : ''}
          <br/>
          <span style="font-size: 8px;">Para dúvidas, entre em contato conosco. &nbsp;|&nbsp; Documento gerado em ${todayBR}</span>
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
