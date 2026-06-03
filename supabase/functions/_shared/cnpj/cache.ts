/**
 * Cache persistente de consultas de CNPJ.
 * Backed by public.cnpj_lookup_cache (acesso via service_role).
 */

import type { NormalizedCnpjResult, ProviderName } from './types.ts';

type SupabaseAdmin = {
  from: (table: string) => any;
};

const DEFAULT_TTL_DAYS = 30;

function ttlDays(): number {
  const raw = Deno.env.get('CNPJ_CACHE_TTL_DAYS');
  const n = raw ? Number(raw) : DEFAULT_TTL_DAYS;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TTL_DAYS;
}

export interface CacheHit {
  payload: NormalizedCnpjResult;
  source: ProviderName;
  fetched_at: string;
}

export async function readCache(
  supabaseAdmin: SupabaseAdmin,
  cnpj: string,
): Promise<CacheHit | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('cnpj_lookup_cache')
      .select('payload, source, fetched_at, expires_at')
      .eq('cnpj', cnpj)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (error || !data) return null;

    // Fire-and-forget: atualiza contador de hits.
    supabaseAdmin
      .from('cnpj_lookup_cache')
      .update({
        hit_count: (data as any).hit_count ? (data as any).hit_count + 1 : 1,
        last_hit_at: new Date().toISOString(),
      })
      .eq('cnpj', cnpj)
      .then(() => {})
      .catch(() => {});

    return {
      payload: data.payload as NormalizedCnpjResult,
      source: data.source as ProviderName,
      fetched_at: data.fetched_at as string,
    };
  } catch {
    return null;
  }
}

export async function writeCache(
  supabaseAdmin: SupabaseAdmin,
  cnpj: string,
  payload: NormalizedCnpjResult,
  source: ProviderName,
): Promise<void> {
  const days = ttlDays();
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  try {
    await supabaseAdmin
      .from('cnpj_lookup_cache')
      .upsert(
        {
          cnpj,
          payload,
          source,
          fetched_at: new Date().toISOString(),
          expires_at: expires,
          hit_count: 0,
          last_hit_at: null,
        },
        { onConflict: 'cnpj' },
      );
  } catch (err) {
    console.warn(`[cnpj-cache] write error for ${cnpj}: ${(err as Error).message}`);
  }
}
