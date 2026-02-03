import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Clock } from 'lucide-react';

interface SLAJustificationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealName: string;
  daysInStage: number;
  onConfirm: (reason: string) => void;
  isLoading?: boolean;
}

export function SLAJustificationModal({
  open,
  onOpenChange,
  dealName,
  daysInStage,
  onConfirm,
  isLoading,
}: SLAJustificationModalProps) {
  const [reason, setReason] = useState('');

  const handleConfirm = () => {
    if (reason.trim()) {
      onConfirm(reason.trim());
      setReason('');
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setReason('');
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            SLA Excedido
          </DialogTitle>
          <DialogDescription className="space-y-3 pt-2">
            <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
              <Clock className="h-4 w-4 text-destructive shrink-0" />
              <span className="text-sm">
                <strong>{dealName}</strong> está há <strong>{daysInStage} dias</strong> nesta etapa.
              </span>
            </div>
            <p className="text-sm text-foreground">
              Este negócio excedeu o tempo máximo nesta etapa. Informe o motivo para prosseguir.
            </p>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="sla-reason">Justificativa *</Label>
            <Textarea
              id="sla-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Cliente solicitou mais tempo para análise interna..."
              rows={4}
              className="mt-1.5"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Esta justificativa será registrada no histórico do negócio.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!reason.trim() || isLoading}
            className="gap-2"
          >
            {isLoading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : null}
            Confirmar e Prosseguir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
