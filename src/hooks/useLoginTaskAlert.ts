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
    // Try to check immediately if session already exists
    const tryCheck = () => {
      const sessionId = localStorage.getItem('app_session_id');
      if (!sessionId) return false;

      const storageKey = `task_alert_checked_${sessionId}`;
      if (sessionStorage.getItem(storageKey)) return true; // already checked
      if (checkedRef.current) return true;

      checkedRef.current = true;
      sessionStorage.setItem(storageKey, '1');
      runCheck();
      return true;
    };

    let cancelled = false;

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

        if (!config.enable_task_login_alert) return;

        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) return;

        // Call RPC
        const { data, error } = await supabase.rpc('check_pending_tasks', {
          p_user_id: user.id,
        });

        if (error || cancelled) {
          console.warn('[TaskAlert] RPC error:', error);
          return;
        }

        const result = data as unknown as TaskAlertData;
        if (!result || (result.overdue_count === 0 && result.today_count === 0)) return;

        setAlertData(result);

        // Delay for smooth UX
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
      // If no session yet, poll briefly (session is set right after login)
      const interval = setInterval(() => {
        if (tryCheck()) clearInterval(interval);
      }, 500);

      // Stop polling after 5 seconds
      const timeout = setTimeout(() => clearInterval(interval), 5000);

      return () => {
        cancelled = true;
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }

    return () => { cancelled = true; };
  }, []);

  return { showModal, alertData, closeModal };
}
