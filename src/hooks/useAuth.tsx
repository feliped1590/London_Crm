import { createContext, useContext, useEffect, useState, useCallback, useMemo, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { clearSessionId, getSessionId } from '@/hooks/useSessionGuard';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let initialized = false;
    let cancelled = false;

    const finishInitialization = (currentSession: Session | null) => {
      if (cancelled || initialized) return;
      initialized = true;
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setLoading(false);
    };

    const fallbackTimer = setTimeout(() => {
      finishInitialization(null);
    }, 8000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        // Diagnóstico: registrar eventos de auth para investigar quedas de sessão
        try {
          console.info('[auth]', event, {
            hasSession: !!currentSession,
            userId: currentSession?.user?.id ?? null,
            expiresAt: currentSession?.expires_at ?? null,
            at: new Date().toISOString(),
          });
        } catch (_) {}

        // After first init, auth state changes always update
        if (initialized && !cancelled) {
          setSession(currentSession);
          setUser(currentSession?.user ?? null);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession()
      .then(({ data: { session: currentSession } }) => {
        clearTimeout(fallbackTimer);
        finishInitialization(currentSession);
      })
      .catch((error) => {
        console.warn('Falha ao restaurar sessão:', error);
        clearTimeout(fallbackTimer);
        finishInitialization(null);
      });

    return () => {
      cancelled = true;
      clearTimeout(fallbackTimer);
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
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

  const signOut = useCallback(async () => {
    console.info('[auth] signOut chamado', { at: new Date().toISOString() });
    try {
      const sessionId = getSessionId();
      if (sessionId) {
        try {
          await supabase.rpc('invalidate_own_session', { p_session_id: sessionId });
        } catch (_) {}
      }
      clearSessionId();

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout no logout')), 3000)
      );

      await Promise.race([
        supabase.auth.signOut({ scope: 'local' }),
        timeoutPromise
      ]);
    } catch (error) {
      console.warn('Erro no signOut (continuando com limpeza local):', error);
    } finally {
      setSession(null);
      setUser(null);
      clearSessionId();
      // Não removemos manualmente a chave sb-*-auth-token aqui: o
      // supabase.auth.signOut({ scope: 'local' }) já cuida disso. Limpar
      // manualmente pode derrubar sessões válidas se este caminho for
      // disparado por engano em outros fluxos.
    }
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
