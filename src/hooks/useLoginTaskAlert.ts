import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TaskAlertData {
  overdue_count: number;
  today_count: number;
  overdue_tasks: { id: string; title: string }[];
  today_tasks: { id: string; title: string }[];
}

interface TaskAlertConfig {
  enable_task_login_alert: boolean;
  enable_task_login_sound: boolean;
}

const DEFAULT_CONFIG: TaskAlertConfig = {
  enable_task_login_alert: true,
  enable_task_login_sound: true,
};

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    // Browser blocked audio — silently ignore
  }
}

export function useLoginTaskAlert() {
  const [showModal, setShowModal] = useState(false);
  const [alertData, setAlertData] = useState<TaskAlertData | null>(null);
  const checkedRef = useRef(false);

  const closeModal = useCallback(() => setShowModal(false), []);

  useEffect(() => {
    let cancelled = false;
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let pollTimeout: ReturnType<typeof setTimeout> | null = null;

    const tryCheck = (): boolean => {
      if (checkedRef.current) return true;

      const sessionId = localStorage.getItem('app_session_id');
      console.log('[TaskAlert] Checking session_id:', sessionId);
      if (!sessionId) return false;

      const storageKey = `task_alert_checked_${sessionId}`;
      if (sessionStorage.getItem(storageKey)) {
        console.log('[TaskAlert] Already checked for this session');
        checkedRef.current = true;
        return true;
      }

      checkedRef.current = true;
      sessionStorage.setItem(storageKey, '1');
      console.log('[TaskAlert] Running check...');
      runCheck();
      return true;
    };

    const runCheck = async () => {
      try {
        // Load config
        const { data: configRow } = await supabase
          .from('system_settings')
          .select('value')
          .eq('key', 'task_alert_config')
          .maybeSingle();

        const config: TaskAlertConfig = {
          ...DEFAULT_CONFIG,
          ...(configRow?.value as Partial<TaskAlertConfig> || {}),
        };

        console.log('[TaskAlert] Config:', config);

        if (!config.enable_task_login_alert) {
          console.log('[TaskAlert] Alert disabled in config');
          return;
        }

        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) {
          console.log('[TaskAlert] No user or cancelled');
          return;
        }

        console.log('[TaskAlert] Calling RPC for user:', user.id);

        // Call RPC
        const { data, error } = await supabase.rpc('check_pending_tasks', {
          p_user_id: user.id,
        });

        console.log('[TaskAlert] RPC result:', data, 'error:', error);

        if (error || cancelled) return;

        const result = data as unknown as TaskAlertData;
        if (!result || (result.overdue_count === 0 && result.today_count === 0)) {
          console.log('[TaskAlert] No pending tasks');
          return;
        }

        console.log('[TaskAlert] Found tasks! overdue:', result.overdue_count, 'today:', result.today_count);
        setAlertData(result);

        setTimeout(() => {
          if (cancelled) return;
          setShowModal(true);
          if (config.enable_task_login_sound) {
            playNotificationSound();
          }
        }, 800);
      } catch (err) {
        console.warn('[TaskAlert] Error:', err);
      }
    };

    // Try immediately
    if (!tryCheck()) {
      // Poll for session_id to appear
      pollInterval = setInterval(() => {
        if (tryCheck() && pollInterval) {
          clearInterval(pollInterval);
          pollInterval = null;
        }
      }, 500);

      pollTimeout = setTimeout(() => {
        if (pollInterval) {
          clearInterval(pollInterval);
          pollInterval = null;
        }
        console.log('[TaskAlert] Polling timed out');
      }, 10000);
    }

    return () => {
      cancelled = true;
      if (pollInterval) clearInterval(pollInterval);
      if (pollTimeout) clearTimeout(pollTimeout);
    };
  }, []);

  return { showModal, alertData, closeModal };
}
