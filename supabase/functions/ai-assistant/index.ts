import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const SEARCHABLE_ENTITIES = new Set(["companies", "contacts", "deals", "products", "tasks", "orders", "proposals", "activities"]);

function sanitizeSearchQuery(value: unknown): string {
  if (typeof value !== "string") return "";

  return value
    .replace(/[%,_\\]/g, "")
    .replace(/[;'"`]/g, "")
    .replace(/--|\/\*/g, "")
    .trim()
    .slice(0, 100);
}

function normalizeSearchLimit(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 10;
  return Math.min(Math.max(Math.floor(value), 1), 50);
}

// Tool definitions for the AI
const tools = [
  {
    type: "function",
    function: {
      name: "search_database",
      description: "Search for records in the database (companies, contacts, deals, products, tasks, orders, proposals, activities)",
      parameters: {
        type: "object",
        properties: {
          entity: {
            type: "string",
            enum: ["companies", "contacts", "deals", "products", "tasks", "orders", "proposals", "activities"],
            description: "The type of entity to search"
          },
          query: {
            type: "string",
            description: "Search query (name, email, phone, number, etc.)"
          },
          limit: {
            type: "number",
            description: "Maximum number of results (default 10)"
          }
        },
        required: ["entity"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_contact",
      description: "Create a new contact in the CRM",
      parameters: {
        type: "object",
        properties: {
          first_name: { type: "string", description: "First name of the contact" },
          last_name: { type: "string", description: "Last name of the contact" },
          email: { type: "string", description: "Email address" },
          phone: { type: "string", description: "Phone number" },
          mobile: { type: "string", description: "Mobile number" },
          company_id: { type: "string", description: "UUID of the company to associate" },
          job_title: { type: "string", description: "Job title" },
          department: { type: "string", description: "Department" }
        },
        required: ["first_name"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_company",
      description: "Create a new company in the CRM",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Company name" },
          cnpj: { type: "string", description: "CNPJ number" },
          email: { type: "string", description: "Company email" },
          phone: { type: "string", description: "Phone number" },
          website: { type: "string", description: "Website URL" },
          address: { type: "string", description: "Address" },
          city: { type: "string", description: "City" },
          state: { type: "string", description: "State" }
        },
        required: ["name"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_deal",
      description: "Create a new deal/opportunity in the pipeline",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Deal name/title" },
          value: { type: "number", description: "Deal value in BRL" },
          company_id: { type: "string", description: "UUID of the company" },
          contact_id: { type: "string", description: "UUID of the contact" },
          stage: { 
            type: "string", 
            enum: ["prospeccao", "qualificacao", "proposta", "negociacao", "fechado_ganho", "fechado_perdido"],
            description: "Pipeline stage" 
          },
          expected_close_date: { type: "string", description: "Expected close date (YYYY-MM-DD)" },
          notes: { type: "string", description: "Additional notes" }
        },
        required: ["name"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_task",
      description: "Create a new task",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Task title" },
          description: { type: "string", description: "Task description" },
          due_date: { type: "string", description: "Due date (YYYY-MM-DD)" },
          due_time: { type: "string", description: "Due time (HH:MM)" },
          priority: { type: "string", enum: ["baixa", "media", "alta", "urgente"], description: "Task priority" },
          assigned_to: { type: "string", description: "UUID of user to assign" },
          company_id: { type: "string", description: "UUID of related company" },
          contact_id: { type: "string", description: "UUID of related contact" },
          deal_id: { type: "string", description: "UUID of related deal" }
        },
        required: ["title"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "send_whatsapp",
      description: "Send a WhatsApp message to a phone number",
      parameters: {
        type: "object",
        properties: {
          phone: { type: "string", description: "Phone number with country code (e.g., 5511999999999)" },
          message: { type: "string", description: "Message content to send" }
        },
        required: ["phone", "message"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "schedule_email",
      description: "Schedule an email to be sent",
      parameters: {
        type: "object",
        properties: {
          to_email: { type: "string", description: "Recipient email address" },
          subject: { type: "string", description: "Email subject" },
          body: { type: "string", description: "Email body (HTML supported)" },
          scheduled_for: { type: "string", description: "When to send (ISO datetime)" },
          contact_id: { type: "string", description: "UUID of related contact" },
          deal_id: { type: "string", description: "UUID of related deal" }
        },
        required: ["to_email", "subject", "body"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_dashboard_stats",
      description: "Get dashboard statistics (deals by stage, tasks pending, recent activities)",
      parameters: {
        type: "object",
        properties: {},
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_record",
      description: "Update an existing record in the database",
      parameters: {
        type: "object",
        properties: {
          entity: {
            type: "string",
            enum: ["companies", "contacts", "deals", "tasks", "orders", "proposals"],
            description: "The type of entity to update"
          },
          id: { type: "string", description: "UUID of the record to update" },
          updates: { 
            type: "object", 
            description: "Key-value pairs of fields to update. For orders: status can be pendente, em_producao, produzido, faturado, entregue, cancelado. For proposals: status can be rascunho, enviada, em_analise, aprovada, recusada, expirada." 
          }
        },
        required: ["entity", "id", "updates"]
      }
    }
  }
];

// Execute a tool call
async function executeTool(
  supabaseUrl: string,
  supabaseKey: string,
  toolName: string,
  args: Record<string, unknown>,
  userId: string
): Promise<{ success: boolean; result: unknown; error?: string }> {
  // Create a fresh client for each tool execution to avoid type issues
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    switch (toolName) {
      case "search_database": {
        const { entity, query, limit = 10 } = args as { entity: string; query?: string; limit?: number };
        if (!SEARCHABLE_ENTITIES.has(entity)) {
          return { success: false, result: null, error: "Tipo de entidade inválido" };
        }

        const sanitizedQuery = sanitizeSearchQuery(query);
        const safeLimit = normalizeSearchLimit(limit);
        
        let data: unknown[] = [];
        let error: unknown = null;
        
        if (entity === "companies") {
          const result = sanitizedQuery 
            ? await supabase.from("companies").select("*").or(`name.ilike.%${sanitizedQuery}%,cnpj.ilike.%${sanitizedQuery}%,email.ilike.%${sanitizedQuery}%`).limit(safeLimit)
            : await supabase.from("companies").select("*").limit(safeLimit);
          data = result.data || [];
          error = result.error;
        } else if (entity === "contacts") {
          const result = sanitizedQuery
            ? await supabase.from("contacts").select("*").or(`first_name.ilike.%${sanitizedQuery}%,last_name.ilike.%${sanitizedQuery}%,email.ilike.%${sanitizedQuery}%`).limit(safeLimit)
            : await supabase.from("contacts").select("*").limit(safeLimit);
          data = result.data || [];
          error = result.error;
        } else if (entity === "deals") {
          const result = sanitizedQuery
            ? await supabase.from("deals").select("*").ilike("name", `%${sanitizedQuery}%`).limit(safeLimit)
            : await supabase.from("deals").select("*").limit(safeLimit);
          data = result.data || [];
          error = result.error;
        } else if (entity === "products") {
          const result = sanitizedQuery
            ? await supabase.from("products").select("*").or(`name.ilike.%${sanitizedQuery}%,sku.ilike.%${sanitizedQuery}%`).limit(safeLimit)
            : await supabase.from("products").select("*").limit(safeLimit);
          data = result.data || [];
          error = result.error;
        } else if (entity === "tasks") {
          const result = query
            ? await supabase.from("tasks").select("*").ilike("title", `%${query}%`).limit(limit)
            : await supabase.from("tasks").select("*").limit(limit);
          data = result.data || [];
          error = result.error;
        } else if (entity === "orders") {
          const result = query
            ? await supabase.from("orders").select("*, company:companies(id, name), contact:contacts(id, first_name, last_name)").or(`number.ilike.%${query}%,observations.ilike.%${query}%`).limit(limit)
            : await supabase.from("orders").select("*, company:companies(id, name), contact:contacts(id, first_name, last_name)").order("created_at", { ascending: false }).limit(limit);
          data = result.data || [];
          error = result.error;
        } else if (entity === "proposals") {
          const result = query
            ? await supabase.from("proposals").select("*, company:companies(id, name), contact:contacts(id, first_name, last_name), deal:deals(id, name)").or(`number.ilike.%${query}%,observations.ilike.%${query}%`).limit(limit)
            : await supabase.from("proposals").select("*, company:companies(id, name), contact:contacts(id, first_name, last_name), deal:deals(id, name)").order("created_at", { ascending: false }).limit(limit);
          data = result.data || [];
          error = result.error;
        } else if (entity === "activities") {
          const result = query
            ? await supabase.from("activities").select("*, company:companies(id, name), contact:contacts(id, first_name, last_name), deal:deals(id, name)").or(`subject.ilike.%${query}%,content.ilike.%${query}%`).limit(limit)
            : await supabase.from("activities").select("*, company:companies(id, name), contact:contacts(id, first_name, last_name), deal:deals(id, name)").order("created_at", { ascending: false }).limit(limit);
          data = result.data || [];
          error = result.error;
        }
        
        if (error) throw error;
        return { success: true, result: data };
      }

      case "create_contact": {
        const { first_name, last_name, email, phone, mobile, company_id, job_title, department } = args as {
          first_name: string;
          last_name?: string;
          email?: string;
          phone?: string;
          mobile?: string;
          company_id?: string;
          job_title?: string;
          department?: string;
        };
        
        const { data, error } = await supabase
          .from("contacts")
          .insert({
            first_name,
            last_name,
            email,
            phone,
            mobile,
            company_id,
            job_title,
            department,
            created_by: userId,
            owner_id: userId
          })
          .select()
          .single();
        if (error) throw error;
        return { success: true, result: data };
      }

      case "create_company": {
        const { name, cnpj, email, phone, website, address, city, state } = args as {
          name: string;
          cnpj?: string;
          email?: string;
          phone?: string;
          website?: string;
          address?: string;
          city?: string;
          state?: string;
        };
        
        const { data, error } = await supabase
          .from("companies")
          .insert({
            name,
            cnpj,
            email,
            phone,
            website,
            address,
            city,
            state,
            created_by: userId,
            owner_id: userId
          })
          .select()
          .single();
        if (error) throw error;
        return { success: true, result: data };
      }

      case "create_deal": {
        const { name, value, company_id, contact_id, stage, expected_close_date, notes } = args as {
          name: string;
          value?: number;
          company_id?: string;
          contact_id?: string;
          stage?: string;
          expected_close_date?: string;
          notes?: string;
        };
        
        const { data, error } = await supabase
          .from("deals")
          .insert({
            name,
            value: value || 0,
            company_id,
            contact_id,
            stage: stage || "prospeccao",
            expected_close_date,
            notes,
            created_by: userId,
            owner_id: userId
          })
          .select()
          .single();
        if (error) throw error;
        return { success: true, result: data };
      }

      case "create_task": {
        const { title, description, due_date, due_time, priority, assigned_to, company_id, contact_id, deal_id } = args as {
          title: string;
          description?: string;
          due_date?: string;
          due_time?: string;
          priority?: string;
          assigned_to?: string;
          company_id?: string;
          contact_id?: string;
          deal_id?: string;
        };
        
        const { data, error } = await supabase
          .from("tasks")
          .insert({
            title,
            description,
            due_date,
            due_time,
            priority: priority || "media",
            assigned_to: assigned_to || userId,
            company_id,
            contact_id,
            deal_id,
            created_by: userId
          })
          .select()
          .single();
        if (error) throw error;
        return { success: true, result: data };
      }

      case "send_whatsapp": {
        const { phone, message } = args as { phone: string; message: string };
        
        // Get first active WhatsApp instance
        const { data: instances } = await supabase
          .from("whatsapp_instances")
          .select("id, instance_id, instance_token, status")
          .eq("status", "connected")
          .limit(1);
        
        if (!instances || instances.length === 0) {
          return { success: false, result: null, error: "Nenhuma instância de WhatsApp conectada" };
        }
        
        const instance = instances[0];
        const zapiUrl = `https://api.z-api.io/instances/${instance.instance_id}/token/${instance.instance_token}/send-text`;
        
        const response = await fetch(zapiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Client-Token": Deno.env.get("ZAPI_CLIENT_TOKEN") || ""
          },
          body: JSON.stringify({
            phone: phone.replace(/\D/g, ""),
            message
          })
        });
        
        if (!response.ok) {
          throw new Error("Falha ao enviar mensagem");
        }
        
        // Log the message
        await supabase.from("whatsapp_messages").insert({
          phone: phone.replace(/\D/g, ""),
          content: message,
          direction: "outbound",
          status: "sent",
          instance_id: instance.id
        });
        
        return { success: true, result: { message: "Mensagem enviada com sucesso" } };
      }

      case "schedule_email": {
        const { to_email, subject, body, scheduled_for, contact_id, deal_id } = args as {
          to_email: string;
          subject: string;
          body: string;
          scheduled_for?: string;
          contact_id?: string;
          deal_id?: string;
        };
        
        const { data, error } = await supabase.from("email_logs").insert({
          to_email,
          subject,
          body,
          scheduled_for: scheduled_for || new Date().toISOString(),
          status: scheduled_for ? "scheduled" : "pending",
          sent_by: userId,
          contact_id,
          deal_id
        }).select().single();
        
        if (error) throw error;
        return { success: true, result: data };
      }

      case "get_dashboard_stats": {
        // Get deals by stage
        const { data: deals } = await supabase
          .from("deals")
          .select("stage, value");
        
        const dealsByStage: Record<string, { count: number; value: number }> = {};
        let totalPipelineValue = 0;
        
        if (deals) {
          for (const deal of deals) {
            const stage = (deal as { stage: string; value: number }).stage;
            const value = (deal as { stage: string; value: number }).value;
            if (!dealsByStage[stage]) {
              dealsByStage[stage] = { count: 0, value: 0 };
            }
            dealsByStage[stage].count++;
            dealsByStage[stage].value += Number(value) || 0;
            totalPipelineValue += Number(value) || 0;
          }
        }
        
        // Get pending tasks count
        const { count: pendingTasks } = await supabase
          .from("tasks")
          .select("*", { count: "exact", head: true })
          .eq("status", "pendente");
        
        // Get today's tasks
        const today = new Date().toISOString().split("T")[0];
        const { count: todayTasks } = await supabase
          .from("tasks")
          .select("*", { count: "exact", head: true })
          .gte("due_date", today)
          .lt("due_date", today + "T23:59:59");
        
        // Get companies count
        const { count: companiesCount } = await supabase
          .from("companies")
          .select("*", { count: "exact", head: true });
        
        // Get contacts count
        const { count: contactsCount } = await supabase
          .from("contacts")
          .select("*", { count: "exact", head: true });
        
        return {
          success: true,
          result: {
            dealsByStage,
            totalPipelineValue,
            pendingTasks,
            todayTasks,
            companiesCount,
            contactsCount
          }
        };
      }

      case "update_record": {
        const { entity, id, updates } = args as { entity: string; id: string; updates: Record<string, unknown> };
        
        let data: unknown = null;
        let error: unknown = null;
        
        if (entity === "companies") {
          const result = await supabase.from("companies").update(updates as Record<string, string>).eq("id", id).select().single();
          data = result.data;
          error = result.error;
        } else if (entity === "contacts") {
          const result = await supabase.from("contacts").update(updates as Record<string, string>).eq("id", id).select().single();
          data = result.data;
          error = result.error;
        } else if (entity === "deals") {
          const result = await supabase.from("deals").update(updates as Record<string, string>).eq("id", id).select().single();
          data = result.data;
          error = result.error;
        } else if (entity === "tasks") {
          const result = await supabase.from("tasks").update(updates as Record<string, string>).eq("id", id).select().single();
          data = result.data;
          error = result.error;
        } else if (entity === "orders") {
          const result = await supabase.from("orders").update(updates as Record<string, string>).eq("id", id).select().single();
          data = result.data;
          error = result.error;
        } else if (entity === "proposals") {
          const result = await supabase.from("proposals").update(updates as Record<string, string>).eq("id", id).select().single();
          data = result.data;
          error = result.error;
        }
        
        if (error) throw error;
        return { success: true, result: data };
      }

      default:
        return { success: false, result: null, error: `Ferramenta desconhecida: ${toolName}` };
    }
  } catch (error) {
    console.error(`Error executing tool ${toolName}:`, error);
    return { success: false, result: null, error: String(error) };
  }
}

interface AIMessage {
  role: string;
  content?: string;
  tool_calls?: Array<{
    id: string;
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;
    
    // Get auth token from request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Create Supabase client with user's token
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    // Get current user
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Usuário não autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Service role client for operations
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey);
    
    const { message, conversationId } = await req.json();
    
    if (!message) {
      return new Response(
        JSON.stringify({ error: "Mensagem é obrigatória" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Get user profile
    const { data: profile } = await supabaseService
      .from("profiles")
      .select("full_name")
      .eq("user_id", user.id)
      .single();
    
    // Load or create conversation
    let conversation: { id: string; messages: Array<{ role: string; content: string }> };
    
    if (conversationId) {
      const { data: existingConv } = await supabaseService
        .from("ai_conversations")
        .select("*")
        .eq("id", conversationId)
        .eq("user_id", user.id)
        .single();
      
      if (existingConv) {
        conversation = {
          id: existingConv.id,
          messages: existingConv.messages as Array<{ role: string; content: string }>
        };
      } else {
        const { data: newConv } = await supabaseService
          .from("ai_conversations")
          .insert({ user_id: user.id, messages: [] })
          .select()
          .single();
        conversation = { id: newConv!.id, messages: [] };
      }
    } else {
      const { data: newConv } = await supabaseService
        .from("ai_conversations")
        .insert({ user_id: user.id, messages: [] })
        .select()
        .single();
      conversation = { id: newConv!.id, messages: [] };
    }
    
    // Build system prompt with context
    const systemPrompt = `Você é o Assistente IA do CRM da FDK. Você pode executar ações diretamente no sistema usando as ferramentas disponíveis.

INFORMAÇÕES DO USUÁRIO:
- Nome: ${profile?.full_name || user.email}
- Email: ${user.email}

CAPACIDADES:
- Buscar empresas, contatos, negócios, produtos, tarefas, pedidos, propostas e atividades
- Criar novos contatos, empresas, negócios e tarefas
- Consultar e atualizar pedidos (orders) e propostas (proposals)
- Enviar mensagens via WhatsApp
- Agendar envio de emails
- Consultar estatísticas do dashboard
- Atualizar registros existentes

MÓDULOS DISPONÍVEIS:
- Pedidos (orders): Campos principais: number, status, total_value, delivery_date, observations. Status possíveis: pendente, em_producao, produzido, faturado, entregue, cancelado
- Propostas (proposals): Campos principais: number, status, total_value, validity_date, payment_terms, delivery_terms. Status possíveis: rascunho, enviada, em_analise, aprovada, recusada, expirada
- Atividades (activities): Campos principais: type, subject, content. Tipos: note, call, email, meeting, task

INSTRUÇÕES:
1. Seja prestativo e execute as ações solicitadas
2. Confirme as ações executadas com detalhes
3. Se precisar de mais informações, pergunte antes de executar
4. Use linguagem profissional mas amigável
5. Sempre responda em português brasileiro
6. Para buscas, execute a ferramenta e apresente os resultados de forma organizada
7. Ao criar registros, confirme os dados criados

FORMATOS DE DATA:
- Data: YYYY-MM-DD (ex: 2026-01-20)
- Hora: HH:MM (ex: 14:30)
- Telefone: apenas números com DDD e código do país (ex: 5511999999999)`;

    // Add user message to history
    conversation.messages.push({ role: "user", content: message });
    
    // Keep only last 20 messages for context
    const messagesForAI = conversation.messages.slice(-20);
    
    // Call Lovable AI with tools
    const aiMessages: AIMessage[] = [
      { role: "system", content: systemPrompt },
      ...messagesForAI
    ];
    
    let response = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: aiMessages,
        tools,
        tool_choice: "auto",
        max_tokens: 4096
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI API error:", errorText);
      throw new Error(`AI API error: ${response.status}`);
    }
    
    let aiData = await response.json();
    let assistantMessage = aiData.choices[0].message;
    
    // Handle tool calls (may need multiple iterations)
    const maxIterations = 5;
    let iterations = 0;
    
    while (assistantMessage.tool_calls && iterations < maxIterations) {
      iterations++;
      
      // Add assistant message with tool calls
      aiMessages.push(assistantMessage);
      
      // Execute each tool call
      for (const toolCall of assistantMessage.tool_calls) {
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments);
        
        console.log(`Executing tool: ${toolName}`, toolArgs);
        
        const toolResult = await executeTool(
          supabaseUrl,
          supabaseServiceKey,
          toolName,
          toolArgs,
          user.id
        );
        
        // Add tool result to messages
        aiMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult)
        });
      }
      
      // Call AI again with tool results
      response = await fetch(LOVABLE_AI_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: aiMessages,
          tools,
          tool_choice: "auto",
          max_tokens: 4096
        })
      });
      
      if (!response.ok) {
        throw new Error(`AI API error: ${response.status}`);
      }
      
      aiData = await response.json();
      assistantMessage = aiData.choices[0].message;
    }
    
    const finalContent = assistantMessage.content || "Ação executada com sucesso.";
    
    // Add assistant response to history
    conversation.messages.push({ role: "assistant", content: finalContent });
    
    // Save updated conversation
    await supabaseService
      .from("ai_conversations")
      .update({ 
        messages: conversation.messages,
        updated_at: new Date().toISOString()
      })
      .eq("id", conversation.id);
    
    return new Response(
      JSON.stringify({
        response: finalContent,
        conversationId: conversation.id
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error("Error in ai-assistant:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao processar mensagem" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
