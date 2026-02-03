import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

interface CopilotRequest {
  context_type: 'deal' | 'company' | 'contact' | 'pipeline' | 'seller' | 'general' | 'dashboard';
  context_entity_id?: string;
  refresh?: boolean;
}

interface ContextData {
  type: string;
  entity?: Record<string, unknown>;
  metrics?: Record<string, unknown>;
  anomalies?: Array<Record<string, unknown>>;
  stalledDeals?: Array<Record<string, unknown>>;
  recentActivities?: Array<Record<string, unknown>>;
  pendingTasks?: Array<Record<string, unknown>>;
}

// Build context from database
// deno-lint-ignore no-explicit-any
async function buildContext(
  supabase: SupabaseClient<any, any, any>,
  contextType: string,
  entityId?: string,
  userId?: string
): Promise<ContextData> {
  const context: ContextData = { type: contextType };

  try {
    // Get anomalies from BI
    // deno-lint-ignore no-explicit-any
    const { data: anomalies } = await (supabase as any).rpc('get_bi_anomalies');
    context.anomalies = anomalies || [];

    // Get stalled deals
    // deno-lint-ignore no-explicit-any
    const { data: stalledDeals } = await (supabase as any).rpc('get_stalled_deals_by_seller', {
      p_seller_id: null,
      p_min_days: 7
    });
    context.stalledDeals = (stalledDeals || []).slice(0, 10);

    // Get pending tasks for user
    if (userId) {
      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, title, due_date, priority, status, company:companies(name), deal:deals(name)')
        .or(`assigned_to.eq.${userId},created_by.eq.${userId}`)
        .in('status', ['pendente', 'em_andamento'])
        .order('due_date', { ascending: true })
        .limit(10);
      context.pendingTasks = tasks || [];
    }

    // Get recent activities
    const { data: activities } = await supabase
      .from('activities')
      .select('id, type, subject, content, created_at, company:companies(name), deal:deals(name)')
      .order('created_at', { ascending: false })
      .limit(5);
    context.recentActivities = activities || [];

    // Entity-specific context
    if (contextType === 'deal' && entityId) {
      const { data: deal } = await supabase
        .from('deals')
        .select(`
          *,
          company:companies(id, name, phone, email, last_reviewed_at),
          contact:contacts(id, first_name, last_name, phone, email),
          pipeline:pipelines(id, name)
        `)
        .eq('id', entityId)
        .single();
      context.entity = deal || undefined;

      // Get deal stage history
      const { data: stageHistory } = await supabase
        .from('deal_stage_history')
        .select('from_stage, to_stage, changed_at, duration_seconds')
        .eq('deal_id', entityId)
        .order('changed_at', { ascending: false })
        .limit(5);
      
      if (context.entity && stageHistory) {
        (context.entity as Record<string, unknown>).stage_history = stageHistory;
      }
    } else if (contextType === 'company' && entityId) {
      const { data: company } = await supabase
        .from('companies')
        .select('*')
        .eq('id', entityId)
        .single();
      context.entity = company || undefined;

      // Get company's deals
      const { data: companyDeals } = await supabase
        .from('deals')
        .select('id, name, stage, value, created_at')
        .eq('company_id', entityId)
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (context.entity && companyDeals) {
        (context.entity as Record<string, unknown>).recent_deals = companyDeals;
      }

      // Get last contact activity
      const { data: lastActivity } = await supabase
        .from('activities')
        .select('type, subject, created_at')
        .eq('company_id', entityId)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (context.entity && lastActivity?.length) {
        (context.entity as Record<string, unknown>).last_activity = lastActivity[0];
      }
    } else if (contextType === 'pipeline') {
      // Get pipeline health
      // deno-lint-ignore no-explicit-any
      const { data: pipelineHealth } = await (supabase as any).rpc('get_pipeline_health', {
        p_pipeline_id: entityId || null,
        p_start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        p_end_date: new Date().toISOString().split('T')[0]
      });
      context.metrics = { pipeline_health: pipelineHealth };
    } else if (contextType === 'seller' && entityId) {
      // Get seller performance
      // deno-lint-ignore no-explicit-any
      const { data: performance } = await (supabase as any).rpc('get_seller_performance', {
        p_start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        p_end_date: new Date().toISOString().split('T')[0],
        p_compare_previous: true
      });
      context.metrics = { 
        seller_performance: (performance || []).find((p: { seller_id: string }) => p.seller_id === entityId) 
      };
    }

    // Dashboard context - general overview
    if (contextType === 'dashboard' || contextType === 'general') {
      // Get deals by stage summary
      const { data: deals } = await supabase
        .from('deals')
        .select('stage, value')
        .not('stage', 'in', '(fechado_ganho,fechado_perdido)');
      
      const dealsByStage: Record<string, { count: number; value: number }> = {};
      (deals || []).forEach((d: { stage: string; value: number | null }) => {
        if (!dealsByStage[d.stage]) {
          dealsByStage[d.stage] = { count: 0, value: 0 };
        }
        dealsByStage[d.stage].count++;
        dealsByStage[d.stage].value += d.value || 0;
      });
      context.metrics = { deals_by_stage: dealsByStage };
    }
  } catch (error) {
    console.error('Error building context:', error);
  }

  return context;
}

