/**
 * Adapter de comunicação com API Iniflex - SANDBOX
 * 
 * Este adapter é EXCLUSIVO para testes e validações.
 * NÃO deve ser usado em produção.
 * 
 * REGRAS:
 * - Usa configurações separadas (INIFLEX_SANDBOX_*)
 * - Loga request e response COMPLETOS para debug
 * - Timeout configurável
 * - Nunca grava dados no banco de produção
 */

export interface SandboxResult {
  success: boolean;
  httpStatus: number | null;
  latencyMs: number;
  request: {
    url: string;
    payload: unknown;
    hasToken: boolean;
    tokenLength: number;
    tokenPreview: string;
  };
  response: {
    raw: unknown;
    text?: string;
  };
  error?: string;
}

/**
 * Envia dados para a API do ERP Iniflex (ambiente sandbox)
 * 
 * @param payload - Dados a serem enviados (a chave será injetada automaticamente)
 * @param timeoutMs - Timeout em milissegundos (default: 15000)
 * @param customUrl - URL customizada (opcional, usa env var se não fornecida)
 * @param customToken - Token customizado (opcional, usa env var se não fornecido)
 * @returns SandboxResult com todos os detalhes para debug
 */
export async function sendToInflexSandbox(
  payload: unknown,
  timeoutMs: number = 15000,
  customUrl?: string,
  customToken?: string
): Promise<SandboxResult> {
  const startTime = Date.now();
  
  // Usar valores customizados ou fallback para env vars
  const SANDBOX_URL = customUrl || Deno.env.get('INIFLEX_SANDBOX_API_URL');
  const SANDBOX_TOKEN = customToken || Deno.env.get('INIFLEX_SANDBOX_API_TOKEN');

  // Validação de credenciais
  if (!SANDBOX_URL || !SANDBOX_TOKEN) {
    console.error('[iniflex-sandbox] Credenciais sandbox não configuradas');
    return {
      success: false,
      httpStatus: null,
      latencyMs: Date.now() - startTime,
      request: {
        url: SANDBOX_URL || 'NOT_CONFIGURED',
        payload,
        hasToken: !!SANDBOX_TOKEN,
        tokenLength: SANDBOX_TOKEN?.length || 0,
        tokenPreview: '',
      },
      response: { raw: null },
      error: 'Credenciais sandbox não configuradas (INIFLEX_SANDBOX_API_URL ou INIFLEX_SANDBOX_API_TOKEN)',
    };
  }

  // Injetar chave no INÍCIO do payload (ordem pode ser importante para a API)
  const payloadObj = payload as Record<string, unknown>;
  const payloadWithKey = {
    chave: SANDBOX_TOKEN, // chave PRIMEIRO
    ...payloadObj,
  };

  // Preview seguro do token para debug (como no adapter de produção)
  const tokenStr = String(SANDBOX_TOKEN || '');
  const tokenPreview = tokenStr.length > 20 
    ? `${tokenStr.substring(0, 10)}...${tokenStr.substring(tokenStr.length - 10)}`
    : '[token muito curto]';

  console.log('[iniflex-sandbox] ========== INICIO DO TESTE ==========');
  console.log('[iniflex-sandbox] URL:', SANDBOX_URL);
  console.log('[iniflex-sandbox] Token - Tamanho:', tokenStr.length, '| Preview:', tokenPreview);
  console.log('[iniflex-sandbox] Payload (sem chave):', JSON.stringify(payloadObj, null, 2));

  // Request com timeout
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    console.log('[iniflex-sandbox] Enviando requisição...');
    
    const response = await fetch(SANDBOX_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // SEM Authorization header - chave vai no body
      },
      body: JSON.stringify(payloadWithKey),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const responseText = await response.text();
    const latencyMs = Date.now() - startTime;

    console.log('[iniflex-sandbox] HTTP Status:', response.status, response.statusText);
    console.log('[iniflex-sandbox] Latência:', latencyMs, 'ms');
    console.log('[iniflex-sandbox] Response Headers:', JSON.stringify(Object.fromEntries(response.headers.entries())));
    console.log('[iniflex-sandbox] Response Body:', responseText);

    // Tentar fazer parse do JSON
    let parsedResponse: unknown;
    try {
      parsedResponse = JSON.parse(responseText);
    } catch {
      parsedResponse = { _parseError: true, rawText: responseText };
      console.log('[iniflex-sandbox] Response não é JSON válido');
    }

    const result: SandboxResult = {
      success: response.ok,
      httpStatus: response.status,
      latencyMs,
      request: {
        url: SANDBOX_URL,
        payload: payloadObj,
        hasToken: true,
        tokenLength: tokenStr.length,
        tokenPreview,
      },
      response: {
        raw: parsedResponse,
        text: responseText,
      },
    };

    if (!response.ok) {
      result.error = `HTTP ${response.status}: ${response.statusText}`;
    }

    console.log('[iniflex-sandbox] ========== FIM DO TESTE ==========');
    return result;

  } catch (error) {
    clearTimeout(timeout);
    const latencyMs = Date.now() - startTime;

    // Tratar timeout
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[iniflex-sandbox] TIMEOUT após', timeoutMs, 'ms');
      return {
        success: false,
        httpStatus: null,
        latencyMs,
        request: {
          url: SANDBOX_URL,
          payload: payloadObj,
          hasToken: true,
          tokenLength: tokenStr.length,
          tokenPreview,
        },
        response: { raw: null },
        error: `Timeout: API não respondeu em ${timeoutMs}ms`,
      };
    }

    // Erro genérico
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[iniflex-sandbox] ERRO:', errorMessage);
    
    return {
      success: false,
      httpStatus: null,
      latencyMs,
      request: {
        url: SANDBOX_URL,
        payload: payloadObj,
        hasToken: true,
        tokenLength: tokenStr.length,
        tokenPreview,
      },
      response: { raw: null },
      error: errorMessage,
    };
  }
}
