import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  CalendarCheck, 
  ShoppingCart, 
  Clock, 
  AlertTriangle,
  Users,
  Building2,
  TrendingUp,
  Package
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { differenceInDays, format, startOfDay, endOfDay, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DailyStats {
  tasksCompleted: number;
  tasksCreated: number;
  dealsUpdated: number;
  ordersCreated: number;
  emailsSent: number;
}

export function OperationalReportsTab() {
  const today = new Date();
  const todayStart = startOfDay(today).toISOString();
  const todayEnd = endOfDay(today).toISOString();

  // Daily tasks summary
  const { data: dailyTasks, isLoading: loadingTasks } = useQuery({
    queryKey: ['reports-daily-tasks', todayStart],
    queryFn: async () => {
      const [completed, created] = await Promise.all([
        supabase
          .from('tasks')
          .select('id, title, completed_at')
          .gte('completed_at', todayStart)
          .lte('completed_at', todayEnd),
        supabase
          .from('tasks')
          .select('id, title, created_at')
          .gte('created_at', todayStart)
          .lte('created_at', todayEnd),
      ]);
      
      return {
        completed: completed.data || [],
        created: created.data || [],
      };
    },
  });

  // Orders by status
  const { data: ordersByStatus, isLoading: loadingOrders } = useQuery({
    queryKey: ['reports-orders-status'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('id, number, status, total_value, company_id, created_at, companies(name)')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      const grouped = {
        pendente: [] as typeof data,
        em_producao: [] as typeof data,
        produzido: [] as typeof data,
        faturado: [] as typeof data,
        entregue: [] as typeof data,
        cancelado: [] as typeof data,
      };
      
      data?.forEach(order => {
        if (grouped[order.status as keyof typeof grouped]) {
          grouped[order.status as keyof typeof grouped].push(order);
        }
      });
      
      return grouped;
    },
  });

  // Stagnant deals (SLA)
  const { data: stagnantDeals, isLoading: loadingStagnant } = useQuery({
    queryKey: ['reports-stagnant-deals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deals')
        .select('id, name, stage, value, updated_at, companies(name), profiles!deals_owner_id_fkey(full_name)')
        .not('stage', 'in', '(fechado_ganho,fechado_perdido)')
        .order('updated_at', { ascending: true });
      
      if (error) throw error;
      
      const SLA_WARNING_DAYS = 5;
      const SLA_CRITICAL_DAYS = 7;
      
      return data?.filter(deal => {
        const daysInStage = differenceInDays(new Date(), new Date(deal.updated_at));
        return daysInStage >= SLA_WARNING_DAYS;
      }).map(deal => ({
        ...deal,
        daysInStage: differenceInDays(new Date(), new Date(deal.updated_at)),
        isCritical: differenceInDays(new Date(), new Date(deal.updated_at)) >= SLA_CRITICAL_DAYS,
      })) || [];
    },
  });

  // Today's activities summary
  const { data: todayActivities, isLoading: loadingActivities } = useQuery({
    queryKey: ['reports-today-activities', todayStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activities')
        .select('id, type, subject, created_at')
        .gte('created_at', todayStart)
        .lte('created_at', todayEnd)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  const statusLabels: Record<string, string> = {
    pendente: 'Pendentes',
    em_producao: 'Em Produção',
    produzido: 'Produzidos',
    faturado: 'Faturados',
    entregue: 'Entregues',
    cancelado: 'Cancelados',
  };

  const statusColors: Record<string, string> = {
    pendente: 'bg-yellow-500',
    em_producao: 'bg-blue-500',
    produzido: 'bg-purple-500',
    faturado: 'bg-green-500',
    entregue: 'bg-emerald-600',
    cancelado: 'bg-red-500',
  };

  const stageLabels: Record<string, string> = {
    prospeccao: 'Prospecção',
    qualificacao: 'Qualificação',
    proposta: 'Proposta',
    negociacao: 'Negociação',
  };

  return (
    <div className="space-y-6">
      {/* Daily Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-green-600" />
              Tarefas Hoje
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingTasks ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-green-600">
                  {dailyTasks?.completed.length || 0}
                </span>
                <span className="text-sm text-muted-foreground">
                  concluídas
                </span>
              </div>
            )}
            {!loadingTasks && (
              <p className="text-xs text-muted-foreground mt-1">
                {dailyTasks?.created.length || 0} criadas hoje
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-blue-600" />
              Pedidos Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingOrders ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-blue-600">
                  {ordersByStatus?.pendente.length || 0}
                </span>
                <span className="text-sm text-muted-foreground">
                  aguardando
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Package className="h-4 w-4 text-purple-600" />
              Em Produção
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingOrders ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-purple-600">
                  {ordersByStatus?.em_producao.length || 0}
                </span>
                <span className="text-sm text-muted-foreground">
                  pedidos
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              Negócios Parados
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingStagnant ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-red-600">
                  {stagnantDeals?.filter(d => d.isCritical).length || 0}
                </span>
                <span className="text-sm text-muted-foreground">
                  críticos
                </span>
              </div>
            )}
            {!loadingStagnant && (
              <p className="text-xs text-muted-foreground mt-1">
                {stagnantDeals?.length || 0} total em alerta
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Orders by Status Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Pedidos por Status
          </CardTitle>
          <CardDescription>
            Visão geral de todos os pedidos agrupados por situação
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingOrders ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(ordersByStatus || {}).map(([status, orders]) => (
                <div
                  key={status}
                  className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-3 h-3 rounded-full ${statusColors[status]}`} />
                    <span className="font-medium">{statusLabels[status]}</span>
                  </div>
                  <div className="text-2xl font-bold">{orders.length}</div>
                  <div className="text-sm text-muted-foreground">
                    {formatCurrency(orders.reduce((sum, o) => sum + (o.total_value || 0), 0))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stagnant Deals (SLA Breach) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Negócios Parados (SLA)
          </CardTitle>
          <CardDescription>
            Negócios com mais de 5 dias sem atualização na etapa atual
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingStagnant ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : stagnantDeals && stagnantDeals.length > 0 ? (
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {stagnantDeals.map(deal => (
                  <div
                    key={deal.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      deal.isCritical ? 'border-red-200 bg-red-50 dark:bg-red-950/20' : 'border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{deal.name}</span>
                        <Badge variant={deal.isCritical ? 'destructive' : 'secondary'}>
                          {deal.daysInStage}d
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                        <span>{stageLabels[deal.stage] || deal.stage}</span>
                        {(deal as any).companies?.name && (
                          <>
                            <span>•</span>
                            <span>{(deal as any).companies.name}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{formatCurrency(deal.value || 0)}</div>
                      <div className="text-xs text-muted-foreground">
                        {(deal as any).profiles?.full_name || 'Sem responsável'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Nenhum negócio parado!</p>
              <p className="text-sm">Todos os negócios estão dentro do SLA</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Today's Activities */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5" />
            Atividades de Hoje
          </CardTitle>
          <CardDescription>
            {format(today, "EEEE, d 'de' MMMM", { locale: ptBR })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingActivities ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : todayActivities && todayActivities.length > 0 ? (
            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {todayActivities.map(activity => (
                  <div
                    key={activity.id}
                    className="flex items-center justify-between p-2 rounded border"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{activity.type}</Badge>
                      <span className="text-sm">{activity.subject || 'Atividade'}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(activity.created_at), 'HH:mm')}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <p>Nenhuma atividade registrada hoje</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
