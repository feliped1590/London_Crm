import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { isInitialValidationDone } from '@/components/AppInitializer';

const SESSION_KEY = 'app_session_id';
const VALIDATE_INTERVAL = 60_000; // 60s
const HEARTBEAT_INTERVAL = 300_000; // 5min

export function getSessionId(): string | null {
  return localStorage.getItem(SESSION_KEY);
}

export function setSessionId(id: string) {
  localStorage.setItem(SESSION_KEY, id);
}

export function clearSessionId() {
  localStorage.removeItem(SESSION_KEY);
}

export function useSessionGuard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const validateTimer = useRef<ReturnType<typeof setInterval>>();
  const heartbeatTimer = useRef<ReturnType<typeof setInterval>>();
  const lastActivity = useRef(Date.now());

  const forceLogout = useCallback(async (reason: string) => {
    clearSessionId();

    const messages: Record<string, string> = {
      'replaced_by_new_login': 'Sua sessão foi encerrada porque um novo login foi realizado.',
      'admin_kick': 'Sua sessão foi encerrada pelo administrador.',
      'idle_timeout': 'Sua sessão expirou por inatividade.',
      'session_not_found': 'Sessão não encontrada. Faça login novamente.',
    };

    toast.error(messages[reason] || 'Sessão encerrada. Faça login novamente.');
    await signOut();
    navigate('/auth', { replace: true });
  }, [signOut, navigate]);

  // Validate session periodically
  useEffect(() => {
    if (!user) return;

    const sessionId = getSessionId();
    if (!sessionId) return;

    const validate = async () => {
      const sid = getSessionId();
      if (!sid) return;

      const { data, error } = await supabase.rpc('validate_app_session', { p_session_id: sid });
      if (error) {
        console.warn('Session validation error:', error);
        return;
      }

      const result = data as any;
      if (result && !result.valid) {
        forceLogout(result.reason);
      }
    };

    validate();
    validateTimer.current = setInterval(validate, VALIDATE_INTERVAL);

    return () => {
      if (validateTimer.current) clearInterval(validateTimer.current);
    };
  }, [user, forceLogout]);

  // Heartbeat
  useEffect(() => {
    if (!user) return;

    const touch = async () => {
      const sid = getSessionId();
      if (!sid) return;

      // Only touch if there was activity
      if (Date.now() - lastActivity.current > HEARTBEAT_INTERVAL) return;

      const { data } = await supabase.rpc('touch_app_session', { p_session_id: sid });
      if (data === false) {
        forceLogout('idle_timeout');
      }
    };

    heartbeatTimer.current = setInterval(touch, HEARTBEAT_INTERVAL);

    return () => {
      if (heartbeatTimer.current) clearInterval(heartbeatTimer.current);
    };
  }, [user, forceLogout]);

  // Track activity
  useEffect(() => {
    const onActivity = () => { lastActivity.current = Date.now(); };
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(e => window.addEventListener(e, onActivity, { passive: true }));
    return () => { events.forEach(e => window.removeEventListener(e, onActivity)); };
  }, []);

  // Realtime: listen for session invalidation
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`session-guard-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'app_sessions',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newRow = payload.new as any;
          const sessionId = getSessionId();
          
          // Only react if it's OUR session that was invalidated
          if (newRow.id === sessionId && newRow.is_valid === false) {
            forceLogout(newRow.invalidated_reason || 'invalidated');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, forceLogout]);
}
