/**
 * CnpjWsProvider — consome https://publica.cnpj.ws/cnpj/{cnpj}.
 *
 * Tier público: 3 req/min por IP (sem autenticação). Não há rate limiter
 * persistido — em 429/5xx o orquestrador faz fallback para BrasilAPI.
 *
 * Token opcional via env CNPJ_WS_TOKEN (plano pago). Quando presente,
 * a request usa o endpoint comercial com header Authorization.
 */

import type { ICnpjProvider, RawProviderResult } from '../types.ts';
import { fromCnpjWs, type CnpjWsRawResponse } from '../normalizer.ts';

const TIMEOUT_MS = 10_000;
const PUBLIC_URL = 'https://publica.cnpj.ws/cnpj';
const COMMERCIAL_URL = 'https://comercial.cnpj.ws/cnpj';

export class CnpjWsProvider implements ICnpjProvider {
  readonly name = 'cnpjws' as const;

  async lookup(cnpjDigits: string): Promise<RawProviderResult> {
    const token = Deno.env.get('CNPJ_WS_TOKEN')?.trim();
    const baseUrl = token ? COMMERCIAL_URL : PUBLIC_URL;
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${baseUrl}/${cnpjDigits}`, {
        signal: controller.signal,
        headers,
      });
      clearTimeout(timeout);

      if (res.status === 404) {
        await res.text().catch(() => {});
        return { ok: false, code: 'not_found', message: 'CNPJ não encontrado na CNPJ.ws' };
      }
      if (res.status === 429) {
        await res.text().catch(() => {});
        return {
          ok: false,
          code: 'rate_limited',
          message: 'Rate limit da CNPJ.ws (3 req/min no tier público)',
        };
      }
      if (!res.ok) {
        await res.text().catch(() => {});
        return {
          ok: false,
          code: 'unavailable',
          message: `CNPJ.ws retornou ${res.status}`,
        };
      }

      const raw = (await res.json()) as CnpjWsRawResponse;
      if (!raw || typeof raw !== 'object' || !raw.estabelecimento) {
        return {
          ok: false,
          code: 'unavailable',
          message: 'CNPJ.ws retornou payload inesperado',
        };
      }

      return { ok: true, data: fromCnpjWs(raw) };
    } catch (err) {
      clearTimeout(timeout);
      if ((err as Error).name === 'AbortError') {
        return { ok: false, code: 'timeout', message: 'Timeout na CNPJ.ws' };
      }
      return { ok: false, code: 'unavailable', message: (err as Error).message };
    }
  }
}
