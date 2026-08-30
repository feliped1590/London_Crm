import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Pencil, Trash2, GripVertical, CheckSquare, AlertCircle } from 'lucide-react';
import {
  useStageChecklistItems,
  useChecklistMutations,
  usePipelineStages,
  stageIdentity,
  type ChecklistItem,
} from '@/hooks/useStageChecklists';
import { usePipelines } from '@/hooks/usePipelines';

const validationTypes = [
  { value: 'manual', label: 'Manual' },
  { value: 'auto_proposal', label: 'Auto (Proposta existente)' },
  { value: 'auto_task', label: 'Auto (Tarefa concluída)' },
  { value: 'auto_activity', label: 'Auto (Atividade registrada)' },
];

function itemMatchesStage(item: ChecklistItem, stage: { id: string; stage: string | null; name: string }) {
  const keys = [stage.id, stage.stage, stage.name].filter(Boolean);
  return keys.includes(item.stage);
}

export function StageChecklistManager() {
  const { pipelines, defaultPipeline } = usePipelines();
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);
  const currentPipelineId = selectedPipelineId || defaultPipeline?.id || null;
  const { data: pipelineStages = [], isLoading: loadingStages } = usePipelineStages(currentPipelineId);
  const { data: checklistItems, isLoading } = useStageChecklistItems(currentPipelineId);
  const { createItem, updateItem, deleteItem } = useChecklistMutations();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ChecklistItem | null>(null);
  const [formData, setFormData] = useState({
    stage: '',
    title: '',
    description: '',
    is_required: true,
    validation_type: 'manual',
    sort_order: 0,
  });

  const defaultStageKey = pipelineStages[0] ? stageIdentity(pipelineStages[0]) : '';

  useEffect(() => {
    if (!formData.stage && defaultStageKey) {
      setFormData((prev) => ({ ...prev, stage: defaultStageKey }));
    }
  }, [defaultStageKey, formData.stage]);

  const resetForm = () => {
    setFormData({
      stage: defaultStageKey,
      title: '',
      description: '',
      is_required: true,
      validation_type: 'manual',
      sort_order: 0,
    });
    setEditingItem(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (item: ChecklistItem) => {
    setEditingItem(item);
    setFormData({
      stage: item.stage,
      title: item.title,
      description: item.description || '',
      is_required: item.is_required,
      validation_type: item.validation_type,
      sort_order: item.sort_order,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.stage) return;

    const data = {
      stage: formData.stage,
      pipeline_id: currentPipelineId,
      title: formData.title,
      description: formData.description || null,
      is_required: formData.is_required,
      sort_order: formData.sort_order,
      validation_type: formData.validation_type,
      auto_condition: null,
    };

    if (editingItem) {
      updateItem.mutate({ id: editingItem.id, ...data }, { onSuccess: resetForm });
    } else {
      createItem.mutate(data, { onSuccess: resetForm });
    }
  };

  const itemsByStage = useMemo(() => {
    const map = new Map<string, ChecklistItem[]>();
    for (const stage of pipelineStages) {
      map.set(stage.id, (checklistItems || []).filter((item) => itemMatchesStage(item, stage)));
    }
    return map;
  }, [checklistItems, pipelineStages]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Checklists por Etapa</h3>
          <p className="text-sm text-muted-foreground">
            Os itens seguem as etapas cadastradas no funil selecionado
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={currentPipelineId || ''}
            onValueChange={(value) => setSelectedPipelineId(value || null)}
          >
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Selecione o funil" />
            </SelectTrigger>
            <SelectContent>
              {pipelines?.map((pipeline) => (
                <SelectItem key={pipeline.id} value={pipeline.id}>
                  {pipeline.name}
                  {pipeline.is_default && ' (Padrão)'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gap-2" disabled={!pipelineStages.length}>
                <Plus className="h-4 w-4" />
                Novo Item
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingItem ? 'Editar Item' : 'Novo Item de Checklist'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Etapa</Label>
                  <Select
                    value={formData.stage}
                    onValueChange={(value) => setFormData({ ...formData, stage: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a etapa" />
                    </SelectTrigger>
                    <SelectContent>
                      {pipelineStages.map((stage) => (
                        <SelectItem key={stage.id} value={stageIdentity(stage)}>
                          {stage.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Título *</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Ex: Contato principal identificado"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descrição detalhada do item (opcional)"
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipo de Validação</Label>
                  <Select
                    value={formData.validation_type}
                    onValueChange={(value) => setFormData({ ...formData, validation_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {validationTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Obrigatório para avançar</Label>
                    <p className="text-xs text-muted-foreground">
                      Se marcado, o negócio não pode avançar sem completar este item
                    </p>
                  </div>
                  <Switch
                    checked={formData.is_required}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_required: checked })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ordem</Label>
                  <Input
                    type="number"
                    value={formData.sort_order}
                    onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                    min={0}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createItem.isPending || updateItem.isPending}>
                    {editingItem ? 'Salvar' : 'Criar'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading || loadingStages ? (
        <div className="text-center py-8 text-muted-foreground">Carregando...</div>
      ) : pipelineStages.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Este funil ainda não possui etapas cadastradas. Cadastre-as em Funis & Etapas.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {pipelineStages.map((stage) => {
            const items = itemsByStage.get(stage.id) || [];
            return (
              <Card key={stage.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: stage.color || '#64748b' }}
                    />
                    <CardTitle className="text-base">{stage.name}</CardTitle>
                    <Badge variant="secondary" className="ml-auto">
                      {items.length} {items.length === 1 ? 'item' : 'itens'}
                    </Badge>
                  </div>
                  <CardDescription>
                    Itens a serem verificados antes de sair desta etapa
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {items.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhum item configurado
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-start gap-2 p-2 rounded-md border bg-card hover:bg-muted/50 transition-colors"
                        >
                          <GripVertical className="h-4 w-4 text-muted-foreground mt-0.5 cursor-grab" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <CheckSquare className="h-4 w-4 text-primary" />
                              <span className="font-medium text-sm truncate">{item.title}</span>
                              {item.is_required && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <AlertCircle className="h-3 w-3 text-destructive" />
                                  </TooltipTrigger>
                                  <TooltipContent>Obrigatório</TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                            {item.description && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                {item.description}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {validationTypes.find((t) => t.value === item.validation_type)?.label || 'Manual'}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleEdit(item)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir item?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta ação não pode ser desfeita. O item "{item.title}" será removido permanentemente.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteItem.mutate(item.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Excluir
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
