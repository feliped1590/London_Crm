import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { OperationalOrder } from '@/hooks/useOperationalKanbanData';
import type { OperationalStage } from '@/hooks/useOperationalPipelines';
import { useOperationalDashboard } from '@/hooks/useOperationalDashboard';
import { Activity, AlertTriangle, Flame, Lock, UserX, TrendingUp } from 'lucide-react';
import { formatDuration } from '@/lib/operationalConstants';

interface Props {
  orders: OperationalOrder[];
  stages: OperationalStage[];
}

export function OperationalDashboardPanel({ orders, stages }: Props) {
  const m = useOperationalDashboard(orders, stages);

  const cards = [
    { label: 'Total', value: m.total, icon: Activity, color: 'text-blue-600' },
    { label: 'Atrasados', value: m.overdue, icon: AlertTriangle, color: 'text-red-600' },
    { label: 'Urgentes', value: m.urgent, icon: Flame, color: 'text-orange-600' },
    { label: 'Bloqueados', value: m.blocked, icon: Lock, color: 'text-zinc-700' },
    { label: 'Sem responsável', value: m.withoutOwner, icon: UserX, color: 'text-amber-600' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {cards.map(c => (
          <Card key={c.label} className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{c.label}</p>
                <p className="text-2xl font-semibold">{c.value}</p>
              </div>
              <c.icon className={`h-5 w-5 ${c.color}`} />
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-4 w-4" />
          <h3 className="font-semibold text-sm">Distribuição por etapa</h3>
        </div>
        <div className="space-y-1.5">
          {stages.map(s => {
            const count = m.byStage.get(s.id) ?? 0;
            const pct = m.total > 0 ? (count / m.total) * 100 : 0;
            return (
              <div key={s.id} className="flex items-center gap-2 text-xs">
                <span className="w-40 truncate">{s.name}</span>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full"
                    style={{ width: `${pct}%`, background: s.color ?? '#6366f1' }}
                  />
                </div>
                <span className="w-8 text-right text-muted-foreground">{count}</span>
              </div>
            );
          })}
        </div>
      </Card>

      {m.bottlenecks.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <h3 className="font-semibold text-sm">Gargalos (maior tempo médio)</h3>
          </div>
          <div className="space-y-2">
            {m.bottlenecks.map(b => (
              <div key={b.stageId} className="flex items-center justify-between text-xs">
                <span className="truncate">{b.stageName}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{b.count} pedidos</Badge>
                  <span className="font-medium">{formatDuration(Math.floor(b.avgHours * 3600))}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
