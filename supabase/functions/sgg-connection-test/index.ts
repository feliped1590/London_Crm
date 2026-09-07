import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { probeSggConnection } from '../_shared/sgg/client.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sgg-sync-secret',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Método não permitido.' }, 405);

  try {
    const authHeader = req.headers.get('Authorization');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      throw new Error('Configuração interna do Supabase incompleta.');
    }

    const configuredSyncSecret = Deno.env.get('SGG_SYNC_CRON_SECRET');
    const providedSyncSecret = req.headers.get('x-sgg-sync-secret');
    const isInternalRequest = Boolean(
      configuredSyncSecret && providedSyncSecret &&
      configuredSyncSecret === providedSyncSecret,
    );

    if (!isInternalRequest) {
      if (!authHeader?.startsWith('Bearer ')) {
        return jsonResponse({ error: 'Não autorizado.' }, 401);
      }

      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: userError } = await userClient.auth.getUser();
      if (userError || !user) return jsonResponse({ error: 'Sessão inválida.' }, 401);

      const adminClient = createClient(supabaseUrl, serviceRoleKey);
      const [{ data: isAdmin }, { data: isDeveloper }] = await Promise.all([
        adminClient.rpc('has_role', { _user_id: user.id, _role: 'admin' }),
        adminClient.rpc('has_role', { _user_id: user.id, _role: 'desenvolvedor' }),
      ]);
      if (!isAdmin && !isDeveloper) {
        return jsonResponse({ error: 'Apenas administradores e desenvolvedores podem testar integrações.' }, 403);
      }
    }

    const result = await probeSggConnection();
    return jsonResponse({ success: result.authenticated, data: result }, result.authenticated ? 200 : 502);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido.';
    console.error('[sgg-connection-test] Falha no teste:', message);
    return jsonResponse({ success: false, error: message }, 500);
  }
});
