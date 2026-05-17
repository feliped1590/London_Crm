import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { clearSessionId, getSessionId } from '@/hooks/useSessionGuard';
import { purgeAuthStorage } from '@/lib/auth/storageAdapter';
import { publishAuthEvent, subscribeAuthEvents } from '@/lib/auth/broadcast';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null; user: User | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: (opts?: { broadcast?: boolean; scope?: 'global' | 'local' }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  // Centralized auth state lifecycle.
  // Order matters: subscribe FIRST, then call getSession(), so the very
  // first INITIAL_SESSION event (emitted synchronously by Supabase v2)
  // is captured and we never miss a transition.
  useEffect(() => {
    mountedRef.current = true;

    const apply = (nextSession: Session | null) => {
      if (!mountedRef.current) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        // NEVER await async work here — it can deadlock the auth callback
        // and starve subsequent events.
        apply(nextSession);
      }
    );

    supabase.auth.getSession()
      .then(({ data }) => apply(data.session))
      .catch((err) => {
        console.warn('Falha ao restaurar sessão:', err);
        apply(null);
      });

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null, user: data?.user ?? null };
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { full_name: fullName },
      },
    });
    return { error: error as Error | null };
  }, []);

  const signOut = useCallback(async (opts?: { broadcast?: boolean; scope?: 'global' | 'local' }) => {
    const scope = opts?.scope ?? 'global';
    const shouldBroadcast = opts?.broadcast ?? true;

    // 1) Invalidate our app-level session record (best effort).
    try {
      const sid = getSessionId();
      if (sid) {
        await supabase.rpc('invalidate_own_session', { p_session_id: sid });
      }
    } catch (e) {
      console.warn('invalidate_own_session falhou (segue logout):', e);
    }
    clearSessionId();

    // 2) Revoke the refresh token server-side (scope: 'global' kills all
    //    refresh tokens for this user). Wrap in a timeout so network
    //    issues don't block the local cleanup.
    try {
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('signOut timeout')), 3000)
      );
      await Promise.race([supabase.auth.signOut({ scope }), timeout]);
    } catch (err) {
      console.warn('supabase.auth.signOut falhou (limpando localmente):', err);
    }

    // 3) Local cleanup — clears sessionStorage + localStorage of all
    //    sb-*/app_session_id keys, regardless of "remember me".
    if (mountedRef.current) {
      setSession(null);
      setUser(null);
    }
    purgeAuthStorage();

    // 4) Notify other tabs so they also drop their UI state.
    if (shouldBroadcast) {
      publishAuthEvent({ type: 'logout', reason: 'manual' });
    }
  }, []);

  // Cross-tab logout listener: if another tab logs out, this tab also
  // clears local state immediately (route guards then redirect to /auth).
  useEffect(() => {
    const unsub = subscribeAuthEvents((evt) => {
      if (evt.type === 'logout') {
        purgeAuthStorage();
        if (mountedRef.current) {
          setSession(null);
          setUser(null);
        }
      }
    });
    return unsub;
  }, []);

  const value = useMemo(() => ({
    user, session, loading, signIn, signUp, signOut
  }), [user, session, loading, signIn, signUp, signOut]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
