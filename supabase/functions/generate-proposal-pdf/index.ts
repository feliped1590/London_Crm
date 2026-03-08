import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { proposal_id } = await req.json();

    if (!proposal_id) {
      return new Response(
        JSON.stringify({ error: 'proposal_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: proposal, error: proposalError } = await supabase
      .from('proposals')
      .select(`
        *,
        company:companies(id, name, cnpj, address, address_number, neighborhood, city, state, phone, email, sales_rep:sales_reps(id, name, phone, email)),
        contact:contacts(id, first_name, last_name, email, phone),
        deal:deals(id, name, legal_entity:legal_entities(id, name, cnpj, logo_url, phone, email))
      `)
      .eq('id', proposal_id)
      .single();

    if (proposalError || !proposal) {
      console.error('Error fetching proposal:', proposalError);
      return new Response(
        JSON.stringify({ error: 'Proposal not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: items, error: itemsError } = await supabase
      .from('proposal_items')
      .select(`
        *,
        product:products(id, sku, name)
      `)
      .eq('proposal_id', proposal_id)
      .order('sort_order');

    if (itemsError) {
      console.error('Error fetching items:', itemsError);
    }

    const legalEntity = proposal.deal?.legal_entity || null;
    const ipiMode = proposal.ipi_mode || 'destacar';
    const showIpi = ipiMode !== 'isento';

    // Get sales rep name from company
    const salesRepName = proposal.company?.sales_rep?.name || '';
    const salesRepPhone = proposal.company?.sales_rep?.phone || '';
    const salesRepEmail = proposal.company?.sales_rep?.email || '';

    // Fetch seller name (user who created)
    let sellerName = '';
    if (proposal.created_by) {
      const { data: sellerProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', proposal.created_by)
        .maybeSingle();
      sellerName = sellerProfile?.full_name || '';
    }

    const formatCurrency = (value: number) => {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(value || 0);
    };

    const formatDate = (dateStr: string | null) => {
      if (!dateStr) return '-';
      return new Date(dateStr).toLocaleDateString('pt-BR');
    };

    // Calculate IPI for each item
    const calculateIpiValue = (subtotalItem: number, ipiRate: number) => {
      if (ipiMode === 'isento' || ipiRate <= 0) return 0;
      if (ipiMode === 'destacar') return subtotalItem * (ipiRate / 100);
      if (ipiMode === 'incluso') return subtotalItem * (ipiRate / (100 + ipiRate));
      return 0;
    };

    // Calculate totals
    let subtotalProducts = 0;
    let totalIpi = 0;

    const processedItems = (items || []).map((item: any) => {
      const subtotal = item.subtotal || (item.quantity * item.unit_price);
      const ipiRate = item.ipi_rate || 0;
      const ipiValue = item.ipi_value != null ? item.ipi_value : calculateIpiValue(subtotal, ipiRate);
      const totalItem = ipiMode === 'destacar' ? subtotal + ipiValue : subtotal;
      
      subtotalProducts += subtotal;
      totalIpi += ipiValue;

      return { ...item, subtotal, ipiRate, ipiValue, totalItem };
    });

    const grandTotal = ipiMode === 'destacar' ? subtotalProducts + totalIpi : subtotalProducts;

    // IPI mode label
    const ipiModeLabels: Record<string, string> = {
      destacar: 'IPI Destacado',
      incluso: 'IPI Incluso no Preço',
      isento: 'Isento de IPI',
    };

    const itemsHtml = processedItems.map((item: any, index: number) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${index + 1}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${item.product?.sku || '-'}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${item.description}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">
          ${item.width || '-'} x ${item.length || '-'} x ${item.thickness || '-'}
        </td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${item.quantity}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(item.unit_price)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${item.discount_percent || 0}%</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(item.subtotal)}</td>
        ${showIpi ? `
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${(item.ipiRate || 0).toFixed(2)}%</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(item.ipiValue)}</td>
        ` : ''}
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold;">${formatCurrency(item.totalItem)}</td>
      </tr>
    `).join('');

    const totalColSpan = showIpi ? 10 : 8;

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
          .proposal-info {
            text-align: right;
          }
          .proposal-number {
            font-size: 18px;
            font-weight: bold;
            color: #1f2937;
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
          .total-section {
            margin-top: 15px;
            display: flex;
            justify-content: flex-end;
          }
          .total-box {
            background: #f3f4f6;
            padding: 15px 20px;
            border-radius: 8px;
            min-width: 280px;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            padding: 4px 0;
            font-size: 12px;
          }
          .total-row.grand {
            border-top: 2px solid #3b82f6;
            margin-top: 6px;
            padding-top: 8px;
            font-size: 16px;
            font-weight: bold;
          }
          .total-row.grand .total-value {
            color: #3b82f6;
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
          .validity {
            display: inline-block;
            background: #fef3c7;
            color: #92400e;
            padding: 8px 16px;
            border-radius: 4px;
            font-weight: bold;
            margin-top: 10px;
          }
          .ipi-mode-badge {
            display: inline-block;
            background: #dbeafe;
            color: #1e40af;
            padding: 4px 10px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: bold;
            margin-top: 6px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            ${legalEntity?.logo_url 
              ? `<div class="logo"><img src="${legalEntity.logo_url}" alt="${legalEntity.name || 'Logo'}" /></div>` 
              : `<div class="logo"><strong style="font-size: 18px;">${legalEntity?.name || 'CRMPro'}</strong></div>`
            }
            ${legalEntity ? `<p style="font-size: 10px; color: #6b7280; margin-top: 4px;">CNPJ: ${legalEntity.cnpj || "-"}</p>` : ""}
          </div>
          <div class="proposal-info">
            <div class="proposal-number">${proposal.number}</div>
            <p style="color: #6b7280; margin: 5px 0;">Data: ${formatDate(proposal.created_at)}</p>
            <div class="validity">Válida até: ${formatDate(proposal.validity_date)}</div>
            ${showIpi ? `<div class="ipi-mode-badge">${ipiModeLabels[ipiMode] || ipiMode}</div>` : ''}
          </div>
        </div>

        <div class="section">
          <div class="section-title">Dados do Cliente</div>
          <div class="info-grid">
            <div class="info-box">
              <div class="info-label">Empresa</div>
              <div class="info-value" style="font-weight: bold; font-size: 14px;">
                ${proposal.company?.name || 'Não informado'}
              </div>
              ${proposal.company?.cnpj ? `<div class="info-value">CNPJ: ${proposal.company.cnpj}</div>` : ''}
              ${proposal.company?.address ? `<div class="info-value">${proposal.company.address}${proposal.company?.address_number ? ', ' + proposal.company.address_number : ''}</div>` : ''}
              ${proposal.company?.city ? `<div class="info-value">${proposal.company.city}${proposal.company.state ? ' - ' + proposal.company.state : ''}</div>` : ''}
            </div>
            <div class="info-box">
              <div class="info-label">Contato</div>
              <div class="info-value" style="font-weight: bold; font-size: 14px;">
                ${proposal.contact ? `${proposal.contact.first_name} ${proposal.contact.last_name || ''}` : 'Não informado'}
              </div>
              ${proposal.contact?.email ? `<div class="info-value">${proposal.contact.email}</div>` : ''}
              ${proposal.contact?.phone ? `<div class="info-value">${proposal.contact.phone}</div>` : ''}
            </div>
          </div>
          ${salesRepName ? `
          <div style="margin-top: 15px;">
            <div class="info-box">
              <div class="info-label">Vendedor Responsável</div>
              <div class="info-value" style="font-weight: bold; font-size: 14px;">${salesRepName}</div>
              ${salesRepEmail ? `<div class="info-value">${salesRepEmail}</div>` : ''}
              ${salesRepPhone ? `<div class="info-value">${salesRepPhone}</div>` : ''}
            </div>
          </div>
          ` : ''}
        </div>

        <div class="section">
          <div class="section-title">Itens da Proposta</div>
          <table>
            <thead>
              <tr>
                <th style="width: 30px;">#</th>
                <th style="width: 80px;">SKU</th>
                <th>Descrição</th>
                <th style="width: 100px; text-align: center;">Medidas (LxCxE)</th>
                <th style="width: 50px; text-align: right;">Qtd</th>
                <th style="width: 85px; text-align: right;">Preço Unit.</th>
                <th style="width: 50px; text-align: right;">Desc.</th>
                <th style="width: 90px; text-align: right;">Subtotal</th>
                ${showIpi ? `
                  <th style="width: 55px; text-align: right;">IPI %</th>
                  <th style="width: 80px; text-align: right;">IPI R$</th>
                ` : ''}
                <th style="width: 95px; text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="total-section">
            <div class="total-box">
              <div class="total-row">
                <span>Subtotal Produtos:</span>
                <span>${formatCurrency(subtotalProducts)}</span>
              </div>
              ${showIpi ? `
                <div class="total-row">
                  <span>IPI Total${ipiMode === 'incluso' ? ' (informativo)' : ''}:</span>
                  <span>${formatCurrency(totalIpi)}</span>
                </div>
              ` : ''}
              <div class="total-row grand">
                <span>VALOR TOTAL:</span>
                <span class="total-value">${formatCurrency(grandTotal)}</span>
              </div>
            </div>
          </div>
        </div>

        ${(proposal.payment_terms || proposal.delivery_terms || proposal.observations) ? `
        <div class="terms">
          <div class="terms-title">Condições Comerciais</div>
          ${proposal.payment_terms ? `<p><strong>Pagamento:</strong> ${proposal.payment_terms}</p>` : ''}
          ${proposal.delivery_terms ? `<p><strong>Prazo de Entrega:</strong> ${proposal.delivery_terms}</p>` : ''}
          ${proposal.observations ? `<p><strong>Observações:</strong> ${proposal.observations}</p>` : ''}
        </div>
        ` : ''}

        ${sellerName ? `
        <div class="section" style="margin-top: 30px;">
          <div style="background: #f0f9ff; padding: 12px 16px; border-radius: 6px; border-left: 4px solid #3b82f6;">
            <span style="font-size: 11px; color: #1e40af;"><strong>Vendedor:</strong> ${sellerName}</span>
          </div>
        </div>
        ` : ''}

        <div class="footer">
          <p><strong>${legalEntity?.name || 'CRMPro'}</strong></p>
          ${legalEntity?.cnpj ? `<p>CNPJ: ${legalEntity.cnpj}</p>` : ''}
          ${legalEntity?.phone ? `<p>Tel: ${legalEntity.phone}</p>` : ''}
          ${legalEntity?.email ? `<p>${legalEntity.email}</p>` : ''}
          <p>Para dúvidas, entre em contato conosco.</p>
        </div>
      </body>
      </html>
    `;

    return new Response(
      JSON.stringify({ 
        success: true,
        html: html,
        proposal_number: proposal.number,
        message: 'HTML gerado com sucesso. Use Ctrl+P no navegador para salvar como PDF.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error generating PDF:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
