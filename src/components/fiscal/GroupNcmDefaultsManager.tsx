import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Save } from 'lucide-react';
import { toast } from 'sonner';

interface GroupRow {
  id: string;
  value: string;
  label: string;
  default_ncm_code: string | null;
  is_active: boolean;
}

export function GroupNcmDefaultsManager() {
  const qc = useQueryClient();
  const { data: groups, isLoading } = useQuery({
    queryKey: ['product_groups', 'ncm-defaults'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_groups')
        .select('id, value, label, default_ncm_code, is_active')
        .order('sort_order');
      if (error) throw error;
      return (data || []) as GroupRow[];
    },
  });

  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const saveMutation = useMutation({
    mutationFn: async ({ id, ncm }: { id: string; ncm: string | null }) => {
      const { error } = await supabase
        .from('product_groups')
        .update({ default_ncm_code: ncm })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('NCM padrão atualizado');
      qc.invalidateQueries({ queryKey: ['product_groups'] });
      qc.invalidateQueries({ queryKey: ['product_groups', 'ncm-defaults'] });
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao salvar'),
  });

  const rows = useMemo(() => groups || [], [groups]);

  const handleSave = (g: GroupRow) => {
    const raw = (drafts[g.id] ?? g.default_ncm_code ?? '').replace(/\D/g, '');
    if (raw && !/^\d{8}$/.test(raw)) {
      toast.error('NCM deve conter 8 dígitos');
      return;
    }
    saveMutation.mutate({ id: g.id, ncm: raw || null });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>NCM padrão por Grupo de Produto</CardTitle>
        <CardDescription>
          Defina o NCM aplicado automaticamente quando um produto novo é criado em cada grupo.
          O auto-preenchimento só ocorre se o campo NCM estiver vazio ou já contiver um dos NCMs
          padrão configurados (não sobrescreve NCMs personalizados).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Grupo</TableHead>
                <TableHead className="w-40">NCM padrão (8 dígitos)</TableHead>
                <TableHead className="w-32">Status</TableHead>
                <TableHead className="w-24 text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((g) => {
                const value = drafts[g.id] ?? g.default_ncm_code ?? '';
                const dirty = (drafts[g.id] ?? g.default_ncm_code ?? '') !== (g.default_ncm_code ?? '');
                return (
                  <TableRow key={g.id}>
                    <TableCell>
                      <div className="font-medium">{g.label}</div>
                      <div className="text-xs text-muted-foreground">{g.value}</div>
                    </TableCell>
                    <TableCell>
                      <Input
                        value={value}
                        onChange={(e) =>
                          setDrafts((d) => ({ ...d, [g.id]: e.target.value.replace(/\D/g, '').slice(0, 8) }))
                        }
                        placeholder="Ex: 39232990"
                        maxLength={8}
                        inputMode="numeric"
                      />
                    </TableCell>
                    <TableCell>
                      {g.is_active ? (
                        <Badge variant="secondary">Ativo</Badge>
                      ) : (
                        <Badge variant="outline">Inativo</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant={dirty ? 'default' : 'outline'}
                        disabled={!dirty || saveMutation.isPending}
                        onClick={() => handleSave(g)}
                      >
                        <Save className="h-4 w-4 mr-1" />
                        Salvar
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                    Nenhum grupo de produto cadastrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
