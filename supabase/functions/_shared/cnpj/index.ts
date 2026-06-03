/**
 * Orquestrador único de consulta de CNPJ.
 *
 * - Cache-first (public.cnpj_lookup_cache).
 * - Provider primário configurável por chamada (brasilapi | cnpjws).
 * - Fallback automático para o outro provider quando habilitado.
 * - Logs estruturados: cnpj, provider, elapsedMs, fallback.
 *
 * Contrato devolvido (NormalizedCnpjResult) é compatível com o histórico do
 * lookup-cnpj — frontend não precisa mudar.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import type {
  ICnpjProvider,
  LookupOptions,
  LookupResponse,
  LookupErrorResponse,
  ProviderName,
} from './types.ts';
import { BrasilApiProvider } from './providers/brasilapi.ts';
import { CnpjWsProvider } from './providers/cnpjws.ts';
import { readCache, writeCache } from './cache.ts';

export * from './types.ts';

function getProviderInstance(name: ProviderName): ICnpjProvider {
  return name === 'cnpjws' ? new CnpjWsProvider() : new BrasilApiProvider();
}

function otherProvider(name: ProviderName): ProviderName {
  return name === 'cnpjws' ? 'brasilapi' : 'cnpjws';
}

function normalizeDigits(cnpj: string): string {
  const digits = String(cnpj ?? '').replace(/\D/g, '');
  return digits.length > 0 && digits.length < 14 ? digits.padStart(14, '0') : digits;
}

let _admin: ReturnType<typeof createClient> | null = null;
function adminClient() {
  if (_admin) return _admin;
  _admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  return _admin;
}

export async function lookupCnpj(
  cnpj: string,
  options: LookupOptions = {},
): Promise<LookupResponse | LookupErrorResponse> {
  const startedAt = Date.now();
  const cnpjDigits = normalizeDigits(cnpj);
  const primary: ProviderName = options.provider ?? 'brasilapi';
  const allowFallback = options.allowFallback !== false;
  const forceRefresh = options.forceRefresh === true;

  if (cnpjDigits.length !== 14) {
    const elapsedMs = Date.now() - startedAt;
    console.warn(
      `[cnpj-lookup] invalid cnpj="${cnpjDigits}" primary=${primary} elapsedMs=${elapsedMs}`,
    );
    return {
      ok: false,
      code: 'invalid',
      message: 'CNPJ deve ter 14 dígitos',
      primaryProvider: primary,
      fallbackUsed: false,
      elapsedMs,
    };
  }

  const admin = adminClient();

  // ─── 1. Cache ──────────────────────────────────────────────
  if (!forceRefresh) {
    const cached = await readCache(admin, cnpjDigits);
    if (cached) {
      const elapsedMs = Date.now() - startedAt;
      console.log(
        `[cnpj-lookup] cnpj=${cnpjDigits} provider=cache origin=${cached.source} ` +
        `fallback=false elapsedMs=${elapsedMs}`,
      );
      return {
        ok: true,
        data: cached.payload,
        source: 'cache',
        primaryProvider: primary,
        fallbackUsed: false,
        elapsedMs,
      };
    }
  }

  // ─── 2. Provider primário ──────────────────────────────────
  let provider = getProviderInstance(primary);
  let result = await provider.lookup(cnpjDigits);
  let providerUsed: ProviderName = primary;
  let fallbackUsed = false;

  // ─── 3. Fallback (não acionado em 'not_found' nem 'invalid') ─
  const shouldFallback = !result.ok
    && allowFallback
    && result.code !== 'not_found'
    && result.code !== 'invalid';

  if (shouldFallback) {
    const fallbackName = otherProvider(primary);
    console.warn(
      `[cnpj-lookup] cnpj=${cnpjDigits} primary=${primary} failed code=${result.code} ` +
      `msg="${result.message}" → fallback=${fallbackName}`,
    );
    provider = getProviderInstance(fallbackName);
    result = await provider.lookup(cnpjDigits);
    providerUsed = fallbackName;
    fallbackUsed = true;
  }

  const elapsedMs = Date.now() - startedAt;

  if (!result.ok) {
    console.warn(
      `[cnpj-lookup] cnpj=${cnpjDigits} provider=${providerUsed} fallback=${fallbackUsed} ` +
      `code=${result.code} elapsedMs=${elapsedMs} msg="${result.message}"`,
    );
    return {
      ok: false,
      code: result.code,
      message: result.message,
      primaryProvider: primary,
      fallbackUsed,
      elapsedMs,
    };
  }

  // ─── 4. Persistir no cache ─────────────────────────────────
  await writeCache(admin, cnpjDigits, result.data, providerUsed);

  console.log(
    `[cnpj-lookup] cnpj=${cnpjDigits} provider=${providerUsed} fallback=${fallbackUsed} ` +
    `elapsedMs=${elapsedMs}`,
  );

  return {
    ok: true,
    data: result.data,
    source: providerUsed,
    primaryProvider: primary,
    fallbackUsed,
    elapsedMs,
  };
}
