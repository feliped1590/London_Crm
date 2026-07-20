import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { permissionErrorResponse, requireModulePermission } from '../_shared/permissionEngine.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Garante membership em user_tenants (+ active_tenant_id / active_legal_entity_id).
 * Necessário porque vincular CNPJ em user_legal_entities não cria o vínculo de tenant,
 * e sem user_tenants o RLS bloqueia legal_entities → tela "Acesso bloqueado".
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: currentUser }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !currentUser) {
      return new Response(JSON.stringify({ error: 'Usuário não autenticado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: isAdmin, error: roleError } = await supabaseUser.rpc('has_role', {
      _user_id: currentUser.id,
      _role: 'admin',
    });
    if (roleError) {
      return new Response(JSON.stringify({ error: 'Erro ao verificar permissões' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Apenas administradores podem reparar acesso de tenant' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await requireModulePermission(supabaseUser, currentUser.id, 'settings', 'edit');

    const body = await req.json();
    const targetUserId = body?.user_id as string | undefined;
    let tenantId = (body?.tenant_id as string | undefined) || null;
    let legalEntityId = (body?.legal_entity_id as string | undefined) || null;

    if (!targetUserId) {
      return new Response(JSON.stringify({ error: 'user_id é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, active_tenant_id, active_legal_entity_id')
      .eq('user_id', targetUserId)
      .maybeSingle();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: 'Perfil do usuário não encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Preferências explícitas → vínculos existentes → tenant do admin
    if (!tenantId && legalEntityId) {
      const { data: entity } = await supabaseAdmin
        .from('legal_entities')
        .select('id, tenant_id')
        .eq('id', legalEntityId)
        .maybeSingle();
      if (entity?.tenant_id) tenantId = entity.tenant_id;
    }

    if (!tenantId || !legalEntityId) {
      const { data: links } = await supabaseAdmin
        .from('user_legal_entities')
        .select('tenant_id, legal_entity_id, created_at')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: true });

      if (links && links.length > 0) {
        if (!tenantId) tenantId = links[0].tenant_id;
        if (!legalEntityId) legalEntityId = links[0].legal_entity_id;
      }
    }

    if (!tenantId) {
      const { data: adminProfile } = await supabaseAdmin
        .from('profiles')
        .select('active_tenant_id')
        .eq('user_id', currentUser.id)
        .maybeSingle();
      tenantId = adminProfile?.active_tenant_id ?? null;
    }

    if (!tenantId) {
      const { data: adminTenant } = await supabaseAdmin
        .from('user_tenants')
        .select('tenant_id')
        .eq('user_id', currentUser.id)
        .limit(1)
        .maybeSingle();
      tenantId = adminTenant?.tenant_id ?? null;
    }

    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: 'Não foi possível determinar o tenant para vincular o usuário' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { error: utError } = await supabaseAdmin.from('user_tenants').upsert(
      {
        user_id: targetUserId,
        tenant_id: tenantId,
        role: 'member',
      },
      { onConflict: 'user_id,tenant_id' },
    );
    if (utError) {
      console.error('Error upserting user_tenants:', utError);
      return new Response(JSON.stringify({ error: utError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const profileUpdate: Record<string, string> = {};
    if (!profile.active_tenant_id) profileUpdate.active_tenant_id = tenantId;
    if (!profile.active_legal_entity_id && legalEntityId) {
      profileUpdate.active_legal_entity_id = legalEntityId;
    }

    if (Object.keys(profileUpdate).length > 0) {
      const { error: updError } = await supabaseAdmin
        .from('profiles')
        .update(profileUpdate)
        .eq('user_id', targetUserId);
      if (updError) {
        console.error('Error updating profile tenant context:', updError);
        return new Response(JSON.stringify({ error: updError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        user_id: targetUserId,
        tenant_id: tenantId,
        legal_entity_id: legalEntityId,
        profile_updated: profileUpdate,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    const permissionResponse = permissionErrorResponse(error, corsHeaders);
    if (permissionResponse) return permissionResponse;

    console.error('Unexpected error:', error);
    return new Response(JSON.stringify({ error: 'Erro interno do servidor' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
