import { useState, useEffect, useRef, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getSessionId } from '@/hooks/useSessionGuard';
import { Loader2, RefreshCw, AlertTriangle } from 'lucide-react';

const INIT_TIMEOUT_MS = 10_000;

type InitPhase =
  | 'waiting_auth'
  | 'validating_session'
  | 'loading_permissions'
  | 'ready'
  | 'error'
  | 'timeout';

const phaseLabels: Record<InitPhase, string> = {
  waiting_auth: 'Restaurando sessão...',
  validating_session: 'Validando sessão...',
  loading_permissions: 'Carregando permissões...',
  ready: '',
  error: 'Erro na inicialização',
  timeout: 'Tempo de inicialização excedido',
};

// Flag global para indicar ao useSessionGuard que o AppInitializer já fez a validação inicial
let initialValidationDone = false;
export function isInitialValidationDone() {
  return initialValidationDone;
}

export function AppInitializer({ children }: { children: ReactNode }) {
  const { user, loading: authLoading, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<InitPhase>('waiting_auth');
  const [errorMessage, setErrorMessage] = useState('');
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const hasInitialized = useRef(false);

  // Timeout global de inicialização
  useEffect(() => {
    if (phase === 'ready' || phase === 'error' || phase === 'timeout') return;

    timeoutRef.current = setTimeout(() => {
      setPhase('timeout');
      setErrorMessage('A inicialização da aplicação demorou mais que o esperado. Verifique sua conexão e tente novamente.');
    }, INIT_TIMEOUT_MS);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [phase]);

  useEffect(() => {
    // Ainda esperando AuthProvider estabilizar
    if (authLoading) {
      setPhase('waiting_auth');
      return;
    }

    // Sem usuário → liberar imediatamente para rotas públicas
    if (!user) {
      initialValidationDone = false;
      hasInitialized.current = false;
      setPhase('ready');
      return;
    }

    // Evitar re-execução em re-renders
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const initialize = async () => {
      try {
        // ── Fase 1: Validar sessão ──
        setPhase('validating_session');
        const sessionId = getSessionId();

        if (sessionId) {
          // Retry com delay para compensar lag de replicação pós-login
          let sessionValid = false;
          for (let attempt = 0; attempt < 3; attempt++) {
            const { data, error } = await supabase.rpc('validate_app_session', {
              p_session_id: sessionId,
            });

            if (error) {
              console.warn(`Session validation attempt ${attempt + 1} error:`, error);
              if (attempt < 2) {
                await new Promise(r => setTimeout(r, 1500));
                continue;
              }
              // Última tentativa falhou - deixar prosseguir (useSessionGuard fará retry)
              break;
            }

            const result = data as any;
            if (result?.valid) {
              sessionValid = true;
              break;
            }

            // Sessão inválida
            if (result?.reason === 'session_not_found' && attempt < 2) {
              // Pode ser lag de replicação
              await new Promise(r => setTimeout(r, 1500));
              continue;
            }

            // Sessão definitivamente inválida
            if (!result?.valid) {
              console.warn('App session invalid:', result?.reason);
              await signOut();
              return;
            }
          }
        }

        // ── Fase 2: Pré-carregar permissões ──
        setPhase('loading_permissions');

        await Promise.all([
          queryClient.prefetchQuery({
            queryKey: ['user_modules', user.id],
            queryFn: async () => {
              const { data, error } = await supabase.rpc('get_user_modules', {
                _user_id: user.id,
              });
              if (error) throw error;
              return data || [];
            },
            staleTime: 5 * 60 * 1000,
          }),
          queryClient.prefetchQuery({
            queryKey: ['is_admin', user.id],
            queryFn: async () => {
              const { data, error } = await supabase.rpc('has_role', {
                _user_id: user.id,
                _role: 'admin',
              });
              if (error) throw error;
              return data as boolean;
            },
            staleTime: 5 * 60 * 1000,
          }),
          queryClient.prefetchQuery({
            queryKey: ['is_developer', user.id],
            queryFn: async () => {
              const { data, error } = await supabase.rpc('has_role', {
                _user_id: user.id,
                _role: 'desenvolvedor',
              });
              if (error) throw error;
              return data as boolean;
            },
            staleTime: 5 * 60 * 1000,
          }),
        ]);

        // ── Pronto ──
        initialValidationDone = true;
        setPhase('ready');
      } catch (err) {
        console.error('App initialization error:', err);
        setPhase('error');
        setErrorMessage(
          err instanceof Error ? err.message : 'Erro desconhecido na inicialização'
        );
      }
    };

    initialize();
  }, [authLoading, user, queryClient, signOut]);

  // Resetar quando user muda (logout + novo login)
  useEffect(() => {
    return () => {
      hasInitialized.current = false;
      initialValidationDone = false;
    };
  }, [user?.id]);

  if (phase === 'ready') {
    return <>{children}</>;
  }

  if (phase === 'error' || phase === 'timeout') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 max-w-md px-6">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
          <h2 className="text-lg font-semibold text-foreground">
            {phaseLabels[phase]}
          </h2>
          <p className="text-sm text-muted-foreground">{errorMessage}</p>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Recarregar aplicação
          </button>
        </div>
      </div>
    );
  }

  // Loading state
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
        <p className="text-sm text-muted-foreground">{phaseLabels[phase]}</p>
      </div>
    </div>
  );
}
