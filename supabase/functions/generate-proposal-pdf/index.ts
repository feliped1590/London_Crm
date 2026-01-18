import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
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

    // Fetch proposal with related data
    const { data: proposal, error: proposalError } = await supabase
      .from('proposals')
      .select(`
        *,
        company:companies(id, name, cnpj, address, city, state, phone, email),
        contact:contacts(id, first_name, last_name, email, phone),
        deal:deals(id, name)
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

    // Fetch proposal items
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

    // Generate HTML for PDF
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

    const itemsHtml = (items || []).map((item: any, index: number) => `
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
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold;">${formatCurrency(item.subtotal)}</td>
      </tr>
    `).join('');

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
          .logo {
            font-size: 28px;
            font-weight: bold;
            color: #3b82f6;
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
          .validity {
            display: inline-block;
            background: #fef3c7;
            color: #92400e;
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
            <div class="logo">QUALYVAC</div>
            <p style="color: #6b7280; margin: 5px 0;">Embalagens de Qualidade</p>
          </div>
          <div class="proposal-info">
            <div class="proposal-number">${proposal.number}</div>
            <p style="color: #6b7280; margin: 5px 0;">Data: ${formatDate(proposal.created_at)}</p>
            <div class="validity">Válida até: ${formatDate(proposal.validity_date)}</div>
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
              ${proposal.company?.address ? `<div class="info-value">${proposal.company.address}</div>` : ''}
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
                <th style="width: 60px; text-align: right;">Qtd</th>
                <th style="width: 90px; text-align: right;">Preço Unit.</th>
                <th style="width: 60px; text-align: right;">Desc.</th>
                <th style="width: 100px; text-align: right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
              <tr class="total-row">
                <td colspan="7" style="text-align: right; border-top: 2px solid #3b82f6;">VALOR TOTAL:</td>
                <td style="text-align: right; border-top: 2px solid #3b82f6; color: #3b82f6;">
                  ${formatCurrency(proposal.total_value)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        ${(proposal.payment_terms || proposal.delivery_terms || proposal.observations) ? `
        <div class="terms">
          <div class="terms-title">Condições Comerciais</div>
          ${proposal.payment_terms ? `<p><strong>Pagamento:</strong> ${proposal.payment_terms}</p>` : ''}
          ${proposal.delivery_terms ? `<p><strong>Prazo de Entrega:</strong> ${proposal.delivery_terms}</p>` : ''}
          ${proposal.observations ? `<p><strong>Observações:</strong> ${proposal.observations}</p>` : ''}
        </div>
        ` : ''}

        <div class="footer">
          <p>Esta proposta foi gerada automaticamente pelo sistema CRM Qualyvac.</p>
          <p>Para dúvidas, entre em contato conosco.</p>
        </div>
      </body>
      </html>
    `;

    // For now, return the HTML content - in production you'd use a PDF library
    // or an external service like Puppeteer, jsPDF, or a PDF API
    return new Response(
      JSON.stringify({ 
        success: true,
        html: html,
        proposal_number: proposal.number,
        // In a production environment, you would generate a PDF and return the URL
        // For now, we return the HTML which can be printed to PDF in the browser
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
