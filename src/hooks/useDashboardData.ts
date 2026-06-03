import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MetricType } from '@/types/dashboard';
import { formatCurrency } from '@/lib/formatters';
import { useAuth } from '@/hooks/useAuth';

const stageLabels: Record<string, string> = {
  prospeccao: 'Prospecção',
  qualificacao: 'Qualificação',
  proposta: 'Proposta',
  negociacao: 'Negociação',
  fechado_ganho: 'Fechado (Ganho)',
  fechado_perdido: 'Fechado (Perdido)',
};

const taskStatusLabels: Record<string, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em Andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
};

const taskPriorityLabels: Record<string, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  urgente: 'Urgente',
};

const proposalStatusLabels: Record<string, string> = {
  rascunho: 'Rascunho',
  enviada: 'Enviada',
  em_analise: 'Em Análise',
  aprovada: 'Aprovada',
  recusada: 'Recusada',
  expirada: 'Expirada',
};

const orderStatusLabels: Record<string, string> = {
  pendente: 'Pendente',
  em_producao: 'Em Produção',
  produzido: 'Produzido',
  faturado: 'Faturado',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};

export interface MetricData {
  value?: number | string;
  subtitle?: string;
  chartData?: Array<{ name: string; value: number; count?: number }>;
  trend?: 'up' | 'down' | 'neutral';
}

/**
 * @param filterUserId - The user ID to filter data by. 
 *   If 'all', no user filter is applied (admin view).
 *   If undefined/null, defaults to current user.
 */
