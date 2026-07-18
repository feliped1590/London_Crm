import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { envFlagEnabled, disabledIntegrationResponse } from '../_shared/integration-gates.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (!envFlagEnabled('ZAPI_INTEGRATION_ENABLED', false)) {
    return disabledIntegrationResponse('Z-API', corsHeaders);
  }

  try {
    const url = new URL(req.url);
    const instanceId = url.searchParams.get('instanceId');

    if (!instanceId) {
      return new Response(
        JSON.stringify({ error: 'instanceId é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate user authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get instance data from database
    const { data: instance, error: instanceError } = await supabase
      .from('whatsapp_instances')
      .select('*')
      .eq('id', instanceId)
      .single();

    if (instanceError || !instance) {
      return new Response(
        JSON.stringify({ error: 'Instância não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call Z-API to get QR Code image
    const zapiUrl = `https://api.z-api.io/instances/${instance.instance_id}/token/${instance.instance_token}/qr-code/image`;
    
    const clientToken = Deno.env.get('ZAPI_CLIENT_TOKEN');
    
    const zapiResponse = await fetch(zapiUrl, {
      method: 'GET',
      headers: {
        'Client-Token': clientToken || '',
      },
    });

    if (!zapiResponse.ok) {
      const errorText = await zapiResponse.text();
      console.error('Z-API error:', errorText);
      
      // Check if already connected
      if (zapiResponse.status === 400 || errorText.includes('connected')) {
        return new Response(
          JSON.stringify({ 
            error: 'Instância já está conectada',
            status: 'connected'
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Erro ao obter QR Code da Z-API' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const qrData = await zapiResponse.json();

    return new Response(
      JSON.stringify({ 
        success: true,
        qrCode: qrData.value || qrData.base64 || qrData
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error:', error);
    const message = error instanceof Error ? error.message : 'Erro interno';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
