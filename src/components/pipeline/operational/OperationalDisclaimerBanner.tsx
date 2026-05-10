import { Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export function OperationalDisclaimerBanner() {
  return (
    <Alert className="border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-100">
      <Info className="h-4 w-4" />
      <AlertTitle className="font-semibold">
        Pipeline operacional interno
      </AlertTitle>
      <AlertDescription className="text-sm">
        Este pipeline reflete apenas o controle interno do CRM. Movimentações
        feitas aqui <strong>não alteram o ERP</strong>, e o ERP <strong>não
        atualiza este pipeline automaticamente</strong>. O único ponto de
        integração com o ERP é o envio inicial do pedido.
      </AlertDescription>
    </Alert>
  );
}
