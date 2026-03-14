import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Save, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import type { ActivityWeight } from '@/hooks/useSellerProductivity';

export function ProductivityScoreSettings() {
  const queryClient = useQueryClient();
  const [editedWeights, setEditedWeights] = useState<Record<string, number>>({});

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

  useEffect(() => {
    if (weights) {
      const map: Record<string, number> = {};
      weights.forEach((w) => { map[w.id] = w.weight; });
      setEditedWeights(map);
    }
  }, [weights]);

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

  const handleReset = () => {
    if (weights) {
      const map: Record<string, number> = {};
      weights.forEach((w) => { map[w.id] = w.weight; });
      setEditedWeights(map);
    }
  };

  const hasChanges = weights?.some((w) => editedWeights[w.id] !== undefined && editedWeights[w.id] !== w.weight);

  if (isLoading) return <Skeleton className="h-[300px] w-full" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pontuação de Produtividade</CardTitle>
        <CardDescription>
          Configure os pesos de cada tipo de interação para o cálculo do score de produtividade dos vendedores.
          Um peso maior indica que a ação é mais relevante para a performance comercial.
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
  );
}
