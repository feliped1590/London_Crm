import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { processNoun, type WorkspaceProcess } from '../types';

const slaCopy: Record<WorkspaceProcess['sla_state'], { label: string; className: string }> = {
  ok: { label: 'No prazo', className: 'bg-emerald-100 text-emerald-800' },
  warning: { label: 'SLA em atenção', className: 'bg-amber-100 text-amber-800' },
  critical: { label: 'SLA crítico', className: 'bg-red-100 text-red-800' },
};

export function CustomerActiveProcesses({
  processes,
  onOpenProcesses,
}: {
  processes: WorkspaceProcess[];
  onOpenProcesses?: () => void;
}) {
  const navigate = useNavigate();
  const open = processes.filter((item) => item.is_open);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">Processos e serviços</CardTitle>
        <Button type="button" size="sm" variant="ghost" onClick={onOpenProcesses}>Ver todos</Button>
      </CardHeader>
      <CardContent>
        {open.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum processo ativo.</p>
        ) : (
          <ul className="space-y-2">
            {open.map((item) => {
              const sla = slaCopy[item.sla_state];
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className="flex w-full items-start justify-between gap-2 rounded-md border p-2 text-left hover:bg-muted/50"
                    onClick={() => navigate(`/pipeline?deal=${item.id}`)}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {processNoun(item.presentation)} · {item.stage_name || 'Etapa atual'}
                        {item.waiting_for_customer ? ' · Aguardando cliente' : ''}
                      </p>
                    </div>
                    <Badge className={sla.className}>{sla.label}</Badge>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
