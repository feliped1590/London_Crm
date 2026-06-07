import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Check, X } from 'lucide-react';
import { usePendingApprovalRequests } from '@/hooks/useCommercialGovernance';
import { format } from 'date-fns';

function fmtPct(v: any) {
  if (v === null || v === undefined || v === '') return '—';
  const n = Number(v);
  return isNaN(n) ? String(v) : `${n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
}

function formatRequested(r: any) {
  const v = r.requested_value ?? {};
  if (r.request_type === 'commission') {
    const items: any[] = Array.isArray(v.items) ? v.items : [];
    if (!items.length) return '—';
    return (
      <div className="space-y-0.5">
        {items.map((it, i) => (
          <div key={i}>
            Comissão aplicada: <span className="font-medium">{fmtPct(it.applied_pct)}</span>
          </div>
        ))}
      </div>
    );
  }
  // payment
  const parts: string[] = [];
  if (v.applied_template_name) parts.push(`Condição: ${v.applied_template_name}`);
  if (v.current_max_dias != null) parts.push(`Maior prazo: ${v.current_max_dias} dias`);
  if (v.applied_rank != null) parts.push(`Rank: ${v.applied_rank}`);
  return parts.length ? parts.join(' · ') : 'Condição fora das regras';
}

function formatMaxAllowed(r: any) {
  const v = r.max_allowed ?? {};
  if (r.request_type === 'commission') {
    const items: any[] = Array.isArray(v.items) ? v.items : [];
    if (!items.length) return '—';
    return (
      <div className="space-y-0.5">
        {items.map((it, i) => (
          <div key={i}>
            Máx. permitido: <span className="font-medium">{fmtPct(it.max_pct)}</span>
          </div>
        ))}
      </div>
    );
  }
  if (v.max_rank != null) return `Até rank ${v.max_rank} (condições mais curtas)`;
  if (v.max_dias != null) return `Até ${v.max_dias} dias`;
  return '—';
}

export function PendingApprovalsManager() {
  const { requests, isLoading, review } = usePendingApprovalRequests();
  const [open, setOpen] = useState<{ id: string; decision: 'approved' | 'rejected' } | null>(null);
  const [notes, setNotes] = useState('');

  const handleConfirm = async () => {
    if (!open) return;
    await review.mutateAsync({ id: open.id, decision: open.decision, notes });
    setOpen(null); setNotes('');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Solicitações de Exceção</CardTitle>
        <CardDescription>Aprovações pendentes e histórico de comissão e condição de pagamento.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? <div className="text-sm text-muted-foreground">Carregando…</div> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pedido</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Solicitado</TableHead>
                <TableHead>Regra aplicada</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Sem solicitações.</TableCell></TableRow>
              )}
              {requests.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">#{r.order?.number ?? '—'}</TableCell>
                  <TableCell>{r.order?.company?.name ?? '—'}</TableCell>
                  <TableCell>{r.request_type === 'commission' ? 'Comissão' : 'Pagamento'}</TableCell>
                  <TableCell className="text-sm">{formatRequested(r)}</TableCell>
                  <TableCell className="text-sm">
                    <div className="font-medium">{r.rule_name ?? '—'}</div>
                    <div className="text-xs text-muted-foreground">{formatMaxAllowed(r)}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.status === 'pending' ? 'outline' : r.status === 'approved' ? 'default' : 'destructive'}>
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{format(new Date(r.requested_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                  <TableCell>
                    {r.status === 'pending' && (
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => setOpen({ id: r.id, decision: 'approved' })}>
                          <Check className="h-4 w-4 text-emerald-600" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setOpen({ id: r.id, decision: 'rejected' })}>
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{open?.decision === 'approved' ? 'Aprovar solicitação' : 'Rejeitar solicitação'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Observação (opcional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(null)}>Cancelar</Button>
            <Button onClick={handleConfirm}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
