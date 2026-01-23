import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Lightbulb, Building2, TrendingDown, Clock, FileText, RefreshCw } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useBusinessInsights } from "@/hooks/useBusinessInsights";
import { useAuth } from "@/hooks/useAuth";
import { InsightCard } from "@/components/insights/InsightCard";
import { InactiveCustomersTable } from "@/components/insights/InactiveCustomersTable";
import { StagnantDealsTable } from "@/components/insights/StagnantDealsTable";
import { OverdueTasksTable } from "@/components/insights/OverdueTasksTable";
import { ExpiringProposalsTable } from "@/components/insights/ExpiringProposalsTable";
import { Skeleton } from "@/components/ui/skeleton";

export default function Insights() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("inactive");
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [taskData, setTaskData] = useState({ companyId: "", companyName: "", title: "", description: "" });

  const {
    inactiveCustomers,
    stagnantDeals,
    overdueTasks,
    expiringProposals,
    summary,
    isLoading,
  } = useBusinessInsights();

  const createTaskMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("tasks").insert({
        title: taskData.title,
        description: taskData.description,
        company_id: taskData.companyId,
        created_by: user?.id,
        assigned_to: user?.id,
        priority: "alta",
        status: "pendente",
        due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 dias
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tarefa de follow-up criada com sucesso!");
      setTaskDialogOpen(false);
      setTaskData({ companyId: "", companyName: "", title: "", description: "" });
      queryClient.invalidateQueries({ queryKey: ["insights-overdue-tasks"] });
    },
    onError: () => {
      toast.error("Erro ao criar tarefa");
    },
  });

  const handleCreateTask = (companyId: string, companyName: string) => {
    setTaskData({
      companyId,
      companyName,
      title: `Follow-up: ${companyName}`,
      description: `Cliente sem compras há muito tempo. Entrar em contato para verificar novas oportunidades.`,
    });
    setTaskDialogOpen(true);
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["insights-inactive-customers"] });
    queryClient.invalidateQueries({ queryKey: ["insights-stagnant-deals"] });
    queryClient.invalidateQueries({ queryKey: ["insights-overdue-tasks"] });
    queryClient.invalidateQueries({ queryKey: ["insights-expiring-proposals"] });
    toast.success("Dados atualizados!");
  };

  const inactiveCritical = inactiveCustomers.filter((c) => c.severity === "critical").length;
  const inactiveWarning = inactiveCustomers.filter((c) => c.severity === "warning").length;
  const inactiveInfo = inactiveCustomers.filter((c) => c.severity === "info").length;

  const stagnantCritical = stagnantDeals.filter((d) => d.severity === "critical").length;
  const stagnantWarning = stagnantDeals.filter((d) => d.severity === "warning").length;
  const stagnantInfo = stagnantDeals.filter((d) => d.severity === "info").length;

  const overdueCritical = overdueTasks.filter((t) => t.severity === "critical").length;
  const overdueWarning = overdueTasks.filter((t) => t.severity === "warning").length;
  const overdueInfo = overdueTasks.filter((t) => t.severity === "info").length;

  const expiringCritical = expiringProposals.filter((p) => p.severity === "critical").length;
  const expiringWarning = expiringProposals.filter((p) => p.severity === "warning").length;
  const expiringInfo = expiringProposals.filter((p) => p.severity === "info").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Lightbulb className="h-6 w-6 text-primary" />
            Insights de Negócio
          </h1>
          <p className="text-muted-foreground">
            Análises e alertas para identificar oportunidades e riscos
          </p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* Summary Cards */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <InsightCard
            title="Clientes Inativos"
            icon={<Building2 className="h-5 w-5" />}
            count={inactiveCustomers.length}
            criticalCount={inactiveCritical}
            warningCount={inactiveWarning}
            infoCount={inactiveInfo}
            onClick={() => setActiveTab("inactive")}
          />
          <InsightCard
            title="Negócios Parados"
            icon={<TrendingDown className="h-5 w-5" />}
            count={stagnantDeals.length}
            criticalCount={stagnantCritical}
            warningCount={stagnantWarning}
            infoCount={stagnantInfo}
            onClick={() => setActiveTab("stagnant")}
          />
          <InsightCard
            title="Tarefas Atrasadas"
            icon={<Clock className="h-5 w-5" />}
            count={overdueTasks.length}
            criticalCount={overdueCritical}
            warningCount={overdueWarning}
            infoCount={overdueInfo}
            onClick={() => setActiveTab("overdue")}
          />
          <InsightCard
            title="Propostas Expirando"
            icon={<FileText className="h-5 w-5" />}
            count={expiringProposals.length}
            criticalCount={expiringCritical}
            warningCount={expiringWarning}
            infoCount={expiringInfo}
            onClick={() => setActiveTab("expiring")}
          />
        </div>
      )}

      {/* Total Summary */}
      {!isLoading && (
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>Total de alertas: <strong>{summary.totalAlerts}</strong></span>
          {summary.criticalCount > 0 && (
            <Badge variant="destructive">{summary.criticalCount} críticos</Badge>
          )}
          {summary.warningCount > 0 && (
            <Badge variant="outline" className="border-amber-500 bg-amber-500/10 text-amber-700">
              {summary.warningCount} atenção
            </Badge>
          )}
        </div>
      )}

      {/* Detailed Tables */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="inactive" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Clientes Inativos
            {inactiveCustomers.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {inactiveCustomers.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="stagnant" className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4" />
            Negócios Parados
            {stagnantDeals.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {stagnantDeals.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="overdue" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Tarefas Atrasadas
            {overdueTasks.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {overdueTasks.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="expiring" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Propostas Expirando
            {expiringProposals.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {expiringProposals.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inactive" className="mt-4">
          <InactiveCustomersTable
            customers={inactiveCustomers}
            onCreateTask={handleCreateTask}
          />
        </TabsContent>

        <TabsContent value="stagnant" className="mt-4">
          <StagnantDealsTable deals={stagnantDeals} />
        </TabsContent>

        <TabsContent value="overdue" className="mt-4">
          <OverdueTasksTable tasks={overdueTasks} />
        </TabsContent>

        <TabsContent value="expiring" className="mt-4">
          <ExpiringProposalsTable proposals={expiringProposals} />
        </TabsContent>
      </Tabs>

      {/* Create Task Dialog */}
      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Tarefa de Follow-up</DialogTitle>
            <DialogDescription>
              Crie uma tarefa para acompanhar o cliente {taskData.companyName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="task-title">Título</Label>
              <Input
                id="task-title"
                value={taskData.title}
                onChange={(e) => setTaskData({ ...taskData, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-description">Descrição</Label>
              <Textarea
                id="task-description"
                value={taskData.description}
                onChange={(e) => setTaskData({ ...taskData, description: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTaskDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => createTaskMutation.mutate()}
              disabled={createTaskMutation.isPending}
            >
              Criar Tarefa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
