import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Pencil, Users, Globe } from 'lucide-react';
import { toast } from 'sonner';
import { Pipeline } from '@/hooks/usePipelines';

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Administrador' },
  { value: 'vendedor', label: 'Vendedor' },
  { value: 'atendente', label: 'Atendente' },
];

export function PipelineAccessManager() {
  const queryClient = useQueryClient();
  const [editingPipeline, setEditingPipeline] = useState<Pipeline | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

  const { data: pipelines, isLoading } = useQuery({
    queryKey: ['pipelines', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pipelines')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      return data as (Pipeline & { allowed_roles?: string[] | null })[];
    },
  });

  const updatePipelineMutation = useMutation({
    mutationFn: async ({ id, allowed_roles }: { id: string; allowed_roles: string[] | null }) => {
      const { error } = await supabase
        .from('pipelines')
        .update({ allowed_roles })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines'] });
      toast.success('Acesso do funil atualizado!');
      resetForm();
    },
    onError: () => toast.error('Erro ao atualizar acesso'),
  });

  const resetForm = () => {
    setEditingPipeline(null);
    setSelectedRoles([]);
    setIsDialogOpen(false);
  };

  const handleEdit = (pipeline: Pipeline & { allowed_roles?: string[] | null }) => {
    setEditingPipeline(pipeline);
    setSelectedRoles(pipeline.allowed_roles || []);
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingPipeline) {
      updatePipelineMutation.mutate({
        id: editingPipeline.id,
        allowed_roles: selectedRoles.length > 0 ? selectedRoles : null,
      });
    }
  };

  const toggleRole = (role: string) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Carregando funis...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Acesso aos Funis por Perfil
        </CardTitle>
        <CardDescription>
          Defina quais perfis de usuário podem visualizar cada funil de vendas
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Funil</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Acesso</TableHead>
              <TableHead className="w-[80px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pipelines?.map((pipeline) => (
              <TableRow key={pipeline.id}>
                <TableCell>
                  <div className="font-medium">{pipeline.name}</div>
                  {pipeline.description && (
                    <p className="text-xs text-muted-foreground">{pipeline.description}</p>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {pipeline.type === 'sales' ? 'Vendas' : 
                     pipeline.type === 'post_sales' ? 'Pós-Venda' : 'Suporte'}
                  </Badge>
                </TableCell>
                <TableCell>
                  {!pipeline.allowed_roles || pipeline.allowed_roles.length === 0 ? (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Globe className="h-4 w-4" />
                      <span className="text-sm">Todos os perfis</span>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {pipeline.allowed_roles.map((role) => (
                        <Badge key={role} variant="secondary" className="text-xs">
                          {ROLE_OPTIONS.find((r) => r.value === role)?.label || role}
                        </Badge>
                      ))}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(pipeline)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Configurar Acesso ao Funil</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {editingPipeline && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="font-medium">{editingPipeline.name}</p>
                  {editingPipeline.description && (
                    <p className="text-sm text-muted-foreground">{editingPipeline.description}</p>
                  )}
                </div>
              )}

              <div className="space-y-3">
                <Label>Perfis com acesso</Label>
                <p className="text-sm text-muted-foreground">
                  Deixe todos desmarcados para permitir acesso a todos os perfis.
                </p>
                
                {ROLE_OPTIONS.map((role) => (
                  <div key={role.value} className="flex items-center gap-2">
                    <Checkbox
                      id={`role-${role.value}`}
                      checked={selectedRoles.includes(role.value)}
                      onCheckedChange={() => toggleRole(role.value)}
                    />
                    <Label htmlFor={`role-${role.value}`} className="cursor-pointer">
                      {role.label}
                    </Label>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={updatePipelineMutation.isPending}>
                  Salvar
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
