import { useEffect, useMemo, useState } from 'react';
import { Workflow, AlertTriangle, LayoutDashboard, Kanban } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useOperationalFeatureFlag } from '@/hooks/useOperationalFeatureFlag';
import { useOperationalPipelines } from '@/hooks/useOperationalPipelines';
import { useOperationalKanbanData } from '@/hooks/useOperationalKanbanData';
import { useOperationalFilters } from '@/hooks/useOperationalFilters';
import { OperationalDisclaimerBanner } from '@/components/pipeline/operational/OperationalDisclaimerBanner';
import { OperationalKanbanBoard } from '@/components/pipeline/operational/OperationalKanbanBoard';
import { OperationalFiltersBar } from '@/components/pipeline/operational/OperationalFiltersBar';
import { OperationalDashboardPanel } from '@/components/pipeline/operational/OperationalDashboardPanel';

export default function OperationalPipeline() {
  const { isEnabled, isLoading: flagLoading } = useOperationalFeatureFlag();
  const { pipelines, stages, isLoading: pipelinesLoading } = useOperationalPipelines();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedId && pipelines.length > 0) {
      setSelectedId(pipelines[0].id);
    }
  }, [pipelines, selectedId]);

  const { orders, isLoading: ordersLoading } = useOperationalKanbanData(selectedId);
  const stagesForPipeline = useMemo(
    () => stages.filter(s => s.pipeline_id === selectedId),
    [stages, selectedId],
  );

  const { filters, update, reset, apply } = useOperationalFilters(selectedId);
  const filteredOrders = useMemo(
    () => apply(orders, stagesForPipeline),
    [orders, stagesForPipeline, apply],
  );

  if (flagLoading || pipelinesLoading) {
    return <div className="p-6 text-muted-foreground">Carregando...</div>;
  }

  if (!isEnabled) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Card className="p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-1 shrink-0" />
            <div>
              <h2 className="font-semibold text-base mb-1">Experiência operacional desativada</h2>
              <p className="text-sm text-muted-foreground">
                A nova arquitetura operacional está implantada mas ainda não foi ativada para esta
                tenant. Um administrador pode habilitar em Configurações &rarr; Pipelines Operacionais.
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (pipelines.length === 0) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">
            Nenhum pipeline operacional disponível para o seu acesso.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Workflow className="h-5 w-5 text-primary" />
          <h1 className="text-xl md:text-2xl font-semibold">Pipeline Operacional</h1>
        </div>

        <Select value={selectedId ?? undefined} onValueChange={setSelectedId}>
          <SelectTrigger className="w-[280px]">
            <SelectValue placeholder="Selecione um pipeline" />
          </SelectTrigger>
          <SelectContent>
            {pipelines.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </header>

      <OperationalDisclaimerBanner />

      <Tabs defaultValue="kanban" className="space-y-3">
        <TabsList>
          <TabsTrigger value="kanban" className="gap-1"><Kanban className="h-3 w-3" /> Kanban</TabsTrigger>
          <TabsTrigger value="dashboard" className="gap-1"><LayoutDashboard className="h-3 w-3" /> Dashboard</TabsTrigger>
        </TabsList>

        <TabsContent value="kanban" className="space-y-3">
          <OperationalFiltersBar filters={filters} update={update} reset={reset} stages={stagesForPipeline} />
          {ordersLoading ? (
            <div className="text-sm text-muted-foreground">Carregando pedidos...</div>
          ) : (
            <OperationalKanbanBoard
              pipelineId={selectedId!}
              stages={stagesForPipeline}
              orders={filteredOrders}
            />
          )}
        </TabsContent>

        <TabsContent value="dashboard">
          <OperationalDashboardPanel orders={orders} stages={stagesForPipeline} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
