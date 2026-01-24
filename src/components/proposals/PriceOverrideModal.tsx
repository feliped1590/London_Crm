import { useState } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AlertCircle, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

interface PriceOverrideModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (justification: string) => void;
  itemDescription: string;
  currentPrice: number;
  pricingTableName: string;
}

export function PriceOverrideModal({
  open,
  onOpenChange,
  onConfirm,
  itemDescription,
  currentPrice,
  pricingTableName,
}: PriceOverrideModalProps) {
  const [justification, setJustification] = useState('');

  const handleConfirm = () => {
    if (justification.trim().length < 10) {
      toast.error('A justificativa deve ter pelo menos 10 caracteres');
      return;
    }
    onConfirm(justification.trim());
    setJustification('');
    onOpenChange(false);
  };

  const handleCancel = () => {
    setJustification('');
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/20">
              <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <AlertDialogTitle>Autorização para Alteração de Preço</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="space-y-3 pt-2">
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-amber-700 dark:text-amber-300">
                <p>Você está prestes a alterar o preço de um item que está vinculado à tabela de preços <strong>"{pricingTableName}"</strong>.</p>
              </div>
            </div>
            
            <div className="space-y-1 text-sm">
              <p><strong>Item:</strong> {itemDescription}</p>
              <p><strong>Preço atual da tabela:</strong> R$ {currentPrice.toFixed(2)}</p>
            </div>
            
            <p className="text-sm">
              Esta ação ficará registrada no histórico do negócio. Por favor, informe o motivo da alteração:
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="py-2">
          <Label htmlFor="justification" className="text-sm font-medium">
            Justificativa <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="justification"
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            placeholder="Explique o motivo da alteração de preço fora da tabela..."
            rows={3}
            className="mt-1.5"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Mínimo de 10 caracteres
          </p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className="bg-amber-600 hover:bg-amber-700 text-white"
            disabled={justification.trim().length < 10}
          >
            Autorizar Alteração
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
