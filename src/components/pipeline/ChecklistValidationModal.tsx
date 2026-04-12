import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import { useChecklistMutations, type ChecklistItem } from '@/hooks/useStageChecklists';
import { cn } from '@/lib/utils';
const defaultStageLabels: Record<string, string> = {
  prospeccao: 'Prospecção',
  qualificacao: 'Qualificação',
  proposta: 'Proposta',
  negociacao: 'Negociação',
  fechado_ganho: 'Fechado (Ganho)',
  fechado_perdido: 'Fechado (Perdido)',
};

interface ChecklistValidationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal: { id: string; name: string; stage: string } | null;
  targetStage: string;
  pendingItems: ChecklistItem[];
  onConfirm: () => void;
}

export function ChecklistValidationModal({
  open,
  onOpenChange,
  deal,
  targetStage,
  pendingItems,
  onConfirm,
}: ChecklistValidationModalProps) {
  const { completeItem } = useChecklistMutations();
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleToggleItem = async (itemId: string) => {
    if (!deal) return;
    
    if (completedIds.has(itemId)) {
      setCompletedIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    } else {
      setCompletedIds((prev) => new Set(prev).add(itemId));
    }
  };

  const handleConfirm = async () => {
    if (!deal) return;
    setIsSubmitting(true);

    try {
      // Mark all checked items as complete
      for (const itemId of completedIds) {
        await completeItem.mutateAsync({
          dealId: deal.id,
          checklistItemId: itemId,
        });
      }
      
      // Proceed with stage change
      onConfirm();
      onOpenChange(false);
      setCompletedIds(new Set());
    } catch (error) {
      console.error('Error completing checklist items:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const allItemsCompleted = pendingItems.every((item) => completedIds.has(item.id));
  const completedCount = completedIds.size;
  const totalCount = pendingItems.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            Checklist Pendente
          </DialogTitle>
          <DialogDescription className="space-y-2">
            <span>
              Para mover <strong>{deal?.name}</strong> de{' '}
              <Badge variant="secondary">{defaultStageLabels[deal?.stage || 'prospeccao'] || deal?.stage}</Badge>{' '}
              para <Badge variant="secondary">{defaultStageLabels[targetStage] || targetStage}</Badge>,{' '}
              complete os itens obrigatórios:
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progresso</span>
              <span className="font-medium">{completedCount}/{totalCount}</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {pendingItems.map((item) => {
              const isCompleted = completedIds.has(item.id);
              return (
                <div
                  key={item.id}
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer',
                    isCompleted
                      ? 'bg-primary/10 border-primary/30'
                      : 'bg-card hover:bg-muted/50'
                  )}
                  onClick={() => handleToggleItem(item.id)}
                >
                  <Checkbox
                    id={item.id}
                    checked={isCompleted}
                    onCheckedChange={() => handleToggleItem(item.id)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <Label
                      htmlFor={item.id}
                      className={cn(
                        'font-medium cursor-pointer',
                        isCompleted && 'line-through text-muted-foreground'
                      )}
                    >
                      {item.title}
                    </Label>
                    {item.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {item.description}
                      </p>
                    )}
                  </div>
                  {isCompleted && (
                    <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!allItemsCompleted || isSubmitting}
            className="gap-2"
          >
            {allItemsCompleted ? (
              <>
                Confirmar e Avançar
                <ArrowRight className="h-4 w-4" />
              </>
            ) : (
              `Complete ${totalCount - completedCount} ${totalCount - completedCount === 1 ? 'item' : 'itens'}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
