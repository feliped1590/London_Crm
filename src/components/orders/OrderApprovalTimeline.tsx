import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  CheckCircle2, 
  XCircle, 
  Factory, 
  Package, 
  Receipt, 
  Truck,
  Clock,
  User,
  FileText
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useOrderApproval, OrderApproval } from '@/hooks/useOrderApproval';
import { OrderStatus, orderStatusConfig } from '@/types/products';

interface OrderApprovalTimelineProps {
  orderId: string;
  orderStatus: OrderStatus;
}

const statusIcons: Record<OrderStatus, React.ElementType> = {
  pendente: FileText,
  em_producao: Factory,
  produzido: Package,
  faturado: Receipt,
  entregue: Truck,
  cancelado: XCircle,
};

const statusColors: Record<OrderStatus, string> = {
  pendente: 'bg-slate-500',
  em_producao: 'bg-blue-500',
  produzido: 'bg-cyan-500',
  faturado: 'bg-yellow-500',
  entregue: 'bg-green-500',
  cancelado: 'bg-red-500',
};

export function OrderApprovalTimeline({ orderId, orderStatus }: OrderApprovalTimelineProps) {
  const { approvalHistory, isLoadingHistory } = useOrderApproval(orderId, orderStatus);

  if (isLoadingHistory) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (approvalHistory.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <CheckCircle2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>Nenhuma aprovação registrada ainda.</p>
        <p className="text-sm mt-1">O histórico aparecerá quando o status for alterado.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[350px]">
      <div className="relative pl-6">
        <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-border" />
        <div className="space-y-4">
          {approvalHistory.map((approval) => (
            <ApprovalEntry key={approval.id} approval={approval} />
          ))}
        </div>
      </div>
    </ScrollArea>
  );
}

function ApprovalEntry({ approval }: { approval: OrderApproval }) {
  const Icon = statusIcons[approval.to_status] || CheckCircle2;
  const dotColor = statusColors[approval.to_status] || 'bg-primary';
  const isCancellation = approval.to_status === 'cancelado';

  const bgColor = isCancellation 
    ? 'bg-red-500/10 border-red-500/20' 
    : 'bg-primary/5 border-primary/20';

  const iconColor = isCancellation 
    ? 'text-red-600' 
    : 'text-primary';

  return (
    <div className="relative">
      <div className={`absolute -left-4 top-1 h-3 w-3 rounded-full border-2 border-background ${dotColor}`} />

      <div className={`rounded-lg p-3 border ${bgColor}`}>
        <div className="flex items-start gap-2">
          <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${iconColor}`} />
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm">
              {isCancellation ? 'Pedido Cancelado' : `Aprovado para ${orderStatusConfig[approval.to_status].label}`}
            </div>
            
            {approval.from_status && (
              <div className="text-sm text-muted-foreground mt-1">
                De: {orderStatusConfig[approval.from_status].label} → {orderStatusConfig[approval.to_status].label}
              </div>
            )}

            {approval.notes && (
              <div className="mt-2 p-2 bg-muted/50 rounded text-sm">
                <span className="text-muted-foreground">Observação:</span> {approval.notes}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{format(new Date(approval.approved_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
          </div>
          {approval.profiles?.full_name && (
            <div className="flex items-center gap-1">
              <User className="h-3 w-3" />
              <span>{approval.profiles.full_name}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
