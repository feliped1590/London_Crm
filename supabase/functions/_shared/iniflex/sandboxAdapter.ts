/**
 * Adapter de comunicação com API Iniflex - SANDBOX
 * 
 * ARQUITETURA SEM VARIÁVEIS DE AMBIENTE:
 * - URL e Token são SEMPRE recebidos explicitamente via parâmetro
 * - Não existe fallback para Deno.env.get()
 * - Falha explícita se credenciais não forem fornecidas
 * 
 * Este adapter é EXCLUSIVO para testes e validações.
 * NÃO deve ser usado em produção.
 */

export interface SandboxConfig {
  baseUrl: string;
  token: string;
}

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
 * @param config - Credenciais OBRIGATÓRIAS (baseUrl e token)
 * @param timeoutMs - Timeout em milissegundos (default: 15000)
 * @returns SandboxResult com todos os detalhes para debug
 */
export async function sendToInflexSandbox(
  payload: unknown,
  config: SandboxConfig,
  timeoutMs: number = 15000
): Promise<SandboxResult> {
  const startTime = Date.now();
  const payloadObj = payload as Record<string, unknown>;
  
  // VALIDAÇÃO ESTRITA - SEM FALLBACK PARA ENV VARS
  if (!config?.baseUrl?.trim() || !config?.token?.trim()) {
    console.error('[iniflex-sandbox] Credenciais não fornecidas');
    return {
      success: false,
      httpStatus: null,
      latencyMs: Date.now() - startTime,
      request: {
        url: config?.baseUrl || 'NOT_PROVIDED',
        payload: payloadObj,
        hasToken: !!config?.token,
        tokenLength: config?.token?.length || 0,
        tokenPreview: '',
      },
      response: { raw: null },
      error: 'URL e Token são obrigatórios. Preencha os campos na interface.',
    };
  }

  // SANITIZAÇÃO DEFENSIVA DA URL (remove barras finais)
  const baseUrl = config.baseUrl.replace(/\/+$/, '');
  const token = config.token.trim();

  // LOG MÍNIMO PADRONIZADO
  console.log('[iniflex-sandbox] URL:', baseUrl);
  console.log('[iniflex-sandbox] tokenLength:', token.length);
  console.log('[iniflex-sandbox] payload.grupoComando:', payloadObj?.grupoComando);

  // Preview seguro do token para debug
  const tokenPreview = token.length > 20 
    ? `${token.substring(0, 10)}...${token.substring(token.length - 10)}`
    : '[token muito curto]';

  console.log('[iniflex-sandbox] ========== INICIO DO TESTE ==========');
  console.log('[iniflex-sandbox] Token preview:', tokenPreview);
  console.log('[iniflex-sandbox] Payload (sem chave):', JSON.stringify(payloadObj, null, 2));

  // Request com timeout
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    console.log('[iniflex-sandbox] Enviando requisição...');
    
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        // TESTE DEFINITIVO: Iniflex usa token CRU sem prefixo
        'Authorization': token,
      },
      body: JSON.stringify(payloadObj),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const responseText = await response.text();
    const latencyMs = Date.now() - startTime;

    console.log('[iniflex-sandbox] HTTP Status:', response.status, response.statusText);
    console.log('[iniflex-sandbox] Latência:', latencyMs, 'ms');
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
        url: baseUrl,
        payload: payloadObj,
        hasToken: true,
        tokenLength: token.length,
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
          url: baseUrl,
          payload: payloadObj,
          hasToken: true,
          tokenLength: token.length,
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
        url: baseUrl,
        payload: payloadObj,
        hasToken: true,
        tokenLength: token.length,
        tokenPreview,
      },
      response: { raw: null },
      error: errorMessage,
    };
  }
}
