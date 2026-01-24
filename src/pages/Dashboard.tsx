import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDashboardData } from "@/hooks/useDashboardData";
import { DashboardWidget } from "@/components/reports/DashboardWidget";
import { AddWidgetDialog } from "@/components/reports/AddWidgetDialog";
import {
  DashboardWidget as WidgetType,
  ChartType,
} from "@/types/dashboard";
import { Json } from "@/integrations/supabase/types";
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
  ShoppingCart,
  Plus,
  Pencil,
  Save,
  X,
  RotateCcw,
} from "lucide-react";
import { DashboardStats, Task, Deal } from "@/types/crm";
import { formatCurrency } from "@/lib/formatters";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { InsightsSummary } from "@/components/insights/InsightsSummary";
import { toast } from "sonner";

interface ExtendedDashboardStats extends DashboardStats {
  pendingProposals: number;
  pendingProposalsValue: number;
  pendingOrders: number;
  pendingOrdersValue: number;
}

const DEFAULT_WIDGETS: WidgetType[] = [
  { id: 'dash-1', type: 'pipeline_total', chartType: 'number', title: 'Pipeline Total', size: 'sm', position: 0 },
  { id: 'dash-2', type: 'deals_won', chartType: 'number', title: 'Vendas Ganhas', size: 'sm', position: 1 },
  { id: 'dash-3', type: 'win_rate', chartType: 'number', title: 'Taxa de Conversão', size: 'sm', position: 2 },
  { id: 'dash-4', type: 'tasks_completion', chartType: 'number', title: 'Tarefas Concluídas', size: 'sm', position: 3 },
  { id: 'dash-5', type: 'deals_by_stage', chartType: 'bar', title: 'Pipeline por Etapa', size: 'md', position: 4 },
  { id: 'dash-6', type: 'deals_by_stage', chartType: 'pie', title: 'Distribuição por Etapa', size: 'md', position: 5 },
];

