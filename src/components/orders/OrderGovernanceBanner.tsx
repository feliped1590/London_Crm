import { useMemo, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ShieldAlert, CheckCircle2, Clock, Send } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import {
  useOrderGovernanceState,
  useGovernanceFlags,
} from '@/hooks/useCommercialGovernance';

interface Props {
  orderId?: string | null;
}

/**
 * Displays governance snapshots (commission/payment), pending approval requests
 * for the order, and allows the user to send a justified approval request when
 * an exception was detected (needs_approval).
 */
export function OrderGovernanceBanner({ orderId }: Props) {
  const { commissionSnapshots, paymentSnapshot, requests, hasPending, hasNeedsApproval, createRequest } =
    useOrderGovernanceState(orderId);
  const { flags } = useGovernanceFlags();

  const [open, setOpen] = useState<null | 'commission' | 'payment_terms'>(null);
  const [justification, setJustification] = useState('');

  const commissionExceptions = useMemo(
    () => commissionSnapshots.filter((s: any) => s.needs_approval),
    [commissionSnapshots],
  );

  if (!orderId) return null;
  const paymentNeeds = (paymentSnapshot as any)?.needs_approval;

  const canSubmit = justification.trim().length >= 10;
  const allowCommissionExc = flags?.commission_allow_exception ?? true;
  const allowPaymentExc = flags?.payment_terms_allow_exception ?? true;

  const submit = () => {
    if (!open || !canSubmit) return;
    const isCommission = open === 'commission';
    const requested = isCommission
      ? { items: commissionExceptions.map((s: any) => ({ id: s.order_item_id, applied_pct: s.applied_pct, max_pct: s.max_pct })) }
      : { applied_rank: (paymentSnapshot as any)?.applied_template_rank, max_rank: (paymentSnapshot as any)?.max_template_rank };
    const max = isCommission
      ? { items: commissionExceptions.map((s: any) => ({ id: s.order_item_id, max_pct: s.max_pct })) }
      : { max_rank: (paymentSnapshot as any)?.max_template_rank };
    createRequest.mutate(
      {
        kind: open,
        justification: justification.trim(),
        requested_value: requested,
        max_allowed: max,
      },
      {
        onSuccess: () => {
          setOpen(null);
          setJustification('');
        },
      },
    );
  };

  if (!commissionExceptions.length && !paymentNeeds && !requests.length) {
    // Nothing to show
    return null;
  }

  return (
    <Alert variant={hasNeedsApproval ? 'destructive' : 'default'} className="border-l-4">
      <ShieldAlert className="h-4 w-4" />
      <AlertTitle className="flex items-center gap-2">
        Governança Comercial
        {hasPending && (
          <Badge variant="outline" className="gap-1">
            <Clock className="h-3 w-3" /> Aguardando aprovação
          </Badge>
        )}
        {!hasNeedsApproval && !hasPending && (
          <Badge variant="default" className="gap-1">
            <CheckCircle2 className="h-3 w-3" /> Dentro das regras
          </Badge>
        )}
      </AlertTitle>
      <AlertDescription className="space-y-3">
        {commissionExceptions.length > 0 && (
          <div className="space-y-1">
            <p className="text-sm font-medium">
              {commissionExceptions.length} item(s) com comissão acima do limite permitido:
            </p>
            <ul className="text-xs space-y-0.5 list-disc list-inside">
              {commissionExceptions.map((s: any) => (
                <li key={s.id}>
                  Aplicado <strong>{Number(s.applied_pct).toFixed(2)}%</strong> · Máximo{' '}
                  <strong>{Number(s.max_pct ?? 0).toFixed(2)}%</strong>
                </li>
              ))}
            </ul>
            {allowCommissionExc ? (
              <Button size="sm" variant="outline" onClick={() => setOpen('commission')} disabled={hasPending}>
                <Send className="h-3 w-3 mr-1" /> Solicitar aprovação de comissão
              </Button>
            ) : (
              <p className="text-xs italic">
                Exceções de comissão estão desabilitadas. Ajuste os percentuais para prosseguir.
              </p>
            )}
          </div>
        )}

        {paymentNeeds && (
          <div className="space-y-1">
            <p className="text-sm font-medium">
              Condição de pagamento acima do nível permitido (
              {(paymentSnapshot as any)?.applied_template_rank} {'>'} {(paymentSnapshot as any)?.max_template_rank}).
            </p>
            {allowPaymentExc ? (
              <Button size="sm" variant="outline" onClick={() => setOpen('payment_terms')} disabled={hasPending}>
                <Send className="h-3 w-3 mr-1" /> Solicitar aprovação de pagamento
              </Button>
            ) : (
              <p className="text-xs italic">
                Exceções de pagamento estão desabilitadas. Ajuste para um template permitido.
              </p>
            )}
          </div>
        )}

        {requests.length > 0 && (
          <div className="space-y-1 pt-2 border-t">
            <p className="text-xs font-medium">Histórico de solicitações:</p>
            <ul className="text-xs space-y-0.5">
              {requests.slice(0, 5).map((r: any) => (
                <li key={r.id} className="flex items-center gap-2">
                  <Badge
                    variant={
                      r.status === 'pending'
                        ? 'outline'
                        : r.status === 'approved'
                        ? 'default'
                        : 'destructive'
                    }
                    className="text-[10px]"
                  >
                    {r.status === 'pending' ? 'Pendente' : r.status === 'approved' ? 'Aprovada' : 'Rejeitada'}
                  </Badge>
                  <span>{r.request_type === 'commission' ? 'Comissão' : 'Pagamento'}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="truncate" title={r.justification}>
                    {r.justification?.slice(0, 80)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </AlertDescription>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {open === 'commission' ? 'Solicitar aprovação de comissão' : 'Solicitar aprovação de pagamento'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Justificativa (mínimo 10 caracteres)</Label>
            <Textarea
              rows={5}
              value={justification}
              onChange={(e) => setJustification(e.target.value.slice(0, 1000))}
              placeholder="Explique o motivo comercial para essa exceção..."
            />
            <p className="text-xs text-muted-foreground text-right">{justification.length}/1000</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(null)}>
              Cancelar
            </Button>
            <Button disabled={!canSubmit || createRequest.isPending} onClick={submit}>
              Enviar solicitação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Alert>
  );
}
