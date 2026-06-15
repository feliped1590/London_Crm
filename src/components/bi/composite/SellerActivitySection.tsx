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
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ExecutiveSection } from './ExecutiveSection';
import { ExecutiveKpiGrid, KpiItem } from './ExecutiveKpiGrid';

interface Props {
  sellerId: string;
  startDate: Date;
  endDate: Date;
  legalEntityId?: string | null;
}

export function SellerActivitySection({ sellerId, startDate, endDate, legalEntityId }: Props) {
  const queryClient = useQueryClient();
  const queryKey = ['report-atividades-vendedor', sellerId, startDate, endDate, legalEntityId];

  const { data, isLoading, error } = useQuery({
    queryKey,
    enabled: !!sellerId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('report_atividades_vendedor' as any, {
        p_sales_rep_id: sellerId,
        p_start_date: format(startDate, 'yyyy-MM-dd'),
        p_end_date: format(endDate, 'yyyy-MM-dd'),
        p_legal_entity_id: legalEntityId || null,
      });
      if (error) {
        console.warn('[SellerActivitySection] RPC error:', error.message);
        throw error;
      }
      return data as any;
    },
    staleTime: 60 * 1000,
  });

  const k = data?.kpis ?? {};
  const isEmpty = !!data?.empty || Object.keys(k).length === 0;

  const items: KpiItem[] = [
    { key: 'crit', label: 'Tarefas criadas', value: k.tarefas_criadas, format: 'number', icon: ListChecks, tone: 'secondary' },
    { key: 'conc', label: 'Tarefas concluídas', value: k.tarefas_concluidas, format: 'number', icon: CheckCircle2, tone: 'success' },
    { key: 'atr', label: 'Tarefas atrasadas', value: k.tarefas_atrasadas, format: 'number', icon: AlertTriangle, tone: 'danger' },
    { key: 'prox', label: 'Próximas (7 dias)', value: k.tarefas_proximas_7d, format: 'number', icon: CalendarClock, tone: 'primary' },
    { key: 'inter', label: 'Interações registradas', value: k.interacoes, format: 'number', icon: Activity, tone: 'primary' },
    { key: 'p14', label: 'Negócios parados 14d', value: k.negocios_parados_14d, format: 'number', icon: Hourglass, tone: 'warning' },
    { key: 'p30', label: 'Negócios parados 30d', value: k.negocios_parados_30d, format: 'number', icon: Hourglass, tone: 'warning' },
    { key: 'sret', label: 'Propostas sem retorno (7d)', value: k.propostas_sem_retorno_7d, format: 'number', icon: FileWarning, tone: 'danger' },
    { key: 'csa', label: 'Clientes sem próxima ação', value: k.clientes_sem_proxima_acao, format: 'number', icon: UserX, tone: 'warning' },
  ];

  const ultima = k.ultima_atividade
    ? format(new Date(k.ultima_atividade), "dd 'de' MMM 'às' HH:mm", { locale: ptBR })
    : '—';

  return (
    <ExecutiveSection
      title="Atividades / Uso do CRM"
      description={`Última atividade registrada: ${ultima}`}
      isLoading={isLoading}
      error={error as any}
      errorMessage="Não foi possível carregar as atividades deste vendedor para o filtro selecionado."
      errorAction={
        <Button
          variant="outline"
          size="sm"
          onClick={() => queryClient.invalidateQueries({ queryKey })}
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Tentar novamente
        </Button>
      }
      isEmpty={isEmpty}
      emptyMessage="Nenhuma atividade encontrada para o vendedor no período/entidade."
    >
      <ExecutiveKpiGrid items={items} columns={3} />
    </ExecutiveSection>
  );
}
