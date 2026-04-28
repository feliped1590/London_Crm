import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowRight, 
  CheckCircle2, 
  XCircle, 
  Factory, 
  Package, 
  Receipt, 
  Truck,
  AlertTriangle 
} from 'lucide-react';
import { useOrderApproval } from '@/hooks/useOrderApproval';
import { OrderStatus, OrderType, orderStatusConfig } from '@/types/products';

interface OrderApprovalActionsProps {
  orderId: string;
  orderStatus: OrderStatus;
  orderCreatedBy?: string | null;
  orderType?: OrderType;
  compact?: boolean;
}

const transitionIcons: Record<string, React.ElementType> = {
  'em_producao': Factory,
  'produzido': Package,
  'em_faturamento': Receipt,
  'faturado': Receipt,
  'entregue': Truck,
};

export function OrderApprovalActions({ 
  orderId, 
  orderStatus, 
  orderCreatedBy,
  orderType = 'Novo/Alteração',
  compact = false 
}: OrderApprovalActionsProps) {
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [notes, setNotes] = useState('');
  const [cancelReason, setCancelReason] = useState('');

  const {
    canApproveNextTransition,
    getNextTransition,
    approve,
    isApproving,
    canCancelOrder,
    cancel,
    isCancelling,
  } = useOrderApproval(orderId, orderStatus, orderCreatedBy, orderType);

  const nextTransition = getNextTransition();
  const TransitionIcon = nextTransition ? (transitionIcons[nextTransition.to] || ArrowRight) : ArrowRight;

  const handleApprove = () => {
    approve({ notes: notes || undefined }, {
      onSuccess: () => {
        setShowApproveDialog(false);
        setNotes('');
      },
    });
  };

  const handleCancel = () => {
    if (!cancelReason.trim()) return;
    cancel({ reason: cancelReason }, {
      onSuccess: () => {
        setShowCancelDialog(false);
        setCancelReason('');
      },
    });
  };

  // If no actions available, show nothing
  if (!canApproveNextTransition && !canCancelOrder) {
    return null;
  }

  // Final states - no actions
  if (orderStatus === 'entregue' || orderStatus === 'cancelado' || ((orderType === 'pronta_entrega' || orderType === 'Pronto Entrega') && orderStatus === 'faturado')) {
    return null;
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {canApproveNextTransition && nextTransition && (
          <Button
            size="sm"
            variant="default"
            onClick={() => setShowApproveDialog(true)}
            disabled={isApproving}
          >
            <TransitionIcon className="h-4 w-4 mr-1" />
            {nextTransition.label}
          </Button>
        )}
        
        {canCancelOrder && (
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setShowCancelDialog(true)}
            disabled={isCancelling}
          >
            <XCircle className="h-4 w-4 mr-1" />
            Cancelar
          </Button>
        )}

        {/* Dialogs */}
        <ApproveDialog
          open={showApproveDialog}
          onOpenChange={setShowApproveDialog}
          transition={nextTransition}
          notes={notes}
          setNotes={setNotes}
          onApprove={handleApprove}
          isApproving={isApproving}
        />

        <CancelDialog
          open={showCancelDialog}
          onOpenChange={setShowCancelDialog}
          reason={cancelReason}
          setReason={setCancelReason}
          onCancel={handleCancel}
          isCancelling={isCancelling}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Next Transition Card */}
      {canApproveNextTransition && nextTransition && (
        <div className="p-4 border rounded-lg bg-card">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <TransitionIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="font-medium">{nextTransition.label}</h4>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {nextTransition.description}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className={orderStatusConfig[nextTransition.from].color.replace('bg-', 'border-') + ' ' + orderStatusConfig[nextTransition.from].color.replace('bg-', 'text-')}>
                    {orderStatusConfig[nextTransition.from].label}
                  </Badge>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <Badge className={orderStatusConfig[nextTransition.to].color}>
                    {orderStatusConfig[nextTransition.to].label}
                  </Badge>
                </div>
              </div>
            </div>
            <Button onClick={() => setShowApproveDialog(true)} disabled={isApproving}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Aprovar
            </Button>
          </div>
        </div>
      )}

      {/* Cancel Option */}
      {canCancelOrder && (
        <div className="p-4 border border-destructive/30 rounded-lg bg-destructive/5">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <h4 className="font-medium text-destructive">Cancelar Pedido</h4>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Esta ação não pode ser desfeita. Informe o motivo do cancelamento.
                </p>
              </div>
            </div>
            <Button 
              variant="destructive" 
              onClick={() => setShowCancelDialog(true)}
              disabled={isCancelling}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Cancelar Pedido
            </Button>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <ApproveDialog
        open={showApproveDialog}
        onOpenChange={setShowApproveDialog}
        transition={nextTransition}
        notes={notes}
        setNotes={setNotes}
        onApprove={handleApprove}
        isApproving={isApproving}
      />

      <CancelDialog
        open={showCancelDialog}
        onOpenChange={setShowCancelDialog}
        reason={cancelReason}
        setReason={setCancelReason}
        onCancel={handleCancel}
        isCancelling={isCancelling}
      />
    </div>
  );
}

// Approve Dialog Component
function ApproveDialog({
  open,
  onOpenChange,
  transition,
  notes,
  setNotes,
  onApprove,
  isApproving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transition: ReturnType<ReturnType<typeof useOrderApproval>['getNextTransition']>;
  notes: string;
  setNotes: (notes: string) => void;
  onApprove: () => void;
  isApproving: boolean;
}) {
  if (!transition) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            {transition.label}
          </DialogTitle>
          <DialogDescription>
            {transition.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center justify-center gap-3">
            <Badge variant="outline" className="text-base px-3 py-1">
              {orderStatusConfig[transition.from].label}
            </Badge>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
            <Badge className={`text-base px-3 py-1 ${orderStatusConfig[transition.to].color}`}>
              {orderStatusConfig[transition.to].label}
            </Badge>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações (opcional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Adicione observações sobre esta aprovação..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={onApprove} disabled={isApproving}>
            {isApproving ? 'Aprovando...' : 'Confirmar Aprovação'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Cancel Dialog Component
function CancelDialog({
  open,
  onOpenChange,
  reason,
  setReason,
  onCancel,
  isCancelling,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason: string;
  setReason: (reason: string) => void;
  onCancel: () => void;
  isCancelling: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <XCircle className="h-5 w-5" />
            Cancelar Pedido
          </DialogTitle>
          <DialogDescription>
            Esta ação não pode ser desfeita. O pedido será marcado como cancelado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="cancel-reason">Motivo do cancelamento *</Label>
            <Textarea
              id="cancel-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Informe o motivo do cancelamento..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Voltar
          </Button>
          <Button 
            variant="destructive" 
            onClick={onCancel} 
            disabled={isCancelling || !reason.trim()}
          >
            {isCancelling ? 'Cancelando...' : 'Confirmar Cancelamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
