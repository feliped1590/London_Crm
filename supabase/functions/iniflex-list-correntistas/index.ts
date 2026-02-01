const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ListRequest {
  baseUrl: string;
  token: string;
  page?: number;
  limit?: number;
  search?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let params: ListRequest = { baseUrl: '', token: '' };
    if (req.method === 'POST') {
      params = await req.json();
    }

    // Validar credenciais obrigatórias
    if (!params.baseUrl || !params.token) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Credenciais obrigatórias: baseUrl e token. Configure na aba Sandbox.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { baseUrl, token, page = 1, limit = 50, search = '' } = params;
    const apiUrl = baseUrl.replace(/\/+$/, '');
    const cleanToken = token.trim();

    console.log(`[iniflex-list-correntistas] Listando correntistas - página: ${page}, busca: ${search}`);

    // Montar payload para consulta de correntistas
    const payload = {
      tipoComando: 'ASDCOMANDO',
      grupoComando: 'EXP_CLIENTES_V1',
      '#out#p_retorno': 'T',
      json: {
        pagina: page,
        limite: limit,
        filtro: search,
      },
    };

    console.log('[iniflex-list-correntistas] Chamando:', apiUrl);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cleanToken}`,
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    console.log('[iniflex-list-correntistas] Resposta Iniflex:', responseText.substring(0, 500));

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    if (!response.ok) {
      console.error('[iniflex-list-correntistas] Erro na API Iniflex:', response.status);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro na API Iniflex', details: responseData }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Processar resposta (ajustar conforme formato real)
    const correntistas = Array.isArray(responseData) 
      ? responseData 
      : responseData.clientes || responseData.correntistas || responseData.data || [];

    // Mapear para formato padronizado
    const mappedCorrentistas = correntistas.map((c: any) => ({
      id: String(c.codigo_erp || c.codigo || c.id || c.cnpj_cpf),
      cnpj_cpf: c.cnpj_cpf?.toString() || '',
      nome: c.nome || c.razao_social || '',
      fantasia: c.fantasia || c.nome_fantasia || '',
      email: c.e_mail || c.email || '',
      fone: c.fone || c.telefone || c.celular || '',
      pfpj: c.pfpj || c.tipo_pessoa || (c.cnpj_cpf?.toString().length > 11 ? 'PJ' : 'PF'),
      cidade: c.desc_loc_cidade || c.cidade || '',
      estado: c.loc_uf || c.estado || '',
      insc_estadual: c.insc_estadual || '',
      endereco: c.loc_endereco || '',
      bairro: c.loc_bairro || '',
      cep: c.loc_cep || '',
    }));

    console.log(`[iniflex-list-correntistas] Retornando ${mappedCorrentistas.length} correntistas`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        correntistas: mappedCorrentistas,
        total: responseData.total || mappedCorrentistas.length,
        page,
        limit,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[iniflex-list-correntistas] Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
