import { useEffect, useRef } from 'react';
import { publishAuthEvent, subscribeAuthEvents } from '@/lib/auth/broadcast';

/**
 * Client-side idle watchdog. Fires `onTimeout` when the user has been
 * inactive for `idleMs`. Tracks pointer/keyboard/scroll/touch + window
 * focus/visibility AND syncs activity across tabs so opening any tab
 * keeps the whole session alive.
 *
 * Safe to mount once per app (do it inside AuthProvider/SessionGuard).
 */
export function useIdleTimeout(opts: {
  enabled: boolean;
  idleMs: number;
  onTimeout: () => void;
  /** How often to broadcast activity to other tabs (default 30s). */
  broadcastEveryMs?: number;
}) {
  const { enabled, idleMs, onTimeout, broadcastEveryMs = 30_000 } = opts;
  const lastActivityRef = useRef<number>(Date.now());
  const lastBroadcastRef = useRef<number>(0);
  const onTimeoutRef = useRef(onTimeout);

  // Keep latest callback without resubscribing listeners
  useEffect(() => { onTimeoutRef.current = onTimeout; }, [onTimeout]);

  useEffect(() => {
    if (!enabled) return;

    const touch = (broadcast = true) => {
      const now = Date.now();
      lastActivityRef.current = now;
      if (broadcast && now - lastBroadcastRef.current > broadcastEveryMs) {
        lastBroadcastRef.current = now;
        publishAuthEvent({ type: 'activity', ts: now });
      }
    };

    const onActivity = () => touch(true);
    const onVisibility = () => { if (!document.hidden) touch(false); };

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'wheel'];
    events.forEach(e => window.addEventListener(e, onActivity, { passive: true }));
    window.addEventListener('focus', onActivity);
    document.addEventListener('visibilitychange', onVisibility);

    // Activity from other tabs counts too.
    const unsubBus = subscribeAuthEvents((evt) => {
      if (evt.type === 'activity') {
        lastActivityRef.current = Math.max(lastActivityRef.current, evt.ts);
      }
    });

    // Poll every 30s; cheaper than a precise timer and resilient to
    // sleep/wake (background timers get throttled by browsers).
    const interval = setInterval(() => {
      if (Date.now() - lastActivityRef.current >= idleMs) {
        clearInterval(interval);
        onTimeoutRef.current();
      }
    }, 30_000);

    return () => {
      events.forEach(e => window.removeEventListener(e, onActivity));
      window.removeEventListener('focus', onActivity);
      document.removeEventListener('visibilitychange', onVisibility);
      unsubBus();
      clearInterval(interval);
    };
  }, [enabled, idleMs, broadcastEveryMs]);
}
