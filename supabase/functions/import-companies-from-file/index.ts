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
    const { rows, legal_entity_id, tenant_id, file_name, batch_index, total_batches } = body;

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return new Response(JSON.stringify({ error: 'rows array required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LEGAL_ENTITY_ID = legal_entity_id || 'c617d4bc-65b8-4b1d-b786-9f256eaab0b2';
    const TENANT_ID = tenant_id || '00000000-0000-0000-0000-000000000001';

    const validRows: { cnpj: string; data: Record<string, any> }[] = [];
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
        data: {
          name: row.name.trim(),
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
        },
      });
    }

    let inserted = 0;
    let updated = 0;
    const errors: string[] = [];

    // Process in chunks to avoid too many queries
    const CHUNK_SIZE = 200;

    for (let i = 0; i < validRows.length; i += CHUNK_SIZE) {
      const chunk = validRows.slice(i, i + CHUNK_SIZE);
      const cnpjs = chunk.map(r => r.cnpj);

      // Find existing companies by CNPJ + tenant
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
          // Update: only fill in non-null fields from import (don't overwrite existing data with null)
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

      // Batch insert new records
      if (toInsert.length > 0) {
        const { error: insertError, data: insertData } = await supabase
          .from('companies')
          .insert(toInsert)
          .select('id');

        if (insertError) {
          errors.push(`Batch ${Math.floor(i / CHUNK_SIZE)}: insert error - ${insertError.message}`);
        } else {
          inserted += insertData?.length || 0;
        }
      }

      // Update existing records one by one (batch update not supported)
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
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
