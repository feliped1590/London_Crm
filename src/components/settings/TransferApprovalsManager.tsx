import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Check, X, Clock, ArrowRight, ArrowLeftRight } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pendente', variant: 'default' },
  approved: { label: 'Aprovada', variant: 'secondary' },
  rejected: { label: 'Rejeitada', variant: 'destructive' },
};

export function TransferApprovalsManager() {
  const queryClient = useQueryClient();
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve');

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['transfer_requests_admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_transfer_requests' as any)
        .select(`
          *,
          companies:company_id(name, fantasia),
          from_rep:from_sales_rep_id(name),
          to_rep:to_sales_rep_id(name)
        `)
        .order('created_at', { ascending: false });
      if (error) {
        console.error('Transfer requests query error:', error);
        throw error;
      }
      console.log('Transfer requests loaded:', data?.length);
      return data || [];
    },
  });

  // Fetch profiles for requester names
  const { data: profiles = {} } = useQuery({
    queryKey: ['transfer_profiles'],
    queryFn: async () => {
      const userIds = [...new Set((requests as any[]).map((r: any) => r.requested_by).filter(Boolean))];
      if (userIds.length === 0) return {};
      const { data } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds);
      const map: Record<string, string> = {};
      data?.forEach((p: any) => { map[p.user_id] = p.full_name; });
      return map;
    },
    enabled: requests.length > 0,
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) => {
      const { data, error } = await supabase.rpc('approve_transfer_request', {
        p_request_id: id,
        p_review_note: note || null,
      } as any);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Transferência aprovada com sucesso');
      queryClient.invalidateQueries({ queryKey: ['transfer_requests_admin'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setReviewingId(null);
      setReviewNote('');
    },
    onError: (e: Error) => toast.error(e.message || 'Erro ao aprovar'),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) => {
      const { error } = await supabase
        .from('customer_transfer_requests' as any)
        .update({
          status: 'rejected',
          reviewed_by: (await ({ data: { user: await getCurrentUser() } } as { data: { user: Awaited<ReturnType<typeof getCurrentUser>> } })).data.user?.id,
          review_note: note || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Solicitação rejeitada');
      queryClient.invalidateQueries({ queryKey: ['transfer_requests_admin'] });
      setReviewingId(null);
      setReviewNote('');
    },
    onError: (e: Error) => toast.error(e.message || 'Erro ao rejeitar'),
  });

  const openReview = (id: string, action: 'approve' | 'reject') => {
    setReviewingId(id);
    setReviewAction(action);
    setReviewNote('');
  };

  const handleConfirm = () => {
    if (!reviewingId) return;
    if (reviewAction === 'approve') {
      approveMutation.mutate({ id: reviewingId, note: reviewNote });
    } else {
      rejectMutation.mutate({ id: reviewingId, note: reviewNote });
    }
  };

  const pendingCount = (requests as any[]).filter((r: any) => r.status === 'pending').length;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <ArrowLeftRight className="h-4 w-4" />
                Solicitações de Transferência
              </CardTitle>
              <CardDescription>
                Gerencie as solicitações de transferência de carteira de clientes
              </CardDescription>
            </div>
            {pendingCount > 0 && (
              <Badge variant="default" className="gap-1">
                <Clock className="h-3 w-3" />
                {pendingCount} pendente{pendingCount > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {(requests as any[]).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhuma solicitação de transferência registrada
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>De</TableHead>
                  <TableHead>Para</TableHead>
                  <TableHead>Solicitante</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(requests as any[]).map((req: any) => {
                  const companyName = req.companies?.fantasia || req.companies?.name || '—';
                  const fromName = req.from_rep?.name || '—';
                  const toName = req.to_rep?.name || '—';
                  const requesterName = (profiles as any)[req.requested_by] || '—';
                  const statusInfo = statusLabels[req.status] || statusLabels.pending;

                  return (
                    <TableRow key={req.id}>
                      <TableCell className="font-medium">{companyName}</TableCell>
                      <TableCell>{fromName}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          {toName}
                        </div>
                      </TableCell>
                      <TableCell>{requesterName}</TableCell>
                      <TableCell className="max-w-[200px] truncate" title={req.reason}>
                        {req.reason}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(req.created_at).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                      </TableCell>
                      <TableCell>
                        {req.status === 'pending' && (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 text-green-700 border-green-500/50 hover:bg-green-500/10"
                              onClick={() => openReview(req.id, 'approve')}
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 text-destructive border-destructive/50 hover:bg-destructive/10"
                              onClick={() => openReview(req.id, 'reject')}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                        {req.status !== 'pending' && req.review_note && (
                          <span className="text-xs text-muted-foreground" title={req.review_note}>
                            {req.review_note.substring(0, 30)}...
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={!!reviewingId} onOpenChange={(open) => { if (!open) setReviewingId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewAction === 'approve' ? 'Aprovar Transferência' : 'Rejeitar Solicitação'}
            </DialogTitle>
            <DialogDescription>
              {reviewAction === 'approve'
                ? 'Ao aprovar, o cliente será transferido automaticamente para a nova carteira.'
                : 'Informe o motivo da rejeição (opcional).'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Observação {reviewAction === 'reject' ? '(opcional)' : '(opcional)'}</Label>
              <Textarea
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder="Adicione uma observação..."
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setReviewingId(null)}>Cancelar</Button>
              <Button
                variant={reviewAction === 'approve' ? 'default' : 'destructive'}
                onClick={handleConfirm}
                disabled={approveMutation.isPending || rejectMutation.isPending}
              >
                {reviewAction === 'approve' ? 'Confirmar Aprovação' : 'Confirmar Rejeição'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
