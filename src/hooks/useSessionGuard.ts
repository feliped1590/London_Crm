import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { isInitialValidationDone } from '@/components/AppInitializer';
import { fetchAccessBlockedInfo } from '@/lib/accessWindowInfo';
import { useIdleTimeout } from '@/hooks/useIdleTimeout';
import { useSessionIdleTimeout } from '@/hooks/useSessionIdleTimeout';
import { publishAuthEvent } from '@/lib/auth/broadcast';

const SESSION_KEY = 'app_session_id';
const VALIDATE_INTERVAL = 60_000;            // 60s — backend session check
const MIN_HEARTBEAT_INTERVAL = 60_000;       // never touch backend more than 1×/min
const MAX_HEARTBEAT_INTERVAL = 300_000;      // …and at least once every 5 min

export function getSessionId(): string | null {
  try { return localStorage.getItem(SESSION_KEY) ?? sessionStorage.getItem(SESSION_KEY); }
  catch { return null; }
}

export function setSessionId(id: string) {
  // Mirror to both stores so the existing hybrid auth strategy works
  // regardless of "remember me".
  try { sessionStorage.setItem(SESSION_KEY, id); } catch { /* ignore */ }
  try { localStorage.setItem(SESSION_KEY, id); } catch { /* ignore */ }
}

export function clearSessionId() {
  try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
  try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
}

/**
 * Single consolidated session guard. One effect per concern but ALL
 * driven by a stable user.id (not by `signOut`/`navigate` identity),
 * so timers and Realtime channels are created exactly once per session.
 */
export function useSessionGuard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  // Keep callbacks in refs so we never need them in deps arrays.
  const signOutRef = useRef(signOut);
  const navigateRef = useRef(navigate);
  const userRef = useRef(user);
  useEffect(() => { signOutRef.current = signOut; }, [signOut]);
  useEffect(() => { navigateRef.current = navigate; }, [navigate]);
  useEffect(() => { userRef.current = user; }, [user]);

  const lastActivityRef = useRef(Date.now());

  const forceLogout = useCallback(async (reason: string) => {
    clearSessionId();

    if (reason === 'outside_allowed_hours') {
      const userId = userRef.current?.id;
      let info = null;
      if (userId) {
        try { info = await fetchAccessBlockedInfo(userId); }
        catch (err) { console.warn('fetchAccessBlockedInfo falhou:', err); }
      }
      toast.error('Sua sessão foi encerrada: fora do horário permitido.');
      await signOutRef.current({ broadcast: true });
      navigateRef.current('/access-blocked', { replace: true, state: { info } });
      return;
    }

    const messages: Record<string, string> = {
      'replaced_by_new_login': 'Sua sessão foi encerrada porque um novo login foi realizado.',
      'admin_kick': 'Sua sessão foi encerrada pelo administrador.',
      'idle_timeout': 'Sua sessão expirou por inatividade.',
      'session_not_found': 'Sessão não encontrada. Faça login novamente.',
    };

    toast.error(messages[reason] || 'Sessão encerrada. Faça login novamente.');
    publishAuthEvent({ type: 'logout', reason });
    await signOutRef.current({ broadcast: false }); // broadcast already sent above
    navigateRef.current('/auth', { replace: true });
  }, []);

  // ── 1. Periodic backend validation + heartbeat (consolidated) ──
  useEffect(() => {
    if (!user) return;
    const sessionId = getSessionId();
    if (!sessionId) return;

    let cancelled = false;
    let validateInFlight = false;

    const validate = async () => {
      if (cancelled || validateInFlight) return;
      const sid = getSessionId();
      if (!sid) return;
      validateInFlight = true;
      try {
        const { data, error } = await supabase.rpc('validate_app_session', { p_session_id: sid });
        if (cancelled) return;
        if (error) { console.warn('Session validation error:', error); return; }
        const result = data as any;
        if (result && !result.valid) {
          forceLogout(result.reason);
        }
      } finally {
        validateInFlight = false;
      }
    };

    const heartbeat = async () => {
      if (cancelled) return;
      const sid = getSessionId();
      if (!sid) return;
      // Only touch backend if the user actually moved in the last interval.
      if (Date.now() - lastActivityRef.current > HEARTBEAT_INTERVAL) return;
      try {
        const { data } = await supabase.rpc('touch_app_session', { p_session_id: sid });
        if (!cancelled && data === false) {
          forceLogout('idle_timeout');
        }
      } catch (e) {
        console.warn('touch_app_session falhou:', e);
      }
    };

    // Skip first validation if AppInitializer already did it.
    if (!isInitialValidationDone()) {
      validate();
    }
    const validateTimer = setInterval(validate, VALIDATE_INTERVAL);
    const heartbeatTimer = setInterval(heartbeat, HEARTBEAT_INTERVAL);

    return () => {
      cancelled = true;
      clearInterval(validateTimer);
      clearInterval(heartbeatTimer);
    };
  }, [user?.id, forceLogout]);

  // ── 2. Local activity tracker (feeds heartbeat decision) ──
  useEffect(() => {
    const onActivity = () => { lastActivityRef.current = Date.now(); };
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(e => window.addEventListener(e, onActivity, { passive: true }));
    return () => events.forEach(e => window.removeEventListener(e, onActivity));
  }, []);

  // ── 3. Client-side idle logout (independent of backend) ──
  useIdleTimeout({
    enabled: !!user,
    idleMs: IDLE_TIMEOUT_MS,
    onTimeout: () => { void forceLogout('idle_timeout'); },
  });

  // ── 4. Realtime: react to remote session invalidation ──
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`session-guard-${user.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'app_sessions',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        const newRow = payload.new as any;
        const sessionId = getSessionId();
        if (newRow.id === sessionId && newRow.is_valid === false) {
          forceLogout(newRow.invalidated_reason || 'invalidated');
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, forceLogout]);
}
