import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FileText } from 'lucide-react';
import { QuickNotes } from '@/components/notes/QuickNotes';
import { usePortfolioProtection } from '@/hooks/usePortfolioProtection';
import { PortfolioProtectionModal } from '@/components/customers/PortfolioProtectionModal';

interface CustomerActivitiesTabProps {
  customerId: string;
  isErpCustomer: boolean;
}

export function CustomerActivitiesTab({ customerId, isErpCustomer }: CustomerActivitiesTabProps) {
  const {
    isBlocked,
    protectionInfo,
    showProtectionModal,
    setShowProtectionModal,
  } = usePortfolioProtection(customerId);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Notas</CardTitle>
          <CardDescription>
            {isErpCustomer
              ? 'Notas não disponíveis para clientes do ERP'
              : isBlocked
                ? 'Este cliente pertence a outro vendedor. Notas bloqueadas.'
                : 'Anotações e observações sobre este cliente'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isErpCustomer ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">Notas não disponíveis</h3>
              <p className="text-muted-foreground max-w-md">
                As notas não estão disponíveis para clientes sincronizados do ERP.
              </p>
            </div>
          ) : isBlocked ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">Notas bloqueadas</h3>
              <p className="text-muted-foreground max-w-md mb-4">
                Este cliente pertence ao vendedor <strong>{protectionInfo.ownerSalesRepName}</strong>. Você não pode adicionar notas.
              </p>
              <button
                onClick={() => setShowProtectionModal(true)}
                className="text-sm text-primary hover:underline"
              >
                Ver detalhes e solicitar transferência
              </button>
            </div>
          ) : (
            <QuickNotes entityType="company" entityId={customerId} />
          )}
        </CardContent>
      </Card>

      <PortfolioProtectionModal
        open={showProtectionModal}
        onOpenChange={setShowProtectionModal}
        info={protectionInfo}
      />
    </>
  );
}
