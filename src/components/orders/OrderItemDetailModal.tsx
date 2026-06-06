import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Lock, LockOpen, RefreshCw, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/formatters';
import { calculatePackagingPrice } from '@/utils/pricing/packagingPricing';
import type { OrderItemDraft } from '@/types/documents';
import { toast } from 'sonner';
import { useResolveCommissionRule } from '@/hooks/useCommercialGovernance';
import { cn } from '@/lib/utils';



const MAX_ITEM_OBSERVATION_LENGTH = 1000;

const sanitizeItemObservation = (value: string) =>
  value.replace(/[<>]/g, '').slice(0, MAX_ITEM_OBSERVATION_LENGTH);

interface OrderItemDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: OrderItemDraft | null;
  index: number;
  onUpdate: (index: number, updatedItem: OrderItemDraft) => void;
  canEdit: boolean;
  companyId?: string | null;
  salesRepId?: string | null;
}

export function OrderItemDetailModal({ open, onOpenChange, item, index, onUpdate, canEdit, companyId, salesRepId }: OrderItemDetailModalProps) {

  const [draft, setDraft] = useState<OrderItemDraft | null>(null);
  const [showSyncConfirm, setShowSyncConfirm] = useState(false);
  const [productData, setProductData] = useState<any>(null);
  const [companySalesRepId, setCompanySalesRepId] = useState<string | null>(null);

  useEffect(() => {
    if (item && open) {
      setDraft({ ...item });
      // Fetch current product data for comparison
      if (item.product_id) {
        supabase
          .from('products')
          .select('id, name, sku, unit_price, width_mm, length_mm, thickness_microns, fator_kg, aliquota_ipi')
          .eq('id', item.product_id)
          .maybeSingle()
          .then(({ data }) => setProductData(data));
      }
    }
  }, [item, open]);

  // Fallback: resolve sales_rep_id from the company when not provided by the parent
  useEffect(() => {
    if (!open) return;
    if (salesRepId || !companyId) {
      setCompanySalesRepId(null);
      return;
    }
    supabase
      .from('companies')
      .select('sales_rep_id')
      .eq('id', companyId)
      .maybeSingle()
      .then(({ data }) => setCompanySalesRepId((data as any)?.sales_rep_id ?? null));
  }, [open, companyId, salesRepId]);

  const effectiveSalesRepId = salesRepId ?? companySalesRepId;

  const { data: commissionRule } = useResolveCommissionRule({
    productId: item?.product_id ?? null,
    companyId: companyId ?? null,
    salesRepId: effectiveSalesRepId,
    enabled: open && !!item?.product_id,
  });


  if (!draft || !item) return null;

  // Item-level lock is no longer a business rule. Editability is controlled by
  // the parent order's lock (passed via `canEdit`).
  const isLocked = false;
  const isEditable = canEdit;

  const maxPct = commissionRule?.max_pct != null ? Number(commissionRule.max_pct) : null;
  const defaultPct = commissionRule?.default_pct != null ? Number(commissionRule.default_pct) : null;
  const commissionExceeds = maxPct != null && (draft?.commission_pct ?? 0) > maxPct + 0.0001;



  const updateDraftField = (field: keyof OrderItemDraft, value: any) => {
    if (!isEditable) return;
    setDraft(prev => {
      if (!prev) return prev;
      const updated: OrderItemDraft = { ...prev, [field]: value };

      // Auto-recalcular preço unitário ao mudar dimensões/Fator KG (fórmula do milheiro)
      if (field === 'width' || field === 'length' || field === 'thickness' || field === 'fator_kg') {
        const calc = calculatePackagingPrice({
          unit_measure: updated.unit_measure,
          unit_price: updated.unit_price,
          fator_kg: updated.fator_kg,
          width: updated.width,
          length: updated.length,
          thickness: updated.thickness,
        });
        if (calc > 0) updated.unit_price = calc;
      }

      const qty = Number(updated.quantity) || 1;
      const price = Number(updated.unit_price) || 0;
      updated.subtotal = qty * price;
      return updated;
    });
  };

  const handleSave = () => {
    if (!draft || draft.is_locked) return;
    if ((draft.observations || '').length > MAX_ITEM_OBSERVATION_LENGTH || (draft.observations_pcp || '').length > MAX_ITEM_OBSERVATION_LENGTH) {
      toast.error(`Cada observação deve ter no máximo ${MAX_ITEM_OBSERVATION_LENGTH} caracteres`);
      return;
    }
    onUpdate(index, draft);
    onOpenChange(false);
  };

  const handleSyncWithProduct = () => {
    if (!productData || !draft || isLocked) return;
    setDraft(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        description: productData.name || prev.description,
        unit_price: productData.unit_price || prev.unit_price,
        width: productData.width_mm || prev.width,
        length: productData.length_mm || prev.length,
        thickness: productData.thickness_microns || prev.thickness,
        fator_kg: productData.fator_kg || prev.fator_kg,
        ipi_rate: productData.aliquota_ipi || prev.ipi_rate,
        subtotal: (prev.quantity) * (productData.unit_price || prev.unit_price),
      };
    });
    setShowSyncConfirm(false);
    toast.success('Dados do item atualizados com os dados atuais do produto');
  };

  const hasDifferences = productData && (
    productData.unit_price !== draft.unit_price ||
    productData.name !== draft.description ||
    (productData.fator_kg || 0) !== (draft.fator_kg || 0)
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isLocked ? <Lock className="h-4 w-4 text-amber-500" /> : <LockOpen className="h-4 w-4 text-muted-foreground" />}
              Detalhes do Item
              {isLocked && (
                <Badge variant="outline" className="text-amber-600 border-amber-300">
                  Finalizado
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {!isLocked && canEdit && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Você está editando este item do pedido. Alterações não afetam o cadastro do produto.
                </p>
              </div>
            )}

            {isLocked && (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <p className="text-xs text-amber-700 dark:text-amber-300 flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  Item finalizado — não pode ser alterado.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Código</Label>
              <Input value={draft.product_code || ''} disabled className="bg-muted" />
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input
                value={draft.description}
                onChange={(e) => updateDraftField('description', e.target.value)}
                disabled={!isEditable}
                className={!isEditable ? 'bg-muted cursor-not-allowed' : ''}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantidade</Label>
                <Input
                  type="number" min={1}
                  value={draft.quantity}
                  onChange={(e) => updateDraftField('quantity', Number(e.target.value) || 1)}
                  disabled={!isEditable}
                  className={!isEditable ? 'bg-muted cursor-not-allowed' : ''}
                />
              </div>
              <div className="space-y-2">
                <Label>Preço Unitário</Label>
                <CurrencyInput
                  value={draft.unit_price}
                  onChange={(val) => updateDraftField('unit_price', val)}
                  disabled={!isEditable}
                  className={!isEditable ? 'bg-muted cursor-not-allowed' : ''}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Largura (mm)</Label>
                <Input
                  type="number"
                  value={draft.width || ''}
                  onChange={(e) => updateDraftField('width', Number(e.target.value) || undefined)}
                  disabled={!isEditable}
                  className={!isEditable ? 'bg-muted cursor-not-allowed' : ''}
                />
              </div>
              <div className="space-y-2">
                <Label>Comprimento (mm)</Label>
                <Input
                  type="number"
                  value={draft.length || ''}
                  onChange={(e) => updateDraftField('length', Number(e.target.value) || undefined)}
                  disabled={!isEditable}
                  className={!isEditable ? 'bg-muted cursor-not-allowed' : ''}
                />
              </div>
              <div className="space-y-2">
                <Label>Espessura (µm)</Label>
                <Input
                  type="number"
                  value={draft.thickness || ''}
                  onChange={(e) => updateDraftField('thickness', Number(e.target.value) || undefined)}
                  disabled={!isEditable}
                  className={!isEditable ? 'bg-muted cursor-not-allowed' : ''}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Fator KG</Label>
                <Input value={draft.fator_kg ? formatCurrency(draft.fator_kg) : '—'} disabled className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>IPI %</Label>
                <Input
                  type="number" step={0.01}
                  value={draft.ipi_rate || ''}
                  onChange={(e) => updateDraftField('ipi_rate', Number(e.target.value) || 0)}
                  disabled={!isEditable}
                  className={!isEditable ? 'bg-muted cursor-not-allowed' : ''}
                />
              </div>
              <div className="space-y-2">
                <Label className={commissionExceeds ? 'text-destructive' : ''}>
                  Comissão %{commissionExceeds && ' ⚠️'}
                </Label>
                <Input
                  type="number" step={0.01}
                  value={draft.commission_pct || ''}
                  onChange={(e) => updateDraftField('commission_pct', Number(e.target.value) || 0)}
                  disabled={!isEditable}
                  className={cn(
                    !isEditable && 'bg-muted cursor-not-allowed',
                    commissionExceeds && 'border-destructive focus-visible:ring-destructive',
                  )}
                />
                {commissionRule && (
                  <p className={cn('text-[10px]', commissionExceeds ? 'text-destructive' : 'text-muted-foreground')}>
                    Regra: padrão {defaultPct?.toFixed(2)}% · máx {maxPct?.toFixed(2)}%
                    {commissionExceeds && ' — acima do limite, requer aprovação'}
                  </p>
                )}
              </div>

            </div>

            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm font-medium">Subtotal: {formatCurrency(draft.subtotal)}</p>
            </div>

            <div className="space-y-2">
              <Label>Observação do item</Label>
              <Textarea
                value={draft.observations || ''}
                onChange={(e) => updateDraftField('observations', sanitizeItemObservation(e.target.value))}
                placeholder="Observação geral deste item..."
                rows={3}
                maxLength={MAX_ITEM_OBSERVATION_LENGTH}
                disabled={!isEditable}
                className={!isEditable ? 'bg-muted cursor-not-allowed' : ''}
              />
              <p className="text-xs text-muted-foreground text-right">{(draft.observations || '').length}/{MAX_ITEM_OBSERVATION_LENGTH}</p>
            </div>

            <div className="space-y-2">
              <Label>Observação PCP / Produção</Label>
              <Textarea
                value={draft.observations_pcp || ''}
                onChange={(e) => updateDraftField('observations_pcp', sanitizeItemObservation(e.target.value))}
                placeholder="Orientações para produção deste item..."
                rows={3}
                maxLength={MAX_ITEM_OBSERVATION_LENGTH}
                disabled={!isEditable}
                className={!isEditable ? 'bg-muted cursor-not-allowed' : ''}
              />
              <p className="text-xs text-muted-foreground text-right">{(draft.observations_pcp || '').length}/{MAX_ITEM_OBSERVATION_LENGTH}</p>
            </div>

            <div className="space-y-2">
              <Label>OC do Cliente</Label>
              <Input
                value={draft.ordem_compra || ''}
                onChange={(e) => updateDraftField('ordem_compra', e.target.value.replace(/[<>]/g, '').slice(0, 60))}
                placeholder="Número da Ordem de Compra do cliente"
                maxLength={60}
                disabled={!isEditable}
                className={!isEditable ? 'bg-muted cursor-not-allowed' : ''}
              />
              <p className="text-xs text-muted-foreground">Enviado ao ERP no campo <code>ordem_compra</code> das entregas.</p>
            </div>

            {/* Comparison with current product */}
            {hasDifferences && !isLocked && (
              <div className="p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg space-y-1">
                <p className="text-xs font-medium text-orange-700 dark:text-orange-300 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Diferenças com o cadastro atual do produto:
                </p>
                {productData.unit_price !== draft.unit_price && (
                  <p className="text-xs text-orange-600 dark:text-orange-400">
                    Preço: {formatCurrency(draft.unit_price)} (item) → {formatCurrency(productData.unit_price)} (cadastro)
                  </p>
                )}
                {productData.name !== draft.description && (
                  <p className="text-xs text-orange-600 dark:text-orange-400">
                    Descrição diferente do cadastro atual
                  </p>
                )}
              </div>
            )}

            {!isLocked && canEdit && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setShowSyncConfirm(true)}
                disabled={!productData}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Atualizar com dados atuais do produto
              </Button>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {isEditable ? 'Cancelar' : 'Fechar'}
            </Button>
            {isEditable && (
              <Button onClick={handleSave}>Salvar Alterações</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showSyncConfirm} onOpenChange={setShowSyncConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Atualizar item com dados do produto?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso substituirá os dados atuais do item (descrição, preço, dimensões) com os dados do cadastro do produto. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleSyncWithProduct}>Atualizar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
