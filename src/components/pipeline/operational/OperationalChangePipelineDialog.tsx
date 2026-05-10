import { useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { OperationalPipeline, OperationalStage } from '@/hooks/useOperationalPipelines';

interface Props {
  open: boolean;
  order: { id: string; number: string } | null;
  currentPipelineId: string | null;
  pipelines: OperationalPipeline[];
  stages: OperationalStage[];
  onCancel: () => void;
  onConfirm: (input: { toPipelineId: string; toStageId: string; reason: string }) => void;
  isPending?: boolean;
}

export function OperationalChangePipelineDialog({
  open, order, currentPipelineId, pipelines, stages, onCancel, onConfirm, isPending,
}: Props) {
  const [toPipelineId, setToPipelineId] = useState<string | null>(null);
  const [toStageId, setToStageId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const targetPipelines = pipelines.filter(p => p.id !== currentPipelineId);
  const stagesForTarget = toPipelineId ? stages.filter(s => s.pipeline_id === toPipelineId) : [];
  const blocked = !toPipelineId || !toStageId || reason.trim().length === 0;

  const handleClose = () => {
    setToPipelineId(null);
    setToStageId(null);
    setReason('');
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Trocar pipeline operacional</DialogTitle>
          <DialogDescription>
            Pedido <span className="font-medium">#{order?.number}</span> será movido para outro
            pipeline operacional. O histórico é preservado e essa ação é registrada.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Pipeline destino</label>
            <Select value={toPipelineId ?? undefined} onValueChange={(v) => { setToPipelineId(v); setToStageId(null); }}>
              <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent>
                {targetPipelines.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Etapa destino</label>
            <Select
              value={toStageId ?? undefined}
              onValueChange={setToStageId}
              disabled={!toPipelineId}
            >
              <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent>
                {stagesForTarget.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Motivo da troca (obrigatório)
            </label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Justificativa para auditoria…"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isPending}>Cancelar</Button>
          <Button
            disabled={isPending || blocked}
            onClick={() => onConfirm({
              toPipelineId: toPipelineId!,
              toStageId: toStageId!,
              reason: reason.trim(),
            })}
          >
            Trocar pipeline
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
