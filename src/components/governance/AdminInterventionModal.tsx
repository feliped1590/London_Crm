import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Shield } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AdminInterventionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientName: string;
  clientOwnerName: string;
  actionDescription: string;
  onConfirm: (justification: string) => void;
  onCancel?: () => void;
  isLoading?: boolean;
}

export function AdminInterventionModal({
  open,
  onOpenChange,
  clientName,
  clientOwnerName,
  actionDescription,
  onConfirm,
  onCancel,
  isLoading = false,
}: AdminInterventionModalProps) {
  const [justification, setJustification] = useState('');

  const handleConfirm = () => {
    if (justification.trim().length < 10) {
      return;
    }
    onConfirm(justification.trim());
    setJustification('');
  };

  const handleCancel = () => {
    setJustification('');
    onCancel?.();
    onOpenChange(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setJustification('');
      onCancel?.();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900">
              <Shield className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <DialogTitle>Autorização Necessária</DialogTitle>
              <DialogDescription>
                Ação em cliente de outro vendedor
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert className="border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100 dark:border-amber-700">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertDescription className="text-amber-800 dark:text-amber-200">
              <strong>{actionDescription}</strong> para o cliente{' '}
              <strong>{clientName}</strong>, que pertence ao vendedor comercial{' '}
              <strong>{clientOwnerName}</strong>.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="justification">
              Motivo da Intervenção <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="justification"
              placeholder="Descreva o motivo para realizar esta ação no cliente de outro vendedor..."
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Mínimo de 10 caracteres. Esta ação será registrada no histórico de auditoria.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isLoading || justification.trim().length < 10}
          >
            {isLoading ? 'Processando...' : 'Confirmar e Registrar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
