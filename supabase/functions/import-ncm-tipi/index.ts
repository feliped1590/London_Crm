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
    // 4. RATE LIMIT — max 5 imports/min (operação pesada de API externa)
    // =========================================================================
    const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
    const { count: recentRequests } = await supabase
      .from('request_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('function_name', 'import-ncm-tipi')
      .gte('created_at', oneMinuteAgo);

    if (recentRequests && recentRequests > 5) {
      return new Response(
        JSON.stringify({ error: 'Too many requests. NCM import is a heavy operation.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await supabase.from('request_logs').insert({
      user_id: userId,
      function_name: 'import-ncm-tipi',
    });

    // =========================================================================
    // 5. LÓGICA DE NEGÓCIO (mantida integralmente)
    // =========================================================================
    console.log('Fetching NCM data from BrasilAPI...');

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

    const BATCH_SIZE = 500;
    let inserted = 0;
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

    console.log('Import complete', { valid_codes: result.valid_codes, processed: result.processed });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('import-ncm-tipi failed', { code: (error as any)?.code });
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Internal server error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
