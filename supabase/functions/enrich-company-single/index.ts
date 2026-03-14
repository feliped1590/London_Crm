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
}

function hasPlaceholder(value: string | null | undefined): boolean {
  if (!value) return false;
  return value.includes('*');
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

    // Auth check
    const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader! } }
    });
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: 'Não autenticado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();
    const companyId = body.company_id;
    const forceOverwrite = body.force_overwrite === true;

    if (!companyId) {
      return new Response(JSON.stringify({ success: false, error: 'company_id é obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch company
    const { data: company, error: fetchError } = await supabase
      .from('companies')
      .select('id, name, cnpj, fantasia, address, address_number, address_complement, neighborhood, city, state, zip_code, phone, email')
      .eq('id', companyId)
      .single();

    if (fetchError || !company) {
      return new Response(JSON.stringify({ success: false, error: 'Cliente não encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let cnpjClean = company.cnpj?.replace(/\D/g, '') || '';
    // Pad with leading zeros if needed (some CNPJs stored without leading zero)
    if (cnpjClean.length > 0 && cnpjClean.length < 14) {
      cnpjClean = cnpjClean.padStart(14, '0');
    }
    if (cnpjClean.length !== 14) {
      return new Response(JSON.stringify({ success: false, error: 'CNPJ inválido ou ausente' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Call BrasilAPI
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjClean}`, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      return new Response(JSON.stringify({ success: false, error: 'Erro ao consultar API (CNPJ não encontrado ou serviço indisponível)' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const apiData: BrasilAPIResponse = await res.json();

    // Build updates - only fill empty/placeholder fields unless forceOverwrite
    const shouldUpdate = (currentValue: string | null | undefined) => {
      if (forceOverwrite) return true;
      return !currentValue || hasPlaceholder(currentValue);
    };

    // Check if API value is actually useful (not empty or placeholder)
    const isUsefulValue = (value: string | null | undefined): boolean => {
      if (!value || value.trim() === '') return false;
      if (hasPlaceholder(value)) return false;
      return true;
    };

    const updates: Record<string, any> = {};
    const fieldsUpdated: string[] = [];

    if (shouldUpdate(company.name) && apiData.razao_social) {
      updates.name = apiData.razao_social;
      fieldsUpdated.push('Razão Social');
    }
    if (shouldUpdate(company.fantasia) && apiData.nome_fantasia) {
      updates.fantasia = apiData.nome_fantasia;
      fieldsUpdated.push('Nome Fantasia');
    }
    if (shouldUpdate(company.address) && apiData.logradouro) {
      updates.address = apiData.logradouro;
      fieldsUpdated.push('Endereço');
    }
    if (shouldUpdate(company.address_number) && apiData.numero) {
      updates.address_number = apiData.numero;
      fieldsUpdated.push('Número');
    }
    if (shouldUpdate(company.address_complement) && apiData.complemento) {
      updates.address_complement = apiData.complemento;
      fieldsUpdated.push('Complemento');
    }
    if (shouldUpdate(company.neighborhood) && apiData.bairro) {
      updates.neighborhood = apiData.bairro;
      fieldsUpdated.push('Bairro');
    }
    if (shouldUpdate(company.city) && apiData.municipio) {
      updates.city = apiData.municipio;
      fieldsUpdated.push('Cidade');
    }
    if (shouldUpdate(company.state) && apiData.uf) {
      updates.state = apiData.uf;
      fieldsUpdated.push('UF');
    }
    if (shouldUpdate(company.zip_code) && apiData.cep) {
      updates.zip_code = apiData.cep?.replace(/\D/g, '');
      fieldsUpdated.push('CEP');
    }
    if (shouldUpdate(company.phone) && apiData.ddd_telefone_1) {
      updates.phone = apiData.ddd_telefone_1?.replace(/\D/g, '');
      fieldsUpdated.push('Telefone');
    }
    if (shouldUpdate(company.email) && apiData.email) {
      updates.email = apiData.email;
      fieldsUpdated.push('E-mail');
    }

    if (Object.keys(updates).length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Todos os dados já estão preenchidos. Nenhuma atualização necessária.',
        fields_updated: [],
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { error: updateError } = await supabase
      .from('companies')
      .update(updates)
      .eq('id', companyId);

    if (updateError) {
      return new Response(JSON.stringify({ success: false, error: 'Erro ao atualizar dados: ' + updateError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Dados enriquecidos com sucesso! ${fieldsUpdated.length} campo(s) atualizado(s).`,
      fields_updated: fieldsUpdated,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[enrich-company-single] Error:', error);
    return new Response(JSON.stringify({ success: false, error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
