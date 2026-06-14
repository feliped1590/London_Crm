import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { CompanyQuickEditForm } from './CompanyQuickEditForm';

interface InlineCustomerEditSheetProps {
  companyId: string | null | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Painel lateral que abre o formulário enxuto de edição do cliente sem sair
 * do OrderDialog. Carrega apenas os campos editáveis (Informações, Logística
 * Padrão e Endereço).
 */
export function InlineCustomerEditSheet({ companyId, open, onOpenChange }: InlineCustomerEditSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[720px] p-0 flex flex-col gap-0">
        <SheetHeader className="px-4 py-3 border-b space-y-1">
          <SheetTitle>Editar cliente</SheetTitle>
          <SheetDescription className="text-xs">
            As alterações ficam disponíveis no pedido após salvar.
          </SheetDescription>
        </SheetHeader>
        {companyId ? (
          <CompanyQuickEditForm
            companyId={companyId}
            onSaved={() => onOpenChange(false)}
            onCancel={() => onOpenChange(false)}
          />
        ) : (
          <div className="p-6 text-sm text-muted-foreground">Selecione um cliente primeiro.</div>
        )}
      </SheetContent>
    </Sheet>
  );
}
