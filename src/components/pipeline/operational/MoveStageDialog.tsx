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

interface Props {
  open: boolean;
  fromStageName: string;
  toStageName: string;
  requireReason?: boolean;
  warning?: string | null;
  onCancel: () => void;
  onConfirm: (reason: string | null) => void;
  isPending?: boolean;
}

export function MoveStageDialog({
  open,
  fromStageName,
  toStageName,
  requireReason,
  warning,
  onCancel,
  onConfirm,
  isPending,
}: Props) {
  const [reason, setReason] = useState('');
  const blocked = requireReason && reason.trim().length === 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setReason('');
          onCancel();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar movimentação</DialogTitle>
          <DialogDescription>
            <span className="block">
              <span className="text-muted-foreground">De: </span>
              <span className="font-medium">{fromStageName || '—'}</span>
            </span>
            <span className="block">
              <span className="text-muted-foreground">Para: </span>
              <span className="font-medium">{toStageName}</span>
            </span>
            {warning && (
              <span className="block mt-2 text-amber-700 dark:text-amber-400 text-xs">
                ⚠ {warning}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            Motivo {requireReason ? '(obrigatório)' : '(opcional)'}
          </label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={requireReason ? 'Descreva o motivo da movimentação…' : 'Opcional…'}
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            disabled={isPending || blocked}
            onClick={() => {
              onConfirm(reason.trim() || null);
              setReason('');
            }}
          >
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
