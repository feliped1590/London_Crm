import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SaveLeadRequest {
  resultId: string;
  ownerId?: string;
  createTask?: boolean;
  taskTitle?: string;
  taskDueDate?: string;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verificar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Cliente com service role para operações privilegiadas
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verificar usuário
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json() as SaveLeadRequest;
    const { resultId, ownerId, createTask = false, taskTitle, taskDueDate } = body;

    if (!resultId) {
      return new Response(
        JSON.stringify({ error: 'ID do resultado é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar resultado da prospecção
    const { data: result, error: resultError } = await supabaseClient
      .from('prospecting_results')
      .select('*, prospecting_searches!inner(user_id)')
      .eq('id', resultId)
      .single();

    if (resultError || !result) {
      return new Response(
        JSON.stringify({ error: 'Resultado não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se já foi salvo
    if (result.status === 'saved' && result.saved_as_company_id) {
      return new Response(
        JSON.stringify({ 
          error: 'Este resultado já foi salvo como lead',
          company_id: result.saved_as_company_id 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar duplicidade por CNPJ
    const { data: existingCompany } = await supabaseClient
      .from('companies')
      .select('id, name, owner_id')
      .eq('cnpj', result.cnpj)
      .maybeSingle();

    if (existingCompany) {
      // Buscar nome do dono se existir
      let ownerName = null;
      if (existingCompany.owner_id) {
        const { data: ownerProfile } = await supabaseClient
          .from('profiles')
          .select('full_name')
          .eq('user_id', existingCompany.owner_id)
          .single();
        ownerName = ownerProfile?.full_name;
      }

      return new Response(
        JSON.stringify({ 
          error: 'Já existe uma empresa cadastrada com este CNPJ',
          existing_company: {
            id: existingCompany.id,
            name: existingCompany.name,
            owner_name: ownerName,
          }
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determinar owner_id final (padrão: usuário atual)
    const finalOwnerId = ownerId || user.id;

    // Criar empresa como lead
    const { data: newCompany, error: companyError } = await supabaseClient
      .from('companies')
      .insert({
        name: result.razao_social,
        fantasia: result.nome_fantasia,
        cnpj: result.cnpj,
        state: result.estado,
        city: result.cidade,
        
        owner_id: finalOwnerId,
        created_by: user.id,
        origin: 'prospecting',
        active: true,
        custom_fields: {
          cnae_principal: result.cnae_principal,
          porte: result.porte,
          data_abertura: result.data_abertura,
          situacao_cadastral: result.situacao_cadastral,
          prospectado_por: user.id,
          prospectado_em: new Date().toISOString(),
        },
      })
      .select()
      .single();

    if (companyError) {
      console.error('Error creating company:', companyError);
      return new Response(
        JSON.stringify({ error: 'Erro ao criar empresa: ' + companyError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Atualizar resultado como salvo
    await supabaseClient
      .from('prospecting_results')
      .update({
        status: 'saved',
        saved_as_company_id: newCompany.id,
        saved_at: new Date().toISOString(),
        saved_by: user.id,
      })
      .eq('id', resultId);

    // Registrar atividade
    await supabaseClient
      .from('activities')
      .insert({
        company_id: newCompany.id,
        type: 'prospecting',
        subject: 'Lead criado via prospecção',
        content: `Empresa prospectada e adicionada como lead. CNPJ: ${result.cnpj}. Origem: Receita Federal.`,
        created_by: user.id,
        metadata: {
          source: 'prospecting',
          prospecting_result_id: resultId,
          cnae: result.cnae_principal,
          porte: result.porte,
        },
      });

    let taskId = null;

    // Criar tarefa de primeiro contato se solicitado
    if (createTask) {
      const { data: newTask, error: taskError } = await supabaseClient
        .from('tasks')
        .insert({
          title: taskTitle || `Primeiro contato - ${result.razao_social}`,
          description: `Realizar primeiro contato com lead prospectado.\n\nEmpresa: ${result.razao_social}\nCNPJ: ${result.cnpj}\nEstado: ${result.estado}`,
          company_id: newCompany.id,
          assigned_to: finalOwnerId,
          created_by: user.id,
          due_date: taskDueDate || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 dias
          priority: 'alta',
          status: 'pendente',
        })
        .select()
        .single();

      if (!taskError && newTask) {
        taskId = newTask.id;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Lead criado com sucesso',
        company: {
          id: newCompany.id,
          name: newCompany.name,
          cnpj: newCompany.cnpj,
        },
        task_id: taskId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in prospecting-save-lead:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno ao salvar lead' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
