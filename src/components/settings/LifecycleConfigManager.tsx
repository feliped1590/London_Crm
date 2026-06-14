import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { RefreshCw, Save, Clock, ArrowRight, ShieldAlert } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { LostCustomersReleaseQueue } from './LostCustomersReleaseQueue';

type LifecycleConfig = {
  id: string;
  tenant_id: string;
  active_days: number;
  inactive_days: number;
  lead_to_prospect_trigger: 'deal_open' | 'proposal_sent' | 'first_activity' | 'manual';
  prospect_to_customer_trigger: 'order_created' | 'order_approved' | 'order_invoiced';
  lost_releases_portfolio: boolean;
  lost_release_requires_confirmation: boolean;
  updated_at: string;
  updated_by: string | null;
};

export function LifecycleConfigManager() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<LifecycleConfig | null>(null);
  const [recalcLoading, setRecalcLoading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['lifecycle_config'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('lifecycle_config')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as LifecycleConfig | null;
    },
  });

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async (payload: LifecycleConfig) => {
      const { error } = await (supabase as any)
        .from('lifecycle_config')
        .update({
          active_days: payload.active_days,
          inactive_days: payload.inactive_days,
          lead_to_prospect_trigger: payload.lead_to_prospect_trigger,
          prospect_to_customer_trigger: payload.prospect_to_customer_trigger,
          lost_releases_portfolio: payload.lost_releases_portfolio,
          lost_release_requires_confirmation: payload.lost_release_requires_confirmation,
          updated_by: user?.id,
        })
        .eq('id', payload.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Configuração salva');
      queryClient.invalidateQueries({ queryKey: ['lifecycle_config'] });
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao salvar'),
  });

  const recalc = async () => {
    setRecalcLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc('recompute_company_lifecycle', { p_company_id: null });
      if (error) throw error;
      toast.success(`Recalculado: ${data ?? 0} empresas atualizadas`);
      queryClient.invalidateQueries({ queryKey: ['lifecycle_counts'] });
    } catch (e: any) {
      toast.error(e.message || 'Erro ao recalcular');
    } finally {
      setRecalcLoading(false);
    }
  };

  if (isLoading || !form) return <Card><CardContent className="p-6">Carregando...</CardContent></Card>;

  const isInvalid = form.inactive_days <= form.active_days;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" /> Janelas de Atividade</CardTitle>
              <CardDescription>
                Define em quantos dias um cliente vira Inativo ou Perdido com base na última interação registrada.
              </CardDescription>
            </div>
            <Button variant="outline" onClick={recalc} disabled={recalcLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${recalcLoading ? 'animate-spin' : ''}`} /> Recalcular agora
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Dias para considerar Ativo</Label>
              <Input
                type="number" min={1}
                value={form.active_days}
                onChange={(e) => setForm({ ...form, active_days: parseInt(e.target.value || '0', 10) })}
              />
              <p className="text-xs text-muted-foreground mt-1">Até X dias da última interação.</p>
            </div>
            <div>
              <Label>Dias para considerar Perdido</Label>
              <Input
                type="number" min={1}
                value={form.inactive_days}
                onChange={(e) => setForm({ ...form, inactive_days: parseInt(e.target.value || '0', 10) })}
              />
              <p className="text-xs text-muted-foreground mt-1">A partir deste valor o cliente é Perdido.</p>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-muted/40 border text-sm flex items-center gap-2 flex-wrap">
            <Badge variant="default">Ativo ≤ {form.active_days}d</Badge>
            <ArrowRight className="h-3 w-3" />
            <Badge variant="secondary">Inativo {form.active_days + 1}–{form.inactive_days}d</Badge>
            <ArrowRight className="h-3 w-3" />
            <Badge variant="destructive">Perdido &gt; {form.inactive_days}d</Badge>
          </div>

          {isInvalid && <p className="text-sm text-destructive">Dias de Perdido devem ser maiores que dias de Ativo.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Regras de Promoção</CardTitle>
          <CardDescription>O que faz o sistema mudar automaticamente o estágio do cliente.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Lead → Prospect quando</Label>
            <Select
              value={form.lead_to_prospect_trigger}
              onValueChange={(v: any) => setForm({ ...form, lead_to_prospect_trigger: v })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="deal_open">Tiver um Negócio aberto em pipeline comercial</SelectItem>
                <SelectItem value="proposal_sent">Tiver uma Proposta enviada</SelectItem>
                <SelectItem value="first_activity">Primeira atividade registrada</SelectItem>
                <SelectItem value="manual">Somente manual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div>
            <Label>Prospect → Cliente Ativo quando</Label>
            <Select
              value={form.prospect_to_customer_trigger}
              onValueChange={(v: any) => setForm({ ...form, prospect_to_customer_trigger: v })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="order_created">Primeiro pedido criado (qualquer status)</SelectItem>
                <SelectItem value="order_approved">Primeiro pedido aprovado</SelectItem>
                <SelectItem value="order_invoiced">Primeiro pedido faturado no ERP</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5" /> Tratamento de Clientes Perdidos</CardTitle>
          <CardDescription>Como agir quando um cliente ultrapassa a janela de Perdido.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Liberar carteira automaticamente</Label>
              <p className="text-xs text-muted-foreground">Quando um cliente vira Perdido, ele sai da carteira do vendedor.</p>
            </div>
            <Switch
              checked={form.lost_releases_portfolio}
              onCheckedChange={(v) => setForm({ ...form, lost_releases_portfolio: v })}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label>Exigir confirmação antes de liberar</Label>
              <p className="text-xs text-muted-foreground">Em vez de liberar direto, gera fila de aprovação para o gestor.</p>
            </div>
            <Switch
              checked={form.lost_release_requires_confirmation}
              onCheckedChange={(v) => setForm({ ...form, lost_release_requires_confirmation: v })}
              disabled={!form.lost_releases_portfolio}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Última alteração: {data?.updated_at ? format(new Date(data.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : '—'}
        </p>
        <Button onClick={() => form && saveMutation.mutate(form)} disabled={saveMutation.isPending || isInvalid}>
          <Save className="h-4 w-4 mr-2" /> Salvar configuração
        </Button>
      </div>

      <LostCustomersReleaseQueue />
    </div>
  );
}
