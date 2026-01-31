/**
 * Adapter de comunicação com API Iniflex
 * Fundação v1 - Ponto único de comunicação HTTP
 * 
 * REGRAS DE AUTENTICAÇÃO:
 * - A API Novafix/Iniflex NÃO usa Authorization Header
 * - O token é enviado SEMPRE no body como campo "chave"
 * - Este adapter injeta automaticamente a chave
 */

import { SyncResult } from './types.ts';

/**
 * Envia dados para a API do ERP Iniflex
 * 
 * IMPORTANTE: Este adapter SEMPRE retorna um SyncResult completo:
 * - success: boolean
 * - externalId: string | null
 * - rawResponse: unknown
 * - error?: string (presente quando success = false)
 * 
 * Cenários tratados:
 * - Credenciais não configuradas
 * - Timeout (10 segundos)
 * - Erro HTTP (4xx, 5xx)
 * - Erro de parse JSON
 * - Exceção inesperada
 * 
 * @param payload - Dados funcionais (SEM chave - será injetada automaticamente)
 * @returns SyncResult padronizado
 */
export async function sendToIniflex(payload: unknown): Promise<SyncResult> {
  const INIFLEX_URL = Deno.env.get('INIFLEX_API_URL');
  const INIFLEX_TOKEN = Deno.env.get('INIFLEX_API_TOKEN');

  // Validação de credenciais
  if (!INIFLEX_URL || !INIFLEX_TOKEN) {
    console.error('[iniflex-adapter] Credenciais não configuradas');
    return {
      success: false,
      externalId: null,
      rawResponse: null,
      error: 'Credenciais do ERP não configuradas (INIFLEX_API_URL ou INIFLEX_API_TOKEN)',
    };
  }

  // Injetar chave no INÍCIO do payload (ordem pode ser importante para a API)
  const payloadObj = payload as Record<string, unknown>;
  const payloadWithKey = {
    chave: payloadObj?.chave ?? INIFLEX_TOKEN, // chave PRIMEIRO
    ...payloadObj,
  };
  // Remover chave duplicada se existia no payload original
  if ('chave' in payloadObj) {
    delete (payloadWithKey as Record<string, unknown>)['chave'];
    (payloadWithKey as Record<string, unknown>)['chave'] = INIFLEX_TOKEN;
  }

  // Log seguro: excluir chave sensível
  const { chave: _chave, ...safePayload } = payloadWithKey;
  console.log('[iniflex-adapter] Enviando para Iniflex:', JSON.stringify(safePayload, null, 2).substring(0, 500));
  // Debug: mostrar primeiros e últimos caracteres do token para validação
  const tokenStr = String(_chave || '');
  const tokenPreview = tokenStr.length > 20 
    ? `${tokenStr.substring(0, 10)}...${tokenStr.substring(tokenStr.length - 10)}`
    : tokenStr;
  console.log('[iniflex-adapter] Chave presente:', !!_chave, '| Tamanho:', tokenStr.length, '| Preview:', tokenPreview);

  // Request com timeout de 10 segundos
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(INIFLEX_URL, {
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
