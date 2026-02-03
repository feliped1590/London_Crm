import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface GoogleCalendarConnection {
  id: string;
  user_id: string;
  sync_enabled: boolean;
  last_sync_at: string | null;
  calendar_id: string;
  created_at: string;
  updated_at: string;
}

export function useGoogleCalendar() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Check if Google Calendar integration is configured
  const isConfigured = false; // Will be true when GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set

  // Fetch user's Google Calendar connection
  const { data: connection, isLoading } = useQuery({
    queryKey: ['google-calendar-connection', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('google_calendar_connections')
        .select('id, user_id, sync_enabled, last_sync_at, calendar_id, created_at, updated_at')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data as GoogleCalendarConnection | null;
    },
    enabled: !!user?.id && isConfigured,
  });

  // Connect to Google Calendar (OAuth flow)
  const connectMutation = useMutation({
    mutationFn: async () => {
      if (!isConfigured) {
        throw new Error('Google Calendar integration is not configured');
      }
      
      // This will trigger the OAuth flow via edge function
      const { data, error } = await supabase.functions.invoke('google-calendar-oauth', {
        body: { action: 'authorize' }
      });
      
      if (error) throw error;
      
      // Redirect to Google OAuth consent screen
      if (data?.authUrl) {
        window.location.href = data.authUrl;
      }
      
      return data;
    },
    onError: (error) => {
      toast.error('Erro ao conectar Google Calendar', {
        description: error.message
      });
    }
  });

  // Disconnect from Google Calendar
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('User not authenticated');
      
      const { error } = await supabase
        .from('google_calendar_connections')
        .delete()
        .eq('user_id', user.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google-calendar-connection'] });
      toast.success('Google Calendar desconectado');
    },
    onError: (error) => {
      toast.error('Erro ao desconectar', {
        description: error.message
      });
    }
  });

  // Toggle sync enabled/disabled
  const toggleSyncMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (!user?.id) throw new Error('User not authenticated');
      
      const { error } = await supabase
        .from('google_calendar_connections')
        .update({ sync_enabled: enabled })
        .eq('user_id', user.id);
      
      if (error) throw error;
    },
    onSuccess: (_, enabled) => {
      queryClient.invalidateQueries({ queryKey: ['google-calendar-connection'] });
      toast.success(enabled ? 'Sincronização ativada' : 'Sincronização pausada');
    },
    onError: (error) => {
      toast.error('Erro ao alterar sincronização', {
        description: error.message
      });
    }
  });

  // Manual sync trigger
  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('google-calendar-sync', {
        body: { action: 'sync' }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google-calendar-connection'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Sincronização concluída');
    },
    onError: (error) => {
      toast.error('Erro na sincronização', {
        description: error.message
      });
    }
  });

  return {
    isConfigured,
    connection,
    isLoading,
    isConnected: !!connection,
    isSyncEnabled: connection?.sync_enabled ?? false,
    lastSyncAt: connection?.last_sync_at,
    connect: connectMutation.mutate,
    disconnect: disconnectMutation.mutate,
    toggleSync: toggleSyncMutation.mutate,
    triggerSync: syncMutation.mutate,
    isConnecting: connectMutation.isPending,
    isDisconnecting: disconnectMutation.isPending,
    isSyncing: syncMutation.isPending,
  };
}
