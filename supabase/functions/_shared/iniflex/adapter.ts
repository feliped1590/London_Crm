/**
 * Adapter de comunicação com API Iniflex
 * Fundação v1 - Ponto único de comunicação HTTP
 */

import { SyncResult } from './types.ts';

/**
 * Envia dados para a API do ERP Iniflex
 * @param payload - Dados formatados para o ERP
 * @returns Resultado da sincronização
 */
export async function sendToIniflex(payload: unknown): Promise<SyncResult> {
  const INIFLEX_URL = Deno.env.get('INIFLEX_API_URL');
  const INIFLEX_TOKEN = Deno.env.get('INIFLEX_API_TOKEN');

  if (!INIFLEX_URL || !INIFLEX_TOKEN) {
    console.error('[iniflex-adapter] Credenciais não configuradas');
    return {
      success: false,
      externalId: null,
      rawResponse: null,
      error: 'Credenciais do ERP não configuradas (INIFLEX_API_URL ou INIFLEX_API_TOKEN)',
    };
  }

  try {
    console.log('[iniflex-adapter] Enviando para Iniflex:', JSON.stringify(payload, null, 2).substring(0, 500));

    const response = await fetch(INIFLEX_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${INIFLEX_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    console.log('[iniflex-adapter] Resposta Iniflex (status:', response.status, '):', responseText.substring(0, 500));

    let data: unknown;
    try {
      data = JSON.parse(responseText);
    } catch {
      data = { raw: responseText };
    }

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

    // Extrair ID retornado pelo ERP (pode vir em diferentes campos)
    let externalId: string | null = null;
    if (typeof data === 'object' && data !== null) {
      const dataObj = data as Record<string, unknown>;
      externalId = String(dataObj.id || dataObj.codigo || dataObj.p_retorno || '') || null;
    }

    return {
      success: true,
      externalId,
      rawResponse: data,
    };
  } catch (error) {
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
