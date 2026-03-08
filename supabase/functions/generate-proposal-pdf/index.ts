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
        company:companies(id, name, cnpj, inscricao_estadual, address, address_number, neighborhood, city, state, zip_code, phone, email, sales_rep:sales_reps(id, name, phone, email)),
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

    // Fetch carrier if present
    let carrierData: any = null;
    if (proposal.carrier_id) {
      const { data: cd } = await supabase
        .from('carriers')
        .select('id, name, trade_name, cnpj, phone')
        .eq('id', proposal.carrier_id)
        .maybeSingle();
      carrierData = cd;
    }

    const legalEntity = proposal.deal?.legal_entity || null;
    const ipiMode = proposal.ipi_mode || 'destacar';
    const showIpi = ipiMode !== 'isento';

    const salesRepName = proposal.company?.sales_rep?.name || '';
    const salesRepPhone = proposal.company?.sales_rep?.phone || '';
    const salesRepEmail = proposal.company?.sales_rep?.email || '';

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
      return new Date(dateStr).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    };

    const todayBR = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    const calculateIpiValue = (subtotalItem: number, ipiRate: number) => {
      if (ipiMode === 'isento' || ipiRate <= 0) return 0;
      if (ipiMode === 'destacar') return subtotalItem * (ipiRate / 100);
      if (ipiMode === 'incluso') return subtotalItem * (ipiRate / (100 + ipiRate));
      return 0;
    };

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

    const ipiModeLabels: Record<string, string> = {
      destacar: 'IPI Destacado',
      incluso: 'IPI Incluso no Preço',
      isento: 'Isento de IPI',
    };

    const companyIE = proposal.company?.inscricao_estadual || proposal.company?.state_registration || proposal.company?.ie || '-';

    const itemsHtml = processedItems.map((item: any, index: number) => {
      const unitMeasure = item.unit_measure || item.product?.unit_measure || 'UN';
      return `
      <tr>
        <td>${index + 1}</td>
        <td>${item.product?.sku || '-'}</td>
        <td class="desc-col">${item.description}</td>
        <td class="center">${item.width || item.length || item.thickness ? `${item.width || '-'} x ${item.length || '-'} x ${item.thickness || '-'}` : '-'}</td>
        <td class="right">${item.quantity}</td>
        <td class="center">${unitMeasure}</td>
        <td class="right">${formatCurrency(item.unit_price)}</td>
        <td class="right">${item.discount_percent || 0}%</td>
        <td class="right">${formatCurrency(item.subtotal)}</td>
        ${showIpi ? `
          <td class="right">${(item.ipiRate || 0).toFixed(2)}%</td>
          <td class="right">${formatCurrency(item.ipiValue)}</td>
        ` : ''}
        <td class="right bold">${formatCurrency(item.totalItem)}</td>
      </tr>
    `}).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Proposta ${proposal.number}</title>
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
          .badge-validity { background: #fef3c7; color: #92400e; }
          .badge-ipi { background: #dbeafe; color: #1e40af; margin-left: 4px; }
          
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
          .desc-col { max-width: 180px; }
          
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
            ${legalEntity?.logo_url 
              ? `<div class="header-logo"><img src="${legalEntity.logo_url}" alt="${legalEntity.name || 'Logo'}" /></div>` 
              : ''
            }
            <div class="header-company">
              <div class="company-name">${legalEntity?.name || 'Empresa'}</div>
              ${legalEntity?.cnpj ? `<div>CNPJ: ${legalEntity.cnpj}</div>` : ''}
              ${legalEntity?.phone ? `<div>Tel: ${legalEntity.phone}</div>` : ''}
              ${legalEntity?.email ? `<div>${legalEntity.email}</div>` : ''}
            </div>
          </div>
          <div class="header-right">
            <div class="doc-title">Proposta Comercial</div>
            <div class="doc-number">${proposal.number}</div>
            <div class="doc-meta">Emissão: ${formatDate(proposal.created_at)}</div>
            <div class="doc-meta">Validade: ${formatDate(proposal.validity_date)}</div>
            ${salesRepName ? `<div class="doc-meta">Vendedor: ${salesRepName}</div>` : ''}
            ${showIpi ? `<span class="badge badge-ipi">${ipiModeLabels[ipiMode] || ipiMode}</span>` : ''}
          </div>
        </div>

        <!-- DADOS DO CLIENTE -->
        <div class="section">
          <div class="section-title">Dados do Cliente</div>
          <div class="client-grid">
            <div class="client-box">
              <div class="label">Empresa</div>
              <div class="name">${proposal.company?.name || 'Não informado'}</div>
              ${proposal.company?.cnpj ? `<div class="detail">CNPJ: ${proposal.company.cnpj}</div>` : ''}
              <div class="detail">IE: ${companyIE}</div>
              ${proposal.company?.address ? `<div class="detail">${proposal.company.address}${proposal.company.address_number ? ', ' + proposal.company.address_number : ''}</div>` : ''}
              ${proposal.company?.neighborhood ? `<div class="detail">${proposal.company.neighborhood}</div>` : ''}
              ${proposal.company?.city ? `<div class="detail">${proposal.company.city}${proposal.company.state ? ' / ' + proposal.company.state : ''}${proposal.company.zip_code ? ' - CEP: ' + proposal.company.zip_code : ''}</div>` : ''}
            </div>
            <div class="client-box">
              <div class="label">Contato</div>
              <div class="name">${proposal.contact ? `${proposal.contact.first_name} ${proposal.contact.last_name || ''}` : 'Não informado'}</div>
              ${proposal.contact?.phone ? `<div class="detail">Tel: ${proposal.contact.phone}</div>` : ''}
              ${proposal.contact?.email ? `<div class="detail">${proposal.contact.email}</div>` : ''}
            </div>
          </div>
          ${salesRepName ? `
          <div class="seller-box">
            <div>
              <div class="label">Vendedor Responsável</div>
              <div class="value">${salesRepName}</div>
            </div>
            ${salesRepEmail ? `<div class="sub">${salesRepEmail}</div>` : ''}
            ${salesRepPhone ? `<div class="sub">Tel: ${salesRepPhone}</div>` : ''}
          </div>
          ` : ''}
        </div>

        <!-- TRANSPORTE (condicional) -->
        ${(carrierData || proposal.freight_type) ? `
        <div class="section">
          <div class="section-title">Transporte</div>
          <div class="client-grid">
            ${carrierData ? `
            <div class="client-box">
              <div class="label">Transportadora</div>
              <div class="name">${carrierData.trade_name || carrierData.name}</div>
              ${carrierData.cnpj ? `<div class="detail">CNPJ: ${carrierData.cnpj}</div>` : ''}
              ${carrierData.phone ? `<div class="detail">Tel: ${carrierData.phone}</div>` : ''}
            </div>
            ` : ''}
            <div class="client-box">
              <div class="label">Frete</div>
              <div class="name">${proposal.freight_type || '-'}</div>
              ${proposal.freight_type === 'CIF' ? '<div class="detail">Frete por conta do vendedor</div>' : ''}
              ${proposal.freight_type === 'FOB' ? '<div class="detail">Frete por conta do cliente</div>' : ''}
              ${proposal.freight_type === 'REDESPACHO' ? '<div class="detail">Transporte combinado</div>' : ''}
            </div>
          </div>
          ${proposal.delivery_same_as_company === false ? `
          <div class="client-box" style="margin-top: 10px;">
            <div class="label">Endereço de Entrega</div>
            ${proposal.delivery_name ? `<div class="name">${proposal.delivery_name}</div>` : ''}
            ${proposal.delivery_address ? `<div class="detail">${proposal.delivery_address}${proposal.delivery_number ? ', ' + proposal.delivery_number : ''}</div>` : ''}
            ${proposal.delivery_neighborhood ? `<div class="detail">${proposal.delivery_neighborhood}</div>` : ''}
            ${proposal.delivery_city ? `<div class="detail">${proposal.delivery_city}${proposal.delivery_state ? ' / ' + proposal.delivery_state : ''}${proposal.delivery_zip_code ? ' - CEP: ' + proposal.delivery_zip_code : ''}</div>` : ''}
            ${proposal.delivery_contact ? `<div class="detail">Contato: ${proposal.delivery_contact}</div>` : ''}
          </div>
          ` : ''}
        </div>
        ` : ''}

        <!-- TABELA DE ITENS -->
        <div class="section">
          <div class="section-title">Itens da Proposta</div>
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
                <th style="width:45px;" class="right">Desc%</th>
                <th style="width:80px;" class="right">Subtotal</th>
                ${showIpi ? `
                  <th style="width:45px;" class="right">IPI%</th>
                  <th style="width:70px;" class="right">IPI R$</th>
                ` : ''}
                <th style="width:85px;" class="right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <!-- TOTAIS -->
          <div class="totals-wrapper">
            <div class="totals-box">
              <div class="totals-row">
                <span>Subtotal Produtos:</span>
                <span>${formatCurrency(subtotalProducts)}</span>
              </div>
              ${showIpi ? `
                <div class="totals-row">
                  <span>IPI Total${ipiMode === 'incluso' ? ' (informativo)' : ''}:</span>
                  <span>${formatCurrency(totalIpi)}</span>
                </div>
              ` : ''}
              <div class="totals-row grand">
                <span>VALOR TOTAL:</span>
                <span>${formatCurrency(grandTotal)}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- CONDIÇÕES COMERCIAIS -->
        ${(proposal.payment_terms || proposal.delivery_terms || proposal.observations) ? `
        <div class="section">
          <div class="section-title">Condições Comerciais</div>
          <div class="conditions-box">
            ${proposal.payment_terms ? `<p><strong>Condição de Pagamento:</strong> ${proposal.payment_terms}</p>` : ''}
            ${proposal.delivery_terms ? `<p><strong>Prazo de Entrega:</strong> ${proposal.delivery_terms}</p>` : ''}
            ${proposal.observations ? `<p><strong>Observações:</strong> ${proposal.observations}</p>` : ''}
          </div>
        </div>
        ` : ''}

        ${sellerName ? `
        <div class="section">
          <div class="seller-box">
            <div>
              <div class="label">Elaborado por</div>
              <div class="value">${sellerName}</div>
            </div>
          </div>
        </div>
        ` : ''}

        <!-- ACEITE DO CLIENTE -->
        <div class="acceptance">
          <div class="acceptance-title">Aceite do Cliente</div>
          <p style="font-size: 10px; color: #4a5568; margin-bottom: 10px;">
            Declaro que li e concordo com todas as condições descritas nesta proposta comercial.
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
          <strong>${legalEntity?.name || 'Empresa'}</strong>
          ${legalEntity?.cnpj ? ` &nbsp;|&nbsp; CNPJ: ${legalEntity.cnpj}` : ''}
          ${legalEntity?.phone ? ` &nbsp;|&nbsp; Tel: ${legalEntity.phone}` : ''}
          ${legalEntity?.email ? ` &nbsp;|&nbsp; ${legalEntity.email}` : ''}
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
