// Edge function: gera PDF (HTML) do Orçamento Livre.
// Mantém identidade visual da entidade jurídica (logo, dados) e marca sent_at se necessário.
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
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { quote_id, mark_sent } = await req.json();
    if (!quote_id) {
      return new Response(JSON.stringify({ error: 'quote_id is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: quote, error: qErr } = await supabase
      .from('quick_quotes')
      .select(`
        *,
        legal_entity:legal_entities(id, name, cnpj, logo_url, phone, email, address, city, state),
        company:companies(id, name, cnpj),
        deal:deals(id, name)
      `)
      .eq('id', quote_id)
      .single();

    if (qErr || !quote) {
      console.error('quote fetch error', qErr);
      return new Response(JSON.stringify({ error: 'Quote not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: items } = await supabase
      .from('quick_quote_items')
      .select('*')
      .eq('quote_id', quote_id)
      .order('sort_order');

    // Carrega rótulos de classificação para compor descrição completa no PDF
    const collectIds = (key: string) =>
      Array.from(new Set((items || []).map((it: any) => it[key]).filter(Boolean)));
    const [famRes, tipRes, grpRes, subRes, clsRes] = await Promise.all([
      supabase.from('product_families').select('id,label').in('id', collectIds('family_id') as string[]),
      supabase.from('product_types').select('id,label').in('id', collectIds('tipo_id') as string[]),
      supabase.from('product_groups').select('id,label').in('id', collectIds('grupo_id') as string[]),
      supabase.from('product_subgroups').select('id,label').in('id', collectIds('subgrupo_id') as string[]),
      supabase.from('product_classes').select('id,label').in('id', collectIds('class_id') as string[]),
    ]);
    const toMap = (rows: any[] | null) =>
      new Map<string, string>((rows || []).map((r: any) => [r.id, r.label]));
    const families = toMap(famRes.data);
    const tipos = toMap(tipRes.data);
    const grupos = toMap(grpRes.data);
    const subgrupos = toMap(subRes.data);
    const classes = toMap(clsRes.data);

    // Atualiza sent_at + status se solicitado e ainda em rascunho
    if (mark_sent && quote.status === 'draft') {
      await supabase
        .from('quick_quotes')
        .update({ status: 'sent' })
        .eq('id', quote_id);
      quote.status = 'sent';
      quote.sent_at = new Date().toISOString();
    }

    const escape = (s: any) =>
      String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const fmtMoney = (v: number) =>
      new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0);
    const fmtDate = (d: string | null) =>
      d ? new Date(d).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '-';

    const le = quote.legal_entity || {};
    const total = (items || []).reduce((s: number, it: any) => s + Number(it.total_price || 0), 0);
    const totalWeight = (items || []).reduce((s: number, it: any) => s + Number(it.weight || 0), 0);
    const fmtNum = (v: any, d = 2) =>
      Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });

    const fmtDim = (v: any, d = 0) => {
      const n = Number(v) || 0;
      return n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: 3 });
    };

    const buildFullDescription = (it: any) => {
      const classif = [
        families.get(it.family_id),
        tipos.get(it.tipo_id),
        grupos.get(it.grupo_id),
        subgrupos.get(it.subgrupo_id),
        classes.get(it.class_id),
      ].filter(Boolean).join(' • ');

      const w = Number(it.width) || 0;
      const l = Number(it.length) || 0;
      const t = Number(it.thickness) || 0;
      const dims = (w > 0 && l > 0 && t > 0)
        ? `${fmtDim(w)}×${fmtDim(l)}×${fmtDim(t, 3)} mm`
        : '';

      const extras: string[] = [];
      if (Number(it.fator) > 0) extras.push(`Fator ${fmtNum(it.fator, 4)}`);
      if (Number(it.weight) > 0) extras.push(`Peso ${fmtNum(it.weight, 3)} kg`);

      const userDesc = String(it.description || '').trim();
      const parts = [classif, dims, extras.join(' • '), userDesc].filter(Boolean);
      return parts.join(' • ');
    };

    const itemsHtml = (items || []).map((it: any, i: number) => `
      <tr>
        <td>${i + 1}</td>
        <td class="desc-col">${escape(buildFullDescription(it))}</td>
        <td class="right">${Number(it.quantity).toLocaleString('pt-BR')}</td>
        <td class="center">${escape(it.unit || '-')}</td>
        <td class="right">${Number(it.weight) > 0 ? fmtNum(it.weight, 3) : '-'}</td>
        <td class="right">${fmtMoney(it.unit_price)}</td>
        <td class="right bold">${fmtMoney(it.total_price)}</td>
      </tr>
    `).join('');


    const statusLabel: Record<string, string> = {
      draft: 'Rascunho', sent: 'Enviado', approved: 'Aprovado',
      rejected: 'Reprovado', expired: 'Expirado', converted: 'Convertido',
    };

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Orçamento ${escape(quote.number)}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI','Helvetica Neue',Arial,sans-serif;padding:30px 35px;color:#1a1a2e;font-size:11px;line-height:1.4}
.header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:15px;border-bottom:2px solid #2d3748;margin-bottom:20px}
.header-left{display:flex;align-items:center;gap:15px}
.header-logo img{max-height:60px;width:auto}
.header-company{font-size:10px;color:#4a5568}
.header-company .company-name{font-size:15px;font-weight:700;color:#1a1a2e;margin-bottom:2px}
.header-right{text-align:right}
.doc-title{font-size:16px;font-weight:700;color:#2d3748;text-transform:uppercase;letter-spacing:1px}
.doc-number{font-size:20px;font-weight:700;color:#2d3748;margin:4px 0}
.doc-meta{font-size:10px;color:#4a5568;margin:2px 0}
.badge{display:inline-block;padding:3px 10px;border-radius:3px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-top:4px;background:#fef3c7;color:#92400e}
.section{margin-bottom:18px}
.section-title{font-size:11px;font-weight:700;color:#2d3748;text-transform:uppercase;letter-spacing:.8px;padding:5px 10px;background:#edf2f7;border-left:3px solid #2d3748;margin-bottom:10px}
.client-grid{display:flex;gap:15px}
.client-box{flex:1;border:1px solid #e2e8f0;border-radius:4px;padding:12px}
.client-box .label{font-size:9px;color:#718096;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;font-weight:600}
.client-box .name{font-size:13px;font-weight:700;color:#1a1a2e;margin-bottom:4px}
.client-box .detail{font-size:10px;color:#4a5568;margin:2px 0}
table{width:100%;border-collapse:collapse;margin-top:8px;font-size:10px}
thead th{background:#2d3748;color:#fff;padding:7px 6px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:.5px;font-weight:600}
tbody tr:nth-child(even){background:#f7fafc}
tbody td{padding:6px;border-bottom:1px solid #e2e8f0}
.center{text-align:center}.right{text-align:right}.bold{font-weight:700}
.desc-col{max-width:320px}
.desc-col .dims{margin-top:3px;font-size:9px;color:#4a5568;display:flex;flex-wrap:wrap;gap:8px}
.desc-col .dims b{color:#2d3748;font-weight:600}
.totals-wrapper{display:flex;justify-content:flex-end;margin-top:12px}
.totals-box{min-width:280px;border:1px solid #e2e8f0;border-radius:4px;overflow:hidden}
.totals-row{display:flex;justify-content:space-between;padding:7px 14px;font-size:11px}
.totals-row.grand{background:#2d3748;color:#fff;font-size:14px;font-weight:700;padding:10px 14px}
.conditions-box{border:1px solid #e2e8f0;border-radius:4px;padding:14px}
.conditions-box p{margin:4px 0;font-size:11px}
.conditions-box strong{color:#2d3748}
.footer{margin-top:25px;padding-top:12px;border-top:2px solid #2d3748;text-align:center;font-size:9px;color:#718096}
</style></head><body>
<div class="header">
  <div class="header-left">
    ${le.logo_url ? `<div class="header-logo"><img src="${le.logo_url}" alt="${escape(le.name)}"/></div>` : ''}
    <div class="header-company">
      <div class="company-name">${escape(le.name || 'Empresa')}</div>
      ${le.cnpj ? `<div>CNPJ: ${escape(le.cnpj)}</div>` : ''}
      ${le.phone ? `<div>Tel: ${escape(le.phone)}</div>` : ''}
      ${le.email ? `<div>${escape(le.email)}</div>` : ''}
    </div>
  </div>
  <div class="header-right">
    <div class="doc-title">Orçamento</div>
    <div class="doc-number">${escape(quote.number)}</div>
    <div class="doc-meta">Emissão: ${fmtDate(quote.created_at)}</div>
    <div class="doc-meta">Validade: ${fmtDate(quote.validity_date)}</div>
    <div class="doc-meta">Status: ${escape(statusLabel[quote.status] || quote.status)}</div>
    ${quote.validity_date ? `<span class="badge">Válido até ${fmtDate(quote.validity_date)}</span>` : ''}
  </div>
</div>

<div class="section">
  <div class="section-title">Dados do Cliente</div>
  <div class="client-grid">
    <div class="client-box">
      <div class="label">Cliente</div>
      <div class="name">${escape(quote.client_name)}</div>
      ${quote.client_cnpj ? `<div class="detail">CNPJ: ${escape(quote.client_cnpj)}</div>` : ''}
      ${quote.company ? `<div class="detail">Vinculado: ${escape(quote.company.name)}</div>` : ''}
    </div>
    <div class="client-box">
      <div class="label">Contato</div>
      ${quote.client_contact ? `<div class="name">${escape(quote.client_contact)}</div>` : '<div class="detail">-</div>'}
      ${quote.client_phone ? `<div class="detail">Tel: ${escape(quote.client_phone)}</div>` : ''}
      ${quote.client_email ? `<div class="detail">${escape(quote.client_email)}</div>` : ''}
    </div>
  </div>
</div>

<div class="section">
  <div class="section-title">Itens</div>
  <table>
    <thead>
      <tr>
        <th style="width:28px">#</th>
        <th>Descrição</th>
        <th style="width:55px" class="right">Qtd</th>
        <th style="width:45px" class="center">Un</th>
        <th style="width:65px" class="right">Peso (kg)</th>
        <th style="width:85px" class="right">Vlr Unit.</th>
        <th style="width:95px" class="right">Total</th>
      </tr>
    </thead>
    <tbody>${itemsHtml || '<tr><td colspan="7" class="center">Sem itens.</td></tr>'}</tbody>
  </table>
  <div class="totals-wrapper">
    <div class="totals-box">
      ${totalWeight > 0 ? `<div class="totals-row"><span>Peso Total</span><span>${fmtNum(totalWeight, 3)} kg</span></div>` : ''}
      <div class="totals-row grand"><span>Total Geral</span><span>${fmtMoney(total)}</span></div>
    </div>
  </div>

</div>

${(quote.payment_terms_free || quote.delivery_terms_free || quote.observations) ? `
<div class="section">
  <div class="section-title">Condições</div>
  <div class="conditions-box">
    ${quote.payment_terms_free ? `<p><strong>Pagamento:</strong> ${escape(quote.payment_terms_free)}</p>` : ''}
    ${quote.delivery_terms_free ? `<p><strong>Entrega:</strong> ${escape(quote.delivery_terms_free)}</p>` : ''}
    ${quote.observations ? `<p><strong>Observações:</strong> ${escape(quote.observations)}</p>` : ''}
  </div>
</div>` : ''}

<div class="footer">
  <strong>${escape(le.name || '')}</strong> — Orçamento ${escape(quote.number)} — Gerado em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
</div>
</body></html>`;

    return new Response(html, {
      headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (e: any) {
    console.error('generate-quick-quote-pdf error', e);
    return new Response(JSON.stringify({ error: e?.message || 'unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
