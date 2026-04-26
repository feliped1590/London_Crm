import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Save, RotateCcw, Target, UserCog, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { ActivityWeight, ProductivityTarget } from '@/hooks/useSellerProductivity';

interface Profile {
  user_id: string;
  full_name: string;
}

interface ManagerUserLink {
  id: string;
  manager_user_id: string;
  user_id: string;
  label: string | null;
}

export function ProductivityScoreSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editedWeights, setEditedWeights] = useState<Record<string, number>>({});
  const [targetPeriod, setTargetPeriod] = useState<'week' | 'month'>('month');
  const [editedTargets, setEditedTargets] = useState<Record<string, number>>({});
  const [managerUserId, setManagerUserId] = useState<string>('');
  const [sellerUserId, setSellerUserId] = useState<string>('');
  const [teamLabel, setTeamLabel] = useState('');

  const { data: tenantId } = useQuery({
    queryKey: ['productivity-settings-tenant', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('user_tenants')
        .select('tenant_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data?.tenant_id ?? null;
    },
    enabled: !!user?.id,
  });

  const { data: weights, isLoading } = useQuery({
    queryKey: ['activity-weights'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_activity_weights')
        .select('*')
        .order('type');
      if (error) throw error;
      return data as unknown as ActivityWeight[];
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ['profiles-for-targets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .order('full_name');
      if (error) throw error;
      return data as Profile[];
    },
  });

  const { data: targets, isLoading: isLoadingTargets } = useQuery({
    queryKey: ['productivity-targets', targetPeriod],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_productivity_targets')
        .select('*')
        .eq('period_type', targetPeriod);
      if (error) throw error;
      return data as unknown as ProductivityTarget[];
    },
  });

  const { data: managerLinks, isLoading: isLoadingManagerLinks } = useQuery({
    queryKey: ['manager-users-settings', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await (supabase as any)
        .from('manager_users')
        .select('id, manager_user_id, user_id, label')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as ManagerUserLink[];
    },
    enabled: !!tenantId,
  });

  useEffect(() => {
    if (weights) {
      const map: Record<string, number> = {};
      weights.forEach((w) => { map[w.id] = w.weight; });
      setEditedWeights(map);
    }
  }, [weights]);

  useEffect(() => {
    if (targets) {
      const map: Record<string, number> = {};
      targets.forEach((t) => { map[t.seller_id] = t.target_score; });
      setEditedTargets(map);
    }
  }, [targets]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!weights) return;
      const updates = weights
        .filter((w) => editedWeights[w.id] !== undefined && editedWeights[w.id] !== w.weight)
        .map((w) =>
          supabase
            .from('crm_activity_weights')
            .update({ weight: editedWeights[w.id], updated_at: new Date().toISOString() })
            .eq('id', w.id)
        );
      const results = await Promise.all(updates);
      const err = results.find((r) => r.error);
      if (err?.error) throw err.error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity-weights'] });
      queryClient.invalidateQueries({ queryKey: ['seller-productivity'] });
      toast.success('Pesos atualizados com sucesso');
    },
    onError: () => toast.error('Erro ao salvar pesos'),
  });

  const saveTargetsMutation = useMutation({
    mutationFn: async () => {
      const upserts = Object.entries(editedTargets)
        .filter(([, score]) => score > 0)
        .map(([sellerId, score]) => ({
          seller_id: sellerId,
          period_type: targetPeriod,
          target_score: score,
          updated_at: new Date().toISOString(),
        }));

      if (upserts.length === 0) return;

      const { error } = await supabase
        .from('crm_productivity_targets')
        .upsert(upserts, { onConflict: 'seller_id,period_type' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productivity-targets'] });
      queryClient.invalidateQueries({ queryKey: ['seller-productivity'] });
      toast.success('Metas atualizadas com sucesso');
    },
    onError: () => toast.error('Erro ao salvar metas'),
  });

  const handleReset = () => {
    if (weights) {
      const map: Record<string, number> = {};
      weights.forEach((w) => { map[w.id] = w.weight; });
      setEditedWeights(map);
    }
  };

  const hasChanges = weights?.some((w) => editedWeights[w.id] !== undefined && editedWeights[w.id] !== w.weight);

  const existingTargetMap = new Map<string, number>();
  targets?.forEach((t) => existingTargetMap.set(t.seller_id, t.target_score));

  const hasTargetChanges = Object.entries(editedTargets).some(
    ([sellerId, score]) => (existingTargetMap.get(sellerId) ?? 0) !== score
  );

  if (isLoading) return <Skeleton className="h-[300px] w-full" />;

  return (
    <div className="space-y-6">
      {/* Weights */}
      <Card>
        <CardHeader>
          <CardTitle>Pontuação de Produtividade</CardTitle>
          <CardDescription>
            Configure os pesos de cada tipo de interação para o cálculo do score de produtividade.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo de Interação</TableHead>
                <TableHead className="w-[120px] text-center">Peso</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {weights?.map((w) => (
                <TableRow key={w.id}>
                  <TableCell className="font-medium">{w.label}</TableCell>
                  <TableCell className="text-center">
                    <Input
                      type="number"
                      min={0}
                      max={20}
                      className="w-[80px] text-center mx-auto"
                      value={editedWeights[w.id] ?? w.weight}
                      onChange={(e) =>
                        setEditedWeights((prev) => ({
                          ...prev,
                          [w.id]: parseInt(e.target.value) || 0,
                        }))
                      }
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={handleReset} disabled={!hasChanges}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Desfazer
            </Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!hasChanges || saveMutation.isPending}>
              <Save className="mr-2 h-4 w-4" />
              Salvar Pesos
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Targets */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Metas de Produtividade
              </CardTitle>
              <CardDescription>
                Defina o score mínimo esperado por vendedor em cada período. Vendedores abaixo da meta aparecerão em vermelho no relatório.
              </CardDescription>
            </div>
            <Select value={targetPeriod} onValueChange={(v) => setTargetPeriod(v as 'week' | 'month')}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Mensal</SelectItem>
                <SelectItem value="week">Semanal</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingTargets ? (
            <Skeleton className="h-[200px] w-full" />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendedor</TableHead>
                    <TableHead className="w-[140px] text-center">Meta de Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles?.map((p) => (
                    <TableRow key={p.user_id}>
                      <TableCell className="font-medium">{p.full_name}</TableCell>
                      <TableCell className="text-center">
                        <Input
                          type="number"
                          min={0}
                          placeholder="0"
                          className="w-[100px] text-center mx-auto"
                          value={editedTargets[p.user_id] ?? ''}
                          onChange={(e) =>
                            setEditedTargets((prev) => ({
                              ...prev,
                              [p.user_id]: parseInt(e.target.value) || 0,
                            }))
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex justify-end gap-2 mt-4">
                <Button
                  onClick={() => saveTargetsMutation.mutate()}
                  disabled={!hasTargetChanges || saveTargetsMutation.isPending}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Salvar Metas
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