// Build the structured prompt
function buildPrompt(context: ContextData): string {
  const today = new Date().toLocaleDateString('pt-BR');
  
  let prompt = `Você é um Copiloto de Vendas inteligente. Sua função é analisar dados reais do CRM e sugerir ações concretas.

## REGRAS CRÍTICAS:
1. NUNCA execute ações - apenas sugira
2. NUNCA invente dados - use apenas o que está no contexto
3. SEMPRE explique o "porquê" de cada sugestão
4. Priorize sugestões acionáveis e específicas
5. Limite a 3-5 sugestões mais relevantes

## DATA ATUAL: ${today}

## CONTEXTO DO CRM:
`;

  // Add anomalies
  if (context.anomalies && context.anomalies.length > 0) {
    prompt += `\n### ALERTAS DETECTADOS:\n`;
    context.anomalies.forEach((a, i) => {
      prompt += `${i + 1}. [${a.severity}] ${a.title}: ${a.description} (${a.affected_count} afetados, R$ ${Number(a.affected_value || 0).toLocaleString('pt-BR')})\n`;
    });
  }

  // Add stalled deals
  if (context.stalledDeals && context.stalledDeals.length > 0) {
    prompt += `\n### NEGÓCIOS PARADOS (7+ dias):\n`;
    context.stalledDeals.slice(0, 5).forEach((d, i) => {
      prompt += `${i + 1}. "${d.deal_name}" - ${d.company_name || 'Sem empresa'} - Etapa: ${d.stage} - ${d.days_stalled} dias parado - R$ ${Number(d.value || 0).toLocaleString('pt-BR')}\n`;
    });
  }

  // Add pending tasks
  if (context.pendingTasks && context.pendingTasks.length > 0) {
    prompt += `\n### TAREFAS PENDENTES:\n`;
    context.pendingTasks.slice(0, 5).forEach((t, i) => {
      const dueDate = t.due_date ? new Date(t.due_date as string).toLocaleDateString('pt-BR') : 'Sem prazo';
      const isOverdue = t.due_date && new Date(t.due_date as string) < new Date();
      prompt += `${i + 1}. ${isOverdue ? '[ATRASADA] ' : ''}${t.title} - Prazo: ${dueDate} - Prioridade: ${t.priority}\n`;
    });
  }

  // Entity-specific context
  if (context.entity) {
    prompt += `\n### ENTIDADE EM FOCO:\n`;
    prompt += JSON.stringify(context.entity, null, 2);
  }

  // Metrics
  if (context.metrics) {
    prompt += `\n### MÉTRICAS:\n`;
    prompt += JSON.stringify(context.metrics, null, 2);
  }

  prompt += `

## FORMATO DE RESPOSTA (JSON):
Retorne um array JSON com as sugestões no formato:
[
  {
    "suggestion_type": "follow_up" | "review_proposal" | "redistribute_portfolio" | "schedule_contact" | "update_deal" | "create_task" | "alert",
    "priority": "low" | "medium" | "high" | "critical",
    "title": "Título curto e claro",
    "description": "Descrição da sugestão (1-2 frases)",
    "reasoning": "Por que estou sugerindo isso (baseado nos dados acima)",
    "action_type": "create_task" | "update_deal" | "navigate" | "send_message" | null,
    "action_payload": { ... dados para a ação, se aplicável ... },
    "action_url": "/pipeline?deal=xyz" (URL relativa para navegação, se aplicável)
  }
]

Gere de 3 a 5 sugestões ordenadas por prioridade.`;

  return prompt;
}

// Parse AI response into structured suggestions
interface Suggestion {
  suggestion_type: string;
  priority: string;
  title: string;
  description: string;
  reasoning: string;
  action_type?: string;
  action_payload?: Record<string, unknown>;
  action_url?: string;
}

function parseAIResponse(content: string): Suggestion[] {
  try {
    // Try to extract JSON from the response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return [];
  } catch (error) {
    console.error('Error parsing AI response:', error);
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Get auth token from request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create client with user's token for RLS
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get user ID
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Service client for writing suggestions
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const body: CopilotRequest = await req.json();
    const { context_type, context_entity_id, refresh } = body;

    // Check for recent suggestions if not refreshing
    if (!refresh) {
      const { data: existingSuggestions } = await supabaseUser
        .from('ai_copilot_suggestions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // Last hour
        .order('created_at', { ascending: false });

      if (existingSuggestions && existingSuggestions.length >= 3) {
        return new Response(
          JSON.stringify({ suggestions: existingSuggestions, cached: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Build context from database
    const context = await buildContext(supabaseUser, context_type, context_entity_id, user.id);

    // Build structured prompt
    const prompt = buildPrompt(context);

    // Call Lovable AI
    const aiResponse = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "user", content: prompt }
        ],
        temperature: 0.3, // Lower temperature for more consistent suggestions
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error("AI service error");
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content || "";
    const usage = aiData.usage || {};

    // Parse suggestions from AI response
    const parsedSuggestions = parseAIResponse(aiContent);

    if (parsedSuggestions.length === 0) {
      return new Response(
        JSON.stringify({ suggestions: [], message: "No actionable suggestions at this time." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Store suggestions in database
    const suggestionsToInsert = parsedSuggestions.map(s => ({
      user_id: user.id,
      context_type,
      context_entity_id: context_entity_id || null,
      context_data: context,
      suggestion_type: s.suggestion_type,
      title: s.title,
      description: s.description,
      reasoning: s.reasoning,
      priority: s.priority,
      action_type: s.action_type || null,
      action_payload: s.action_payload || null,
      action_url: s.action_url || null,
      status: 'pending',
      model_used: 'google/gemini-3-flash-preview',
      prompt_tokens: usage.prompt_tokens || null,
      completion_tokens: usage.completion_tokens || null,
    }));

    const { data: savedSuggestions, error: insertError } = await supabaseAdmin
      .from('ai_copilot_suggestions')
      .insert(suggestionsToInsert)
      .select();

    if (insertError) {
      console.error("Error saving suggestions:", insertError);
    }

    return new Response(
      JSON.stringify({ 
        suggestions: savedSuggestions || suggestionsToInsert,
        cached: false 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Copilot error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
