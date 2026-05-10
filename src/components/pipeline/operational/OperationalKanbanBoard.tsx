import { useMemo, useState } from 'react';
import { OperationalOrderCard } from './OperationalOrderCard';
import { MoveStageDialog } from './MoveStageDialog';
import { useMoveOrderOperationalStage } from '@/hooks/useMoveOrderOperationalStage';
import type { OperationalOrder } from '@/hooks/useOperationalKanbanData';
import type { OperationalStage } from '@/hooks/useOperationalPipelines';
import { cn } from '@/lib/utils';

interface Props {
  pipelineId: string;
  stages: OperationalStage[];
  orders: OperationalOrder[];
}

interface PendingMove {
  order: OperationalOrder;
  toStage: OperationalStage;
  fromStageName: string;
}

export function OperationalKanbanBoard({ pipelineId, stages, orders }: Props) {
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const [draggedOrderId, setDraggedOrderId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);
  const moveMutation = useMoveOrderOperationalStage();

  const ordersByStage = useMemo(() => {
    const map = new Map<string, OperationalOrder[]>();
    stages.forEach(s => map.set(s.id, []));
    const unassigned: OperationalOrder[] = [];
    orders.forEach(o => {
      if (o.operational_stage_id && map.has(o.operational_stage_id)) {
        map.get(o.operational_stage_id)!.push(o);
      } else {
        unassigned.push(o);
      }
    });
    return { map, unassigned };
  }, [stages, orders]);

  const handleDragStart = (e: React.DragEvent, orderId: string) => {
    setDraggedOrderId(orderId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStageId(stageId);
  };

  const handleDrop = (e: React.DragEvent, stage: OperationalStage) => {
    e.preventDefault();
    setDragOverStageId(null);
    const orderId = draggedOrderId;
    setDraggedOrderId(null);
    if (!orderId) return;

    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    if (order.operational_stage_id === stage.id) return;

    const fromStage = stages.find(s => s.id === order.operational_stage_id);
    setPendingMove({
      order,
      toStage: stage,
      fromStageName: fromStage?.name ?? '',
    });
  };

  const handleConfirm = (reason: string | null) => {
    if (!pendingMove) return;
    moveMutation.mutate(
      {
        orderId: pendingMove.order.id,
        pipelineId,
        toStageId: pendingMove.toStage.id,
        reason,
      },
      { onSuccess: () => setPendingMove(null) },
    );
  };

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {stages.map(stage => {
          const stageOrders = ordersByStage.map.get(stage.id) ?? [];
          return (
            <div
              key={stage.id}
              onDragOver={(e) => handleDragOver(e, stage.id)}
              onDragLeave={() => setDragOverStageId(prev => (prev === stage.id ? null : prev))}
              onDrop={(e) => handleDrop(e, stage)}
              className={cn(
                'min-w-[280px] w-[280px] bg-muted/30 rounded-lg p-3 border-2 transition-colors',
                dragOverStageId === stage.id ? 'border-primary bg-primary/5' : 'border-transparent',
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ background: stage.color ?? '#6366f1' }}
                  />
                  <h3 className="font-semibold text-sm">{stage.name}</h3>
                </div>
                <span className="text-xs text-muted-foreground">{stageOrders.length}</span>
              </div>
              <div className="space-y-2 min-h-[100px]">
                {stageOrders.map(order => (
                  <OperationalOrderCard key={order.id} order={order} onDragStart={handleDragStart} />
                ))}
                {stageOrders.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-6">
                    Solte um pedido aqui
                  </p>
                )}
              </div>
            </div>
          );
        })}

        {ordersByStage.unassigned.length > 0 && (
          <div className="min-w-[280px] w-[280px] bg-amber-50 dark:bg-amber-950/20 rounded-lg p-3 border border-amber-200 dark:border-amber-900">
            <h3 className="font-semibold text-sm mb-3 text-amber-900 dark:text-amber-200">
              Sem etapa ({ordersByStage.unassigned.length})
            </h3>
            <div className="space-y-2">
              {ordersByStage.unassigned.map(order => (
                <OperationalOrderCard key={order.id} order={order} onDragStart={handleDragStart} />
              ))}
            </div>
          </div>
        )}
      </div>

      <MoveStageDialog
        open={!!pendingMove}
        fromStageName={pendingMove?.fromStageName ?? ''}
        toStageName={pendingMove?.toStage.name ?? ''}
        onCancel={() => setPendingMove(null)}
        onConfirm={handleConfirm}
        isPending={moveMutation.isPending}
      />
    </>
  );
}
