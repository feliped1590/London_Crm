import { useState } from 'react';
import { usePipelines, Pipeline, PipelineInsert } from '@/hooks/usePipelines';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, Star, Target, Headphones, RotateCcw } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

const typeLabels: Record<string, { label: string; icon: typeof Target }> = {
  sales: { label: 'Vendas', icon: Target },
  post_sales: { label: 'Pós-Venda', icon: RotateCcw },
  support: { label: 'Suporte', icon: Headphones },
};

export function PipelinesManager() {
  const { allPipelines, isLoading, createPipeline, updatePipeline, deletePipeline, setDefaultPipeline } = usePipelines();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPipeline, setEditingPipeline] = useState<Pipeline | null>(null);
  const [formData, setFormData] = useState<PipelineInsert>({
    name: '',
    description: '',
    type: 'sales',
    is_active: true,
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      type: 'sales',
      is_active: true,
    });
    setEditingPipeline(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (pipeline: Pipeline) => {
    setEditingPipeline(pipeline);
    setFormData({
      name: pipeline.name,
      description: pipeline.description || '',
      type: pipeline.type,
      is_active: pipeline.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingPipeline) {
      updatePipeline.mutate({ id: editingPipeline.id, ...formData }, {
        onSuccess: resetForm,
      });
    } else {
      createPipeline.mutate(formData, {
        onSuccess: resetForm,
      });
    }
  };

  const handleDelete = (id: string) => {
    deletePipeline.mutate(id);
  };

  const handleSetDefault = (id: string) => {
    setDefaultPipeline.mutate(id);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Funis de Vendas</h2>
          <p className="text-sm text-muted-foreground">
            Configure diferentes funis para seus processos de vendas, pós-venda e suporte
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Funil
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingPipeline ? 'Editar Funil' : 'Novo Funil'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Vendas Corporativas"
                  required
                />
              </div>
              <div>
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descrição do funil..."
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="type">Tipo *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(v) => setFormData({ ...formData, type: v as 'sales' | 'post_sales' | 'support' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(typeLabels).map(([key, { label }]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label htmlFor="is_active" className="font-normal">Funil ativo</Label>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createPipeline.isPending || updatePipeline.isPending}>
                  {editingPipeline ? 'Atualizar' : 'Criar'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {!allPipelines?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10 text-center">
            <Target className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">Nenhum funil configurado</h3>
            <p className="text-muted-foreground">Crie seu primeiro funil de vendas.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {allPipelines.map((pipeline) => {
            const TypeIcon = typeLabels[pipeline.type]?.icon || Target;
            return (
              <Card key={pipeline.id} className={!pipeline.is_active ? 'opacity-60' : ''}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <TypeIcon className="h-5 w-5 text-primary" />
                      <CardTitle className="text-lg">{pipeline.name}</CardTitle>
                    </div>
                    <div className="flex items-center gap-1">
                      {pipeline.is_default && (
                        <Badge variant="secondary" className="gap-1">
                          <Star className="h-3 w-3 fill-current" />
                          Padrão
                        </Badge>
                      )}
                      {!pipeline.is_active && (
                        <Badge variant="outline">Inativo</Badge>
                      )}
                    </div>
                  </div>
                  <CardDescription>{pipeline.description || 'Sem descrição'}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <Badge variant="outline">{typeLabels[pipeline.type]?.label || pipeline.type}</Badge>
                    <div className="flex items-center gap-1">
                      {!pipeline.is_default && pipeline.is_active && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleSetDefault(pipeline.id)}
                          title="Definir como padrão"
                        >
                          <Star className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEdit(pipeline)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {!pipeline.is_default && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir funil?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta ação não pode ser desfeita. Os deals associados a este funil não serão excluídos.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(pipeline.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
