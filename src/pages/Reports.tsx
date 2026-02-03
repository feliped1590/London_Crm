import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, 
  Pencil, 
  Save, 
  X, 
  Printer, 
  FileText, 
  List, 
  MoreVertical,
  RotateCcw,
  Download,
  BarChart3,
  TrendingUp,
  ClipboardList,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useDashboardData } from '@/hooks/useDashboardData';
import { DashboardWidget } from '@/components/reports/DashboardWidget';
import { AddWidgetDialog } from '@/components/reports/AddWidgetDialog';
import { SalesFunnelChart } from '@/components/reports/SalesFunnelChart';
import { PipelineVelocityCard } from '@/components/reports/PipelineVelocityCard';
import { LossReasonsChart } from '@/components/reports/LossReasonsChart';
import { OperationalReportsTab } from '@/components/reports/OperationalReportsTab';
import {
  DashboardWidget as WidgetType,
  DashboardConfig,
  ChartType,
  METRIC_DEFINITIONS,
} from '@/types/dashboard';
import { Json } from '@/integrations/supabase/types';

const DEFAULT_WIDGETS: WidgetType[] = [
  { id: 'default-1', type: 'pipeline_total', chartType: 'number', title: 'Pipeline Total', size: 'sm', position: 0 },
  { id: 'default-2', type: 'deals_won', chartType: 'number', title: 'Vendas Ganhas', size: 'sm', position: 1 },
  { id: 'default-3', type: 'win_rate', chartType: 'number', title: 'Taxa de Conversão', size: 'sm', position: 2 },
  { id: 'default-4', type: 'tasks_completion', chartType: 'number', title: 'Tarefas Concluídas', size: 'sm', position: 3 },
  { id: 'default-5', type: 'companies_count', chartType: 'number', title: 'Total de Empresas', size: 'sm', position: 4 },
  { id: 'default-6', type: 'contacts_count', chartType: 'number', title: 'Total de Contatos', size: 'sm', position: 5 },
  { id: 'default-7', type: 'deals_by_stage', chartType: 'bar', title: 'Pipeline por Etapa', size: 'md', position: 6 },
  { id: 'default-8', type: 'deals_by_stage', chartType: 'pie', title: 'Distribuição por Etapa', size: 'md', position: 7 },
  { id: 'default-9', type: 'deals_by_month', chartType: 'line', title: 'Evolução de Negócios', size: 'xl', position: 8 },
];

export default function Reports() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { getMetricData } = useDashboardData();
  
  const [widgets, setWidgets] = useState<WidgetType[]>(DEFAULT_WIDGETS);
  const [isEditing, setIsEditing] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [dashboardName, setDashboardName] = useState('Meu Dashboard');
  const [isPrinting, setIsPrinting] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Load saved config
  const { data: savedConfig, isLoading: isLoadingConfig } = useQuery({
    queryKey: ['dashboard-config', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('user_dashboard_configs')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_default', true)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        ...data,
        widgets: data.widgets as unknown as WidgetType[],
      } as DashboardConfig;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (savedConfig) {
      const parsedWidgets = savedConfig.widgets as unknown as WidgetType[];
      if (Array.isArray(parsedWidgets) && parsedWidgets.length > 0) {
        setWidgets(parsedWidgets);
      }
      setDashboardName(savedConfig.name);
    }
  }, [savedConfig]);

  // Save config mutation
  const saveConfigMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('User not authenticated');
      
      const configData = {
        user_id: user.id,
        name: dashboardName,
        widgets: widgets as unknown as Json,
        is_default: true,
      };

      if (savedConfig?.id) {
        const { error } = await supabase
          .from('user_dashboard_configs')
          .update(configData)
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
      queryClient.invalidateQueries({ queryKey: ['dashboard-config'] });
      toast.success('Dashboard salvo!');
      setIsEditing(false);
    },
    onError: () => toast.error('Erro ao salvar dashboard'),
  });

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
    setDashboardName('Meu Dashboard');
  };

  const handlePrint = async (format: 'graph' | 'list') => {
    setIsPrinting(true);
    try {
      const widgetData: Record<string, any> = {};
      widgets.forEach((w) => {
        widgetData[w.id] = getMetricData(w.type);
      });

      const { data, error } = await supabase.functions.invoke('generate-report-pdf', {
        body: {
          widgets,
          data: widgetData,
          title: dashboardName,
          format,
        },
      });

      if (error) throw error;

      if (data?.html) {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(data.html);
          printWindow.document.close();
          toast.success('Relatório gerado! Use Ctrl+P para imprimir/salvar.');
        }
      }
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error('Erro ao gerar relatório');
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-foreground">Relatórios</h1>
        </div>
      </div>

      {/* Tabs for different report sections */}
      <Tabs defaultValue="operacional" className="space-y-6">
        <TabsList>
          <TabsTrigger value="operacional" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            Operacional
          </TabsTrigger>
          <TabsTrigger value="funnel" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Funil de Vendas
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Dashboard Personalizado
          </TabsTrigger>
        </TabsList>

        {/* Operational Reports Tab */}
        <TabsContent value="operacional" className="space-y-6">
          <OperationalReportsTab />
        </TabsContent>

        {/* Sales Funnel Tab */}
        <TabsContent value="funnel" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SalesFunnelChart />
            <PipelineVelocityCard />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <LossReasonsChart />
          </div>
        </TabsContent>

        {/* Custom Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-6">
          {/* Dashboard Header */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              {isEditing ? (
                <Input
                  value={dashboardName}
                  onChange={(e) => setDashboardName(e.target.value)}
                  className="text-xl font-bold h-10 w-64"
                />
              ) : (
                <h2 className="text-xl font-semibold text-foreground">{dashboardName}</h2>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
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
                <>
                  <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Editar
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" disabled={isPrinting}>
                        <Printer className="mr-2 h-4 w-4" />
                        Imprimir
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handlePrint('graph')}>
                        <FileText className="mr-2 h-4 w-4" />
                        Formato Gráfico
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handlePrint('list')}>
                        <List className="mr-2 h-4 w-4" />
                        Formato Lista
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
            </div>
          </div>

          {isEditing && (
            <p className="text-sm text-muted-foreground">
              Arraste os cards para reorganizar, use o menu de cada card para alterar tipo de gráfico ou tamanho.
            </p>
          )}

          {/* Widgets Grid */}
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

          {widgets.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <FileText className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg mb-2">Nenhum widget no dashboard</p>
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Widget
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>

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
