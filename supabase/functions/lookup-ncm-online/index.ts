import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { search_term } = await req.json();
    
    if (!search_term || search_term.length < 2) {
      return new Response(JSON.stringify({ success: false, error: 'search_term must have at least 2 characters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // First try local database
    const isNumeric = /^\d+$/.test(search_term);
    let query = supabase.from('ncm_codes').select('*');
    
    if (isNumeric) {
      query = query.ilike('codigo', `${search_term}%`);
    } else {
      query = query.ilike('descricao', `%${search_term}%`);
    }
    
    const { data: localResults } = await query.limit(20);
    
    if (localResults && localResults.length > 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        source: 'local', 
        data: localResults 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fallback: search BrasilAPI for specific code
    if (isNumeric && search_term.length >= 4) {
      try {
        const apiResponse = await fetch(`https://brasilapi.com.br/api/ncm/v1?search=${encodeURIComponent(search_term)}`, {
          headers: { 'Accept': 'application/json' },
        });

        if (apiResponse.ok) {
          const apiData = await apiResponse.json();
          const validResults = apiData
            .filter((ncm: any) => ncm.codigo && ncm.codigo.length === 8)
            .slice(0, 20);

          if (validResults.length > 0) {
            // Save to local database for future use
            const toInsert = validResults.map((ncm: any) => ({
              codigo: ncm.codigo,
              descricao: ncm.descricao || 'Sem descrição',
              status: ncm.data_fim ? 'inativo' : 'ativo',
              data_vigencia: ncm.data_inicio || '2022-01-01',
              data_fim_vigencia: ncm.data_fim || null,
            }));

            await supabase.from('ncm_codes').upsert(toInsert, { 
              onConflict: 'codigo', 
              ignoreDuplicates: true 
            });

            return new Response(JSON.stringify({ 
              success: true, 
              source: 'online', 
              data: toInsert 
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }
      } catch (apiError) {
        console.error('BrasilAPI fallback error:', apiError);
      }
    }

    // Final fallback: use Lovable AI to suggest NCM codes
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (LOVABLE_API_KEY) {
      try {
        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash-lite',
            messages: [
              {
                role: 'system',
                content: `Você é um especialista em classificação fiscal NCM (Nomenclatura Comum do Mercosul) do Brasil.
Retorne APENAS um JSON array com NCMs relevantes para a busca.
Cada item deve ter: codigo (8 dígitos), descricao (oficial da TIPI).
Retorne no máximo 10 resultados. Se não encontrar, retorne array vazio [].
Não inclua explicações, apenas o JSON array.`
              },
              {
                role: 'user',
                content: `Buscar NCMs para: "${search_term}"`
              }
            ],
            tools: [{
              type: 'function',
              function: {
                name: 'return_ncm_results',
                description: 'Return NCM search results',
                parameters: {
                  type: 'object',
                  properties: {
                    results: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          codigo: { type: 'string', description: '8-digit NCM code' },
                          descricao: { type: 'string', description: 'Official TIPI description' }
                        },
                        required: ['codigo', 'descricao']
                      }
                    }
                  },
                  required: ['results']
                }
              }
            }],
            tool_choice: { type: 'function', function: { name: 'return_ncm_results' } }
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
          
          if (toolCall?.function?.arguments) {
            const parsed = JSON.parse(toolCall.function.arguments);
            const aiResults = (parsed.results || [])
              .filter((r: any) => r.codigo && /^\d{8}$/.test(r.codigo) && r.descricao);

            if (aiResults.length > 0) {
              // Save AI-suggested NCMs to local database
              const toInsert = aiResults.map((ncm: any) => ({
                codigo: ncm.codigo,
                descricao: ncm.descricao,
                status: 'ativo',
                data_vigencia: '2022-01-01',
              }));

              await supabase.from('ncm_codes').upsert(toInsert, { 
                onConflict: 'codigo', 
                ignoreDuplicates: true 
              });

              return new Response(JSON.stringify({ 
                success: true, 
                source: 'ai', 
                data: toInsert 
              }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              });
            }
          }
        } else if (aiResponse.status === 429 || aiResponse.status === 402) {
          console.warn('AI rate limited or payment required');
        }
      } catch (aiError) {
        console.error('AI fallback error:', aiError);
      }
    }

    // Nothing found anywhere
    return new Response(JSON.stringify({ 
      success: true, 
      source: 'none', 
      data: [] 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Lookup error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
