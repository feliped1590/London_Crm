import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { permissionErrorResponse, requireModulePermission } from '../_shared/permissionEngine.ts';

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
        JSON.stringify({ error: 'Apenas administradores podem criar usuários' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await requireModulePermission(supabaseUser, currentUser.id, 'settings', 'create');

    // Create a service role client to check license and create users
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Check license limit before creating user
    console.log('Checking license status...');
    const { data: licenseStatus, error: licenseError } = await supabaseAdmin
      .rpc('get_license_status');

    if (licenseError) {
      console.error('Error checking license:', licenseError);
      return new Response(
        JSON.stringify({ error: 'Erro ao verificar licença' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('License status:', licenseStatus);

    // get_license_status returns an array, get the first element
    const license = Array.isArray(licenseStatus) ? licenseStatus[0] : licenseStatus;

    if (!license?.can_add_user) {
      console.error('License limit reached:', license);
      return new Response(
        JSON.stringify({ 
          error: `Limite de usuários atingido (${license?.current_users}/${license?.max_users}). Entre em contato para aumentar sua licença.`
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { email, password, full_name, role } = await req.json();

    if (!email || !password || !full_name) {
      return new Response(
        JSON.stringify({ error: 'Email, senha e nome são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'A senha deve ter no mínimo 6 caracteres' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate role against allowed app_role enum values
    const ASSIGNABLE_ROLES = [
      'admin',
      'vendedor',
      'atendente',
      'financeiro',
      'faturamento',
      'logistica',
      'qualidade',
    ];
    if (role && !ASSIGNABLE_ROLES.includes(role)) {
      return new Response(
        JSON.stringify({ error: `Perfil inválido: ${role}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Creating user with email:', email);

    // Create the user using admin API
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm the email
      user_metadata: {
        full_name,
      },
    });

    if (createError) {
      console.error('Error creating user:', createError);
      
      // Handle specific error cases
      if (createError.message?.includes('already been registered')) {
        return new Response(
          JSON.stringify({ error: 'Este email já está cadastrado' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: createError.message || 'Erro ao criar usuário' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User created:', newUser.user?.id);

    // The trigger handle_new_user will create the profile and assign default role (vendedor)
    // If the role should be different, update it
    if (role && role !== 'vendedor' && newUser.user) {
      console.log('Updating role to:', role);
      const { error: updateRoleError } = await supabaseAdmin
        .from('user_roles')
        .update({ role })
        .eq('user_id', newUser.user.id);

      if (updateRoleError) {
        console.error('Error updating role:', updateRoleError);
        // User was created, but role update failed - not critical
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: { 
          id: newUser.user?.id, 
          email: newUser.user?.email 
        } 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const permissionResponse = permissionErrorResponse(error, corsHeaders);
    if (permissionResponse) return permissionResponse;

    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
