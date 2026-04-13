import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/lib/formatters';
import type { OrderItemDraft } from '@/types/documents';
import { Edit } from 'lucide-react';

interface OrderItemEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: OrderItemDraft;
  onSave: (updated: OrderItemDraft) => void;
  canEdit: boolean;
}

export function OrderItemEditDialog({ open, onOpenChange, item, onSave, canEdit }: OrderItemEditDialogProps) {
  const [draft, setDraft] = useState<OrderItemDraft>(item);

  // Reset draft when item changes
  const [prevItem, setPrevItem] = useState(item);
  if (item !== prevItem) {
    setDraft(item);
    setPrevItem(item);
  }

  const updateField = (field: keyof OrderItemDraft, value: any) => {
    setDraft(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'quantity' || field === 'unit_price') {
        const qty = field === 'quantity' ? (Number(value) || 1) : prev.quantity;
        const price = field === 'unit_price' ? (Number(value) || 0) : prev.unit_price;
        next.quantity = qty;
        next.unit_price = price;
        next.subtotal = qty * price;
      }
      return next;
    });
  };

  const handleSave = () => {
    onSave(draft);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-4 w-4" />
            Editar Item
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-muted-foreground text-xs">Código</Label>
            <p className="font-mono text-sm">{draft.product_code || '—'}</p>
          </div>

          <div className="space-y-1">
            <Label className="text-muted-foreground text-xs">Descrição</Label>
            <p className="text-sm font-medium">{draft.description}</p>
          </div>

          <div className="space-y-1">
            <Label className="text-muted-foreground text-xs">Fator KG</Label>
            <p className="text-sm">{draft.fator_kg ? formatCurrency(draft.fator_kg) : '—'}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Quantidade</Label>
              <Input
                type="number"
                min={1}
                value={draft.quantity}
                onChange={(e) => updateField('quantity', Number(e.target.value) || 1)}
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-2">
              <Label>Preço Unitário</Label>
              <CurrencyInput
                value={draft.unit_price}
                onChange={(val) => updateField('unit_price', val)}
                disabled={!canEdit}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>IPI %</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={draft.ipi_rate || ''}
                onChange={(e) => updateField('ipi_rate', Number(e.target.value) || 0)}
                disabled={!canEdit}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label>Comissão %</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step={0.01}
                value={draft.commission_pct || ''}
                onChange={(e) => updateField('commission_pct', Number(e.target.value) || 0)}
                disabled={!canEdit}
                placeholder="0"
              />
            </div>
          </div>

          <div className="pt-2 border-t">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">{formatCurrency(draft.subtotal)}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          {canEdit && (
            <Button onClick={handleSave}>Salvar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
