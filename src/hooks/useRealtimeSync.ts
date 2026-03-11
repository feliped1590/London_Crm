import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { subscribeAll } from '@/lib/realtimeManager';

/**
 * Subscribes to Supabase Realtime channels for CRM entities.
 * Should only be mounted when the user is authenticated.
 */
export function useRealtimeSync(userId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const cleanup = subscribeAll(supabase, queryClient, userId);

    return cleanup;
  }, [userId, queryClient]);
}
