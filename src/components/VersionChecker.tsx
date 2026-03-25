import { useEffect, useRef, useCallback, useState } from 'react';
import { toast } from 'sonner';

const VERSION_KEY = 'app_build_version';
const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
const RELOAD_GUARD_KEY = 'app_version_reload_ts';
const RELOAD_GUARD_WINDOW = 30_000; // 30s anti-loop

async function fetchRemoteVersion(): Promise<string | null> {
  try {
    const res = await fetch('/version.json', { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.version ?? null;
  } catch {
    return null;
  }
}

function isReloadSafe(): boolean {
  const last = localStorage.getItem(RELOAD_GUARD_KEY);
  if (!last) return true;
  return Date.now() - Number(last) > RELOAD_GUARD_WINDOW;
}

function markReload() {
  localStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
}

export function VersionChecker() {
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const [pendingVersion, setPendingVersion] = useState<string | null>(null);

  const checkVersion = useCallback(async (autoReload = false) => {
    const remote = await fetchRemoteVersion();
    if (!remote) return;

    const local = localStorage.getItem(VERSION_KEY);

    // First visit — just store
    if (!local) {
      localStorage.setItem(VERSION_KEY, remote);
      return;
    }

    if (local === remote) return;

    // New version detected
    if (autoReload && isReloadSafe()) {
      markReload();
      window.location.reload();
      return;
    }

    // Show toast for manual reload
    setPendingVersion(remote);
  }, []);

  // Show persistent toast when pending
  useEffect(() => {
    if (!pendingVersion) return;

    toast.info('Nova versão disponível', {
      description: 'Clique para atualizar o sistema.',
      duration: Infinity,
      id: 'version-update',
      action: {
        label: 'Atualizar agora',
        onClick: () => {
          if (isReloadSafe()) {
            localStorage.setItem(VERSION_KEY, pendingVersion);
            markReload();
            window.location.reload();
          }
        },
      },
    });
  }, [pendingVersion]);

  // Initial check (auto-reload on boot if safe)
  useEffect(() => {
    checkVersion(true);
  }, [checkVersion]);

  // Periodic check
  useEffect(() => {
    intervalRef.current = setInterval(() => checkVersion(false), CHECK_INTERVAL);
    return () => clearInterval(intervalRef.current);
  }, [checkVersion]);

  // Visibility change
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        checkVersion(false);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [checkVersion]);

  return null;
}
