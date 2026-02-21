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
    const { rows, legal_entity_id, tenant_id } = body;

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return new Response(JSON.stringify({ error: 'rows array required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LEGAL_ENTITY_ID = legal_entity_id || 'c617d4bc-65b8-4b1d-b786-9f256eaab0b2';
    const TENANT_ID = tenant_id || '00000000-0000-0000-0000-000000000001';

    // Get existing CNPJs to deduplicate
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

      let zipCode = (row.zip_code || '').replace(/\D/g, '');
      if (zipCode) zipCode = zipCode.padStart(8, '0');

      toInsert.push({
        name: row.name || 'Sem nome',
        contact_name: row.contact_name || null,
        phone: row.phone || null,
        fax: row.fax || null,
        address: row.address || null,
        neighborhood: row.neighborhood || null,
        city: row.city || null,
        state: row.state || null,
        zip_code: zipCode || null,
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
      total_received: rows.length,
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