export function useDashboardData(filterUserId?: string | null) {
  const { user } = useAuth();
  
  // Determine effective filter: default to current user
  const effectiveUserId = filterUserId === 'all' ? null : (filterUserId || user?.id || null);

  // Fetch sales pipeline IDs to filter commercial metrics
  const { data: salesPipelineIds } = useQuery({
    queryKey: ['dashboard-sales-pipeline-ids'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pipelines')
        .select('id')
        .eq('type', 'sales')
        .eq('is_active', true);
      if (error) throw error;
      return data?.map(p => p.id) || [];
    },
  });

  // Janela de 12 meses para listagens de apoio do dashboard
  const since12mIso = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();

  const { data: deals } = useQuery({
    queryKey: ['dashboard-deals', effectiveUserId, salesPipelineIds, since12mIso],
    queryFn: async () => {
      let query = supabase
        .from('deals')
        .select('stage,value,pipeline_id,created_at,owner_id')
        .gte('created_at', since12mIso)
        .order('created_at', { ascending: false })
        .limit(5000);

      if (effectiveUserId) {
        query = query.eq('owner_id', effectiveUserId);
      }
      if (salesPipelineIds && salesPipelineIds.length > 0) {
        query = query.in('pipeline_id', salesPipelineIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && !!salesPipelineIds,
    staleTime: 5 * 60 * 1000,
  });

  const { data: tasks } = useQuery({
    queryKey: ['dashboard-tasks', effectiveUserId, since12mIso],
    queryFn: async () => {
      let query = supabase
        .from('tasks')
        .select('status,priority,assigned_to')
        .gte('created_at', since12mIso)
        .limit(5000);

      if (effectiveUserId) {
        query = query.eq('assigned_to', effectiveUserId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  const { data: companiesCount } = useQuery({
    queryKey: ['dashboard-companies-count', effectiveUserId],
    queryFn: async () => {
      let query = supabase.from('companies').select('*', { count: 'exact', head: true });
      if (effectiveUserId) {
        query = query.eq('owner_id', effectiveUserId);
      }
      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  const { data: contactsCount } = useQuery({
    queryKey: ['dashboard-contacts-count', effectiveUserId],
    queryFn: async () => {
      let query = supabase.from('contacts').select('*', { count: 'exact', head: true });
      if (effectiveUserId) {
        query = query.eq('owner_id', effectiveUserId);
      }
      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  const { data: proposals } = useQuery({
    queryKey: ['dashboard-proposals', effectiveUserId, since12mIso],
    queryFn: async () => {
      let query = supabase
        .from('proposals')
        .select('status,created_by')
        .gte('created_at', since12mIso)
        .limit(5000);

      if (effectiveUserId) {
        query = query.eq('created_by', effectiveUserId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  const { data: orders } = useQuery({
    queryKey: ['dashboard-orders', effectiveUserId, since12mIso],
    queryFn: async () => {
      let query = supabase
        .from('orders')
        .select('status,total_value,created_at,created_by')
        .gte('created_at', since12mIso)
        .limit(5000);

      if (effectiveUserId) {
        query = query.eq('created_by', effectiveUserId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  // WhatsApp desativado (auditoria perf 2026-05) — não consulta whatsapp_messages
  const whatsappMessages = 0;

  const { data: productsCount } = useQuery({
    queryKey: ['dashboard-products-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('active', true);
      if (error) throw error;
      return count || 0;
    },
    staleTime: 10 * 60 * 1000,
  });

  // Top produtos agregado no servidor — evita baixar a tabela order_items inteira
  const { data: topProducts } = useQuery({
    queryKey: ['dashboard-top-products'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('dashboard_top_products', { p_limit: 5 });
      if (error) throw error;
      return (data as Array<{ name: string; total_quantity: number }>) || [];
    },
    staleTime: 5 * 60 * 1000,
  });


  const getMetricData = (metricType: MetricType): MetricData => {
    const wonDeals = deals?.filter((d) => d.stage === 'fechado_ganho') || [];
    const lostDeals = deals?.filter((d) => d.stage === 'fechado_perdido') || [];
    const activeDeals = deals?.filter((d) => !['fechado_ganho', 'fechado_perdido'].includes(d.stage)) || [];

    switch (metricType) {
      case 'pipeline_total': {
        const value = activeDeals.reduce((sum, d) => sum + (d.value || 0), 0);
        return { value: formatCurrency(value), subtitle: `${activeDeals.length} negócios ativos` };
      }
      case 'deals_won': {
        const value = wonDeals.reduce((sum, d) => sum + (d.value || 0), 0);
        return { value: formatCurrency(value), subtitle: `${wonDeals.length} negócios fechados`, trend: 'up' };
      }
      case 'deals_lost': {
        return { value: lostDeals.length, subtitle: 'negócios perdidos', trend: 'down' };
      }
      case 'win_rate': {
        const total = wonDeals.length + lostDeals.length;
        const rate = total > 0 ? Math.round((wonDeals.length / total) * 100) : 0;
        return { value: `${rate}%`, subtitle: `${wonDeals.length}/${total} finalizados` };
      }
      case 'deals_by_stage': {
        const chartData = Object.entries(stageLabels).map(([stage, label]) => {
          const stageDeals = deals?.filter((d) => d.stage === stage) || [];
          return { name: label, value: stageDeals.reduce((sum, d) => sum + (d.value || 0), 0), count: stageDeals.length };
        });
        return { chartData };
      }
      case 'deals_by_month': {
        const months: Record<string, { name: string; created: number; won: number; value: number }> = {};
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
          const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          months[key] = { name: date.toLocaleDateString('pt-BR', { month: 'short' }), created: 0, won: 0, value: 0 };
        }
        deals?.forEach((deal) => {
          const date = new Date(deal.created_at);
          const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          if (months[key]) {
            months[key].created++;
            if (deal.stage === 'fechado_ganho') {
              months[key].won++;
              months[key].value += deal.value || 0;
            }
          }
        });
        return { chartData: Object.values(months).map((m) => ({ name: m.name, value: m.created, count: m.won })) };
      }
      case 'tasks_completion': {
        const completed = tasks?.filter((t) => t.status === 'concluida').length || 0;
        const total = tasks?.length || 0;
        const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
        return { value: `${rate}%`, subtitle: `${completed} de ${total} tarefas` };
      }
      case 'tasks_by_status': {
        const chartData = Object.entries(taskStatusLabels).map(([status, label]) => ({
          name: label,
          value: tasks?.filter((t) => t.status === status).length || 0,
        }));
        return { chartData };
      }
      case 'tasks_by_priority': {
        const chartData = Object.entries(taskPriorityLabels).map(([priority, label]) => ({
          name: label,
          value: tasks?.filter((t) => t.priority === priority).length || 0,
        }));
        return { chartData };
      }
      case 'companies_count':
        return { value: companiesCount || 0, subtitle: 'empresas cadastradas' };
      case 'contacts_count':
        return { value: contactsCount || 0, subtitle: 'contatos cadastrados' };
      case 'proposals_sent': {
        const sent = proposals?.filter((p) => p.status !== 'rascunho').length || 0;
        return { value: sent, subtitle: 'propostas enviadas' };
      }
      case 'proposals_approved': {
        const approved = proposals?.filter((p) => p.status === 'aprovada').length || 0;
        return { value: approved, subtitle: 'propostas aprovadas', trend: 'up' };
      }
      case 'proposals_conversion': {
        const sent = proposals?.filter((p) => p.status !== 'rascunho').length || 0;
        const approved = proposals?.filter((p) => p.status === 'aprovada').length || 0;
        const rate = sent > 0 ? Math.round((approved / sent) * 100) : 0;
        return { value: `${rate}%`, subtitle: `${approved}/${sent} aprovadas` };
      }
      case 'proposals_by_status': {
        const chartData = Object.entries(proposalStatusLabels).map(([status, label]) => ({
          name: label,
          value: proposals?.filter((p) => p.status === status).length || 0,
        }));
        return { chartData };
      }
      case 'orders_pending': {
        const pending = orders?.filter((o) => o.status === 'pendente').length || 0;
        return { value: pending, subtitle: 'pedidos pendentes' };
      }
      case 'orders_by_status': {
        const chartData = Object.entries(orderStatusLabels).map(([status, label]) => ({
          name: label,
          value: orders?.filter((o) => o.status === status).length || 0,
        }));
        return { chartData };
      }
      case 'orders_value': {
        const value = orders?.reduce((sum, o) => sum + (o.total_value || 0), 0) || 0;
        return { value: formatCurrency(value), subtitle: `${orders?.length || 0} pedidos` };
      }
      case 'orders_by_month': {
        const months: Record<string, { name: string; count: number; value: number }> = {};
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
          const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          months[key] = { name: date.toLocaleDateString('pt-BR', { month: 'short' }), count: 0, value: 0 };
        }
        orders?.forEach((order) => {
          const date = new Date(order.created_at);
          const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          if (months[key]) {
            months[key].count++;
            months[key].value += order.total_value || 0;
          }
        });
        return { chartData: Object.values(months).map((m) => ({ name: m.name, value: m.count })) };
      }
      case 'whatsapp_messages':
        return { value: whatsappMessages || 0, subtitle: 'mensagens total' };
      case 'whatsapp_conversations': {
        return { value: '-', subtitle: 'conversas ativas' };
      }
      case 'products_count':
        return { value: productsCount || 0, subtitle: 'produtos ativos' };
      case 'top_products': {
        const productCounts: Record<string, { name: string; count: number }> = {};
        orderItems?.forEach((item) => {
          const name = item.product?.name || item.description;
          if (!productCounts[name]) productCounts[name] = { name, count: 0 };
          productCounts[name].count += item.quantity;
        });
        const sorted = Object.values(productCounts).sort((a, b) => b.count - a.count).slice(0, 5);
        return { chartData: sorted.map((p) => ({ name: p.name, value: p.count })) };
      }
      default:
        return { value: '-' };
    }
  };

  return { getMetricData };
}
