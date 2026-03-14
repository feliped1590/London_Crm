import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSalesReps } from '@/hooks/useSalesReps';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Send } from 'lucide-react';
import { toast } from 'sonner';

interface TransferRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  companyName: string;
  currentSalesRepId: string;
  currentSalesRepName: string;
}

export function TransferRequestModal({
  open, onOpenChange, companyId, companyName,
  currentSalesRepId, currentSalesRepName,
}: TransferRequestModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [reason, setReason] = useState('');

  // Get the requester's default sales rep
  const { data: myDefaultSalesRep } = useQuery({
    queryKey: ['my_default_sales_rep', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('user_sales_reps')
        .select('sales_rep_id, sales_reps(id, name)')
        .eq('user_id', user.id)
        .eq('is_default', true)
        .single();
      return data?.sales_reps as { id: string; name: string } | null;
    },
    enabled: !!user?.id && open,
  });

  // Get tenant_id
  const { data: tenantId } = useQuery({
    queryKey: ['active_tenant_id', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('user_tenants')
        .select('tenant_id')
        .eq('user_id', user.id)
        .limit(1)
        .single();
      return data?.tenant_id || null;
    },
    enabled: !!user?.id,
  });

  const createRequest = useMutation({
    mutationFn: async () => {
      if (!user?.id || !myDefaultSalesRep || !tenantId) throw new Error('Dados insuficientes');
      const { error } = await supabase
        .from('customer_transfer_requests' as any)
        .insert({
          company_id: companyId,
          from_sales_rep_id: currentSalesRepId,
          to_sales_rep_id: myDefaultSalesRep.id,
          requested_by: user.id,
          reason,
          tenant_id: tenantId,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Solicitação de transferência enviada para aprovação');
      queryClient.invalidateQueries({ queryKey: ['transfer_requests'] });
      queryClient.invalidateQueries({ queryKey: ['pending_transfer', companyId] });
      setReason('');
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message || 'Erro ao enviar solicitação'),
  });

  const canSubmit = reason.trim().length >= 10 && !!myDefaultSalesRep;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Solicitar Transferência de Carteira</DialogTitle>
          <DialogDescription>
            Solicite a transferência deste cliente para sua carteira. A solicitação será analisada por um administrador.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-3 rounded-lg border bg-muted/30">
            <p className="text-sm font-medium text-foreground mb-2">Cliente</p>
            <p className="text-sm text-muted-foreground">{companyName}</p>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Carteira atual</p>
              <Badge variant="outline" className="mt-1">{currentSalesRepName}</Badge>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1 text-right">
              <p className="text-xs text-muted-foreground">Solicitar para</p>
              <Badge variant="default" className="mt-1">
                {myDefaultSalesRep?.name || 'Carregando...'}
              </Badge>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="transfer-reason">Motivo da solicitação *</Label>
            <Textarea
              id="transfer-reason"
              placeholder="Descreva o motivo da transferência (mínimo 10 caracteres)..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              {reason.length}/10 caracteres mínimos
            </p>
          </div>

          {!myDefaultSalesRep && (
            <p className="text-sm text-destructive">
              Você precisa ter um vendedor comercial padrão vinculado à sua conta para solicitar transferências.
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button
              onClick={() => createRequest.mutate()}
              disabled={!canSubmit || createRequest.isPending}
            >
              <Send className="h-4 w-4 mr-2" />
              {createRequest.isPending ? 'Enviando...' : 'Enviar Solicitação'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
