import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ShieldAlert, Pencil, Send } from 'lucide-react';
import type { PreflightResult } from '@/hooks/useCommercialGovernance';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preflight: PreflightResult | null;
  allowCommissionException: boolean;
  allowPaymentException: boolean;
  isSubmitting: boolean;
  onReview: () => void;
  onRequestAuthorization: (justification: string) => void;
}

const MIN_JUSTIFICATION = 10;

export function GovernancePreflightModal({
  open,
  onOpenChange,
  preflight,
  allowCommissionException,
  allowPaymentException,
  isSubmitting,
  onReview,
  onRequestAuthorization,
}: Props) {
  const [justification, setJustification] = useState('');

  const hasCommission = (preflight?.commissionExceptions.length ?? 0) > 0;
  const hasPayment = !!preflight?.paymentException;

  // Solicitação só é possível se TODOS os tipos com exceção forem permitidos
  const canRequest = useMemo(() => {
    if (!hasCommission && !hasPayment) return false;
    if (hasCommission && !allowCommissionException) return false;
    if (hasPayment && !allowPaymentException) return false;
    return true;
  }, [hasCommission, hasPayment, allowCommissionException, allowPaymentException]);

  const canSubmit = canRequest && justification.trim().length >= MIN_JUSTIFICATION;

  const handleOpenChange = (next: boolean) => {
    if (!next) setJustification('');
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            Pedido fora das regras de governança
          </DialogTitle>
          <DialogDescription>
            Identificamos divergências em relação às regras configuradas. Revise os dados ou
            solicite autorização para prosseguir.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {hasCommission && (
            <Alert variant="destructive">
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>Comissão acima do permitido</AlertTitle>
              <AlertDescription>
                <ul className="text-xs space-y-0.5 list-disc list-inside mt-1">
                  {preflight!.commissionExceptions.map((c) => (
                    <li key={`${c.product_id}-${c.order_item_id ?? 'new'}`}>
                      {c.description || c.product_id} — aplicado{' '}
                      <strong>{Number(c.applied_pct).toFixed(2)}%</strong> · máximo{' '}
                      <strong>{Number(c.max_pct).toFixed(2)}%</strong>
                    </li>
                  ))}
                </ul>
                {!allowCommissionException && (
                  <p className="text-xs italic mt-2">
                    Exceções de comissão estão desabilitadas. Ajuste os percentuais para prosseguir.
                  </p>
                )}
              </AlertDescription>
            </Alert>
          )}

          {hasPayment && (
            <Alert variant="destructive">
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>Condição de pagamento acima do permitido</AlertTitle>
              <AlertDescription>
                <p className="text-xs mt-1">
                  Template aplicado:{' '}
                  <strong>
                    {preflight!.paymentException!.applied_template_name ||
                      `${preflight!.paymentException!.current_max_dias} dias (sem template)`}
                  </strong>
                  {preflight!.paymentException!.applied_rank != null && (
                    <> (rank {preflight!.paymentException!.applied_rank})</>
                  )}{' '}
                  · Máximo permitido: <strong>rank {preflight!.paymentException!.max_template_rank}</strong>.
                </p>
                {!allowPaymentException && (
                  <p className="text-xs italic mt-2">
                    Exceções de pagamento estão desabilitadas. Ajuste para um template permitido.
                  </p>
                )}
              </AlertDescription>
            </Alert>
          )}

          {canRequest && (
            <div className="space-y-2 pt-2 border-t">
              <Label>
                Justificativa para solicitar autorização <span className="text-destructive">*</span>
              </Label>
              <Textarea
                rows={4}
                value={justification}
                onChange={(e) => setJustification(e.target.value.slice(0, 1000))}
                placeholder="Explique o motivo comercial para essa exceção (mínimo 10 caracteres)..."
                disabled={isSubmitting}
              />
              <p className="text-xs text-muted-foreground text-right">{justification.length}/1000</p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onReview} disabled={isSubmitting}>
            <Pencil className="h-4 w-4 mr-2" /> Revisar pedido
          </Button>
          {canRequest && (
            <Button
              onClick={() => onRequestAuthorization(justification.trim())}
              disabled={!canSubmit || isSubmitting}
            >
              <Send className="h-4 w-4 mr-2" />
              {isSubmitting ? 'Enviando...' : 'Solicitar autorização'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
