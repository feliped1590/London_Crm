/**
 * BrasilApiProvider — consome https://brasilapi.com.br/api/cnpj/v1/{cnpj}.
 * Mantém o comportamento histórico do projeto.
 */

import type { ICnpjProvider, RawProviderResult } from '../types.ts';
import { fromBrasilApi, type BrasilApiRawResponse } from '../normalizer.ts';

const TIMEOUT_MS = 10_000;

export class BrasilApiProvider implements ICnpjProvider {
  readonly name = 'brasilapi' as const;

  async lookup(cnpjDigits: string): Promise<RawProviderResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(
        `https://brasilapi.com.br/api/cnpj/v1/${cnpjDigits}`,
        { signal: controller.signal },
      );
      clearTimeout(timeout);

      if (res.status === 404) {
        return { ok: false, code: 'not_found', message: 'CNPJ não encontrado na BrasilAPI' };
      }
      if (res.status === 429) {
        return { ok: false, code: 'rate_limited', message: 'Rate limit da BrasilAPI' };
      }
      if (!res.ok) {
        return { ok: false, code: 'unavailable', message: `BrasilAPI retornou ${res.status}` };
      }

      const raw = (await res.json()) as BrasilApiRawResponse;
      return { ok: true, data: fromBrasilApi(raw) };
    } catch (err) {
      clearTimeout(timeout);
      if ((err as Error).name === 'AbortError') {
        return { ok: false, code: 'timeout', message: 'Timeout na BrasilAPI' };
      }
      return { ok: false, code: 'unavailable', message: (err as Error).message };
    }
  }
}
