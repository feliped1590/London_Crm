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
    // 4. RATE LIMIT — max 10 imports/min
    // =========================================================================
    const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
    const { count: recentRequests } = await supabase
      .from('request_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('function_name', 'import-companies-from-file')
      .gte('created_at', oneMinuteAgo);

    if (recentRequests && recentRequests > 10) {
      return new Response(
        JSON.stringify({ error: 'Too many import requests. Try again in a minute.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await supabase.from('request_logs').insert({
      user_id: userId,
      function_name: 'import-companies-from-file',
    });

    // =========================================================================
    // 5. INPUT VALIDATION
    // =========================================================================
    const body = await req.json();
    const { rows, legal_entity_id, tenant_id, file_name, batch_index, total_batches } = body;

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return new Response(JSON.stringify({ error: 'rows array required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (rows.length > 5000) {
      return new Response(JSON.stringify({ error: 'Maximum 5000 rows per batch' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // =========================================================================
    // 6. LÓGICA DE NEGÓCIO (mantida integralmente)
    // =========================================================================
    const LEGAL_ENTITY_ID = legal_entity_id || 'c617d4bc-65b8-4b1d-b786-9f256eaab0b2';
    const TENANT_ID = tenant_id || '00000000-0000-0000-0000-000000000001';

    const validRows: { cnpj: string; vendedor_nome: string | null; data: Record<string, any> }[] = [];
    let skipped = 0;
    const rowErrors: { row_number: number; error_message: string; raw_data: any }[] = [];

    for (let idx = 0; idx < rows.length; idx++) {
      const row = rows[idx];
      const cnpjClean = (row.cnpj || '').replace(/\D/g, '');

      if (!cnpjClean) {
        rowErrors.push({
          row_number: (batch_index || 0) * 200 + idx + 1,
          error_message: 'CNPJ ausente ou inválido',
          raw_data: row,
        });
        skipped++;
        continue;
      }

      if (!row.name || !row.name.trim()) {
        rowErrors.push({
          row_number: (batch_index || 0) * 200 + idx + 1,
          error_message: 'Razão Social ausente',
          raw_data: row,
        });
        skipped++;
        continue;
      }

      let zipCode = (row.zip_code || '').replace(/\D/g, '');
      if (zipCode) zipCode = zipCode.padStart(8, '0');

      validRows.push({
        cnpj: cnpjClean,
        vendedor_nome: row.vendedor_nome || null,
        data: {
          name: row.name.trim(),
          contact_name: row.contact_name || null,
          phone: row.phone || null,
          phone2: row.phone2 || null,
          fax: row.fax || null,
          email: row.email || null,
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
        },
      });
    }

    let inserted = 0;
    let updated = 0;
    const errors: string[] = [];

    // Resolve vendedor names to sales_rep IDs
    const vendedorNames = [...new Set(validRows.map(r => r.vendedor_nome).filter(Boolean))] as string[];
    const vendedorMap = new Map<string, string>();

    if (vendedorNames.length > 0) {
      const { data: salesReps } = await supabase
        .from('sales_reps')
        .select('id, name')
        .eq('tenant_id', TENANT_ID);

      if (salesReps) {
        for (const name of vendedorNames) {
          const nameLower = name.toLowerCase().trim();
          const match = salesReps.find((sr: any) => sr.name?.toLowerCase().trim() === nameLower);
          if (match) {
            vendedorMap.set(nameLower, match.id);
          }
        }
      }

      // Auto-create missing vendedores as external sales reps
      for (const name of vendedorNames) {
        const nameLower = name.toLowerCase().trim();
        if (!vendedorMap.has(nameLower)) {
          const { data: newRep, error: createError } = await supabase
            .from('sales_reps')
            .insert({
              name: name.trim(),
              tenant_id: TENANT_ID,
              active: true,
              type: 'external',
            })
            .select('id')
            .single();

          if (newRep) {
            vendedorMap.set(nameLower, newRep.id);
            console.log(`Auto-created external sales rep: ${name.trim()} -> ${newRep.id}`);
          } else if (createError) {
            errors.push(`Erro ao criar vendedor "${name}": ${createError.message}`);
          }
        }
      }
    }

    // Assign sales_rep_id from vendedor lookup
    for (const row of validRows) {
      if (row.vendedor_nome) {
        const salesRepId = vendedorMap.get(row.vendedor_nome.toLowerCase().trim());
        if (salesRepId) {
          row.data.sales_rep_id = salesRepId;
        }
      }
    }

    // Process in chunks
    const CHUNK_SIZE = 200;

    for (let i = 0; i < validRows.length; i += CHUNK_SIZE) {
      const chunk = validRows.slice(i, i + CHUNK_SIZE);
      const cnpjs = chunk.map(r => r.cnpj);

      const { data: existing, error: fetchError } = await supabase
        .from('companies')
        .select('id, cnpj')
        .eq('tenant_id', TENANT_ID)
        .in('cnpj', cnpjs);

      if (fetchError) {
        errors.push(`Batch ${Math.floor(i / CHUNK_SIZE)}: fetch error - ${fetchError.message}`);
        continue;
      }

      const existingMap = new Map<string, string>();
      for (const ex of (existing || [])) {
        if (ex.cnpj) existingMap.set(ex.cnpj, ex.id);
      }

      const toInsert: Record<string, any>[] = [];
      const toUpdate: { id: string; data: Record<string, any> }[] = [];

      for (const row of chunk) {
        const existingId = existingMap.get(row.cnpj);
        if (existingId) {
          const updateData: Record<string, any> = {};
          for (const [key, value] of Object.entries(row.data)) {
            if (value !== null && key !== 'tenant_id' && key !== 'cnpj') {
              updateData[key] = value;
            }
          }
          toUpdate.push({ id: existingId, data: updateData });
        } else {
          toInsert.push(row.data);
        }
      }

      for (const record of toInsert) {
        const { error: insertError } = await supabase
          .from('companies')
          .insert(record)
          .select('id')
          .single();

        if (insertError) {
          if (insertError.message?.includes('duplicate') || insertError.code === '23505') {
            skipped++;
          } else {
            errors.push(`Insert ${record.cnpj}: ${insertError.message}`);
          }
        } else {
          inserted++;
        }
      }

      for (const upd of toUpdate) {
        const { error: updateError } = await supabase
          .from('companies')
          .update(upd.data)
          .eq('id', upd.id);

        if (updateError) {
          errors.push(`Update ${upd.id}: ${updateError.message}`);
        } else {
          updated++;
        }
      }
    }

    // Save import errors to log
    if (rowErrors.length > 0 && batch_index === 0) {
      const { data: logData } = await supabase
        .from('import_logs')
        .insert({
          file_name: file_name || 'unknown',
          total_rows: rows.length * (total_batches || 1),
          success_count: inserted,
          error_count: rowErrors.length,
          skipped_count: skipped,
          updated_count: updated,
          tenant_id: TENANT_ID,
          legal_entity_id: LEGAL_ENTITY_ID,
        })
        .select('id')
        .single();

      if (logData) {
        const errorInserts = rowErrors.map(e => ({
          import_log_id: logData.id,
          row_number: e.row_number,
          error_message: e.error_message,
          raw_data: e.raw_data,
        }));
        await supabase.from('import_errors').insert(errorInserts);
      }
    }

    return new Response(JSON.stringify({
      total_received: rows.length,
      to_process: validRows.length,
      inserted,
      updated,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
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
