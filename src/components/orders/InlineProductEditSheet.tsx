import { useQueryClient } from '@tanstack/react-query';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { ProductGeneralEditForm } from '@/components/products/ProductGeneralEditForm';

interface InlineProductEditSheetProps {
  productId: string | null | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Painel lateral para editar a aba Geral do produto sem sair do OrderDialog.
 * Após salvar, invalida as queries relevantes para refletir mudanças no item do pedido.
 */
export function InlineProductEditSheet({ productId, open, onOpenChange }: InlineProductEditSheetProps) {
  const queryClient = useQueryClient();

  const handleSaved = () => {
    queryClient.invalidateQueries({ queryKey: ['products'] });
    queryClient.invalidateQueries({ queryKey: ['products-all'] });
    queryClient.invalidateQueries({ queryKey: ['order-items'] });
    queryClient.invalidateQueries({ queryKey: ['order-company'] });
    if (productId) {
      queryClient.invalidateQueries({ queryKey: ['product', productId] });
    }
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[860px] p-0 flex flex-col gap-0">
        <SheetHeader className="px-4 py-3 border-b space-y-1">
          <SheetTitle>Editar produto</SheetTitle>
          <SheetDescription className="text-xs">
            Alterações na aba Geral. As mudanças aparecem no item do pedido após salvar.
          </SheetDescription>
        </SheetHeader>
        {productId ? (
          <ProductGeneralEditForm
            productId={productId}
            embedded
            onSaved={handleSaved}
            onCancel={() => onOpenChange(false)}
          />
        ) : (
          <div className="p-6 text-sm text-muted-foreground">Selecione um produto primeiro.</div>
        )}
      </SheetContent>
    </Sheet>
  );
}
