import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface CardDefinition {
  key: string;
  label: string;
  icon: string;
}

export const AVAILABLE_CARDS: CardDefinition[] = [
  { key: 'total_clients', label: 'Total de Clientes', icon: 'Users' },
  { key: 'top_setor', label: 'Clientes por Setor', icon: 'Building2' },
  { key: 'top_segmento', label: 'Segmento com mais clientes', icon: 'Layers' },
  { key: 'top_atividade', label: 'Atividade com mais clientes', icon: 'Activity' },
  { key: 'active_clients', label: 'Novos clientes (30 dias)', icon: 'UserPlus' },
  { key: 'open_deals', label: 'Negócios em aberto', icon: 'Handshake' },
];

const DEFAULT_CARDS = AVAILABLE_CARDS.map((c, i) => ({
  card_key: c.key,
  position: i,
  enabled: true,
}));

export interface UserCardPreference {
  card_key: string;
  position: number;
  enabled: boolean;
}

export function useDashboardCards() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: preferences, isLoading: prefsLoading } = useQuery({
    queryKey: ['dashboard-cards-prefs', user?.id],
    queryFn: async () => {
      if (!user) return DEFAULT_CARDS;
      const { data, error } = await supabase
        .from('user_dashboard_cards')
        .select('card_key, position, enabled')
        .eq('user_id', user.id)
        .order('position');
      if (error) throw error;
      if (!data || data.length === 0) return DEFAULT_CARDS;
      return data as UserCardPreference[];
    },
    enabled: !!user,
  });

  const activeCards = (preferences || DEFAULT_CARDS)
    .filter((p) => p.enabled)
    .sort((a, b) => a.position - b.position);

  // Fetch metrics data via RPC for accurate counts
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['dashboard-cards-metrics'],
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    queryFn: async () => {
      const [{ data: rpcData, error: rpcError }, { count: newClientsCount, error: newClientsError }] =
        await Promise.all([
          supabase.rpc('get_dashboard_card_metrics'),
          supabase
            .from('companies')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
        ]);
      if (rpcError) throw rpcError;
      if (newClientsError) throw newClientsError;
      const m = rpcData as any;

      return {
        total_clients: {
          value: String(m.total_clients || 0),
          subtitle: `${m.setores_count || 0} setores cadastrados`,
        },
        top_setor: {
          value: m.top_setor_nome || 'N/A',
          subtitle: m.top_setor_count ? `${m.top_setor_count} clientes` : 'Sem dados',
        },
        top_segmento: {
          value: m.top_segmento_nome || 'N/A',
          subtitle: m.top_segmento_count ? `${m.top_segmento_count} clientes` : 'Sem dados',
        },
        top_atividade: {
          value: m.top_atividade_nome || 'N/A',
          subtitle: m.top_atividade_count ? `${m.top_atividade_count} clientes` : 'Sem dados',
        },
        active_clients: {
          value: String(newClientsCount || 0),
          subtitle: 'Cadastrados nos últimos 30 dias',
        },
        open_deals: {
          value: String(m.open_deals_count || 0),
          subtitle: `R$ ${((m.open_deals_value || 0) / 1000).toFixed(0)}k em valor`,
        },
      } as Record<string, { value: string; subtitle: string }>;
    },
  });

  const savePreferences = useMutation({
    mutationFn: async (cards: UserCardPreference[]) => {
      if (!user) return;
      // Delete existing
      await supabase.from('user_dashboard_cards').delete().eq('user_id', user.id);
      // Insert new
      const rows = cards.map((c) => ({
        user_id: user.id,
        card_key: c.card_key,
        position: c.position,
        enabled: c.enabled,
      }));
      const { error } = await supabase.from('user_dashboard_cards').insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-cards-prefs'] });
    },
  });

  return {
    activeCards,
    allPreferences: preferences || DEFAULT_CARDS,
    metrics: metrics || {},
    isLoading: prefsLoading || metricsLoading,
    savePreferences: savePreferences.mutateAsync,
    isSaving: savePreferences.isPending,
  };
}
