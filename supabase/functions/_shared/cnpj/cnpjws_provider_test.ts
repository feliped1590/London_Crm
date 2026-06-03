/**
 * Teste de integração do CnpjWsProvider (com fetch mockado).
 *
 * Garante:
 *  - 200 OK + payload válido → ok:true + data normalizada.
 *  - 404 → not_found.
 *  - 429 → rate_limited.
 *  - 5xx → unavailable.
 *  - timeout → timeout.
 *  - payload inesperado (sem estabelecimento) → unavailable.
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { CnpjWsProvider } from './providers/cnpjws.ts';

const originalFetch = globalThis.fetch;

function mockFetch(handler: (url: string) => Response | Promise<Response>) {
  globalThis.fetch = ((input: string | URL | Request) => {
    const url = typeof input === 'string'
      ? input
      : input instanceof URL ? input.toString() : input.url;
    return Promise.resolve(handler(url));
  }) as typeof fetch;
}

function restoreFetch() {
  globalThis.fetch = originalFetch;
}

Deno.test('CnpjWsProvider: 200 OK normaliza corretamente', async () => {
  mockFetch(() =>
    new Response(
      JSON.stringify({
        razao_social: 'EMPRESA OK LTDA',
        capital_social: '10000',
        porte: { descricao: 'ME' },
        simples: { simples: true },
        estabelecimento: {
          tipo: 'Matriz',
          nome_fantasia: 'OK',
          situacao_cadastral: 'Ativa',
          atividade_principal: { id: '1234567', descricao: 'Atividade X' },
          ddd1: '11',
          telefone1: '22223333',
          logradouro: 'RUA OK',
          numero: '10',
          bairro: 'CENTRO',
          cep: '01000000',
          cidade: { nome: 'São Paulo' },
          estado: { sigla: 'SP' },
          inscricoes_estaduais: [
            { inscricao_estadual: '999999999', ativo: true, estado: { sigla: 'SP' } },
          ],
        },
      }),
      { status: 200 },
    )
  );
  try {
    const r = await new CnpjWsProvider().lookup('12345678000199');
    assertEquals(r.ok, true);
    if (r.ok) {
      assertEquals(r.data.razao_social, 'EMPRESA OK LTDA');
      assertEquals(r.data.inscricao_estadual, '999999999');
      assertEquals(r.data.is_matriz, true);
      assertEquals(r.data.regime_tributario, 'simples_nacional');
      assertEquals(r.data.telefone, '1122223333');
    }
  } finally {
    restoreFetch();
  }
});

Deno.test('CnpjWsProvider: 404 → not_found', async () => {
  mockFetch(() => new Response('not found', { status: 404 }));
  try {
    const r = await new CnpjWsProvider().lookup('00000000000000');
    assertEquals(r.ok, false);
    if (!r.ok) assertEquals(r.code, 'not_found');
  } finally {
    restoreFetch();
  }
});

Deno.test('CnpjWsProvider: 429 → rate_limited', async () => {
  mockFetch(() => new Response('too many', { status: 429 }));
  try {
    const r = await new CnpjWsProvider().lookup('12345678000199');
    assertEquals(r.ok, false);
    if (!r.ok) assertEquals(r.code, 'rate_limited');
  } finally {
    restoreFetch();
  }
});

Deno.test('CnpjWsProvider: 500 → unavailable', async () => {
  mockFetch(() => new Response('boom', { status: 500 }));
  try {
    const r = await new CnpjWsProvider().lookup('12345678000199');
    assertEquals(r.ok, false);
    if (!r.ok) assertEquals(r.code, 'unavailable');
  } finally {
    restoreFetch();
  }
});

Deno.test('CnpjWsProvider: payload sem estabelecimento → unavailable', async () => {
  mockFetch(() => new Response(JSON.stringify({ razao_social: 'X' }), { status: 200 }));
  try {
    const r = await new CnpjWsProvider().lookup('12345678000199');
    assertEquals(r.ok, false);
    if (!r.ok) assertEquals(r.code, 'unavailable');
  } finally {
    restoreFetch();
  }
});

Deno.test('CnpjWsProvider: AbortError → timeout', async () => {
  globalThis.fetch = (() => {
    const err = new Error('aborted');
    err.name = 'AbortError';
    return Promise.reject(err);
  }) as typeof fetch;
  try {
    const r = await new CnpjWsProvider().lookup('12345678000199');
    assertEquals(r.ok, false);
    if (!r.ok) assertEquals(r.code, 'timeout');
  } finally {
    restoreFetch();
  }
});
