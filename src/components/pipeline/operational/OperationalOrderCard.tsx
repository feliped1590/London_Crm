import { CheckCircle2, Calendar, Building2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { OperationalOrder } from '@/hooks/useOperationalKanbanData';

interface Props {
  order: OperationalOrder;
  onDragStart: (e: React.DragEvent, orderId: string) => void;
}

function formatDate(value: string | null) {
  if (!value) return null;
  try {
    return new Date(value).toLocaleDateString('pt-BR');
  } catch {
    return null;
  }
}

function formatCurrency(value: number | null) {
  if (value == null) return '—';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function OperationalOrderCard({ order, onDragStart }: Props) {
  const syncedAt = formatDate(order.erp_synced_at);
  const deliveryDate = formatDate(order.delivery_date);

  return (
    <Card
      draggable
      onDragStart={(e) => onDragStart(e, order.id)}
      className="cursor-grab active:cursor-grabbing p-3 mb-2 hover:border-primary/50 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="font-semibold text-sm">#{order.number}</div>
        <Badge variant="outline" className="text-[10px] shrink-0">
          {formatCurrency(order.total_value)}
        </Badge>
      </div>

      {order.company_name && (
        <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
          <Building2 className="h-3 w-3 shrink-0" />
          <span className="truncate">{order.company_name}</span>
        </div>
      )}

      {deliveryDate && (
        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3 shrink-0" />
          <span>Entrega: {deliveryDate}</span>
        </div>
      )}

      {syncedAt && (
        <div className="mt-2 flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="h-3 w-3 shrink-0" />
          <span>Enviado ao ERP em {syncedAt}</span>
        </div>
      )}
    </Card>
  );
}
