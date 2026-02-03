import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SearchFilters {
  cnpj?: string;
  razaoSocial?: string;
  cnae?: string;
  porte?: string;
  estado?: string;
  dataAberturaInicio?: string;
  dataAberturaFim?: string;
}

interface BrasilAPIResponse {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  cnae_fiscal: number;
  cnae_fiscal_descricao: string;
  porte: string;
  uf: string;
  municipio: string;
  data_inicio_atividade: string;
  situacao_cadastral: string;
  descricao_situacao_cadastral: string;
}

// Função para limpar CNPJ
function cleanCnpj(cnpj: string): string {
  return cnpj.replace(/[^\d]/g, '');
}

// Função para validar CNPJ
function validateCnpj(cnpj: string): boolean {
  const cleanedCnpj = cleanCnpj(cnpj);
  if (cleanedCnpj.length !== 14) return false;
  
  // Verificar se todos os dígitos são iguais
  if (/^(\d)\1+$/.test(cleanedCnpj)) return false;
  
  // Validação do dígito verificador
  let sum = 0;
  let weight = 5;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleanedCnpj.charAt(i)) * weight;
    weight = weight === 2 ? 9 : weight - 1;
  }
  let digit = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (parseInt(cleanedCnpj.charAt(12)) !== digit) return false;
  
  sum = 0;
  weight = 6;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cleanedCnpj.charAt(i)) * weight;
    weight = weight === 2 ? 9 : weight - 1;
  }
  digit = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (parseInt(cleanedCnpj.charAt(13)) !== digit) return false;
  
  return true;
}

// Função para buscar na BrasilAPI
async function searchCnpj(cnpj: string): Promise<BrasilAPIResponse | null> {
  const cleanedCnpj = cleanCnpj(cnpj);
  
  try {
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanedCnpj}`, {
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      console.log(`BrasilAPI returned ${response.status} for CNPJ ${cleanedCnpj}`);
      return null;
    }
    
    const data = await response.json();
    return data as BrasilAPIResponse;
  } catch (error) {
    console.error('Error fetching from BrasilAPI:', error);
    return null;
  }
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verificar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verificar usuário
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { filters } = await req.json() as { filters: SearchFilters };
    
    // Validar que pelo menos um filtro foi fornecido
    if (!filters.cnpj && !filters.razaoSocial) {
      return new Response(
        JSON.stringify({ error: 'Informe ao menos CNPJ ou Razão Social para buscar' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: Array<{
      cnpj: string;
      razao_social: string;
      nome_fantasia: string;
      cnae_principal: string;
      cnae_descricao: string;
      porte: string;
      estado: string;
      cidade: string;
      data_abertura: string;
      situacao_cadastral: string;
      already_exists: boolean;
      existing_company_id?: string;
    }> = [];

    // Busca por CNPJ específico
    if (filters.cnpj) {
      const cleanedCnpj = cleanCnpj(filters.cnpj);
      
      if (!validateCnpj(cleanedCnpj)) {
        return new Response(
          JSON.stringify({ error: 'CNPJ inválido' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verificar se já existe no CRM
      const { data: existingCompany } = await supabase
        .from('companies')
        .select('id, cnpj')
        .eq('cnpj', cleanedCnpj)
        .maybeSingle();

      // Buscar na BrasilAPI
      const apiResult = await searchCnpj(cleanedCnpj);
      
      if (apiResult) {
        results.push({
          cnpj: apiResult.cnpj,
          razao_social: apiResult.razao_social,
          nome_fantasia: apiResult.nome_fantasia || '',
          cnae_principal: String(apiResult.cnae_fiscal),
          cnae_descricao: apiResult.cnae_fiscal_descricao || '',
          porte: apiResult.porte || '',
          estado: apiResult.uf,
          cidade: apiResult.municipio,
          data_abertura: apiResult.data_inicio_atividade,
          situacao_cadastral: apiResult.descricao_situacao_cadastral || apiResult.situacao_cadastral,
          already_exists: !!existingCompany,
          existing_company_id: existingCompany?.id,
        });
      } else {
        return new Response(
          JSON.stringify({ error: 'CNPJ não encontrado na base da Receita Federal' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Registrar busca no histórico
    const { data: searchRecord, error: searchError } = await supabase
      .from('prospecting_searches')
      .insert({
        user_id: user.id,
        filters: filters,
        results_count: results.length,
      })
      .select()
      .single();

    if (searchError) {
      console.error('Error saving search:', searchError);
    }

    // Salvar resultados
    if (searchRecord && results.length > 0) {
      const resultsToInsert = results.map(r => ({
        search_id: searchRecord.id,
        cnpj: r.cnpj,
        razao_social: r.razao_social,
        nome_fantasia: r.nome_fantasia,
        cnae_principal: r.cnae_principal,
        cnae_descricao: r.cnae_descricao,
        porte: r.porte,
        estado: r.estado,
        cidade: r.cidade,
        data_abertura: r.data_abertura || null,
        situacao_cadastral: r.situacao_cadastral,
        status: r.already_exists ? 'discarded' : 'new',
        saved_as_company_id: r.existing_company_id || null,
      }));

      const { error: resultsError } = await supabase
        .from('prospecting_results')
        .insert(resultsToInsert);

      if (resultsError) {
        console.error('Error saving results:', resultsError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        search_id: searchRecord?.id,
        results,
        message: results.length > 0 
          ? `${results.length} empresa(s) encontrada(s)`
          : 'Nenhuma empresa encontrada',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in prospecting-search:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno ao processar busca' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
