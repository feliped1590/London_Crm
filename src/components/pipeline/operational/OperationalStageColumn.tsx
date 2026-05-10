import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { OperationalCardExpanded } from './OperationalCardExpanded';
import type { OperationalOrder } from '@/hooks/useOperationalKanbanData';
import type { OperationalStage } from '@/hooks/useOperationalPipelines';
import { cn } from '@/lib/utils';

interface Props {
  pipelineId: string;
  stage: OperationalStage;
  orders: OperationalOrder[];
  canMoveInto: boolean;
  isDragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onCardDragStart: (e: React.DragEvent, orderId: string) => void;
  onOpenHistory: (order: OperationalOrder) => void;
  onChangePipeline: (order: OperationalOrder) => void;
}

export function OperationalStageColumn({
  pipelineId, stage, orders, canMoveInto, isDragOver,
  onDragOver, onDragLeave, onDrop, onCardDragStart, onOpenHistory, onChangePipeline,
}: Props) {
  const storageKey = `opkanban:collapsed:${pipelineId}:${stage.id}`;
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try { setCollapsed(localStorage.getItem(storageKey) === '1'); } catch {/* */}
  }, [storageKey]);

  const toggle = () => {
    setCollapsed(c => {
      const nv = !c;
      try { localStorage.setItem(storageKey, nv ? '1' : '0'); } catch {/* */}
      return nv;
    });
  };

  if (collapsed) {
    return (
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={cn(
          'shrink-0 w-12 bg-muted/30 rounded-lg border-2 transition-colors flex flex-col items-center py-2 gap-2',
          isDragOver && canMoveInto ? 'border-primary bg-primary/5' : 'border-transparent',
        )}
      >
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={toggle}>
          <ChevronRight className="h-3 w-3" />
        </Button>
        <span
          className="text-[10px] font-semibold writing-vertical-rl select-none"
          style={{ writingMode: 'vertical-rl' }}
        >
          {stage.name}
        </span>
        <Badge variant="outline" className="text-[10px]">{orders.length}</Badge>
      </div>
    );
  }

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        'shrink-0 min-w-[280px] w-[280px] bg-muted/30 rounded-lg p-3 border-2 transition-colors flex flex-col',
        isDragOver && canMoveInto && 'border-primary bg-primary/5',
        isDragOver && !canMoveInto && 'border-red-400 bg-red-50/40',
        !isDragOver && 'border-transparent',
      )}
    >
      <div className="sticky top-0 bg-muted/30 backdrop-blur z-10 -m-3 mb-2 p-3 pb-2 rounded-t-lg">
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="inline-block w-2 h-2 rounded-full shrink-0"
              style={{ background: stage.color ?? '#6366f1' }}
            />
            <h3 className="font-semibold text-sm truncate">{stage.name}</h3>
            {!canMoveInto && (
              <Lock className="h-3 w-3 text-muted-foreground shrink-0" aria-label="Sem permissão para mover" />
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-xs text-muted-foreground">{orders.length}</span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={toggle}>
              <ChevronLeft className="h-3 w-3" />
            </Button>
          </div>
        </div>
        {stage.operational_department && (
          <Badge variant="outline" className="text-[9px] mt-1 font-normal">
            {stage.operational_department}
          </Badge>
        )}
      </div>

      <div className="space-y-2 min-h-[100px] overflow-y-auto">
        {orders.map(order => (
          <OperationalCardExpanded
            key={order.id}
            order={order}
            pipelineId={pipelineId}
            stage={stage}
            canMove={canMoveInto}
            onDragStart={onCardDragStart}
            onOpenHistory={() => onOpenHistory(order)}
            onChangePipeline={() => onChangePipeline(order)}
          />
        ))}
        {orders.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6">
            {canMoveInto ? 'Solte um pedido aqui' : '—'}
          </p>
        )}
      </div>
    </div>
  );
}