export default function Dashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { getMetricData } = useDashboardData();
  
  const [stats, setStats] = useState<ExtendedDashboardStats | null>(null);
  const [recentDeals, setRecentDeals] = useState<Deal[]>([]);
  const [upcomingTasks, setUpcomingTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [widgets, setWidgets] = useState<WidgetType[]>(DEFAULT_WIDGETS);
  const [isEditing, setIsEditing] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Load saved dashboard config (separate from reports dashboard)
  const { data: savedConfig } = useQuery({
    queryKey: ['home-dashboard-config', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('user_dashboard_configs')
        .select('*')
        .eq('user_id', user.id)
        .eq('name', 'Visão Geral')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (savedConfig) {
      const parsedWidgets = savedConfig.widgets as unknown as WidgetType[];
      if (Array.isArray(parsedWidgets) && parsedWidgets.length > 0) {
        setWidgets(parsedWidgets);
      }
    }
  }, [savedConfig]);

  // Save config mutation
  const saveConfigMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('User not authenticated');
      
      const configData = {
        user_id: user.id,
        name: 'Visão Geral',
        widgets: widgets as unknown as Json,
        is_default: false,
      };

      if (savedConfig?.id) {
        const { error } = await supabase
          .from('user_dashboard_configs')
          .update({ widgets: widgets as unknown as Json })
          .eq('id', savedConfig.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_dashboard_configs')
          .insert(configData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['home-dashboard-config'] });
      toast.success('Dashboard salvo!');
      setIsEditing(false);
    },
    onError: () => toast.error('Erro ao salvar dashboard'),
  });

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      const [
        { count: totalDeals },
        { count: totalContacts },
        { count: totalCompanies },
        { data: deals },
        { data: tasks },
        { data: pendingProposals },
        { data: pendingOrders },
      ] = await Promise.all([
        supabase.from("deals").select("*", { count: "exact", head: true }),
        supabase.from("contacts").select("*", { count: "exact", head: true }),
        supabase.from("companies").select("*", { count: "exact", head: true }),
        supabase.from("deals").select("*").order("created_at", { ascending: false }).limit(100),
        supabase
          .from("tasks")
          .select("*, company:companies(*), contact:contacts(*), deal:deals(*)")
          .in("status", ["pendente", "em_andamento"])
          .order("due_date", { ascending: true })
          .limit(5),
        supabase.from("proposals").select("total_value").in("status", ["rascunho", "enviada", "em_analise"]),
        supabase.from("orders").select("total_value").in("status", ["pendente", "em_producao"]),
      ]);

      const allDeals = deals || [];
      const wonDeals = allDeals.filter((d) => d.stage === "fechado_ganho");
      const openDeals = allDeals.filter((d) => !["fechado_ganho", "fechado_perdido"].includes(d.stage));

      const totalValue = allDeals.reduce((sum, d) => sum + Number(d.value || 0), 0);
      const wonValue = wonDeals.reduce((sum, d) => sum + Number(d.value || 0), 0);
      const openValue = openDeals.reduce((sum, d) => sum + Number(d.value || 0), 0);

      const now = new Date().toISOString();
      const pendingTasksCount = (tasks || []).filter((t) => t.status === "pendente").length;
      const overdueTasks = (tasks || []).filter(
        (t) => t.due_date && t.due_date < now && t.status !== "concluida",
      ).length;

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
      console.error("Error fetching dashboard data:", error);
      toast.error("Erro ao carregar dados do dashboard");
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setWidgets((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleRemoveWidget = (id: string) => {
    setWidgets((prev) => prev.filter((w) => w.id !== id));
  };

  const handleChangeChart = (id: string, chartType: ChartType) => {
    setWidgets((prev) =>
      prev.map((w) => (w.id === id ? { ...w, chartType } : w))
    );
  };

  const handleChangeSize = (id: string, size: 'sm' | 'md' | 'lg' | 'xl') => {
    setWidgets((prev) =>
      prev.map((w) => (w.id === id ? { ...w, size } : w))
    );
  };

  const handleAddWidgets = (newWidgets: WidgetType[]) => {
    setWidgets((prev) => [...prev, ...newWidgets]);
  };

  const handleResetToDefault = () => {
    setWidgets(DEFAULT_WIDGETS);
  };

  const StatCard = ({
    title,
    value,
    icon: Icon,
    description,
    trend,
    href,
  }: {
    title: string;
    value: string | number;
    icon: React.ElementType;
    description?: string;
    trend?: "up" | "down" | null;
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
            {trend === "up" && <ArrowUpRight className="h-3 w-3 text-success" />}
            {trend === "down" && <ArrowDownRight className="h-3 w-3 text-destructive" />}
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
      prospeccao: "Prospecção",
      qualificacao: "Qualificação",
      proposta: "Proposta",
      negociacao: "Negociação",
      fechado_ganho: "Ganho",
      fechado_perdido: "Perdido",
    };
    return labels[stage] || stage;
  };

  const getStageColor = (stage: string) => {
    const colors: Record<string, string> = {
      prospeccao: "bg-stage-prospeccao",
      qualificacao: "bg-stage-qualificacao",
      proposta: "bg-stage-proposta",
      negociacao: "bg-stage-negociacao",
      fechado_ganho: "bg-stage-ganho",
      fechado_perdido: "bg-stage-perdido",
    };
    return colors[stage] || "bg-muted";
  };

  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      baixa: "secondary",
      media: "default",
      alta: "destructive",
      urgente: "destructive",
    };
    const labels: Record<string, string> = {
      baixa: "Baixa",
      media: "Média",
      alta: "Alta",
      urgente: "Urgente",
    };
    return <Badge variant={variants[priority] || "default"}>{labels[priority] || priority}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Visão Geral</h1>
          <p className="text-muted-foreground">Visão geral do seu funil de vendas</p>
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Widget
              </Button>
              <Button variant="outline" size="sm" onClick={handleResetToDefault}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Resetar
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
                <X className="mr-2 h-4 w-4" />
                Cancelar
              </Button>
              <Button size="sm" onClick={() => saveConfigMutation.mutate()} disabled={saveConfigMutation.isPending}>
                <Save className="mr-2 h-4 w-4" />
                Salvar
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              Personalizar
            </Button>
          )}
        </div>
      </div>

      {isEditing && (
        <p className="text-sm text-muted-foreground">
          Arraste os cards para reorganizar, use o menu de cada card para alterar tipo de gráfico ou tamanho.
        </p>
      )}

      {/* Customizable Widgets Grid */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={widgets.map((w) => w.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {widgets.map((widget) => (
              <DashboardWidget
                key={widget.id}
                widget={widget}
                data={getMetricData(widget.type)}
                onRemove={handleRemoveWidget}
                onChangeChart={handleChangeChart}
                onChangeSize={handleChangeSize}
                isEditing={isEditing}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Secondary Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
        <StatCard title="Tarefas Pendentes" value={stats?.pendingTasks || 0} icon={CheckSquare} href="/tasks" />
        <StatCard
          title="Tarefas Atrasadas"
          value={stats?.overdueTasks || 0}
          icon={AlertCircle}
          description={stats?.overdueTasks ? "Atenção necessária" : "Tudo em dia"}
          trend={stats?.overdueTasks ? "down" : null}
        />
      </div>

      {/* Insights Summary */}
      <InsightsSummary />

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
                      <p className="text-sm text-muted-foreground">{formatCurrency(Number(deal.value))}</p>
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
                          {new Date(task.due_date).toLocaleDateString("pt-BR")}
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

      {/* Add Widget Dialog */}
      <AddWidgetDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onAdd={handleAddWidgets}
        existingWidgets={widgets}
      />
    </div>
  );
}
