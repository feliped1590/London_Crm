import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OverdueTask } from "@/hooks/useBusinessInsights";

interface OverdueTasksTableProps {
  tasks: OverdueTask[];
}

const priorityLabels: Record<string, { label: string; variant: "destructive" | "default" | "secondary" }> = {
  alta: { label: "Alta", variant: "destructive" },
  media: { label: "Média", variant: "default" },
  baixa: { label: "Baixa", variant: "secondary" },
};

export function OverdueTasksTable({ tasks }: OverdueTasksTableProps) {
  const queryClient = useQueryClient();

  const completeTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from("tasks")
        .update({
          status: "concluida",
          completed_at: new Date().toISOString(),
        })
        .eq("id", taskId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tarefa marcada como concluída");
      queryClient.invalidateQueries({ queryKey: ["insights-overdue-tasks"] });
    },
    onError: () => {
      toast.error("Erro ao atualizar tarefa");
    },
  });

  const getSeverityBadge = (severity: "critical" | "warning" | "info") => {
    switch (severity) {
      case "critical":
        return <Badge variant="destructive">Crítico</Badge>;
      case "warning":
        return (
          <Badge variant="outline" className="border-yellow-500 bg-yellow-500/10 text-yellow-700">
            Atenção
          </Badge>
        );
      default:
        return <Badge variant="secondary">Info</Badge>;
    }
  };

  if (tasks.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Clock className="mx-auto h-12 w-12 mb-4 opacity-50" />
        <p>Nenhuma tarefa atrasada encontrada</p>
        <p className="text-sm">Todas as tarefas estão em dia!</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tarefa</TableHead>
            <TableHead>Vencimento</TableHead>
            <TableHead className="text-center">Dias Atrasado</TableHead>
            <TableHead>Prioridade</TableHead>
            <TableHead>Responsável</TableHead>
            <TableHead>Negócio</TableHead>
            <TableHead className="text-center">Severidade</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => (
            <TableRow key={task.id}>
              <TableCell className="font-medium">{task.title}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1 text-destructive">
                  <AlertTriangle className="h-3 w-3" />
                  {format(task.dueDate, "dd/MM/yyyy", { locale: ptBR })}
                </div>
              </TableCell>
              <TableCell className="text-center font-semibold text-destructive">
                {task.daysOverdue} dias
              </TableCell>
              <TableCell>
                <Badge variant={priorityLabels[task.priority]?.variant || "default"}>
                  {priorityLabels[task.priority]?.label || task.priority}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {task.assigneeName || "-"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {task.dealName || task.companyName || "-"}
              </TableCell>
              <TableCell className="text-center">
                {getSeverityBadge(task.severity)}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => completeTaskMutation.mutate(task.id)}
                  disabled={completeTaskMutation.isPending}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Concluir
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
