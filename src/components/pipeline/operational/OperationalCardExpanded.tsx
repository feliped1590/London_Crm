import { CheckCircle2, Calendar, Building2, Workflow, History as HistoryIcon, AlertTriangle, UserCheck } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { OperationalSlaBadge } from './OperationalSlaBadge';
import { OperationalPriorityMenu } from './OperationalPriorityMenu';
import { OperationalAssignOwnerPopover } from './OperationalAssignOwnerPopover';
import type { OperationalOrder } from '@/hooks/useOperationalKanbanData';
import type { OperationalStage } from '@/hooks/useOperationalPipelines';

interface Props {
  order: OperationalOrder;
  pipelineId: string;
  stage: OperationalStage | null;
  canMove: boolean;
  onDragStart: (e: React.DragEvent, orderId: string) => void;
  onOpenHistory: () => void;
  onChangePipeline: () => void;
}

function fmtDate(v: string | null) {
  if (!v) return null;
  try { return new Date(v).toLocaleDateString('pt-BR'); } catch { return null; }
}
function fmtCurrency(v: number | null) {
  if (v == null) return '—';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function OperationalCardExpanded({
  order, pipelineId, stage, canMove, onDragStart, onOpenHistory, onChangePipeline,
}: Props) {
  const synced = fmtDate(order.erp_synced_at);
  const delivery = fmtDate(order.delivery_date);
  const isCritical = stage?.is_critical_stage;
  const waiting = stage?.waiting_for_customer;

  return (
    <Card
      draggable={canMove}
      onDragStart={(e) => canMove && onDragStart(e, order.id)}
      className={
        'p-3 mb-2 transition-colors ' +
        (canMove ? 'cursor-grab active:cursor-grabbing hover:border-primary/50 ' : 'cursor-default opacity-90 ')
      }
    >
      <div className="flex items-start justify-between gap-2">
        <div className="font-semibold text-sm">#{order.number}</div>
        <Badge variant="outline" className="text-[10px] shrink-0">
          {fmtCurrency(order.total_value)}
        </Badge>
      </div>

      <div className="mt-2 flex items-center gap-2 flex-wrap">
        <OperationalPriorityMenu
          orderId={order.id}
          pipelineId={pipelineId}
          value={order.operational_priority}
          disabled={!canMove}
        />
        <OperationalSlaBadge
          enteredAt={order.operational_entered_stage_at}
          warningHours={stage?.sla_warning_hours ?? null}
          criticalHours={stage?.sla_critical_hours ?? null}
        />
        {isCritical && (
          <Badge variant="outline" className="text-[10px] border-red-400 text-red-700">
            <AlertTriangle className="h-3 w-3 mr-1" /> crítica
          </Badge>
        )}
        {waiting && (
          <Badge variant="outline" className="text-[10px] border-blue-400 text-blue-700">
            aguard. cliente
          </Badge>
        )}
      </div>

      {order.company_name && (
        <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
          <Building2 className="h-3 w-3 shrink-0" />
          <span className="truncate">{order.company_name}</span>
        </div>
      )}

      {delivery && (
        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3 shrink-0" />
          <span>Entrega: {delivery}</span>
        </div>
      )}

      <div className="mt-2 flex items-center gap-1">
        {!order.operational_owner_id && (
          <UserCheck className="h-3 w-3 text-amber-600 shrink-0" />
        )}
        <OperationalAssignOwnerPopover
          orderId={order.id}
          pipelineId={pipelineId}
          ownerId={order.operational_owner_id}
          ownerName={order.owner_name ?? null}
          disabled={!canMove}
        />
      </div>

      {synced && (
        <div className="mt-2 flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="h-3 w-3 shrink-0" />
          <span>Enviado ao ERP em {synced}</span>
        </div>
      )}

      <div className="mt-2 flex items-center gap-1 pt-2 border-t border-border/50">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-[11px]"
          onClick={(e) => { e.stopPropagation(); onOpenHistory(); }}
        >
          <HistoryIcon className="h-3 w-3 mr-1" /> Histórico
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-[11px]"
          disabled={!canMove}
          onClick={(e) => { e.stopPropagation(); onChangePipeline(); }}
        >
          <Workflow className="h-3 w-3 mr-1" /> Trocar pipeline
        </Button>
      </div>
    </Card>
  );
}
