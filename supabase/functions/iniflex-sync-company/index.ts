import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendToIniflex } from '../_shared/iniflex/adapter.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncRequest {
  company_id: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const inflexCompanyId = Deno.env.get('INIFLEX_COMPANY_ID')!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { company_id } = await req.json() as SyncRequest;

    if (!company_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'company_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[iniflex-sync-company] Sincronizando empresa: ${company_id}`);

    // Buscar empresa
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('*')
      .eq('id', company_id)
      .single();

    if (companyError || !company) {
      console.error('[iniflex-sync-company] Empresa não encontrada:', companyError);
      return new Response(
        JSON.stringify({ success: false, error: 'Empresa não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Montar payload para Iniflex (SEM chave - adapter injeta automaticamente)
    const cnpjLimpo = company.cnpj?.replace(/\D/g, '') || '';

    // Montar endereço se disponível
    const enderecos = [];
    if (company.address || company.city) {
      enderecos.push({
        cidade: 0, // Código da cidade (seria necessário um mapeamento)
        tipo_endereco: 'C', // Comercial
        endereco: company.address || '',
        complemento: '',
        numero_endereco: '',
        bairro: '',
        cep: 0,
      });
    }

    const payload = {
      tipoComando: 'ASDCOMANDO',
      grupoComando: 'IMP_CLIENTE_V3',
      '#out#p_retorno': 'T',
      json: {
        cnpj_cpf: cnpjLimpo ? parseInt(cnpjLimpo) : 0,
        pfpj: 'PJ',
        nome: company.name,
        fantasia: company.fantasia || company.name,
        email: company.email || '',
        fone: company.phone || '',
        insc_estadual: company.inscricao_estadual || '',
        obs_geral: company.notes || '',
        tipo_correntista: 'C', // Cliente
        regiao: 1, // Default
        destino_mercadoria: 'R', // Revenda
        usuario: parseInt(inflexCompanyId) || 1,
        banco_padrao: 0,
        tributacao_ir: 'N', // Normal
        segmento_mercado: 1,
        subsegmento_mercado: 0,
        enderecos: enderecos,
        enderecos_entrega: [],
        vendedores: [],
      },
    };

    console.log('[iniflex-sync-company] Payload preparado para empresa:', company_id);

    // Usar adapter centralizado (chave injetada automaticamente)
    const result = await sendToIniflex(payload);

    if (!result.success) {
      console.error('[iniflex-sync-company] Erro na API Iniflex:', result.error);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro na API Iniflex', details: result.error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extrair iniflex_id da resposta
    const inflexId = result.externalId || cnpjLimpo;

    // Atualizar empresa com iniflex_id
    const { error: updateError } = await supabase
      .from('companies')
      .update({
        iniflex_id: String(inflexId),
        iniflex_synced_at: new Date().toISOString(),
      })
      .eq('id', company_id);

    if (updateError) {
      console.error('[iniflex-sync-company] Erro ao atualizar empresa:', updateError);
    }

    console.log(`[iniflex-sync-company] Empresa sincronizada com sucesso: ${inflexId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        iniflex_id: inflexId,
        message: 'Empresa sincronizada com Iniflex'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[iniflex-sync-company] Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
