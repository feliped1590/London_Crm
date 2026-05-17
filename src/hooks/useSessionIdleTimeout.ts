import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const DEFAULT_IDLE_TIMEOUT_MINUTES = 30;

/**
 * Single source of truth for the tenant's configured session idle timeout.
 * Cached for 5 min so it does not thrash the RPC. Invalidate the
 * `['session_idle_timeout']` query key after admin updates the setting
 * to propagate the new value to all hooks (including useSessionGuard).
 */
export function useSessionIdleTimeout() {
  const query = useQuery({
    queryKey: ['session_idle_timeout'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_session_idle_timeout_minutes');
      if (error) throw error;
      const minutes = Number(data);
      if (!Number.isFinite(minutes) || minutes < 1) return DEFAULT_IDLE_TIMEOUT_MINUTES;
      return Math.min(Math.max(Math.trunc(minutes), 1), 1440);
    },
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });

  const minutes = query.data ?? DEFAULT_IDLE_TIMEOUT_MINUTES;
  return {
    minutes,
    ms: minutes * 60_000,
    isLoading: query.isLoading,
    isResolved: query.data != null,
  };
}
