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
  // Cliente
  cnpj: 'CNPJ / CPF',
  company_name: 'Nome / Razão Social',
  address: 'Endereço',
  city_mapping: 'Cidade',
  sales_rep: 'Vendedor comercial',
  erp_user: 'Usuário ERP',
  // Pedido
  company_erp_code: 'Cliente sincronizado com ERP',
  company_cnpj: 'CNPJ do cliente',
  erp_empresa: 'Empresa emissora (Razão Social)',
  pedido_terceiro: 'Número de referência do pedido',
  erp_usuario: 'Usuário criador no ERP',
  erp_fluxo_venda: 'Tipo de pedido (fluxo de venda)',
  erp_vendedor: 'Vendedor no ERP',
  erp_frete: 'Tipo de frete',
  payment_method: 'Forma de pagamento',
  payment_terms: 'Condições de pagamento',
  items: 'Itens do pedido',
  product_erp_code: 'Código ERP do produto',
  product_erp_versao: 'Versão ERP do produto',
  item_quantity: 'Quantidade do item',
  item_unit_price: 'Preço unitário do item',
  sale_type: 'Tipo de venda do item',
  system: 'Sistema',
};

function getFieldLabel(field: string): string {
  // Suporta chaves como "items[2].product_erp_code" → cai no sufixo
  const direct = FIELD_LABELS[field];
  if (direct) return direct;
  const m = field.match(/\.([a-z_]+)$/i);
  if (m && FIELD_LABELS[m[1]]) return FIELD_LABELS[m[1]];
  return field;
}

export function SyncValidationModal({ open, onOpenChange, companyName, errors }: SyncValidationModalProps) {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Não foi possível enviar ao ERP
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {companyName && (
            <p className="text-sm text-muted-foreground">
              Cliente: <span className="font-medium text-foreground">{companyName}</span>
            </p>
          )}

          <Alert variant="default" className="border-warning/30 bg-warning/10">
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
                      {getFieldLabel(err.field)}
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
