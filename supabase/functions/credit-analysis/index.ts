import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkAccessWindow, AccessWindowError, AccessCheckUnavailableError } from '../_shared/accessControl.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreditAnalysisRequest {
  companyId: string;
  cnpj: string;
  companyName: string;
  reason: string;
}

interface SimulatedCreditResult {
  creditScore: number;
  riskClassification: 'baixo' | 'medio' | 'alto';
  cadastralStatus: string;
  restrictionsSummary: string | null;
}

function generateSimulatedCredit(): SimulatedCreditResult {
  // Simula score entre 300 e 900
  const creditScore = Math.floor(Math.random() * 600) + 300;
  
  // Classifica risco baseado no score
  let riskClassification: 'baixo' | 'medio' | 'alto';
  let cadastralStatus: string;
  let restrictionsSummary: string | null = null;
  
  if (creditScore >= 700) {
    riskClassification = 'baixo';
    cadastralStatus = 'Regular';
  } else if (creditScore >= 500) {
    riskClassification = 'medio';
    cadastralStatus = 'Regular com ressalvas';
    restrictionsSummary = 'Histórico de pagamentos com atrasos pontuais';
  } else {
    riskClassification = 'alto';
    cadastralStatus = 'Irregular';
    restrictionsSummary = 'Restrições cadastrais identificadas. Recomenda-se análise detalhada antes de concessão de crédito.';
  }
  
  return {
    creditScore,
    riskClassification,
    cadastralStatus,
    restrictionsSummary,
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Get auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user's token for auth
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    
    // Get authenticated user
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create admin client for operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // ⏰ Janela de acesso (strict — análise de crédito é decisão financeira)
    try {
      await checkAccessWindow(supabaseAdmin, user.id, {
        mode: 'strict',
        context: 'credit-analysis',
      });
    } catch (winErr) {
      if (winErr instanceof AccessWindowError || winErr instanceof AccessCheckUnavailableError) {
        return new Response(
          JSON.stringify({ error: winErr.message, code: (winErr as any).code }),
          { status: (winErr as any).status ?? 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw winErr;
    }

    // Check permission using the function
    const { data: canUpdate, error: permError } = await supabaseAdmin.rpc('can_update_credit_score', {
      _user_id: user.id
    });

    if (permError || !canUpdate) {
      return new Response(
        JSON.stringify({ error: 'Você não tem permissão para realizar análises de crédito' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: CreditAnalysisRequest = await req.json();
    const { companyId, cnpj, companyName, reason } = body;

    if (!companyId || !cnpj || !companyName || !reason) {
      return new Response(
        JSON.stringify({ error: 'Dados incompletos. Informe empresa, CNPJ e motivo.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (reason.length < 10) {
      return new Response(
        JSON.stringify({ error: 'O motivo deve ter pelo menos 10 caracteres' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user profile for audit
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('full_name')
      .eq('user_id', user.id)
      .single();

    const userName = profile?.full_name || user.email || 'Usuário';

    // Generate simulated credit result
    const creditResult = generateSimulatedCredit();

    // UPSERT into credit_analyses
    const { error: upsertError } = await supabaseAdmin
      .from('credit_analyses')
      .upsert({
        company_id: companyId,
        cnpj: cnpj,
        credit_score: creditResult.creditScore,
        risk_classification: creditResult.riskClassification,
        cadastral_status: creditResult.cadastralStatus,
        restrictions_summary: creditResult.restrictionsSummary,
        api_provider: 'simulado',
        analysis_date: new Date().toISOString(),
        consultation_reason: reason,
        consulted_by: user.id,
      }, {
        onConflict: 'company_id'
      });

    if (upsertError) {
      console.error('Error upserting credit analysis:', upsertError);
      return new Response(
        JSON.stringify({ error: 'Erro ao salvar análise de crédito' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert audit record
    const { error: auditError } = await supabaseAdmin
      .from('credit_analysis_audit')
      .insert({
        company_id: companyId,
        company_name: companyName,
        cnpj: cnpj,
        user_id: user.id,
        user_name: userName,
        reason: reason,
        action: 'consulta',
        result_summary: {
          credit_score: creditResult.creditScore,
          risk_classification: creditResult.riskClassification,
          cadastral_status: creditResult.cadastralStatus,
        },
      });

    if (auditError) {
      console.error('Error inserting audit record:', auditError);
      // Don't fail - analysis was saved, just log the audit error
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          creditScore: creditResult.creditScore,
          riskClassification: creditResult.riskClassification,
          cadastralStatus: creditResult.cadastralStatus,
          restrictionsSummary: creditResult.restrictionsSummary,
          analysisDate: new Date().toISOString(),
          apiProvider: 'simulado',
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Credit analysis error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno ao processar análise de crédito' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
