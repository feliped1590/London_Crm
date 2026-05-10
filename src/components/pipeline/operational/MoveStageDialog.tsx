import { useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface Props {
  open: boolean;
  fromStageName: string;
  toStageName: string;
  onCancel: () => void;
  onConfirm: (reason: string | null) => void;
  isPending?: boolean;
}

export function MoveStageDialog({ open, fromStageName, toStageName, onCancel, onConfirm, isPending }: Props) {
  const [reason, setReason] = useState('');

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mover pedido</DialogTitle>
          <DialogDescription>
            De <strong>{fromStageName || '—'}</strong> para <strong>{toStageName}</strong>.
            Movimentação interna do CRM (não afeta o ERP).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="reason">Motivo (opcional)</Label>
          <Textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex.: liberado pela qualidade"
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isPending}>Cancelar</Button>
          <Button onClick={() => onConfirm(reason.trim() || null)} disabled={isPending}>
            {isPending ? 'Movendo...' : 'Confirmar movimentação'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
