/**
 * Adapter de comunicação com API Iniflex
 * 
 * ARQUITETURA SEM VARIÁVEIS DE AMBIENTE:
 * - URL e Token são SEMPRE recebidos explicitamente via parâmetro
 * - Não existe fallback para Deno.env.get()
 * - Falha explícita se credenciais não forem fornecidas
 * 
 * REGRAS DE AUTENTICAÇÃO:
 * - A API Novafix/Iniflex NÃO usa Authorization Header
 * - O token é enviado SEMPRE no body como campo "chave"
 * - Este adapter injeta automaticamente a chave
 */

import { SyncResult } from './types.ts';

/**
 * Configuração de credenciais para a API Iniflex
 */
export interface InflexConfig {
  baseUrl: string;
  token: string;
}

/**
 * Envia dados para a API do ERP Iniflex
 * 
 * IMPORTANTE: Este adapter SEMPRE retorna um SyncResult completo:
 * - success: boolean
 * - externalId: string | null
 * - rawResponse: unknown
 * - error?: string (presente quando success = false)
 * 
 * @param payload - Dados funcionais (SEM chave - será injetada automaticamente)
 * @param config - Credenciais obrigatórias (baseUrl e token)
 * @returns SyncResult padronizado
 */
export async function sendToIniflex(
  payload: unknown,
  config: InflexConfig
): Promise<SyncResult> {
  
  // VALIDAÇÃO OBRIGATÓRIA - SEM FALLBACK
  if (!config?.baseUrl?.trim() || !config?.token?.trim()) {
    console.error('[iniflex-adapter] Credenciais não fornecidas');
    return {
      success: false,
      externalId: null,
      rawResponse: null,
      error: 'baseUrl e token são obrigatórios. Configure os campos na interface.',
    };
  }

  // SANITIZAÇÃO DEFENSIVA DA URL (remove barras finais)
  const baseUrl = config.baseUrl.replace(/\/+$/, '');
  const token = config.token.trim();

  // LOG MÍNIMO PADRONIZADO (nunca logar token completo)
  const payloadObj = payload as Record<string, unknown>;
  console.log('[iniflex-adapter] URL:', baseUrl);
  console.log('[iniflex-adapter] tokenLength:', token.length);
  console.log('[iniflex-adapter] payload.grupoComando:', payloadObj?.grupoComando);

  // Injetar chave no INÍCIO do payload (ordem pode ser importante para a API)
  const payloadWithKey = {
    chave: token, // chave PRIMEIRO
    ...payloadObj,
  };

  // Log seguro: excluir chave sensível
  const { chave: _chave, ...safePayload } = payloadWithKey;
  console.log('[iniflex-adapter] Enviando para Iniflex:', JSON.stringify(safePayload, null, 2).substring(0, 500));
  
  // Preview seguro do token para validação
  const tokenPreview = token.length > 20 
    ? `${token.substring(0, 10)}...${token.substring(token.length - 10)}`
    : '[token curto]';
  console.log('[iniflex-adapter] Token preview:', tokenPreview);

  // Request com timeout de 10 segundos
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // SEM Authorization header - chave vai no body
      },
      body: JSON.stringify(payloadWithKey),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    // Sempre consumir o body da resposta
    const responseText = await response.text();
    console.log('[iniflex-adapter] Resposta Iniflex (status:', response.status, '):', responseText.substring(0, 500));

    // Tentar fazer parse do JSON
    let data: unknown;
    try {
      data = JSON.parse(responseText);
    } catch {
      // Erro de parse JSON
      console.error('[iniflex-adapter] Erro ao parsear resposta JSON');
      return {
        success: false,
        externalId: null,
        rawResponse: { raw: responseText },
        error: `Resposta inválida do ERP (não é JSON válido)`,
      };
    }

    // Verificar status HTTP
    if (!response.ok) {
      const errorMessage = typeof data === 'object' && data !== null && 'message' in data
        ? String((data as { message: unknown }).message)
        : `HTTP ${response.status}: ${response.statusText}`;

      return {
        success: false,
        externalId: null,
        rawResponse: data,
        error: errorMessage,
      };
    }

    // Sucesso - Extrair ID retornado pelo ERP (pode vir em diferentes campos)
    let externalId: string | null = null;
    if (typeof data === 'object' && data !== null) {
      const dataObj = data as Record<string, unknown>;
      const extractedId = dataObj.id || dataObj.codigo || dataObj.p_retorno;
      externalId = extractedId ? String(extractedId) : null;
    }

    return {
      success: true,
      externalId,
      rawResponse: data,
    };

  } catch (error) {
    clearTimeout(timeout);

    // Tratar timeout especificamente
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[iniflex-adapter] Timeout na requisição (10s)');
      return {
        success: false,
        externalId: null,
        rawResponse: null,
        error: 'Timeout: ERP não respondeu em 10 segundos',
      };
    }

    // Exceção inesperada
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[iniflex-adapter] Erro na requisição:', errorMessage);

    return {
      success: false,
      externalId: null,
      rawResponse: null,
      error: errorMessage,
    };
  }
}
