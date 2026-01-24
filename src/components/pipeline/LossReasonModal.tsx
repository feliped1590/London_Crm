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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { AlertTriangle } from 'lucide-react';

const LOSS_REASONS = [
  { value: 'preco', label: 'Preço', description: 'O cliente considerou o preço alto demais' },
  { value: 'concorrencia', label: 'Concorrência', description: 'Optou por um concorrente' },
  { value: 'timing', label: 'Timing/Momento', description: 'Não era o momento certo para o cliente' },
  { value: 'orcamento', label: 'Sem Orçamento', description: 'Cliente não tinha orçamento disponível' },
  { value: 'necessidade', label: 'Sem Necessidade', description: 'O cliente não tinha necessidade real' },
  { value: 'decisor', label: 'Decisor Não Alcançado', description: 'Não conseguimos falar com o decisor' },
  { value: 'inativo', label: 'Cliente Inativo', description: 'Cliente parou de responder' },
  { value: 'outro', label: 'Outro', description: 'Outro motivo não listado' },
];

interface LossReasonModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealName: string;
  onConfirm: (reason: string, notes: string) => void;
  isLoading?: boolean;
}

export function LossReasonModal({
  open,
  onOpenChange,
  dealName,
  onConfirm,
  isLoading = false,
}: LossReasonModalProps) {
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [notes, setNotes] = useState('');

  const handleConfirm = () => {
    if (!selectedReason) return;
    
    const reasonLabel = LOSS_REASONS.find(r => r.value === selectedReason)?.label || selectedReason;
    onConfirm(reasonLabel, notes);
    
    // Reset state
    setSelectedReason('');
    setNotes('');
  };

  const handleClose = () => {
    setSelectedReason('');
    setNotes('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Motivo da Perda
          </DialogTitle>
          <DialogDescription>
            Por que o negócio <span className="font-medium">"{dealName}"</span> foi perdido?
            Essa informação ajuda a melhorar suas vendas futuras.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <Label>Selecione o motivo principal *</Label>
            <RadioGroup
              value={selectedReason}
              onValueChange={setSelectedReason}
              className="grid gap-2"
            >
              {LOSS_REASONS.map((reason) => (
                <label
                  key={reason.value}
                  className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                >
                  <RadioGroupItem value={reason.value} className="mt-0.5" />
                  <div className="flex-1">
                    <div className="font-medium">{reason.label}</div>
                    <div className="text-sm text-muted-foreground">
                      {reason.description}
                    </div>
                  </div>
                </label>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="loss-notes">Observações adicionais (opcional)</Label>
            <Textarea
              id="loss-notes"
              placeholder="Adicione detalhes sobre o motivo da perda..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedReason || isLoading}
            variant="destructive"
          >
            {isLoading ? 'Salvando...' : 'Confirmar Perda'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
