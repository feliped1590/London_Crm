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
import { AlertTriangle, Loader2 } from 'lucide-react';

interface CreditUpdateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
  isLoading?: boolean;
  companyName: string;
}

export function CreditUpdateModal({
  open,
  onOpenChange,
  onConfirm,
  isLoading = false,
  companyName,
}: CreditUpdateModalProps) {
  const [reason, setReason] = useState('');
  
  const handleConfirm = () => {
    if (reason.trim().length >= 10) {
      onConfirm(reason.trim());
      setReason('');
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setReason('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Confirmar Consulta de Crédito
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 pt-2">
              <p className="text-sm text-muted-foreground">
                Você está prestes a realizar uma nova consulta de crédito para <strong>{companyName}</strong>.
              </p>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <p className="font-medium">⚠️ Atenção:</p>
                <p className="mt-1">
                  Esta ação realizará uma nova consulta em bureaus de crédito, podendo gerar custos conforme contrato vigente. 
                  Utilize este recurso apenas quando necessário. <strong>Todas as consultas são auditadas.</strong>
                </p>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="reason">Motivo da consulta *</Label>
            <Textarea
              id="reason"
              placeholder="Descreva o motivo da consulta (mínimo 10 caracteres)..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              {reason.length}/10 caracteres mínimos
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={reason.trim().length < 10 || isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Consultando...
              </>
            ) : (
              'Confirmar Consulta'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
