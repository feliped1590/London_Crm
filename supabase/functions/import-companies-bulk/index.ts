import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function parseMarkdownRows(text: string): any[] {
  const lines = text.split('\n').filter(l => l.trim().startsWith('|'));
  const dataLines = lines.filter(l => !l.includes('Razão Social') && !l.match(/^\|[-\s|]+\|$/));
  
  return dataLines.map(line => {
    const cols = line.split('|').slice(1, -1).map(c => c.trim());
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
  }).filter(r => r.name && r.cnpj);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // =========================================================================
    // 1. AUTENTICAÇÃO — validar usuário real via getUser()
    // =========================================================================
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;

    // =========================================================================
    // 2. SERVICE CLIENT — criado APÓS autenticação
    // =========================================================================
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // =========================================================================
    // 3. AUTORIZAÇÃO — apenas admin
    // =========================================================================
    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: userId, _role: 'admin' });
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: admin role required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =========================================================================
    // 4. RATE LIMIT — max 10 imports/min (importação é operação pesada)
    // =========================================================================
    const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
    const { count: recentRequests } = await supabase
      .from('request_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('function_name', 'import-companies-bulk')
      .gte('created_at', oneMinuteAgo);

    if (recentRequests && recentRequests > 10) {
      return new Response(
        JSON.stringify({ error: 'Too many import requests. Try again in a minute.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await supabase.from('request_logs').insert({
      user_id: userId,
      function_name: 'import-companies-bulk',
    });

    // =========================================================================
    // 5. INPUT VALIDATION
    // =========================================================================
    const body = await req.json();
    let rows: any[];

    if (body.markdown_text) {
      if (typeof body.markdown_text !== 'string' || body.markdown_text.length > 10 * 1024 * 1024) {
        return new Response(JSON.stringify({ error: 'markdown_text must be a string under 10MB' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      rows = parseMarkdownRows(body.markdown_text);
    } else if (body.rows && Array.isArray(body.rows)) {
      if (body.rows.length > 10000) {
        return new Response(JSON.stringify({ error: 'Maximum 10000 rows per request' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      rows = body.rows;
    } else {
      return new Response(JSON.stringify({ error: 'rows array or markdown_text required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // =========================================================================
    // 6. RESOLVER TENANT/LEGAL_ENTITY DINAMICAMENTE
    // =========================================================================
    const { data: profile } = await supabase
      .from('profiles')
      .select('active_tenant_id, active_legal_entity_id')
      .eq('user_id', userId)
      .single();

    const TENANT_ID = profile?.active_tenant_id || '00000000-0000-0000-0000-000000000001';
    const LEGAL_ENTITY_ID = profile?.active_legal_entity_id || 'c617d4bc-65b8-4b1d-b786-9f256eaab0b2';

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
        name: row.name,
        contact_name: row.contact_name || null,
        phone: row.phone || null,
        phone2: row.phone2 || null,
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
        errors.push(`Batch ${i / BATCH_SIZE}: ${error.message}`);
      } else {
        inserted += (data?.length || 0);
      }
    }

    return new Response(JSON.stringify({
      total_parsed: rows.length,
      inserted,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
      legal_entity_id: LEGAL_ENTITY_ID,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('Error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
