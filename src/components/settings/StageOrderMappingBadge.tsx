import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ArrowRight, Zap, Hand } from 'lucide-react';
import { OrderStatus, orderStatusConfig } from '@/types/products';
import { cn } from '@/lib/utils';

interface StageOrderMappingBadgeProps {
  targetStatus: OrderStatus | null | undefined;
  autoApply: boolean;
  appliesTo: 'producao' | 'pronta_entrega' | null | undefined;
  className?: string;
}

/**
 * Compact badge shown next to a pipeline stage to indicate its order-status mapping.
 */
export function StageOrderMappingBadge({
  targetStatus,
  autoApply,
  appliesTo,
  className,
}: StageOrderMappingBadgeProps) {
  if (!targetStatus) {
    return null;
  }

  const statusLabel = orderStatusConfig[targetStatus]?.label || targetStatus;
  const Icon = autoApply ? Zap : Hand;
  const typeLabel =
    appliesTo === 'producao'
      ? 'Produção'
      : appliesTo === 'pronta_entrega'
      ? 'Pronta entrega'
      : 'Todos os tipos';

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn('inline-flex items-center gap-1', className)}>
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] py-0 h-4 gap-1',
                autoApply
                  ? 'border-primary/40 text-primary'
                  : 'border-warning/40 text-warning',
              )}
            >
              <ArrowRight className="h-2.5 w-2.5" />
              {statusLabel}
              <Icon className="h-2.5 w-2.5" />
            </Badge>
            {!autoApply && (
              <Badge
                variant="outline"
                className="text-[10px] py-0 h-4 gap-1 border-warning/60 text-warning bg-warning/5"
              >
                ⚠️ Manual
              </Badge>
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1 text-xs">
            <p>
              <strong>Pedido →</strong> {statusLabel}
            </p>
            <p>
              <strong>Modo:</strong>{' '}
              {autoApply
                ? 'Automático (aplica ao mover o deal)'
                : 'Manual — apenas sugere, não altera o pedido sem confirmação'}
            </p>
            <p>
              <strong>Aplica a:</strong> {typeLabel}
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
