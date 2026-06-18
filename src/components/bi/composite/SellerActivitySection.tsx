import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CheckCircle2,
  AlertTriangle,
  CalendarClock,
  ListChecks,
  Activity,
  Hourglass,
  FileWarning,
  UserX,
  RefreshCw,
  ArrowRightLeft,
  FileText,
  ShoppingCart,
  Mail,
  StickyNote,
  RefreshCcw,
  Award,
  Gauge,
  Target,
  Trophy,
  Percent,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { ExecutiveSection } from './ExecutiveSection';
import { ExecutiveKpiGrid, KpiItem } from './ExecutiveKpiGrid';

interface Props {
  sellerId: string;
  startDate: Date;
  endDate: Date;
  legalEntityId?: string | null;
}

interface ProductivityRow {
  seller_id: string;
  seller_name: string;
  total_interactions: number;
  interaction_score: number;
  rank_position: number;
  participation_percent: number;
  efficiency_rate: number;
  proposal_conversion_rate: number;
  pipeline_conversion_rate: number;
  activities: number;
  tasks_created: number;
  tasks_completed: number;
  stage_changes: number;
  proposals: number;
  orders: number;
  notes: number;
  emails: number;
  deal_updates: number;
}

type ProductivityRpcName = 'get_seller_productivity' | 'get_sales_rep_productivity';
type PendenciasReport = {
  kpis?: Partial<Record<
    | 'tarefas_atrasadas'
    | 'tarefas_proximas_7d'
    | 'negocios_parados_14d'
    | 'negocios_parados_30d'
    | 'propostas_sem_retorno_7d'
    | 'clientes_sem_proxima_acao',
    number
  >> & { ultima_atividade?: string | null };
};

const toPendenciasReport = (value: Database['public']['Functions']['report_atividades_vendedor']['Returns']): PendenciasReport =>
  (value && typeof value === 'object' && !Array.isArray(value) ? value : {}) as PendenciasReport;

