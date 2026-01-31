import { useState } from 'react';
import { CheckCircle2, Circle, Clock, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { TodayTask } from '@/hooks/useTodayData';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

interface TodayTaskListProps {
  tasks: TodayTask[];
  isLoading: boolean;
}

const priorityConfig: Record<string, { label: string; color: string }> = {
  baixa: { label: 'Baixa', color: 'bg-muted text-muted-foreground' },
  media: { label: 'Média', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  alta: { label: 'Alta', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' },
  urgente: { label: 'Urgente', color: 'bg-destructive text-destructive-foreground' },
};

export function TodayTaskList({ tasks, isLoading }: TodayTaskListProps) {
  const queryClient = useQueryClient();
  const [completing, setCompleting] = useState<string | null>(null);

  const handleComplete = async (taskId: string) => {
    setCompleting(taskId);
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: 'concluida', completed_at: new Date().toISOString() })
        .eq('id', taskId);

      if (error) throw error;
      
      toast.success('Tarefa concluída!');
      queryClient.invalidateQueries({ queryKey: ['today-tasks'] });
    } catch (error) {
      toast.error('Erro ao concluir tarefa');
    } finally {
      setCompleting(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            Tarefas de Hoje
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Tarefas de Hoje
            {tasks.length > 0 && (
              <Badge variant="secondary" className="ml-2">{tasks.length}</Badge>
            )}
          </CardTitle>
          <Link to="/tasks">
            <Button variant="ghost" size="sm">Ver todas →</Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nenhuma tarefa para hoje!</p>
            <p className="text-sm">Aproveite para prospectar ou fazer follow-ups.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.map(task => {
              const priority = priorityConfig[task.priority] || priorityConfig.media;
              const isCompleting = completing === task.id;

              return (
                <div
                  key={task.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                    "hover:bg-accent/50"
                  )}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={() => handleComplete(task.id)}
                    disabled={isCompleting}
                  >
                    {isCompleting ? (
                      <Clock className="h-4 w-4 animate-spin" />
                    ) : (
                      <Circle className="h-4 w-4" />
                    )}
                  </Button>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{task.title}</p>
                    {(task.deal || task.company) && (
                      <p className="text-xs text-muted-foreground truncate">
                        {task.deal?.name || task.company?.name}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {task.due_time && (
                      <Badge variant="outline" className="text-xs">
                        <Clock className="h-3 w-3 mr-1" />
                        {task.due_time.slice(0, 5)}
                      </Badge>
                    )}
                    <Badge className={cn("text-xs", priority.color)}>
                      {priority.label}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
