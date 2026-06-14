import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Check, X, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type QueueRow = {
  id: string;
  company_id: string;
  previous_sales_rep_id: string | null;
  status: string;
  flagged_at: string;
  company?: { name: string; fantasia: string | null } | null;
  sales_rep?: { name: string } | null;
};

export function LostCustomersReleaseQueue() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['portfolio_release_queue', 'pending'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('portfolio_release_queue')
        .select('id, company_id, previous_sales_rep_id, status, flagged_at, company:companies(name, fantasia), sales_rep:sales_reps(name)')
        .eq('status', 'pending_confirmation')
        .order('flagged_at', { ascending: false });
      if (error) throw error;
      return (data || []) as QueueRow[];
    },
  });

  const flagNow = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase as any).rpc('flag_lost_customers_for_release');
      if (error) throw error;
      return data;
    },
    onSuccess: (n) => { toast.success(`${n ?? 0} clientes adicionados à fila`); qc.invalidateQueries({ queryKey: ['portfolio_release_queue'] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const release = useMutation({
    mutationFn: async (row: QueueRow) => {
      const { error: e1 } = await (supabase as any)
        .from('companies')
        .update({ sales_rep_id: null, owner_id: null })
        .eq('id', row.company_id);
      if (e1) throw e1;
      const { error: e2 } = await (supabase as any)
        .from('portfolio_release_queue')
        .update({ status: 'released', decided_by: user?.id, decided_at: new Date().toISOString() })
        .eq('id', row.id);
      if (e2) throw e2;
    },
    onSuccess: () => { toast.success('Cliente liberado da carteira'); qc.invalidateQueries({ queryKey: ['portfolio_release_queue'] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const keep = useMutation({
    mutationFn: async (row: QueueRow) => {
      const { error } = await (supabase as any)
        .from('portfolio_release_queue')
        .update({ status: 'kept', decided_by: user?.id, decided_at: new Date().toISOString() })
        .eq('id', row.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Cliente mantido na carteira'); qc.invalidateQueries({ queryKey: ['portfolio_release_queue'] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>Clientes Perdidos – Liberação Pendente</CardTitle>
            <CardDescription>Decida se cada cliente sai da carteira do vendedor ou permanece.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} /> Atualizar
            </Button>
            <Button variant="secondary" size="sm" onClick={() => flagNow.mutate()} disabled={flagNow.isPending}>
              Verificar agora
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum cliente perdido aguardando decisão.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Vendedor atual</TableHead>
                <TableHead>Marcado em</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.company?.fantasia || r.company?.name || '—'}</TableCell>
                  <TableCell>{r.sales_rep?.name || '—'}</TableCell>
                  <TableCell>{format(new Date(r.flagged_at), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                  <TableCell><Badge variant="destructive">Pendente</Badge></TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button size="sm" variant="outline" onClick={() => keep.mutate(r)} disabled={keep.isPending}>
                      <X className="h-3 w-3 mr-1" /> Manter
                    </Button>
                    <Button size="sm" onClick={() => release.mutate(r)} disabled={release.isPending}>
                      <Check className="h-3 w-3 mr-1" /> Liberar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
