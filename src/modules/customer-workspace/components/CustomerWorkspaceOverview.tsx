import { AlertCircle, CheckSquare, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCustomerWorkspaceSummary } from '../hooks/useCustomerWorkspaceSummary';
import { CustomerHealthCard } from './CustomerHealthCard';
import { CustomerPendingItems } from './CustomerPendingItems';
import { CustomerUpcomingDeadlines } from './CustomerUpcomingDeadlines';
import { CustomerActiveProcesses } from './CustomerActiveProcesses';
import { CustomerResponsibleTeam } from './CustomerResponsibleTeam';
import { fromCivilDateUTC } from '@/lib/civilDate';

export function CustomerWorkspaceOverview({
  companyId,
  onOpenTab,
}: {
  companyId: string;
  onOpenTab: (tab: string) => void;
}) {
  const { data, isLoading, isError, error, refetch } = useCustomerWorkspaceSummary(companyId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" />
        Carregando visão operacional…
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <p className="text-sm font-medium">Não foi possível carregar o Workspace 360</p>
          <p className="max-w-md text-xs text-muted-foreground">
            {(error as { message?: string } | null)?.message
              || 'Não foi possível consultar o resumo operacional deste cliente. A tela de cadastro continua disponível.'}
          </p>
          <Button type="button" size="sm" variant="outline" onClick={() => refetch()}>Tentar novamente</Button>
        </CardContent>
      </Card>
    );
  }

  const overdue = data.open_tasks.filter((task) => task.bucket === 'overdue');
  const today = data.open_tasks.filter((task) => task.bucket === 'today');
  const upcoming = data.open_tasks.filter((task) => task.bucket === 'upcoming');

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryStat label="Atrasadas" value={data.counts.tasks_overdue} tone="danger" onClick={() => onOpenTab('tarefas')} />
        <SummaryStat label="Hoje" value={data.counts.tasks_today} onClick={() => onOpenTab('tarefas')} />
        <SummaryStat label="Próximos 7 dias" value={data.counts.tasks_next_7_days} onClick={() => onOpenTab('tarefas')} />
        <SummaryStat label="Aguardando cliente" value={data.counts.tasks_waiting_customer + data.counts.documents_waiting_customer} onClick={() => onOpenTab('documentos')} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <CustomerHealthCard health={data.health} reasons={data.health_reasons} />
        <CustomerPendingItems
          items={data.waiting_items}
          onOpenTasks={() => onOpenTab('tarefas')}
          onOpenDocuments={() => onOpenTab('documentos')}
        />
        <CustomerUpcomingDeadlines items={data.upcoming_deadlines} />
        <CustomerActiveProcesses processes={data.processes} onOpenProcesses={() => onOpenTab('negocios')} />
        <CustomerResponsibleTeam team={data.team} />
        <Card>
          <CardContent className="space-y-3 pt-6">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Tarefas em destaque</h3>
              <Button type="button" size="sm" variant="ghost" onClick={() => onOpenTab('tarefas')}>Agenda</Button>
            </div>
            {data.open_tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma tarefa aberta para este cliente.</p>
            ) : (
              <ul className="space-y-2">
                {[...overdue, ...today, ...upcoming].slice(0, 8).map((task) => (
                  <li key={task.id}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-2 rounded-md border p-2 text-left text-sm hover:bg-muted/50"
                      onClick={() => onOpenTab('tarefas')}
                    >
                    <span className="flex min-w-0 items-center gap-2">
                      <CheckSquare className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="truncate">{task.title}</span>
                    </span>
                    <Badge variant={task.bucket === 'overdue' ? 'destructive' : 'outline'}>
                      {task.bucket === 'overdue' ? 'Atrasada' : task.bucket === 'today' ? 'Hoje' : fromCivilDateUTC(task.due_date) || 'Sem data'}
                    </Badge>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {data.last_interaction && (
              <p className="text-xs text-muted-foreground">
                Última interação: {data.last_interaction.title}
              </p>
            )}
            {data.primary_contacts.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Contatos: {data.primary_contacts.map((c) => `${c.first_name} ${c.last_name || ''}`.trim()).join(', ')}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  tone,
  onClick,
}: {
  label: string;
  value: number;
  tone?: 'danger';
  onClick?: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="rounded-lg border bg-card p-4 text-left hover:bg-muted/40">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${tone === 'danger' && value > 0 ? 'text-destructive' : ''}`}>{value}</p>
    </button>
  );
}
