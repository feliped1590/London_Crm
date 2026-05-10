import { useMemo, useState } from 'react';
import { OperationalStageColumn } from './OperationalStageColumn';
import { MoveStageDialog } from './MoveStageDialog';
import { OperationalChangePipelineDialog } from './OperationalChangePipelineDialog';
import { OperationalHistoryDrawer } from './OperationalHistoryDrawer';
import { useMoveOrderOperationalStage } from '@/hooks/useMoveOrderOperationalStage';
import { useOperationalPermissions } from '@/hooks/useOperationalPermissions';
import { useOperationalPipelines } from '@/hooks/useOperationalPipelines';
import type { OperationalOrder } from '@/hooks/useOperationalKanbanData';
import type { OperationalStage } from '@/hooks/useOperationalPipelines';

interface Props {
  pipelineId: string;
  stages: OperationalStage[];
  orders: OperationalOrder[];
}

interface PendingMove {
  order: OperationalOrder;
  toStage: OperationalStage;
  fromStage: OperationalStage | null;
  requireReason: boolean;
  warning: string | null;
}

export function OperationalKanbanBoard({ pipelineId, stages, orders }: Props) {
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const [draggedOrderId, setDraggedOrderId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);
  const [historyOrder, setHistoryOrder] = useState<OperationalOrder | null>(null);
  const [changePipelineOrder, setChangePipelineOrder] = useState<OperationalOrder | null>(null);

  const moveMutation = useMoveOrderOperationalStage();
  const { canMove } = useOperationalPermissions();
  const { pipelines, stages: allStages } = useOperationalPipelines();

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
    // ordenação por prioridade dentro da coluna
    const order = ['bloqueado', 'urgente', 'alta', 'media', 'baixa'];
    map.forEach(list => {
      list.sort((a, b) => order.indexOf(a.operational_priority) - order.indexOf(b.operational_priority));
    });
    return { map, unassigned };
  }, [stages, orders]);

  const handleDragStart = (e: React.DragEvent, orderId: string) => {
    setDraggedOrderId(orderId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (toStage: OperationalStage) => {
    setDragOverStageId(null);
    const orderId = draggedOrderId;
    setDraggedOrderId(null);
    if (!orderId) return;
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    if (order.operational_stage_id === toStage.id) return;
    if (!canMove(pipelineId, toStage.operational_department)) return;

    const fromStage = stages.find(s => s.id === order.operational_stage_id) ?? null;

    // detecta salto não sequencial
    let requireReason = false;
    let warning: string | null = null;
    if (fromStage && Math.abs((fromStage.sort_order ?? 0) - (toStage.sort_order ?? 0)) > 1) {
      requireReason = true;
      warning = 'Salto não sequencial entre etapas — motivo é obrigatório.';
    }

    setPendingMove({ order, toStage, fromStage, requireReason, warning });
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

  const handleChangePipelineConfirm = (input: { toPipelineId: string; toStageId: string; reason: string }) => {
    if (!changePipelineOrder) return;
    moveMutation.mutate(
      {
        orderId: changePipelineOrder.id,
        pipelineId: input.toPipelineId,
        toStageId: input.toStageId,
        reason: input.reason,
      },
      { onSuccess: () => setChangePipelineOrder(null) },
    );
  };

  return (
    <>
      {/* minimapa de chips */}
      <div className="flex flex-wrap gap-1 mb-2 px-1">
        {stages.map(s => (
          <a
            key={s.id}
            href={`#stage-${s.id}`}
            className="text-[10px] px-2 py-0.5 rounded-full border bg-muted/40 hover:bg-muted truncate max-w-[120px]"
          >
            {s.name} ({(ordersByStage.map.get(s.id) ?? []).length})
          </a>
        ))}
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4">
        {stages.map(stage => {
          const stageOrders = ordersByStage.map.get(stage.id) ?? [];
          const allowed = canMove(pipelineId, stage.operational_department);
          return (
            <div key={stage.id} id={`stage-${stage.id}`}>
              <OperationalStageColumn
                pipelineId={pipelineId}
                stage={stage}
                orders={stageOrders}
                canMoveInto={allowed}
                isDragOver={dragOverStageId === stage.id}
                onDragOver={(e) => { e.preventDefault(); setDragOverStageId(stage.id); }}
                onDragLeave={() => setDragOverStageId(prev => (prev === stage.id ? null : prev))}
                onDrop={(e) => { e.preventDefault(); handleDrop(stage); }}
                onCardDragStart={handleDragStart}
                onOpenHistory={(o) => setHistoryOrder(o)}
                onChangePipeline={(o) => setChangePipelineOrder(o)}
              />
            </div>
          );
        })}

        {ordersByStage.unassigned.length > 0 && (
          <div className="shrink-0 min-w-[280px] w-[280px] bg-amber-50 dark:bg-amber-950/20 rounded-lg p-3 border border-amber-200 dark:border-amber-900">
            <h3 className="font-semibold text-sm mb-3 text-amber-900 dark:text-amber-200">
              Sem etapa ({ordersByStage.unassigned.length})
            </h3>
            <div className="space-y-2">
              {ordersByStage.unassigned.map(order => (
                <div key={order.id} className="text-xs border rounded p-2 bg-background">
                  #{order.number} — {order.company_name ?? '—'}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <MoveStageDialog
        open={!!pendingMove}
        fromStageName={pendingMove?.fromStage?.name ?? ''}
        toStageName={pendingMove?.toStage.name ?? ''}
        requireReason={pendingMove?.requireReason}
        warning={pendingMove?.warning ?? null}
        onCancel={() => setPendingMove(null)}
        onConfirm={handleConfirm}
        isPending={moveMutation.isPending}
      />

      <OperationalChangePipelineDialog
        open={!!changePipelineOrder}
        order={changePipelineOrder ? { id: changePipelineOrder.id, number: changePipelineOrder.number } : null}
        currentPipelineId={pipelineId}
        pipelines={pipelines}
        stages={allStages}
        onCancel={() => setChangePipelineOrder(null)}
        onConfirm={handleChangePipelineConfirm}
        isPending={moveMutation.isPending}
      />

      <OperationalHistoryDrawer
        open={!!historyOrder}
        order={historyOrder ? { id: historyOrder.id, number: historyOrder.number } : null}
        onClose={() => setHistoryOrder(null)}
      />
    </>
  );
}
