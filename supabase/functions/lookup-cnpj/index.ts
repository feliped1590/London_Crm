const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface LookupRequest {
  cnpj: string;
}

interface BrasilAPIResponse {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  situacao_cadastral: number;
  descricao_situacao_cadastral: string;
  data_inicio_atividade: string;
  cnae_fiscal: number;
  cnae_fiscal_descricao: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cep: string;
  uf: string;
  municipio: string;
  ddd_telefone_1: string;
  email?: string;
  porte?: string;
  capital_social?: number;
}

// Validate CNPJ checksum digits
function isValidCNPJ(cnpj: string): boolean {
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cnpj[i]) * weights1[i];
  }
  let remainder = sum % 11;
  const digit1 = remainder < 2 ? 0 : 11 - remainder;
  if (digit1 !== parseInt(cnpj[12])) return false;

  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cnpj[i]) * weights2[i];
  }
  remainder = sum % 11;
  const digit2 = remainder < 2 ? 0 : 11 - remainder;
  return digit2 === parseInt(cnpj[13]);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cnpj } = (await req.json()) as LookupRequest;
    const cnpjClean = cnpj?.replace(/\D/g, '') || '';

    // Validation
    if (!cnpjClean) {
      return new Response(
        JSON.stringify({ success: false, error: 'CNPJ é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (cnpjClean.length !== 14) {
      return new Response(
        JSON.stringify({ success: false, error: 'CNPJ deve ter 14 dígitos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!isValidCNPJ(cnpjClean)) {
      return new Response(
        JSON.stringify({ success: false, error: 'CNPJ inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[lookup-cnpj] Consultando CNPJ: ${cnpjClean}`);

    // Call BrasilAPI with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
      const response = await fetch(
        `https://brasilapi.com.br/api/cnpj/v1/${cnpjClean}`,
        { signal: controller.signal }
      );
      clearTimeout(timeout);

      if (response.status === 404) {
        console.log(`[lookup-cnpj] CNPJ não encontrado: ${cnpjClean}`);
        return new Response(
          JSON.stringify({ success: false, error: 'CNPJ não encontrado na base da Receita Federal' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!response.ok) {
        console.error(`[lookup-cnpj] Erro BrasilAPI: ${response.status}`);
        return new Response(
          JSON.stringify({ success: false, error: 'Serviço de consulta temporariamente indisponível' }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data: BrasilAPIResponse = await response.json();

      // Normalize response to CRM format
      const normalized = {
        razao_social: data.razao_social || '',
        nome_fantasia: data.nome_fantasia || '',
        situacao_cadastral: data.descricao_situacao_cadastral || '',
        data_inicio_atividade: data.data_inicio_atividade || '',
        cnae_principal: data.cnae_fiscal_descricao
          ? `${data.cnae_fiscal} - ${data.cnae_fiscal_descricao}`
          : '',
        endereco: {
          logradouro: data.logradouro || '',
          numero: data.numero || '',
          complemento: data.complemento || '',
          bairro: data.bairro || '',
          cidade: data.municipio || '',
          uf: data.uf || '',
          cep: data.cep || '',
        },
        telefone: data.ddd_telefone_1?.replace(/\D/g, '') || '',
        porte: data.porte || '',
        capital_social: data.capital_social || 0,
      };

      console.log(`[lookup-cnpj] Sucesso: ${data.razao_social}`);

      return new Response(
        JSON.stringify({ success: true, data: normalized, source: 'receita_federal' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (fetchError) {
      clearTimeout(timeout);
      if ((fetchError as Error).name === 'AbortError') {
        console.error('[lookup-cnpj] Timeout na consulta');
        return new Response(
          JSON.stringify({ success: false, error: 'Consulta demorou muito. Tente novamente' }),
          { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw fetchError;
    }
  } catch (error) {
    console.error('[lookup-cnpj] Erro:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro ao consultar CNPJ' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
