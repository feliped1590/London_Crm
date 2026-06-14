import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ExternalLink, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

interface InlineCustomerEditSheetProps {
  companyId: string | null | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Sheet lateral que carrega /customers/:id em iframe, permitindo editar o
 * cadastro do cliente sem sair do OrderDialog. O formulário do pedido
 * permanece montado por trás. Ao fechar, invalidamos as queries do cliente
 * para que o pedido leia os dados atualizados.
 */
export function InlineCustomerEditSheet({ companyId, open, onOpenChange }: InlineCustomerEditSheetProps) {
  const queryClient = useQueryClient();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!open) setLoaded(false);
  }, [open]);

  const handleClose = (next: boolean) => {
    if (!next && companyId) {
      // Atualiza dados do cliente exibidos no pedido (nome, vínculos, etc.)
      queryClient.invalidateQueries({ queryKey: ['order-company', companyId] });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['company', companyId] });
      queryClient.invalidateQueries({ queryKey: ['customer-detail', companyId] });
    }
    onOpenChange(next);
  };

  const src = companyId ? `/customers/${companyId}?embed=1` : null;

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="right" className="w-full sm:max-w-[1100px] p-0 flex flex-col gap-0">
        <SheetHeader className="px-4 py-3 border-b flex-row items-center justify-between space-y-0">
          <div>
            <SheetTitle>Editar cliente</SheetTitle>
            <SheetDescription className="text-xs">
              As alterações ficam disponíveis no pedido ao fechar este painel.
            </SheetDescription>
          </div>
          {src && (
            <Button asChild size="sm" variant="ghost">
              <a href={src.replace('?embed=1', '')} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4 mr-1" /> Abrir em nova aba
              </a>
            </Button>
          )}
        </SheetHeader>
        <div className="flex-1 relative bg-muted/20">
          {src ? (
            <>
              {!loaded && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}
              <iframe
                key={src}
                src={src}
                title="Editar cliente"
                onLoad={() => setLoaded(true)}
                className="w-full h-full border-0"
              />
            </>
          ) : (
            <div className="p-6 text-sm text-muted-foreground">Selecione um cliente primeiro.</div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