export function SellerActivitySection({ sellerId, startDate, endDate, legalEntityId }: Props) {
  const queryClient = useQueryClient();

  // ===== Fonte 1: Produtividade (mesma chamada/lista do relatório "Detalhamento por Tipo de Interação")
  const prodKey = ['seller-360-productivity', sellerId, startDate, endDate];
  const productivity = useQuery({
    queryKey: prodKey,
    enabled: !!sellerId,
    queryFn: async () => {
      const { data: links, error: linkError } = await supabase
        .from('user_sales_reps')
        .select('user_id')
        .eq('sales_rep_id', sellerId)
        .limit(1);
      if (linkError) throw linkError;

      const linkedUserId = links?.[0]?.user_id ?? null;
      const rpcName: ProductivityRpcName = linkedUserId ? 'get_seller_productivity' : 'get_sales_rep_productivity';
      const { data, error } = await supabase.rpc(rpcName, {
        p_start_date: startDate.toISOString(),
        p_end_date: endDate.toISOString(),
      });
      if (error) throw error;
      const rows = (data ?? []) as unknown as ProductivityRow[];
      return rows.find((r) => r.seller_id === (linkedUserId ?? sellerId)) ?? null;
    },
    staleTime: 60 * 1000,
  });

  // ===== Fonte 2: Pendências (RPC legada) — tarefas atrasadas, propostas sem retorno, etc.
  const pendKey = ['seller-360-pendencias', sellerId, startDate, endDate, legalEntityId];
  const pendencias = useQuery({
    queryKey: pendKey,
    enabled: !!sellerId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('report_atividades_vendedor', {
        p_sales_rep_id: sellerId,
        p_start_date: format(startDate, 'yyyy-MM-dd'),
        p_end_date: format(endDate, 'yyyy-MM-dd'),
        p_legal_entity_id: legalEntityId || null,
      });
      if (error) {
        console.warn('[SellerActivitySection] pendências RPC error:', error.message);
        throw error;
      }
      return toPendenciasReport(data);
    },
    staleTime: 60 * 1000,
  });

  const p = productivity.data;
  const pk = pendencias.data?.kpis ?? {};

  const isLoading = productivity.isLoading || pendencias.isLoading;
  const error = productivity.error ?? pendencias.error;
  const isEmpty = !p && Object.keys(pk).length === 0;

  // === Bloco "Produção" (fonte: get_sales_rep_productivity) ===
  const producao: KpiItem[] = [
    { key: 'act', label: 'Atividades', value: p?.activities ?? 0, format: 'number', icon: Activity, tone: 'primary' },
    { key: 'tcrit', label: 'Tarefas criadas', value: p?.tasks_created ?? 0, format: 'number', icon: ListChecks, tone: 'secondary' },
    { key: 'tconc', label: 'Tarefas concluídas', value: p?.tasks_completed ?? 0, format: 'number', icon: CheckCircle2, tone: 'success' },
    { key: 'stage', label: 'Mudanças de etapa', value: p?.stage_changes ?? 0, format: 'number', icon: ArrowRightLeft, tone: 'primary' },
    { key: 'prop', label: 'Propostas', value: p?.proposals ?? 0, format: 'number', icon: FileText, tone: 'secondary' },
    { key: 'ord', label: 'Pedidos', value: p?.orders ?? 0, format: 'number', icon: ShoppingCart, tone: 'success' },
    { key: 'dupd', label: 'Atualiz. negócios', value: p?.deal_updates ?? 0, format: 'number', icon: RefreshCcw, tone: 'primary' },
    { key: 'mail', label: 'E-mails', value: p?.emails ?? 0, format: 'number', icon: Mail, tone: 'neutral' },
    { key: 'note', label: 'Observações', value: p?.notes ?? 0, format: 'number', icon: StickyNote, tone: 'neutral' },
    { key: 'score', label: 'Score', value: p?.interaction_score ?? 0, format: 'number', icon: Award, tone: 'warning' },
  ];

  // === Bloco "Performance" (mesma fonte) ===
  const performance: KpiItem[] = [
    { key: 'rank', label: 'Posição no ranking', value: p?.rank_position ? `${p.rank_position}º` : '—', format: 'text', icon: Trophy, tone: 'warning' },
    { key: 'part', label: 'Participação do time', value: p?.participation_percent ?? 0, format: 'percent', icon: Percent, tone: 'secondary' },
    { key: 'eff', label: 'Eficiência', value: p?.efficiency_rate ?? 0, format: 'percent', icon: Gauge, tone: 'success' },
    { key: 'cprop', label: 'Conv. Proposta', value: p?.proposal_conversion_rate ?? 0, format: 'percent', icon: Target, tone: 'primary' },
    { key: 'cpipe', label: 'Conv. Pipeline', value: p?.pipeline_conversion_rate ?? 0, format: 'percent', icon: Target, tone: 'primary' },
  ];

  // === Bloco "Pendências" (fonte: report_atividades_vendedor) ===
  const pendKpis: KpiItem[] = [
    { key: 'atr', label: 'Tarefas atrasadas', value: pk.tarefas_atrasadas ?? 0, format: 'number', icon: AlertTriangle, tone: 'danger' },
    { key: 'prox', label: 'Próximas 7 dias', value: pk.tarefas_proximas_7d ?? 0, format: 'number', icon: CalendarClock, tone: 'primary' },
    { key: 'p14', label: 'Negócios parados 14d', value: pk.negocios_parados_14d ?? 0, format: 'number', icon: Hourglass, tone: 'warning' },
    { key: 'p30', label: 'Negócios parados 30d', value: pk.negocios_parados_30d ?? 0, format: 'number', icon: Hourglass, tone: 'warning' },
    { key: 'sret', label: 'Propostas sem retorno (7d)', value: pk.propostas_sem_retorno_7d ?? 0, format: 'number', icon: FileWarning, tone: 'danger' },
    { key: 'csa', label: 'Clientes sem próxima ação', value: pk.clientes_sem_proxima_acao ?? 0, format: 'number', icon: UserX, tone: 'warning' },
  ];

  const ultima = pk.ultima_atividade
    ? format(new Date(pk.ultima_atividade), "dd 'de' MMM 'às' HH:mm", { locale: ptBR })
    : '—';

  return (
    <ExecutiveSection
      title="Atividades / Uso do CRM"
      description={`Última atividade registrada: ${ultima} · Mesma base do relatório de Produtividade.`}
      isLoading={isLoading}
      error={error}
      errorMessage="Não foi possível carregar as atividades deste vendedor para o filtro selecionado."
      errorAction={
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: prodKey });
            queryClient.invalidateQueries({ queryKey: pendKey });
          }}
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Tentar novamente
        </Button>
      }
      isEmpty={isEmpty}
      emptyMessage="Nenhuma atividade encontrada para o vendedor no período/entidade."
    >
      <div className="space-y-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-[#64748B] mb-2">Produção</div>
          <ExecutiveKpiGrid items={producao} columns={5} />
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-[#64748B] mb-2">Performance</div>
          <ExecutiveKpiGrid items={performance} columns={5} />
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-[#64748B] mb-2">Pendências</div>
          <ExecutiveKpiGrid items={pendKpis} columns={3} />
        </div>
      </div>
    </ExecutiveSection>
  );
}
