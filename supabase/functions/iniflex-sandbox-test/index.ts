import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendToInflexSandbox } from '../_shared/iniflex/sandboxAdapter.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TestRequest {
  payload: Record<string, unknown>;
  timeout_ms?: number;
  save_log?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verificar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verificar usuário autenticado
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub;

    // Verificar se é admin
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roleData, error: roleError } = await serviceClient
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single();

    if (roleError || !['admin', 'desenvolvedor'].includes(roleData?.role)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Acesso restrito a administradores' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse do request
    const body = await req.json() as TestRequest;

    if (!body.payload || typeof body.payload !== 'object') {
      return new Response(
        JSON.stringify({ success: false, error: 'Payload é obrigatório e deve ser um objeto JSON' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[iniflex-sandbox-test] Iniciando teste para usuário:', userId);
    console.log('[iniflex-sandbox-test] Payload recebido:', JSON.stringify(body.payload, null, 2));

    // Executar teste no sandbox
    const result = await sendToInflexSandbox(body.payload, body.timeout_ms || 15000);

    // Salvar log se solicitado
    if (body.save_log !== false) {
      try {
        await serviceClient.from('iniflex_sandbox_logs').insert({
          request_payload: body.payload,
          response_payload: result.response.raw,
          http_status: result.httpStatus,
          latency_ms: result.latencyMs,
          error_message: result.error || null,
          created_by: userId,
        });
        console.log('[iniflex-sandbox-test] Log salvo com sucesso');
      } catch (logError) {
        console.error('[iniflex-sandbox-test] Erro ao salvar log:', logError);
      }
    }

    return new Response(
      JSON.stringify({
        success: result.success,
        test_result: result,
        timestamp: new Date().toISOString(),
      }),
      { 
        status: result.success ? 200 : 502, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('[iniflex-sandbox-test] Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
