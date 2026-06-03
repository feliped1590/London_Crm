/**
 * CnpjWsProvider — consome https://publica.cnpj.ws/cnpj/{cnpj}.
 *
 * Fase 1: stub. A implementação efetiva entra na Fase 2.
 * Atualmente devolve `unavailable` para que o orquestrador faça fallback
 * para o BrasilApiProvider — comportamento idêntico ao histórico.
 */

import type { ICnpjProvider, RawProviderResult } from '../types.ts';

export class CnpjWsProvider implements ICnpjProvider {
  readonly name = 'cnpjws' as const;

  // deno-lint-ignore require-await
  async lookup(_cnpjDigits: string): Promise<RawProviderResult> {
    return {
      ok: false,
      code: 'unavailable',
      message: 'CnpjWsProvider ainda não implementado (Fase 2)',
    };
  }
}
