/**
 * lookup-cnpj — endpoint público de consulta de CNPJ para o cadastro.
 *
 * Fase 1: refatorado para usar o orquestrador `_shared/cnpj`.
 * - Provider primário: BrasilAPI (mantém comportamento histórico).
 * - Cache de 30 dias em `cnpj_lookup_cache`.
 * - Logs: cnpj, provider, fallback, elapsedMs (gerados no orquestrador).
 *
 * Contrato de resposta MANTIDO 100% compatível com o frontend atual.
 */

import { lookupCnpj } from '../_shared/cnpj/index.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface LookupRequest {
  cnpj: string;
  force_refresh?: boolean;
}

// Validação de DV (mantida para responder 400 antes de bater no orquestrador).
function isValidCNPJ(cnpj: string): boolean {
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(cnpj[i]) * weights1[i];
  let remainder = sum % 11;
  const digit1 = remainder < 2 ? 0 : 11 - remainder;
  if (digit1 !== parseInt(cnpj[12])) return false;

  sum = 0;
  for (let i = 0; i < 13; i++) sum += parseInt(cnpj[i]) * weights2[i];
  remainder = sum % 11;
  const digit2 = remainder < 2 ? 0 : 11 - remainder;
  return digit2 === parseInt(cnpj[13]);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as LookupRequest;
    const cnpjClean = body?.cnpj?.replace(/\D/g, '') || '';
    const forceRefresh = body?.force_refresh === true;

    if (!cnpjClean) {
      return new Response(
        JSON.stringify({ success: false, error: 'CNPJ é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (cnpjClean.length !== 14) {
      return new Response(
        JSON.stringify({ success: false, error: 'CNPJ deve ter 14 dígitos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!isValidCNPJ(cnpjClean)) {
      return new Response(
        JSON.stringify({ success: false, error: 'CNPJ inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Fase 1: BrasilAPI como provider primário, com cache + logs.
    const result = await lookupCnpj(cnpjClean, {
      provider: 'brasilapi',
      allowFallback: true,
      forceRefresh,
    });

    if (!result.ok) {
      if (result.code === 'not_found') {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'CNPJ não encontrado na base da Receita Federal',
            code: 'CNPJ_NOT_FOUND',
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      if (result.code === 'timeout') {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Consulta demorou muito. Preencha manualmente ou tente novamente.',
            code: 'CNPJ_LOOKUP_TIMEOUT',
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Serviço de consulta temporariamente indisponível',
          code: 'CNPJ_SERVICE_UNAVAILABLE',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Shape MANTIDO compatível com o frontend (CustomerNew.tsx → response.data.data.{...}).
    return new Response(
      JSON.stringify({
        success: true,
        data: result.data,
        source: result.source,
        fallback_used: result.fallbackUsed,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('[lookup-cnpj] Erro:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro ao consultar CNPJ' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
