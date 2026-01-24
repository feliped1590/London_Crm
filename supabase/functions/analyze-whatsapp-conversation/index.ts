import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, contactId } = await req.json();

    if (!phone) {
      return new Response(
        JSON.stringify({ error: "Phone number is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch last 100 messages from this conversation
    const { data: messages, error: messagesError } = await supabase
      .from("whatsapp_messages")
      .select("content, direction, created_at, message_type")
      .eq("phone", phone)
      .order("created_at", { ascending: true })
      .limit(100);

    if (messagesError) {
      console.error("Error fetching messages:", messagesError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch messages" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!messages || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "No messages found for this conversation" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format messages for AI analysis
    const conversationText = messages
      .map((msg) => {
        const sender = msg.direction === "outbound" ? "Vendedor" : "Cliente";
        const content = msg.message_type === "text" ? msg.content : `[${msg.message_type}]`;
        return `${sender}: ${content || "[mídia]"}`;
      })
      .join("\n");

    const systemPrompt = `Você é um assistente de análise de vendas. Analise a conversa de WhatsApp abaixo e retorne uma análise estruturada.

IMPORTANTE: Retorne APENAS um JSON válido, sem markdown, sem explicações, apenas o JSON puro.

A análise deve identificar:
1. Um resumo conciso da conversa (2-3 frases)
2. O sentimento geral do cliente (positive, neutral, negative)
3. O nível de interesse do cliente (Alto, Médio, Baixo)
4. Próximos passos sugeridos (lista de 2-3 ações)
5. Objeções identificadas, se houver

Para cada objeção identificada, classifique como:
- price: Objeções relacionadas a preço, custo, orçamento, desconto
- timing: Objeções de tempo, como "depois", "mês que vem", "precisamos aprovar internamente"
- competition: Menções a concorrentes ou outras opções
- authority: Cliente não é o decisor, precisa consultar alguém
- need: Cliente questiona se realmente precisa do produto/serviço
- other: Outras objeções

Formato de resposta JSON:
{
  "summary": "string",
  "sentiment": "positive" | "neutral" | "negative",
  "customerIntent": "Alto" | "Médio" | "Baixo",
  "nextSteps": ["string", "string"],
  "objections": [
    {
      "type": "price" | "timing" | "competition" | "authority" | "need" | "other",
      "description": "descrição breve da objeção",
      "excerpt": "trecho relevante da mensagem"
    }
  ]
}`;

    // Call Lovable AI Gateway
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Conversa:\n${conversationText}` },
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: "AI analysis failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content;

    if (!aiContent) {
      return new Response(
        JSON.stringify({ error: "No response from AI" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse AI response
    let analysis;
    try {
      // Clean the response in case it has markdown code blocks
      let cleanContent = aiContent.trim();
      if (cleanContent.startsWith("```json")) {
        cleanContent = cleanContent.slice(7);
      } else if (cleanContent.startsWith("```")) {
        cleanContent = cleanContent.slice(3);
      }
      if (cleanContent.endsWith("```")) {
        cleanContent = cleanContent.slice(0, -3);
      }
      analysis = JSON.parse(cleanContent.trim());
    } catch (parseError) {
      console.error("Failed to parse AI response:", aiContent);
      return new Response(
        JSON.stringify({ error: "Failed to parse AI response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Save summary to database
    const { data: summaryData, error: summaryError } = await supabase
      .from("whatsapp_conversation_summaries")
      .insert({
        phone,
        contact_id: contactId || null,
        summary: analysis.summary,
        sentiment: analysis.sentiment,
        customer_intent: analysis.customerIntent,
        next_steps: analysis.nextSteps,
        message_count: messages.length,
        analyzed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (summaryError) {
      console.error("Error saving summary:", summaryError);
    }

    // Save objections to database
    if (analysis.objections && analysis.objections.length > 0) {
      const objectionsToInsert = analysis.objections.map((obj: any) => ({
        phone,
        contact_id: contactId || null,
        type: obj.type,
        description: obj.description,
        message_excerpt: obj.excerpt,
        status: "raised",
        detected_at: new Date().toISOString(),
      }));

      const { error: objectionsError } = await supabase
        .from("whatsapp_objections")
        .insert(objectionsToInsert);

      if (objectionsError) {
        console.error("Error saving objections:", objectionsError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        summary: summaryData,
        objections: analysis.objections || [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in analyze-whatsapp-conversation:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
