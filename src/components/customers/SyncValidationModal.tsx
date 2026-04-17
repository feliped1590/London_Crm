import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export interface SyncValidationError {
  field: string;
  message: string;
  fixHint: string;
  fixRoute?: string;
}

interface SyncValidationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyName?: string;
  errors: SyncValidationError[];
}

const FIELD_LABELS: Record<string, string> = {
  cnpj: 'CNPJ / CPF',
  company_name: 'Nome / Razão Social',
  address: 'Endereço',
  city_mapping: 'Cidade',
  sales_rep: 'Vendedor comercial',
  erp_user: 'Usuário ERP',
};

export function SyncValidationModal({ open, onOpenChange, companyName, errors }: SyncValidationModalProps) {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Não foi possível enviar ao ERP
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {companyName && (
            <p className="text-sm text-muted-foreground">
              Cliente: <span className="font-medium text-foreground">{companyName}</span>
            </p>
          )}

          <Alert variant="default" className="border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/30">
            <AlertDescription className="text-sm">
              Corrija os itens abaixo para liberar a sincronização. Enquanto houver pendências, o cliente não será adicionado à fila do ERP.
            </AlertDescription>
          </Alert>

          <ul className="space-y-2 max-h-[50vh] overflow-y-auto">
            {errors.map((err, i) => (
              <li key={i} className="border rounded-lg p-3 bg-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
                      {FIELD_LABELS[err.field] ?? err.field}
                    </p>
                    <p className="text-sm font-medium mt-0.5">{err.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">{err.fixHint}</p>
                  </div>
                  {err.fixRoute && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 gap-1"
                      onClick={() => {
                        onOpenChange(false);
                        navigate(err.fixRoute!);
                      }}
                    >
                      <ExternalLink className="h-3 w-3" />
                      Corrigir
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <DialogFooter>
          <Button variant="default" onClick={() => onOpenChange(false)}>
            Entendi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
