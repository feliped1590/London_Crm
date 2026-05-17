/**
 * Hybrid storage adapter for Supabase Auth.
 *
 * Default policy: tokens live in `sessionStorage` and are wiped when the
 * browser/tab is closed. If the user opts in to "Manter conectado" we
 * mirror tokens into `localStorage` so the session survives browser restarts.
 *
 * The adapter ALWAYS reads from both stores (sessionStorage first), so the
 * Supabase client transparently picks up the right token regardless of the
 * mode the user chose at the last login.
 */

const REMEMBER_FLAG = 'crm_auth_remember_me';

export function getRememberMe(): boolean {
  try {
    return localStorage.getItem(REMEMBER_FLAG) === '1';
  } catch {
    return false;
  }
}

export function setRememberMe(remember: boolean) {
  try {
    if (remember) {
      localStorage.setItem(REMEMBER_FLAG, '1');
    } else {
      localStorage.removeItem(REMEMBER_FLAG);
    }
  } catch {
    /* storage disabled — ignore */
  }
}

function safeGet(store: Storage, key: string): string | null {
  try { return store.getItem(key); } catch { return null; }
}
function safeSet(store: Storage, key: string, value: string) {
  try { store.setItem(key, value); } catch { /* ignore */ }
}
function safeRemove(store: Storage, key: string) {
  try { store.removeItem(key); } catch { /* ignore */ }
}

export const hybridAuthStorage = {
  getItem: (key: string): string | null => {
    // sessionStorage wins (current tab), then fall back to localStorage
    // (only relevant when user opted in to "manter conectado").
    const fromSession = safeGet(sessionStorage, key);
    if (fromSession !== null) return fromSession;
    if (getRememberMe()) {
      const fromLocal = safeGet(localStorage, key);
      if (fromLocal !== null) {
        // Hydrate sessionStorage so subsequent reads are fast and the
        // tab keeps its own copy.
        safeSet(sessionStorage, key, fromLocal);
        return fromLocal;
      }
    }
    return null;
  },

  setItem: (key: string, value: string): void => {
    safeSet(sessionStorage, key, value);
    if (getRememberMe()) {
      safeSet(localStorage, key, value);
    } else {
      // Defensive: clear any stale persistent copy from previous "remember" session.
      safeRemove(localStorage, key);
    }
  },

  removeItem: (key: string): void => {
    safeRemove(sessionStorage, key);
    safeRemove(localStorage, key);
  },
};

/**
 * Wipes every auth/session related entry from BOTH stores.
 * Called on logout, idle timeout, or forced session invalidation.
 */
export function purgeAuthStorage() {
  const patterns = ['sb-', 'supabase.auth', 'app_session_id', REMEMBER_FLAG, 'CRM_QUERY_CACHE'];
  for (const store of [sessionStorage, localStorage]) {
    try {
      const keys: string[] = [];
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        if (k && patterns.some(p => k.includes(p))) keys.push(k);
      }
      keys.forEach(k => safeRemove(store, k));
    } catch {
      /* ignore */
    }
  }
}
