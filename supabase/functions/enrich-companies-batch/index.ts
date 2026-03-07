import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface BrasilAPIResponse {
  razao_social: string;
  nome_fantasia: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cep: string;
  uf: string;
  municipio: string;
  ddd_telefone_1: string;
  email?: string;
  situacao_cadastral?: number;
}

async function fetchCNPJ(cnpj: string): Promise<BrasilAPIResponse | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user is authenticated and admin
    const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader! } }
    });
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: 'Não autenticado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check admin role
    const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
    const isAdmin = roles?.some(r => r.role === 'admin' || r.role === 'desenvolvedor');
    if (!isAdmin) {
      return new Response(JSON.stringify({ success: false, error: 'Apenas administradores podem executar enriquecimento em lote' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json().catch(() => ({}));
    const limit = Math.min(body.limit || 50, 200);

    // Find companies with CNPJ (14 digits) but missing key data
    // "name" often contains the razão social already, so we look for companies
    // where fantasia is null OR address/city/state are missing
    const { data: companies, error: fetchError } = await supabase
      .from('companies')
      .select('id, name, cnpj, fantasia, address, city, state, phone, email, zip_code, neighborhood, address_number, address_complement')
      .not('cnpj', 'is', null)
      .or('fantasia.is.null,address.is.null,city.is.null,state.is.null')
      .limit(limit);

    if (fetchError) throw fetchError;

    // Filter only valid CNPJs (14 digits)
    const eligible = (companies || []).filter(c => {
      const digits = c.cnpj?.replace(/\D/g, '') || '';
      return digits.length === 14;
    });

    if (eligible.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Nenhum cliente com dados faltantes encontrado',
        enriched: 0,
        failed: 0,
        total_checked: 0,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let enriched = 0;
    let failed = 0;
    const details: { id: string; name: string; status: string; fields_updated: string[] }[] = [];

    for (const company of eligible) {
      const cnpjClean = company.cnpj!.replace(/\D/g, '');
      const apiData = await fetchCNPJ(cnpjClean);

      if (!apiData) {
        failed++;
        details.push({ id: company.id, name: company.name, status: 'api_error', fields_updated: [] });
        await sleep(500); // Rate limit
        continue;
      }

      // Build update object only for missing fields
      const updates: Record<string, any> = {};
      const fieldsUpdated: string[] = [];

      if (!company.fantasia && apiData.nome_fantasia) {
        updates.fantasia = apiData.nome_fantasia;
        fieldsUpdated.push('fantasia');
      }
      if (!company.address && apiData.logradouro) {
        updates.address = apiData.logradouro;
        fieldsUpdated.push('address');
      }
      if (!company.address_number && apiData.numero) {
        updates.address_number = apiData.numero;
        fieldsUpdated.push('address_number');
      }
      if (!company.address_complement && apiData.complemento) {
        updates.address_complement = apiData.complemento;
        fieldsUpdated.push('address_complement');
      }
      if (!company.neighborhood && apiData.bairro) {
        updates.neighborhood = apiData.bairro;
        fieldsUpdated.push('neighborhood');
      }
      if (!company.city && apiData.municipio) {
        updates.city = apiData.municipio;
        fieldsUpdated.push('city');
      }
      if (!company.state && apiData.uf) {
        updates.state = apiData.uf;
        fieldsUpdated.push('state');
      }
      if (!company.zip_code && apiData.cep) {
        updates.zip_code = apiData.cep?.replace(/\D/g, '');
        fieldsUpdated.push('zip_code');
      }
      if (!company.phone && apiData.ddd_telefone_1) {
        updates.phone = apiData.ddd_telefone_1?.replace(/\D/g, '');
        fieldsUpdated.push('phone');
      }
      if (!company.email && apiData.email) {
        updates.email = apiData.email;
        fieldsUpdated.push('email');
      }

      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase
          .from('companies')
          .update(updates)
          .eq('id', company.id);

        if (updateError) {
          failed++;
          details.push({ id: company.id, name: company.name, status: 'update_error', fields_updated: [] });
        } else {
          enriched++;
          details.push({ id: company.id, name: company.name, status: 'enriched', fields_updated: fieldsUpdated });
        }
      } else {
        details.push({ id: company.id, name: company.name, status: 'no_update_needed', fields_updated: [] });
      }

      // Rate limit: 500ms between requests to avoid BrasilAPI throttling
      await sleep(500);
    }

    console.log(`[enrich-companies-batch] Enriched: ${enriched}, Failed: ${failed}, Total: ${eligible.length}`);

    return new Response(JSON.stringify({
      success: true,
      message: `Enriquecimento concluído: ${enriched} atualizados, ${failed} com erro`,
      enriched,
      failed,
      total_checked: eligible.length,
      details,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[enrich-companies-batch] Error:', error);
    return new Response(JSON.stringify({ success: false, error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
