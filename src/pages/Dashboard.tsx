import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { 
  Building2, 
  Users, 
  Target, 
  CheckSquare, 
  TrendingUp, 
  DollarSign,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  FileText,
  ShoppingCart
} from 'lucide-react';
import { DashboardStats, Task, Deal } from '@/types/crm';
import { formatCurrency } from '@/lib/formatters';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { InsightsSummary } from '@/components/insights/InsightsSummary';

interface ExtendedDashboardStats extends DashboardStats {
  pendingProposals: number;
  pendingProposalsValue: number;
  pendingOrders: number;
  pendingOrdersValue: number;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<ExtendedDashboardStats | null>(null);
  const [recentDeals, setRecentDeals] = useState<Deal[]>([]);
  const [upcomingTasks, setUpcomingTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      // Fetch all data in parallel
      const [
        { count: totalDeals },
        { count: totalContacts },
        { count: totalCompanies },
        { data: deals },
        { data: tasks },
        { data: pendingProposals },
        { data: pendingOrders }
      ] = await Promise.all([
        supabase.from('deals').select('*', { count: 'exact', head: true }),
        supabase.from('contacts').select('*', { count: 'exact', head: true }),
        supabase.from('companies').select('*', { count: 'exact', head: true }),
        supabase.from('deals').select('*').order('created_at', { ascending: false }).limit(5),
        supabase.from('tasks')
          .select('*, company:companies(*), contact:contacts(*), deal:deals(*)')
          .in('status', ['pendente', 'em_andamento'])
          .order('due_date', { ascending: true })
          .limit(5),
        supabase.from('proposals')
          .select('total_value')
          .in('status', ['rascunho', 'enviada', 'em_analise']),
        supabase.from('orders')
          .select('total_value')
          .in('status', ['pendente', 'em_producao'])
      ]);

      // Calculate stats from deals
      const allDeals = deals || [];
      const wonDeals = allDeals.filter(d => d.stage === 'fechado_ganho');
      const openDeals = allDeals.filter(d => !['fechado_ganho', 'fechado_perdido'].includes(d.stage));
      
      const totalValue = allDeals.reduce((sum, d) => sum + Number(d.value || 0), 0);
      const wonValue = wonDeals.reduce((sum, d) => sum + Number(d.value || 0), 0);
      const openValue = openDeals.reduce((sum, d) => sum + Number(d.value || 0), 0);

      // Get pending and overdue tasks count
      const now = new Date().toISOString();
      const pendingTasksCount = (tasks || []).filter(t => t.status === 'pendente').length;
      const overdueTasks = (tasks || []).filter(t => t.due_date && t.due_date < now && t.status !== 'concluida').length;

      // Calculate proposals and orders stats
      const pendingProposalsList = pendingProposals || [];
      const pendingOrdersList = pendingOrders || [];

      setStats({
        totalDeals: totalDeals || 0,
        totalValue,
        wonDeals: wonDeals.length,
        wonValue,
        openDeals: openDeals.length,
        openValue,
        conversionRate: totalDeals ? (wonDeals.length / (totalDeals || 1)) * 100 : 0,
        avgDealValue: totalDeals ? totalValue / (totalDeals || 1) : 0,
        totalContacts: totalContacts || 0,
        totalCompanies: totalCompanies || 0,
        pendingTasks: pendingTasksCount,
        overdueTasks,
        pendingProposals: pendingProposalsList.length,
        pendingProposalsValue: pendingProposalsList.reduce((sum, p) => sum + Number(p.total_value || 0), 0),
        pendingOrders: pendingOrdersList.length,
        pendingOrdersValue: pendingOrdersList.reduce((sum, o) => sum + Number(o.total_value || 0), 0),
      });

      setRecentDeals(allDeals as Deal[]);
      setUpcomingTasks((tasks || []) as Task[]);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ 
    title, 
    value, 
    icon: Icon, 
    description, 
    trend,
    href 
  }: { 
    title: string; 
    value: string | number; 
    icon: React.ElementType; 
    description?: string;
    trend?: 'up' | 'down' | null;
    href?: string;
  }) => (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
            {trend === 'up' && <ArrowUpRight className="h-3 w-3 text-success" />}
            {trend === 'down' && <ArrowDownRight className="h-3 w-3 text-destructive" />}
            {description}
          </p>
        )}
        {href && (
          <Link to={href} className="text-xs text-primary hover:underline mt-2 inline-block">
            Ver todos →
          </Link>
        )}
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const getStageLabel = (stage: string) => {
    const labels: Record<string, string> = {
      prospeccao: 'Prospecção',
      qualificacao: 'Qualificação',
      proposta: 'Proposta',
      negociacao: 'Negociação',
      fechado_ganho: 'Ganho',
      fechado_perdido: 'Perdido'
    };
    return labels[stage] || stage;
  };

  const getStageColor = (stage: string) => {
    const colors: Record<string, string> = {
      prospeccao: 'bg-stage-prospeccao',
      qualificacao: 'bg-stage-qualificacao',
      proposta: 'bg-stage-proposta',
      negociacao: 'bg-stage-negociacao',
      fechado_ganho: 'bg-stage-ganho',
      fechado_perdido: 'bg-stage-perdido'
    };
    return colors[stage] || 'bg-muted';
  };

  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      baixa: 'secondary',
      media: 'default',
      alta: 'destructive',
      urgente: 'destructive'
    };
    const labels: Record<string, string> = {
      baixa: 'Baixa',
      media: 'Média',
      alta: 'Alta',
      urgente: 'Urgente'
    };
    return <Badge variant={variants[priority] || 'default'}>{labels[priority] || priority}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral do seu funil de vendas</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          title="Total de Negócios" 
          value={stats?.totalDeals || 0} 
          icon={Target}
          href="/pipeline"
        />
        <StatCard 
          title="Valor Total" 
          value={formatCurrency(stats?.totalValue || 0)} 
          icon={DollarSign}
        />
        <StatCard 
          title="Contatos" 
          value={stats?.totalContacts || 0} 
          icon={Users}
          href="/contacts"
        />
        <StatCard 
          title="Empresas" 
          value={stats?.totalCompanies || 0} 
          icon={Building2}
          href="/companies"
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          title="Negócios Ganhos" 
          value={stats?.wonDeals || 0} 
          icon={TrendingUp}
          description={formatCurrency(stats?.wonValue || 0)}
          trend="up"
        />
        <StatCard 
          title="Negócios Abertos" 
          value={stats?.openDeals || 0} 
          icon={Target}
          description={formatCurrency(stats?.openValue || 0)}
        />
        <StatCard 
          title="Propostas Pendentes" 
          value={stats?.pendingProposals || 0} 
          icon={FileText}
          description={formatCurrency(stats?.pendingProposalsValue || 0)}
          href="/pipeline"
        />
        <StatCard 
          title="Pedidos em Produção" 
          value={stats?.pendingOrders || 0} 
          icon={ShoppingCart}
          description={formatCurrency(stats?.pendingOrdersValue || 0)}
          href="/orders"
        />
      </div>

      {/* Tasks Stats + Insights */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          title="Tarefas Pendentes" 
          value={stats?.pendingTasks || 0} 
          icon={CheckSquare}
          href="/tasks"
        />
        <StatCard 
          title="Tarefas Atrasadas" 
          value={stats?.overdueTasks || 0} 
          icon={AlertCircle}
          description={stats?.overdueTasks ? 'Atenção necessária' : 'Tudo em dia'}
          trend={stats?.overdueTasks ? 'down' : null}
        />
        <div className="lg:col-span-2">
          <InsightsSummary />
        </div>
      </div>

      {/* Recent Deals and Tasks */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent Deals */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Negócios Recentes</CardTitle>
            <CardDescription>Últimas oportunidades criadas</CardDescription>
          </CardHeader>
          <CardContent>
            {recentDeals.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Target className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Nenhum negócio ainda</p>
                <Link to="/pipeline" className="text-primary hover:underline text-sm">
                  Criar primeiro negócio →
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {recentDeals.map((deal) => (
                  <Link 
                    key={deal.id} 
                    to={`/pipeline?deal=${deal.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{deal.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(Number(deal.value))}
                      </p>
                    </div>
                    <Badge className={`${getStageColor(deal.stage)} text-white border-0`}>
                      {getStageLabel(deal.stage)}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Tasks */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Próximas Tarefas</CardTitle>
            <CardDescription>Atividades pendentes</CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingTasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Nenhuma tarefa pendente</p>
                <Link to="/tasks" className="text-primary hover:underline text-sm">
                  Criar primeira tarefa →
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingTasks.map((task) => (
                  <Link 
                    key={task.id} 
                    to={`/tasks?task=${task.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{task.title}</p>
                      {task.due_date && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(task.due_date).toLocaleDateString('pt-BR')}
                        </p>
                      )}
                    </div>
                    {getPriorityBadge(task.priority)}
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}