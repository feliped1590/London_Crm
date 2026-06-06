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
                <TableHead>Máx. permitido</TableHead>
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
                  <TableCell className="text-xs"><pre className="whitespace-pre-wrap">{JSON.stringify(r.requested_value)}</pre></TableCell>
                  <TableCell className="text-xs"><pre className="whitespace-pre-wrap">{JSON.stringify(r.max_allowed)}</pre></TableCell>
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
