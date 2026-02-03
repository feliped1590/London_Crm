import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Building2, Target, User, Calendar, Clock, CheckCircle2, Circle, AlertCircle } from 'lucide-react';
import { format, parseISO, isBefore, startOfToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';

type Task = Tables<'tasks'> & {
  companies?: { id: string; name: string } | null;
  contacts?: { id: string; first_name: string; last_name: string } | null;
  deals?: { id: string; name: string } | null;
};

interface TaskDetailDrawerProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusConfig = {
  pendente: { label: 'Pendente', color: 'bg-yellow-500', icon: Circle },
  em_andamento: { label: 'Em Andamento', color: 'bg-blue-500', icon: Clock },
  concluida: { label: 'Concluída', color: 'bg-green-500', icon: CheckCircle2 },
  cancelada: { label: 'Cancelada', color: 'bg-gray-500', icon: AlertCircle },
};

const priorityConfig = {
  baixa: { label: 'Baixa', color: 'bg-slate-400' },
  media: { label: 'Média', color: 'bg-blue-400' },
  alta: { label: 'Alta', color: 'bg-orange-400' },
  urgente: { label: 'Urgente', color: 'bg-red-500' },
};

export default function TaskDetailDrawer({ task, open, onOpenChange }: TaskDetailDrawerProps) {
  const queryClient = useQueryClient();

  const toggleComplete = useMutation({
    mutationFn: async ({ completed }: { completed: boolean }) => {
      if (!task) return;
      const { error } = await supabase
        .from('tasks')
        .update({
          status: completed ? 'concluida' : 'pendente',
          completed_at: completed ? new Date().toISOString() : null,
        })
        .eq('id', task.id);
      if (error) throw error;
    },
    onSuccess: (_, { completed }) => {
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['today-tasks'] });
      toast.success(completed ? 'Tarefa concluída!' : 'Tarefa reaberta!');
      onOpenChange(false);
    },
    onError: () => {
      toast.error('Erro ao atualizar tarefa');
    },
  });

  if (!task) return null;

  const status = statusConfig[task.status];
  const priority = priorityConfig[task.priority];
  const StatusIcon = status.icon;

  const isOverdue = task.due_date && 
    isBefore(parseISO(task.due_date), startOfToday()) && 
    task.status !== 'concluida';

  const formattedDate = task.due_date 
    ? format(parseISO(task.due_date), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })
    : 'Sem data definida';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="space-y-4">
          <div className="flex items-start justify-between">
            <SheetTitle className="text-xl font-bold pr-4">{task.title}</SheetTitle>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge className={`${status.color} text-white gap-1`}>
              <StatusIcon className="h-3 w-3" />
              {status.label}
            </Badge>
            <Badge className={`${priority.color} text-white`}>
              {priority.label}
            </Badge>
            {isOverdue && (
              <Badge variant="destructive">Atrasada</Badge>
            )}
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Description */}
          {task.description && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Descrição</h4>
              <p className="text-sm">{task.description}</p>
            </div>
          )}

          <Separator />

          {/* Date & Time */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Data</p>
                <p className="text-sm text-muted-foreground capitalize">{formattedDate}</p>
              </div>
            </div>

            {task.due_time && (
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Horário</p>
                  <p className="text-sm text-muted-foreground">{task.due_time.slice(0, 5)}</p>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Related entities */}
          <div className="space-y-3">
            {task.companies?.name && (
              <div className="flex items-center gap-3">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Empresa</p>
                  <p className="text-sm text-muted-foreground">{task.companies.name}</p>
                </div>
              </div>
            )}

            {task.deals?.name && (
              <div className="flex items-center gap-3">
                <Target className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Negócio</p>
                  <p className="text-sm text-muted-foreground">{task.deals.name}</p>
                </div>
              </div>
            )}

            {task.contacts && (
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Contato</p>
                  <p className="text-sm text-muted-foreground">
                    {task.contacts.first_name} {task.contacts.last_name}
                  </p>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex flex-col gap-2">
            {task.status !== 'concluida' ? (
              <Button
                className="w-full gap-2"
                onClick={() => toggleComplete.mutate({ completed: true })}
                disabled={toggleComplete.isPending}
              >
                <CheckCircle2 className="h-4 w-4" />
                Marcar como Concluída
              </Button>
            ) : (
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => toggleComplete.mutate({ completed: false })}
                disabled={toggleComplete.isPending}
              >
                <Circle className="h-4 w-4" />
                Reabrir Tarefa
              </Button>
            )}
          </div>

          {/* Metadata */}
          <div className="pt-4 border-t text-xs text-muted-foreground space-y-1">
            <p>Criada em: {format(parseISO(task.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
            {task.completed_at && (
              <p>Concluída em: {format(parseISO(task.completed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
