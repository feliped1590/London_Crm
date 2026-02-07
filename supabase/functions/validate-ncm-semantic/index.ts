import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SemanticValidationResponse {
  compatible: boolean;
  confidence: number;
  risk_level: 'low' | 'medium' | 'high';
  summary: string;
  product_keywords?: string[];
  expected_keywords?: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { productDescription, ncmCode, ncmDescription } = await req.json();

    if (!productDescription || !ncmCode || !ncmDescription) {
      return new Response(
        JSON.stringify({ 
          error: "Parâmetros obrigatórios: productDescription, ncmCode, ncmDescription" 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY não configurada");
      // Fallback para não bloquear o fluxo
      return new Response(JSON.stringify({
        compatible: true,
        confidence: 0.5,
        risk_level: "medium",
        summary: "Validação automática indisponível. Verifique manualmente a compatibilidade do NCM.",
      } as SemanticValidationResponse), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `Você é um especialista fiscal brasileiro em classificação NCM. Analise a compatibilidade entre:

DESCRIÇÃO DO PRODUTO: "${productDescription}"
CÓDIGO NCM: ${ncmCode}
DESCRIÇÃO OFICIAL DO NCM: "${ncmDescription}"

Responda APENAS com um JSON válido seguindo este schema exato (sem markdown, sem explicações extras):
{
  "compatible": boolean,
  "confidence": number (0.0 a 1.0),
  "risk_level": "low" | "medium" | "high",
  "summary": "Explicação em até 50 palavras",
  "product_keywords": ["palavras", "chave", "do", "produto"],
  "expected_keywords": ["palavras", "esperadas", "pelo", "ncm"]
}

Critérios para sua análise:
- compatible: true se o produto PODE ser classificado neste NCM conforme a TIPI
- confidence: sua certeza na análise (0.0 = nenhuma, 1.0 = absoluta)
- risk_level: 
  - "low" se compatible=true E confidence>0.8 (produto claramente compatível)
  - "medium" se compatible=true E confidence entre 0.5-0.8, OU se há ambiguidade que requer revisão
  - "high" se compatible=false OU confidence<0.5 (divergência clara ou classificação incorreta)

Considere:
- Materiais compatíveis (ex: PEBD é polietileno, compatível com NCM de plásticos)
- Finalidade do produto (embalagem, filme, sacola, etc)
- Processo produtivo implícito na descrição`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ 
          error: "Limite de requisições excedido. Tente novamente em alguns segundos." 
        }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      if (response.status === 402) {
        return new Response(JSON.stringify({ 
          error: "Créditos insuficientes para validação de IA." 
        }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      // Fallback para não bloquear o fluxo
      return new Response(JSON.stringify({
        compatible: true,
        confidence: 0.5,
        risk_level: "medium",
        summary: "Não foi possível validar automaticamente. Verifique manualmente.",
      } as SemanticValidationResponse), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || "";
    
    // Extrair JSON da resposta (pode vir com markdown code blocks)
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    } else {
      const plainMatch = content.match(/\{[\s\S]*\}/);
      if (plainMatch) {
        jsonStr = plainMatch[0];
      }
    }

    try {
      const result: SemanticValidationResponse = JSON.parse(jsonStr);
      
      // Validar e normalizar os campos
      const validatedResult: SemanticValidationResponse = {
        compatible: Boolean(result.compatible),
        confidence: Math.max(0, Math.min(1, Number(result.confidence) || 0.5)),
        risk_level: ['low', 'medium', 'high'].includes(result.risk_level) 
          ? result.risk_level 
          : 'medium',
        summary: String(result.summary || 'Análise concluída.').slice(0, 200),
        product_keywords: Array.isArray(result.product_keywords) 
          ? result.product_keywords.slice(0, 10) 
          : undefined,
        expected_keywords: Array.isArray(result.expected_keywords) 
          ? result.expected_keywords.slice(0, 10) 
          : undefined,
      };

      return new Response(JSON.stringify(validatedResult), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      return new Response(JSON.stringify({
        compatible: true,
        confidence: 0.5,
        risk_level: "medium",
        summary: "Erro ao processar resposta. Verifique manualmente.",
      } as SemanticValidationResponse), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

  } catch (error) {
    console.error("Validation error:", error);
    return new Response(JSON.stringify({
      compatible: true,
      confidence: 0.5,
      risk_level: "medium",
      summary: "Erro na validação. Verifique manualmente.",
    }), {
      status: 200, // Não bloquear o fluxo por erro
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
