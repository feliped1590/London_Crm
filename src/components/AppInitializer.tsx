import { useEffect, useRef, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getSessionId } from '@/hooks/useSessionGuard';
import { Loader2 } from 'lucide-react';

// Flag global para indicar ao useSessionGuard que o AppInitializer já fez a validação inicial
let initialValidationDone = false;
export function isInitialValidationDone() {
  return initialValidationDone;
}

/**
 * Non-blocking AppInitializer:
 * - Blocks render ONLY while auth is loading (authLoading === true)
 * - Once auth resolves, renders children immediately
 * - Session validation + permission prefetch happen in background
 */
export function AppInitializer({ children }: { children: ReactNode }) {
  const { user, loading: authLoading, signOut } = useAuth();
  const queryClient = useQueryClient();
  const hasStartedBackground = useRef(false);

  // Background initialization: session validation + permissions prefetch
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      initialValidationDone = false;
      hasStartedBackground.current = false;
      return;
    }

    if (hasStartedBackground.current) return;
    hasStartedBackground.current = true;

    const runBackground = async () => {
      try {
        // ── Validate session (best-effort, non-blocking) ──
        const sessionId = getSessionId();
        if (sessionId) {
          let sessionValid = false;
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              const { data, error } = await supabase.rpc('validate_app_session', {
                p_session_id: sessionId,
              });

              if (error) {
                console.warn(`Session validation attempt ${attempt + 1} error:`, error);
                if (attempt < 2) {
                  await new Promise(r => setTimeout(r, 800));
                  continue;
                }
                break; // Let useSessionGuard handle retries
              }

              const result = data as any;
              if (result?.valid) {
                sessionValid = true;
                break;
              }

              if (result?.reason === 'session_not_found' && attempt < 2) {
                await new Promise(r => setTimeout(r, 800));
                continue;
              }

              // Session definitively invalid — only sign out for confirmed reasons
              if (!result?.valid) {
                const definitiveReasons = ['replaced_by_new_login', 'admin_kick', 'manual_logout'];
                if (definitiveReasons.includes(result?.reason)) {
                  console.warn('App session definitively invalid:', result?.reason);
                  await signOut();
                  return;
                }
                // For transient reasons (idle_timeout, unknown), let useSessionGuard retry
                console.warn('App session issue (non-fatal):', result?.reason);
                break;
              }
            } catch (err) {
              console.warn(`Session validation attempt ${attempt + 1} exception:`, err);
              if (attempt < 2) {
                await new Promise(r => setTimeout(r, 800));
              }
            }
          }
        }

        initialValidationDone = true;

        // ── Prefetch permissions (non-blocking, React Query handles caching) ──
        const prefetchPromises = [
          queryClient.prefetchQuery({
            queryKey: ['user_modules', user.id],
            queryFn: async () => {
              const { data, error } = await supabase.rpc('get_user_modules', { _user_id: user.id });
              if (error) throw error;
              return data || [];
            },
            staleTime: 5 * 60 * 1000,
          }),
          queryClient.prefetchQuery({
            queryKey: ['is_admin', user.id],
            queryFn: async () => {
              const { data, error } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
              if (error) throw error;
              return data as boolean;
            },
            staleTime: 5 * 60 * 1000,
          }),
          queryClient.prefetchQuery({
            queryKey: ['is_developer', user.id],
            queryFn: async () => {
              const { data, error } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'desenvolvedor' });
              if (error) throw error;
              return data as boolean;
            },
            staleTime: 5 * 60 * 1000,
          }),
        ];

        // Fire and forget — don't block on permission failures
        await Promise.allSettled(prefetchPromises);
      } catch (err) {
        console.error('Background initialization error (non-fatal):', err);
      }
    };

    runBackground();
  }, [authLoading, user, queryClient, signOut]);

  // Reset when user changes (logout + new login)
  useEffect(() => {
    return () => {
      hasStartedBackground.current = false;
      initialValidationDone = false;
    };
  }, [user?.id]);

  // ONLY block while auth state is resolving
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Restaurando sessão...</p>
        </div>
      </div>
    );
  }

  // Auth resolved → render immediately, background tasks continue
  return <>{children}</>;
}
