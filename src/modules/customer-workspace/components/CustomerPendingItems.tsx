import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { WorkspaceWaitingItem } from '../types';

export function CustomerPendingItems({
  items,
  onOpenTasks,
  onOpenDocuments,
}: {
  items: WorkspaceWaitingItem[];
  onOpenTasks?: () => void;
  onOpenDocuments?: () => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Aguardando o cliente</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nada pendente com o cliente agora.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={`${item.kind}-${item.id}`} className="flex items-start justify-between gap-2 rounded-md border p-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.kind === 'document' ? 'Documento' : item.kind === 'process' ? 'Processo' : 'Tarefa'}</p>
                </div>
                <Badge variant="outline">Cliente</Badge>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={onOpenTasks}>Ver tarefas</Button>
          <Button type="button" size="sm" variant="outline" onClick={onOpenDocuments}>Ver documentos</Button>
        </div>
      </CardContent>
    </Card>
  );
}
