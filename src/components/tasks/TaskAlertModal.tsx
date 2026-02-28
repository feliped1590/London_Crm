import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Clock, CheckSquare } from 'lucide-react';

interface TaskAlertData {
  overdue_count: number;
  today_count: number;
  overdue_tasks: { id: string; title: string }[];
  today_tasks: { id: string; title: string }[];
}

interface TaskAlertModalProps {
  open: boolean;
  onClose: () => void;
  data: TaskAlertData;
}

export function TaskAlertModal({ open, onClose, data }: TaskAlertModalProps) {
  const navigate = useNavigate();

  const handleViewTasks = () => {
    onClose();
    navigate('/tasks');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md animate-in fade-in-0 slide-in-from-bottom-4 duration-300">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5 text-primary" />
            Tarefas Pendentes
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {data.overdue_count > 0 && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-destructive">
                  {data.overdue_count} {data.overdue_count === 1 ? 'tarefa vencida' : 'tarefas vencidas'}
                </p>
                {data.overdue_tasks.length > 0 && (
                  <ul className="mt-1.5 space-y-1">
                    {data.overdue_tasks.map(t => (
                      <li key={t.id} className="text-sm text-muted-foreground truncate max-w-[300px]">
                        • {t.title}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {data.today_count > 0 && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-warning/10 border border-warning/20">
              <Clock className="h-5 w-5 text-warning mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-warning">
                  {data.today_count} {data.today_count === 1 ? 'tarefa vence hoje' : 'tarefas vencem hoje'}
                </p>
                {data.today_tasks.length > 0 && (
                  <ul className="mt-1.5 space-y-1">
                    {data.today_tasks.map(t => (
                      <li key={t.id} className="text-sm text-muted-foreground truncate max-w-[300px]">
                        • {t.title}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          <Button onClick={handleViewTasks}>
            Ver Tarefas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
