import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Fetching NCM data from BrasilAPI...');

    // BrasilAPI provides the full TIPI NCM table
    const response = await fetch('https://brasilapi.com.br/api/ncm/v1', {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`BrasilAPI returned status ${response.status}`);
    }

    const ncmData: Array<{
      codigo: string;
      descricao: string;
      data_inicio: string;
      data_fim: string;
      tipo_ato: string;
      numero_ato: string;
      ano_ato: string;
    }> = await response.json();

    console.log(`Received ${ncmData.length} NCM codes from BrasilAPI`);

    // Transform to our schema
    const records = ncmData
      .filter(ncm => ncm.codigo && ncm.codigo.length === 8 && /^\d{8}$/.test(ncm.codigo))
      .map(ncm => ({
        codigo: ncm.codigo,
        descricao: ncm.descricao || 'Sem descrição',
        status: ncm.data_fim ? 'inativo' : 'ativo',
        data_vigencia: ncm.data_inicio || '2022-01-01',
        data_fim_vigencia: ncm.data_fim || null,
      }));

    console.log(`Filtered to ${records.length} valid 8-digit NCM codes`);

    // Upsert in batches of 500
    const BATCH_SIZE = 500;
    let inserted = 0;
    let updated = 0;
    let errors = 0;

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      
      const { error } = await supabase
        .from('ncm_codes')
        .upsert(batch, { 
          onConflict: 'codigo',
          ignoreDuplicates: false,
        });

      if (error) {
        console.error(`Batch ${i / BATCH_SIZE + 1} error:`, error.message);
        errors += batch.length;
      } else {
        inserted += batch.length;
      }

      console.log(`Processed batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(records.length / BATCH_SIZE)}`);
    }

    const result = {
      success: true,
      total_fetched: ncmData.length,
      valid_codes: records.length,
      processed: inserted,
      errors,
    };

    console.log('Import complete:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Import error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
