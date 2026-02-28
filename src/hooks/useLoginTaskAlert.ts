import { useState, useEffect, useCallback } from 'react';
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

  const closeModal = useCallback(() => setShowModal(false), []);

  useEffect(() => {
    let cancelled = false;
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let pollTimeout: ReturnType<typeof setTimeout> | null = null;

    const tryCheck = (): boolean => {
      const sessionId = localStorage.getItem('app_session_id');
      if (!sessionId) return false;

      const storageKey = `task_alert_checked_${sessionId}`;
      if (sessionStorage.getItem(storageKey)) {
        return true; // already checked for this session
      }

      sessionStorage.setItem(storageKey, '1');
      runCheck();
      return true;
    };

    const runCheck = async () => {
      try {
        const { data: configRow } = await supabase
          .from('system_settings')
          .select('value')
          .eq('key', 'task_alert_config')
          .maybeSingle();

        const config: TaskAlertConfig = {
          ...DEFAULT_CONFIG,
          ...(configRow?.value as Partial<TaskAlertConfig> || {}),
        };

        if (!config.enable_task_login_alert || cancelled) return;

        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) return;

        const { data, error } = await supabase.rpc('check_pending_tasks', {
          p_user_id: user.id,
        });

        if (error || cancelled) return;

        const result = data as unknown as TaskAlertData;
        if (!result || (result.overdue_count === 0 && result.today_count === 0)) return;

        setAlertData(result);

        setTimeout(() => {
          if (cancelled) return;
          setShowModal(true);
          if (config.enable_task_login_sound) {
            playNotificationSound();
          }
        }, 800);
      } catch {
        // Silently fail
      }
    };

    // Delay initial check slightly to ensure session_id is written after login navigation
    const initialDelay = setTimeout(() => {
      if (cancelled) return;
      if (!tryCheck()) {
        pollInterval = setInterval(() => {
          if (cancelled) return;
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
        }, 10000);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(initialDelay);
      if (pollInterval) clearInterval(pollInterval);
      if (pollTimeout) clearTimeout(pollTimeout);
    };
  }, []);

  return { showModal, alertData, closeModal };
}
