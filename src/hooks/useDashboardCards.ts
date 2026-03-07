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
  { key: 'active_clients', label: 'Clientes ativos (30 dias)', icon: 'TrendingUp' },
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

  // Fetch metrics data
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['dashboard-cards-metrics'],
    queryFn: async () => {
      const [totalRes, setorRes, segmentoRes, atividadeRes, activeRes, dealsRes] = await Promise.all([
        supabase.from('companies').select('id', { count: 'exact', head: true }),
        supabase.from('companies').select('setor_id, setores!companies_setor_id_fkey(nome)').not('setor_id', 'is', null),
        supabase.from('companies').select('segmento_id, segmentos!companies_segmento_id_fkey(nome)').not('segmento_id', 'is', null),
        supabase.from('companies').select('atividade_id, atividades!companies_atividade_id_fkey(nome)').not('atividade_id', 'is', null),
        supabase.from('companies').select('id', { count: 'exact', head: true }).gte('updated_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
        supabase.from('deals').select('id, value', { count: 'exact' }).not('stage', 'in', '(fechado_ganho,fechado_perdido)'),
      ]);

      // Count by setor
      const setorCounts: Record<string, number> = {};
      (setorRes.data || []).forEach((r: any) => {
        const nome = r.setores?.nome;
        if (nome) setorCounts[nome] = (setorCounts[nome] || 0) + 1;
      });
      const topSetor = Object.entries(setorCounts).sort((a, b) => b[1] - a[1])[0];

      // Count by segmento
      const segCounts: Record<string, number> = {};
      (segmentoRes.data || []).forEach((r: any) => {
        const nome = r.segmentos?.nome;
        if (nome) segCounts[nome] = (segCounts[nome] || 0) + 1;
      });
      const topSegmento = Object.entries(segCounts).sort((a, b) => b[1] - a[1])[0];

      // Count by atividade
      const atiCounts: Record<string, number> = {};
      (atividadeRes.data || []).forEach((r: any) => {
        const nome = r.atividades?.nome;
        if (nome) atiCounts[nome] = (atiCounts[nome] || 0) + 1;
      });
      const topAtividade = Object.entries(atiCounts).sort((a, b) => b[1] - a[1])[0];

      const dealsValue = (dealsRes.data || []).reduce((sum: number, d: any) => sum + (d.value || 0), 0);

      return {
        total_clients: {
          value: String(totalRes.count || 0),
          subtitle: `${Object.keys(setorCounts).length} setores cadastrados`,
        },
        top_setor: {
          value: topSetor ? topSetor[0] : 'N/A',
          subtitle: topSetor ? `${topSetor[1]} clientes` : 'Sem dados',
        },
        top_segmento: {
          value: topSegmento ? topSegmento[0] : 'N/A',
          subtitle: topSegmento ? `${topSegmento[1]} clientes` : 'Sem dados',
        },
        top_atividade: {
          value: topAtividade ? topAtividade[0] : 'N/A',
          subtitle: topAtividade ? `${topAtividade[1]} clientes` : 'Sem dados',
        },
        active_clients: {
          value: String(activeRes.count || 0),
          subtitle: 'Últimos 30 dias',
        },
        open_deals: {
          value: String(dealsRes.count || 0),
          subtitle: `R$ ${(dealsValue / 1000).toFixed(0)}k em valor`,
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
