import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useOperationalOrderHistory } from '@/hooks/useOperationalOrderHistory';
import { formatDuration } from '@/lib/operationalConstants';
import { ArrowRight, Workflow, Layers, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Props {
  open: boolean;
  onClose: () => void;
  order: { id: string; number: string } | null;
}

export function OperationalHistoryDrawer({ open, onClose, order }: Props) {
  const { data: rows = [], isLoading } = useOperationalOrderHistory(open ? order?.id ?? null : null);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[420px] sm:max-w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Histórico — Pedido #{order?.number}</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-3">
          {isLoading && <p className="text-xs text-muted-foreground">Carregando…</p>}
          {!isLoading && rows.length === 0 && (
            <p className="text-xs text-muted-foreground">Sem movimentações registradas.</p>
          )}
          {rows.map((r) => {
            const isPipelineMove = r.move_kind === 'pipeline' || r.move_kind === 'both';
            return (
              <div
                key={r.id}
                className="border rounded-md p-3 text-xs space-y-2 bg-muted/20"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    {isPipelineMove ? <Workflow className="h-3 w-3" /> : <Layers className="h-3 w-3" />}
                    <span>
                      {r.move_kind === 'initial'
                        ? 'Entrada'
                        : isPipelineMove
                          ? 'Troca de pipeline'
                          : 'Movimentação'}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(r.moved_at).toLocaleString('pt-BR')}
                  </span>
                </div>

                {isPipelineMove && (
                  <div className="flex items-center gap-1 font-medium">
                    <span>{r.from_pipeline_name ?? '—'}</span>
                    <ArrowRight className="h-3 w-3 shrink-0" />
                    <span>{r.to_pipeline_name ?? '—'}</span>
                  </div>
                )}

                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Etapa:</span>
                  <span className="font-medium">{r.from_stage_name ?? '—'}</span>
                  <ArrowRight className="h-3 w-3 shrink-0" />
                  <span className="font-medium">{r.to_stage_name ?? '—'}</span>
                </div>

                <div className="flex items-center gap-3 flex-wrap text-[11px] text-muted-foreground">
                  {r.moved_by_name && (
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" /> {r.moved_by_name}
                    </span>
                  )}
                  {r.time_in_stage_seconds != null && (
                    <span>Tempo na etapa: {formatDuration(r.time_in_stage_seconds)}</span>
                  )}
                  {r.is_non_sequential && (
                    <Badge variant="outline" className="border-amber-400 text-amber-700 text-[9px] py-0">
                      não sequencial
                    </Badge>
                  )}
                </div>

                {r.reason && (
                  <p className="text-[11px] italic text-foreground/80 border-l-2 border-muted-foreground/30 pl-2">
                    {r.reason}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
