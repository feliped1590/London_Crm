import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendToIniflex } from '../_shared/iniflex/adapter.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncRequest {
  contact_id: string;
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

    const { contact_id } = await req.json() as SyncRequest;

    if (!contact_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'contact_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[iniflex-sync-contact] Sincronizando contato: ${contact_id}`);

    // Buscar contato e empresa associada
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('*, companies(*)')
      .eq('id', contact_id)
      .single();

    if (contactError || !contact) {
      console.error('[iniflex-sync-contact] Contato não encontrado:', contactError);
      return new Response(
        JSON.stringify({ success: false, error: 'Contato não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Montar payload para Iniflex (SEM chave - adapter injeta automaticamente)
    const cpfLimpo = contact.cpf?.replace(/\D/g, '') || '';
    const nome = `${contact.first_name} ${contact.last_name || ''}`.trim();
    const fone = contact.mobile || contact.phone || '';

    const payload = {
      tipoComando: 'ASDCOMANDO',
      grupoComando: 'IMP_CLIENTE_V3',
      '#out#p_retorno': 'T',
      json: {
        cnpj_cpf: cpfLimpo ? parseInt(cpfLimpo) : 0,
        pfpj: contact.tipo_pessoa || 'PF',
        nome: nome,
        fantasia: nome,
        email: contact.email || '',
        fone: fone,
        obs_geral: contact.notes || '',
        tipo_correntista: 'C', // Cliente
        regiao: 1, // Default
        destino_mercadoria: 'R', // Revenda
        usuario: parseInt(inflexCompanyId) || 1,
        banco_padrao: 0,
        tributacao_ir: 'N', // Normal
        segmento_mercado: 1,
        subsegmento_mercado: 0,
        enderecos: [],
        enderecos_entrega: [],
        vendedores: [],
      },
    };

    console.log('[iniflex-sync-contact] Payload preparado para contato:', contact_id);

    // Usar adapter centralizado (chave injetada automaticamente)
    const result = await sendToIniflex(payload);

    if (!result.success) {
      console.error('[iniflex-sync-contact] Erro na API Iniflex:', result.error);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro na API Iniflex', details: result.error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extrair iniflex_id da resposta
    const inflexId = result.externalId || cpfLimpo;

    // Atualizar contato com iniflex_id
    const { error: updateError } = await supabase
      .from('contacts')
      .update({
        iniflex_id: String(inflexId),
        iniflex_synced_at: new Date().toISOString(),
      })
      .eq('id', contact_id);

    if (updateError) {
      console.error('[iniflex-sync-contact] Erro ao atualizar contato:', updateError);
    }

    console.log(`[iniflex-sync-contact] Contato sincronizado com sucesso: ${inflexId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        iniflex_id: inflexId,
        message: 'Contato sincronizado com Iniflex'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[iniflex-sync-contact] Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
