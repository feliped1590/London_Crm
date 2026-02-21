import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = await req.json();
    const { lines } = body; // array of markdown table lines

    if (!lines || !Array.isArray(lines) || lines.length === 0) {
      return new Response(JSON.stringify({ error: 'lines array required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LEGAL_ENTITY_ID = 'c617d4bc-65b8-4b1d-b786-9f256eaab0b2';
    const TENANT_ID = '00000000-0000-0000-0000-000000000001';

    // Parse lines into rows
    const rows = lines
      .filter((l: string) => l.trim().startsWith('|') && !l.includes('Razão Social') && !l.match(/^\|[-\s|]+\|$/))
      .map((line: string) => {
        const cols = line.split('|').slice(1, -1).map((c: string) => c.trim());
        const cnpjRaw = cols[9] || '';
        const cnpj = cnpjRaw.replace(/\D/g, '');
        let zipCode = (cols[8] || '').replace(/\D/g, '');
        if (zipCode) zipCode = zipCode.padStart(8, '0');

        return {
          name: cols[0] || '',
          contact_name: cols[1] || null,
          phone: cols[2] || null,
          fax: cols[3] || null,
          address: cols[4] || null,
          neighborhood: cols[5] || null,
          city: cols[6] || null,
          state: cols[7] || null,
          zip_code: zipCode || null,
          cnpj: cnpj || null,
          inscricao_estadual: cols[10] === 'ISENTO' ? 'ISENTO' : (cols[10] || null),
          fantasia: cols[12] || null,
          address_number: cols[13] || null,
          origin: cols[14] || null,
        };
      })
      .filter((r: any) => r.name && r.cnpj);

    // Get existing CNPJs
    const { data: existingCompanies } = await supabase
      .from('companies')
      .select('cnpj');

    const existingCnpjs = new Set(
      (existingCompanies || []).map((c: any) => c.cnpj?.replace(/\D/g, '')).filter(Boolean)
    );

    const toInsert = [];
    let skipped = 0;

    for (const row of rows) {
      const cnpjClean = (row.cnpj || '').replace(/\D/g, '');
      if (!cnpjClean || existingCnpjs.has(cnpjClean)) {
        skipped++;
        continue;
      }

      toInsert.push({
        name: row.name,
        contact_name: row.contact_name || null,
        phone: row.phone || null,
        fax: row.fax || null,
        address: row.address || null,
        neighborhood: row.neighborhood || null,
        city: row.city || null,
        state: row.state || null,
        zip_code: row.zip_code || null,
        cnpj: cnpjClean,
        inscricao_estadual: row.inscricao_estadual || null,
        fantasia: row.fantasia || null,
        address_number: row.address_number || null,
        origin: row.origin || null,
        legal_entity_id: LEGAL_ENTITY_ID,
        tenant_id: TENANT_ID,
        active: true,
      });

      existingCnpjs.add(cnpjClean);
    }

    let inserted = 0;
    const BATCH_SIZE = 500;
    const errors: string[] = [];

    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE);
      const { error, data } = await supabase
        .from('companies')
        .insert(batch)
        .select('id');

      if (error) {
        console.error(`Batch ${i / BATCH_SIZE} error:`, error);
        errors.push(`Batch ${Math.floor(i / BATCH_SIZE)}: ${error.message}`);
      } else {
        inserted += (data?.length || 0);
      }
    }

    return new Response(JSON.stringify({
      total_parsed: rows.length,
      to_insert: toInsert.length,
      inserted,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('Error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
