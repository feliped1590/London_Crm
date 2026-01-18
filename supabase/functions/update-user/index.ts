import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Get the authorization header from the request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create a client with the user's token to verify they are admin
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get the current user
    const { data: { user: currentUser }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !currentUser) {
      console.error('Error getting current user:', userError);
      return new Response(
        JSON.stringify({ error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Current user:', currentUser.id);

    // Check if the current user is an admin using the has_role function
    const { data: isAdmin, error: roleError } = await supabaseUser.rpc('has_role', {
      _user_id: currentUser.id,
      _role: 'admin'
    });

    if (roleError) {
      console.error('Error checking admin role:', roleError);
      return new Response(
        JSON.stringify({ error: 'Erro ao verificar permissões' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!isAdmin) {
      console.error('User is not admin:', currentUser.id);
      return new Response(
        JSON.stringify({ error: 'Apenas administradores podem editar usuários' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { user_id, email, password, full_name, role } = await req.json();

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'ID do usuário é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Updating user:', user_id);

    // Create a service role client to update users
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Build the update object for auth
    const authUpdateData: Record<string, unknown> = {};
    
    if (email) {
      authUpdateData.email = email;
      authUpdateData.email_confirm = true; // Auto-confirm the new email
    }
    
    if (password) {
      if (password.length < 6) {
        return new Response(
          JSON.stringify({ error: 'A senha deve ter no mínimo 6 caracteres' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      authUpdateData.password = password;
    }

    // Update auth data if there are changes
    if (Object.keys(authUpdateData).length > 0) {
      console.log('Updating auth data for user:', user_id);
      const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(
        user_id,
        authUpdateData
      );

      if (updateAuthError) {
        console.error('Error updating auth data:', updateAuthError);
        
        // Handle specific error cases
        if (updateAuthError.message?.includes('already been registered')) {
          return new Response(
            JSON.stringify({ error: 'Este email já está cadastrado para outro usuário' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        return new Response(
          JSON.stringify({ error: updateAuthError.message || 'Erro ao atualizar dados de autenticação' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Update profile if full_name is provided
    if (full_name) {
      console.log('Updating profile for user:', user_id);
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({ full_name, updated_at: new Date().toISOString() })
        .eq('user_id', user_id);

      if (profileError) {
        console.error('Error updating profile:', profileError);
        return new Response(
          JSON.stringify({ error: 'Erro ao atualizar perfil' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Update role if provided
    if (role) {
      console.log('Updating role for user:', user_id, 'to:', role);
      const { error: roleUpdateError } = await supabaseAdmin
        .from('user_roles')
        .update({ role })
        .eq('user_id', user_id);

      if (roleUpdateError) {
        console.error('Error updating role:', roleUpdateError);
        return new Response(
          JSON.stringify({ error: 'Erro ao atualizar nível de acesso' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log('User updated successfully:', user_id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Usuário atualizado com sucesso'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
