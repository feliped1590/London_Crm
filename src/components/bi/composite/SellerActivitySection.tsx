import { useQuery } from '@tanstack/react-query';
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
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ExecutiveSection } from './ExecutiveSection';
import { ExecutiveKpiGrid, KpiItem } from './ExecutiveKpiGrid';

interface Props {
  sellerId: string;
  startDate: Date;
  endDate: Date;
  legalEntityId?: string | null;
}

export function SellerActivitySection({ sellerId, startDate, endDate, legalEntityId }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['report-atividades-vendedor', sellerId, startDate, endDate, legalEntityId],
    enabled: !!sellerId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('report_atividades_vendedor' as any, {
        p_sales_rep_id: sellerId,
        p_start_date: format(startDate, 'yyyy-MM-dd'),
        p_end_date: format(endDate, 'yyyy-MM-dd'),
        p_legal_entity_id: legalEntityId || null,
      });
      if (error) throw error;
      return data as any;
    },
    staleTime: 60 * 1000,
  });

  const k = data?.kpis ?? {};
  const isEmpty = !!data?.empty || Object.keys(k).length === 0;

  const items: KpiItem[] = [
    { key: 'crit', label: 'Tarefas criadas', value: k.tarefas_criadas, format: 'number', icon: ListChecks },
    { key: 'conc', label: 'Tarefas concluídas', value: k.tarefas_concluidas, format: 'number', icon: CheckCircle2 },
    { key: 'atr', label: 'Tarefas atrasadas', value: k.tarefas_atrasadas, format: 'number', icon: AlertTriangle },
    { key: 'prox', label: 'Próximas (7 dias)', value: k.tarefas_proximas_7d, format: 'number', icon: CalendarClock },
    { key: 'inter', label: 'Interações registradas', value: k.interacoes, format: 'number', icon: Activity },
    { key: 'p14', label: 'Negócios parados 14d', value: k.negocios_parados_14d, format: 'number', icon: Hourglass },
    { key: 'p30', label: 'Negócios parados 30d', value: k.negocios_parados_30d, format: 'number', icon: Hourglass },
    { key: 'sret', label: 'Propostas sem retorno (7d)', value: k.propostas_sem_retorno_7d, format: 'number', icon: FileWarning },
    { key: 'csa', label: 'Clientes sem próxima ação', value: k.clientes_sem_proxima_acao, format: 'number', icon: UserX },
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
      isEmpty={isEmpty}
      emptyMessage="Nenhuma atividade encontrada para o vendedor no período/entidade."
    >
      <ExecutiveKpiGrid items={items} columns={3} />
    </ExecutiveSection>
  );
}
