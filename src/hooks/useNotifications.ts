import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type NotificationStatus = 'pending' | 'resolved' | 'archived';
export type NotificationFilter = 'all' | 'unread' | 'read' | 'archived';

export interface NotificationRow {
  id: string;
  user_id: string;
  tenant_id: string | null;
  legal_entity_id: string | null;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  read_at: string | null;
  status: NotificationStatus;
  origin_module: string | null;
  origin_id: string | null;
  action_url: string | null;
  link: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  created_by: string | null;
}

export function useUnreadNotificationCount() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['notifications', 'unread_count', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_unread_notification_count');
      if (error) throw error;
      return (data as number) ?? 0;
    },
    refetchInterval: 60_000,
    staleTime: 15_000,
  });

  // Realtime escopado ao usuário
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  return query;
}

export function useNotificationsList(filter: NotificationFilter = 'all', limit = 50) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['notifications', 'list', user?.id, filter, limit],
    enabled: !!user?.id,
    queryFn: async () => {
      let q = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (filter === 'archived') {
        q = q.eq('status', 'archived');
      } else {
        q = q.neq('status', 'archived');
        if (filter === 'unread') q = q.eq('is_read', false);
        else if (filter === 'read') q = q.eq('is_read', true);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as NotificationRow[];
    },
    refetchInterval: 60_000,
    staleTime: 15_000,
  });
}

export function useRecentNotifications(limit = 8) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['notifications', 'recent', user?.id, limit],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user!.id)
        .neq('status', 'archived')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data || []) as unknown as NotificationRow[];
    },
    refetchInterval: 60_000,
    staleTime: 15_000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('mark_notification_read', { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('mark_all_notifications_read');
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export function useArchiveNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('archive_notification', { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}
