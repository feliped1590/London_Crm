const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ListRequest {
  page?: number;
  limit?: number;
  search?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const inflexUrl = Deno.env.get('INIFLEX_API_URL')!;
    const inflexToken = Deno.env.get('INIFLEX_API_TOKEN')!;

    let params: ListRequest = {};
    if (req.method === 'POST') {
      params = await req.json();
    }

    const { page = 1, limit = 50, search = '' } = params;

    console.log(`[iniflex-list-correntistas] Listando correntistas - página: ${page}, busca: ${search}`);

    // Montar payload para consulta de correntistas
    // Ajustar conforme documentação real da API Iniflex
    const payload = {
      tipoComando: 'ASDCOMANDO',
      grupoComando: 'EXP_CLIENTE', // Assumindo que existe um comando de exportação/listagem
      '#out#p_retorno': 'T',
      json: {
        pagina: page,
        limite: limit,
        filtro: search,
      },
    };

    console.log('[iniflex-list-correntistas] Enviando para Iniflex:', JSON.stringify(payload, null, 2));

    const response = await fetch(inflexUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${inflexToken}`,
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
      id: c.codigo || c.id || c.cnpj_cpf,
      cnpj_cpf: c.cnpj_cpf?.toString() || '',
      nome: c.nome || '',
      fantasia: c.fantasia || '',
      email: c.email || '',
      fone: c.fone || c.telefone || '',
      pfpj: c.pfpj || (c.cnpj_cpf?.toString().length > 11 ? 'PJ' : 'PF'),
      cidade: c.cidade || '',
      estado: c.estado || '',
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
