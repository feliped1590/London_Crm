/**
 * Pre-boot auth bootstrap. MUST be imported before the Supabase client
 * is created (i.e. at the very top of `main.tsx`).
 *
 * Strategy: the Supabase SDK persists tokens in `localStorage` by default.
 * We cannot swap the storage adapter (client.ts is auto-generated), so we
 * enforce session policy here:
 *
 *   1. On every page load, if the user did NOT opt into "Manter conectado",
 *      purge any leftover `sb-*` auth tokens BEFORE the SDK reads them.
 *      → Effect: closing and reopening the browser drops the session.
 *
 *   2. Mark the current tab as "alive" in sessionStorage. If a token exists
 *      in localStorage but no tab marker exists (= browser was fully closed
 *      and reopened) AND remember-me is OFF, purge.
 *
 *   3. On `pagehide`, if remember-me is off, schedule a purge. Browsers
 *      keep sessionStorage per-tab so the marker disappears naturally.
 */

import { getRememberMe, purgeAuthStorage } from '@/lib/auth/storageAdapter';

const TAB_ALIVE_KEY = 'crm_tab_alive';
const SUPABASE_PROJECT_REF = 'lusyhkizwoihixcvcgap';
const TOKEN_KEY = `sb-${SUPABASE_PROJECT_REF}-auth-token`;

function purgeSupabaseTokens() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    // Also drop any other sb-* leftovers (refresh tokens, code verifiers, etc.)
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('sb-') || k.startsWith('supabase.auth'))) keys.push(k);
    }
    keys.forEach(k => localStorage.removeItem(k));
    localStorage.removeItem('app_session_id');
  } catch {
    /* ignore */
  }
}

export function bootstrapAuth() {
  const remember = getRememberMe();
  const tabAlive = sessionStorage.getItem(TAB_ALIVE_KEY) === '1';

  // Cold start (browser fully closed/reopened) → no tab marker.
  // If user did NOT opt into "remember me", drop the persisted token now,
  // before Supabase reads it.
  if (!tabAlive && !remember) {
    purgeSupabaseTokens();
  }

  // Mark this tab as alive for its entire lifetime.
  try { sessionStorage.setItem(TAB_ALIVE_KEY, '1'); } catch { /* ignore */ }

  // On tab/window close: if not remembering, schedule a purge so a fresh
  // tab opened from the same browser later won't reuse the token. We use
  // both `pagehide` (more reliable than `beforeunload`) and `visibilitychange`.
  const onLeave = () => {
    if (!getRememberMe()) {
      purgeSupabaseTokens();
    }
  };
  window.addEventListener('pagehide', onLeave);
}

export { purgeAuthStorage, purgeSupabaseTokens };
