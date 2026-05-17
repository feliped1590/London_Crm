/**
 * Lightweight, network-free user accessor.
 *
 * Background: calling `supabase.auth.getUser()` always issues an HTTP
 * `GET /user` to verify the JWT server-side. When this runs while the
 * AuthProvider is still hydrating (or just after logout/idle), the SDK
 * falls back to the publishable anon key as the Bearer token, and the
 * server responds with `403 bad_jwt: missing sub claim`. Repeated across
 * many hooks this produces the noisy `/user` 403 loop seen in auth logs.
 *
 * For client code that just needs the current user id (e.g. to attach
 * `owner_id`, `uploaded_by`, etc.) we don't need server verification —
 * the session in memory is already validated by `onAuthStateChange`
 * and revalidated by `useSessionGuard` every 60s. Reading from
 * `auth.getSession()` returns the cached session without hitting the
 * network.
 *
 * Use this helper instead of `supabase.auth.getUser()` everywhere the
 * goal is "give me the current user". Reserve `auth.getUser()` for
 * code paths that *must* re-verify the JWT against the server (edge
 * functions or token-sensitive guards).
 */

import type { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export async function getCurrentUser(): Promise<User | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user ?? null;
  } catch {
    return null;
  }
}

export async function getCurrentUserId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.id ?? null;
}
