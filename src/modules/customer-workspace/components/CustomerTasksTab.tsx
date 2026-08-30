import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, CheckSquare, List, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import TaskCalendar from '@/components/tasks/TaskCalendar';
import { TaskFormDialog, type TaskListRow } from '@/components/tasks/TaskFormDialog';
import { fromCivilDateUTC, todayCivilDate } from '@/lib/civilDate';
import { WAITING_ON_LABELS } from '../types';

const COLUMNS = `
  id, title, description, status, priority, due_date, due_time, completed_at,
  company_id, contact_id, deal_id, assigned_to, created_by, waiting_on, task_kind,
  created_at, updated_at,
  companies(id, name),
  contacts(id, first_name, last_name),
  deals(id, name)
`;

export function CustomerTasksTab({
  companyId,
  canEdit,
  openTaskId,
}: {
  companyId: string;
  canEdit: boolean;
  openTaskId?: string | null;
}) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState('pending');
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TaskListRow | null>(null);

  const { data: tasks = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['customer-tasks', companyId, filter],
    queryFn: async () => {
      let query = supabase
        .from('tasks')
        .select(COLUMNS)
        .eq('company_id', companyId)
        .order('due_date', { ascending: true, nullsFirst: false });
      if (filter === 'pending') query = query.in('status', ['pendente', 'em_andamento']);
      if (filter === 'completed') query = query.eq('status', 'concluida');
      if (filter === 'overdue') {
        query = query.in('status', ['pendente', 'em_andamento']).lt('due_date', `${todayCivilDate()}T00:00:00Z`);
      }
      const { data, error } = await query.limit(200);
      if (error) throw error;
      return (data || []) as unknown as TaskListRow[];
    },
  });

  const assigneeIds = useMemo(
    () => [...new Set(tasks.map((t) => t.assigned_to).filter(Boolean))] as string[],
    [tasks],
  );

  const { data: assignees = [] } = useQuery({
    queryKey: ['customer-task-assignees', assigneeIds],
    enabled: assigneeIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('user_id, full_name').in('user_id', assigneeIds);
      if (error) throw error;
      return data || [];
    },
  });

  const assigneeName = useMemo(
    () => new Map(assignees.map((p) => [p.user_id, p.full_name || 'Usuário'])),
    [assignees],
  );

  useEffect(() => {
    if (!openTaskId || tasks.length === 0) return;
    const found = tasks.find((task) => task.id === openTaskId);
    if (found) {
      setEditing(found);
      setDialogOpen(true);
    }
  }, [openTaskId, tasks]);

  const complete = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { error } = await supabase.from('tasks').update({
        status: completed ? 'concluida' : 'pendente',
        completed_at: completed ? new Date().toISOString() : null,
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customer-tasks', companyId] });
      qc.invalidateQueries({ queryKey: ['customer-workspace-summary', companyId] });
      qc.invalidateQueries({ queryKey: ['customer-workspace-timeline'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList>
            <TabsTrigger value="pending">Pendentes</TabsTrigger>
            <TabsTrigger value="overdue">Atrasadas</TabsTrigger>
            <TabsTrigger value="completed">Concluídas</TabsTrigger>
            <TabsTrigger value="all">Todas</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant={view === 'list' ? 'secondary' : 'outline'} onClick={() => setView('list')}>
            <List className="mr-1 h-4 w-4" />Lista
          </Button>
          <Button type="button" size="sm" variant={view === 'calendar' ? 'secondary' : 'outline'} onClick={() => setView('calendar')}>
            <CalendarDays className="mr-1 h-4 w-4" />Calendário
          </Button>
          {canEdit && (
            <Button type="button" size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
              <Plus className="mr-1 h-4 w-4" />Nova tarefa
            </Button>
          )}
        </div>
      </div>

      {view === 'calendar' ? (
        <TaskCalendar
          onCreateTask={() => { setEditing(null); setDialogOpen(true); }}
          onEditTask={(task) => { setEditing(task as TaskListRow); setDialogOpen(true); }}
          companyId={companyId}
        />
      ) : isLoading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Carregando tarefas…</p>
      ) : isError ? (
        <div className="py-10 text-center">
          <p className="text-sm font-medium text-destructive">Não foi possível carregar as tarefas.</p>
          <Button type="button" className="mt-3" size="sm" variant="outline" onClick={() => refetch()}>Tentar novamente</Button>
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-center">
          <CheckSquare className="h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-medium">Nenhuma tarefa neste filtro</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {tasks.map((task) => (
            <li key={task.id}>
              <div className="flex items-start gap-3 rounded-lg border p-3">
                <Checkbox
                  checked={task.status === 'concluida'}
                  disabled={!canEdit}
                  onCheckedChange={(checked) => complete.mutate({ id: task.id, completed: Boolean(checked) })}
                  aria-label={`Concluir ${task.title}`}
                />
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => { setEditing(task); setDialogOpen(true); }}>
                  <p className={`text-sm font-medium ${task.status === 'concluida' ? 'text-muted-foreground line-through' : ''}`}>{task.title}</p>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {task.due_date && <span>{fromCivilDateUTC(task.due_date)}</span>}
                    {task.waiting_on && <Badge variant="outline">{WAITING_ON_LABELS[task.waiting_on] || task.waiting_on}</Badge>}
                    {task.deals?.name && <span>{task.deals.name}</span>}
                    {task.assigned_to && <span>{assigneeName.get(task.assigned_to) || 'Responsável'}</span>}
                  </div>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <TaskFormDialog
        open={dialogOpen}
        onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditing(null); }}
        task={editing}
        lockedCompanyId={companyId}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ['customer-tasks', companyId] });
          qc.invalidateQueries({ queryKey: ['customer-workspace-summary', companyId] });
          qc.invalidateQueries({ queryKey: ['customer-workspace-timeline'] });
          qc.invalidateQueries({ queryKey: ['calendar-tasks'] });
        }}
      />
    </div>
  );
}
