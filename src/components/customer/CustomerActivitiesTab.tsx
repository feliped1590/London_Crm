import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FileText, Database } from 'lucide-react';
import { QuickNotes } from '@/components/notes/QuickNotes';

interface CustomerActivitiesTabProps {
  customerId: string;
  isErpCustomer: boolean;
}

export function CustomerActivitiesTab({ customerId, isErpCustomer }: CustomerActivitiesTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Notas</CardTitle>
        <CardDescription>
          {isErpCustomer
            ? 'Notas não disponíveis para clientes do ERP'
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
        ) : (
          <QuickNotes entityType="company" entityId={customerId} />
        )}
      </CardContent>
    </Card>
  );
}
