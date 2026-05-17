/**
 * Cross-tab auth synchronization. When one tab logs out (manual / idle /
 * forced), every other tab in the same browser receives the event and
 * cleans up immediately.
 *
 * Uses BroadcastChannel when available, with a localStorage `storage`
 * event fallback for older browsers.
 */

export type AuthBroadcastEvent =
  | { type: 'logout'; reason?: string }
  | { type: 'activity'; ts: number };

const CHANNEL_NAME = 'crm-auth-sync';
const FALLBACK_KEY = '__crm_auth_bus__';

let channel: BroadcastChannel | null = null;
try {
  if (typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel(CHANNEL_NAME);
  }
} catch {
  channel = null;
}

export function publishAuthEvent(event: AuthBroadcastEvent) {
  try {
    if (channel) {
      channel.postMessage(event);
    } else {
      // Fallback: write+remove to trigger `storage` events on other tabs.
      const payload = JSON.stringify({ ...event, _ts: Date.now() });
      localStorage.setItem(FALLBACK_KEY, payload);
      localStorage.removeItem(FALLBACK_KEY);
    }
  } catch {
    /* ignore */
  }
}

export function subscribeAuthEvents(handler: (event: AuthBroadcastEvent) => void): () => void {
  if (channel) {
    const listener = (msg: MessageEvent) => handler(msg.data as AuthBroadcastEvent);
    channel.addEventListener('message', listener);
    return () => channel?.removeEventListener('message', listener);
  }

  const storageListener = (e: StorageEvent) => {
    if (e.key !== FALLBACK_KEY || !e.newValue) return;
    try {
      handler(JSON.parse(e.newValue) as AuthBroadcastEvent);
    } catch {
      /* ignore */
    }
  };
  window.addEventListener('storage', storageListener);
  return () => window.removeEventListener('storage', storageListener);
}
