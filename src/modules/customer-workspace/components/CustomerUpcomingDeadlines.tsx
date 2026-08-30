import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { WorkspaceDeadline } from '../types';

function formatDue(value: string | null) {
  if (!value) return 'Sem data';
  try {
    return format(parseISO(value.length === 10 ? `${value}T12:00:00Z` : value), 'dd MMM yyyy', { locale: ptBR });
  } catch {
    return value;
  }
}

const kindLabel: Record<string, string> = {
  task: 'Tarefa',
  document: 'Documento',
  contract: 'Contrato',
};

export function CustomerUpcomingDeadlines({ items }: { items: WorkspaceDeadline[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Prazos próximos</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum prazo nos próximos sete dias.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={`${item.kind}-${item.id}`} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate">
                  <span className="text-muted-foreground">{kindLabel[item.kind] || item.kind}: </span>
                  {item.label}
                </span>
                <time className="shrink-0 text-xs text-muted-foreground" dateTime={item.due_on ?? undefined}>
                  {formatDue(item.due_on)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
