import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePipelines, Pipeline, PipelineInsert } from '@/hooks/usePipelines';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2, Star, Target, Headphones, RotateCcw, Users, Globe, Palette, GripVertical, Link2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';

type PipelineStage = Tables<'pipeline_stages'>;

const typeLabels: Record<string, { label: string; icon: typeof Target }> = {
  sales: { label: 'Vendas', icon: Target },
  post_sales: { label: 'Pós-Venda', icon: RotateCcw },
  support: { label: 'Suporte', icon: Headphones },
};

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Administrador' },
  { value: 'vendedor', label: 'Vendedor' },
  { value: 'atendente', label: 'Atendente' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'faturamento', label: 'Faturamento' },
  { value: 'logistica', label: 'Logística' },
  { value: 'qualidade', label: 'Qualidade' },
];

const DEAL_STAGES: { value: string; label: string }[] = [
  { value: 'prospeccao', label: 'Prospecção' },
  { value: 'qualificacao', label: 'Qualificação' },
  { value: 'proposta', label: 'Proposta' },
  { value: 'negociacao', label: 'Negociação' },
  { value: 'fechado_ganho', label: 'Fechado Ganho' },
  { value: 'fechado_perdido', label: 'Fechado Perdido' },
];

export function UnifiedPipelineManager() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { allPipelines, isLoading: pipelinesLoading, createPipeline, updatePipeline, deletePipeline, setDefaultPipeline } = usePipelines();
  
  const [activeSubTab, setActiveSubTab] = useState('pipelines');
  
  // Pipeline form state
  const [isPipelineDialogOpen, setIsPipelineDialogOpen] = useState(false);
  const [editingPipeline, setEditingPipeline] = useState<Pipeline | null>(null);
  const [pipelineFormData, setPipelineFormData] = useState<PipelineInsert & { allowed_roles?: string[] }>({
    name: '',
    description: '',
    type: 'sales',
    is_active: true,
    allowed_roles: [],
  });

  // Stage form state
  const [isStageDialogOpen, setIsStageDialogOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<PipelineStage | null>(null);
  const [stageFormData, setStageFormData] = useState<{
    name: string;
    color: string;
    probability: number;
    sort_order: number;
    stage: string;
    pipeline_id: string;
    sla_hours: number | null;
    sla_warning_hours: number | null;
  }>({
    name: '',
    color: '#6366f1',
    probability: 10,
    sort_order: 1,
    stage: 'prospeccao',
    pipeline_id: '',
    sla_hours: null,
    sla_warning_hours: null,
  });

  // Fetch pipeline stages with pipeline info
  const { data: pipelineStages, isLoading: stagesLoading } = useQuery({
    queryKey: ['pipeline_stages_with_pipelines'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pipeline_stages')
        .select('*, pipelines(id, name)')
        .order('pipeline_id', { ascending: true })
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Pipeline mutations
  const updatePipelineAccessMutation = useMutation({
    mutationFn: async ({ id, allowed_roles, ...data }: Partial<Pipeline> & { id: string; allowed_roles?: string[] | null }) => {
      const { error } = await supabase
        .from('pipelines')
        .update({ ...data, allowed_roles })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines'] });
      toast.success('Funil atualizado!');
      resetPipelineForm();
    },
    onError: () => toast.error('Erro ao atualizar funil'),
  });

  // Stage mutations
  const createStageMutation = useMutation({
    mutationFn: async (data: Omit<typeof stageFormData, ''>) => {
      const { error } = await supabase.from('pipeline_stages').insert({
        name: data.name,
        color: data.color,
        probability: data.probability,
        sort_order: data.sort_order,
        stage: data.stage,
        pipeline_id: data.pipeline_id || null,
        sla_hours: data.sla_hours,
        sla_warning_hours: data.sla_warning_hours,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline_stages_with_pipelines'] });
      toast.success('Etapa criada com sucesso!');
      resetStageForm();
    },
    onError: (error: Error) => {
      console.error('Create stage error:', error);
      if (error.message?.includes('row-level security')) {
        toast.error('Sem permissão. Apenas administradores podem criar etapas.');
      } else {
        toast.error('Erro ao criar etapa: ' + error.message);
      }
    },
  });

  const updateStageMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<PipelineStage> & { id: string }) => {
      const { error } = await supabase.from('pipeline_stages').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline_stages_with_pipelines'] });
      toast.success('Etapa atualizada!');
      resetStageForm();
    },
    onError: (error: Error) => {
      console.error('Update stage error:', error);
      if (error.message?.includes('row-level security')) {
        toast.error('Sem permissão. Apenas administradores podem editar etapas.');
      } else {
        toast.error('Erro ao atualizar etapa: ' + error.message);
      }
    },
  });

  const deleteStageMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('pipeline_stages').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline_stages_with_pipelines'] });
      toast.success('Etapa excluída!');
    },
    onError: (error: Error) => {
      console.error('Delete stage error:', error);
      if (error.message?.includes('row-level security')) {
        toast.error('Sem permissão. Apenas administradores podem excluir etapas.');
      } else {
        toast.error('Erro ao excluir etapa: ' + error.message);
      }
    },
  });

  // Pipeline form handlers
  const resetPipelineForm = () => {
    setPipelineFormData({
      name: '',
      description: '',
      type: 'sales',
      is_active: true,
      allowed_roles: [],
    });
    setEditingPipeline(null);
    setIsPipelineDialogOpen(false);
  };

  const handleEditPipeline = (pipeline: Pipeline & { allowed_roles?: string[] | null }) => {
    setEditingPipeline(pipeline);
    setPipelineFormData({
      name: pipeline.name,
      description: pipeline.description || '',
      type: pipeline.type,
      is_active: pipeline.is_active,
      allowed_roles: pipeline.allowed_roles || [],
    });
    setIsPipelineDialogOpen(true);
  };

  const handlePipelineSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingPipeline) {
      updatePipelineAccessMutation.mutate({
        id: editingPipeline.id,
        name: pipelineFormData.name,
        description: pipelineFormData.description,
        type: pipelineFormData.type,
        is_active: pipelineFormData.is_active,
        allowed_roles: pipelineFormData.allowed_roles?.length ? pipelineFormData.allowed_roles : null,
      });
    } else {
      createPipeline.mutate(pipelineFormData, {
        onSuccess: () => resetPipelineForm(),
      });
    }
  };

  const togglePipelineRole = (role: string) => {
    setPipelineFormData((prev) => ({
      ...prev,
      allowed_roles: prev.allowed_roles?.includes(role)
        ? prev.allowed_roles.filter((r) => r !== role)
        : [...(prev.allowed_roles || []), role],
    }));
  };

  // Stage form handlers
  const resetStageForm = () => {
    setStageFormData({
      name: '',
      color: '#6366f1',
      probability: 10,
      sort_order: 1,
      stage: 'prospeccao',
      pipeline_id: '',
      sla_hours: null,
      sla_warning_hours: null,
    });
    setEditingStage(null);
    setIsStageDialogOpen(false);
  };

  const handleEditStage = (stage: PipelineStage) => {
    setEditingStage(stage);
    setStageFormData({
      name: stage.name,
      color: stage.color || '#6366f1',
      probability: stage.probability || 10,
      sort_order: stage.sort_order,
      stage: stage.stage,
      pipeline_id: stage.pipeline_id || '',
      sla_hours: stage.sla_hours,
      sla_warning_hours: stage.sla_warning_hours,
    });
    setIsStageDialogOpen(true);
  };

  const handleStageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingStage) {
      updateStageMutation.mutate({ 
        id: editingStage.id, 
        ...stageFormData,
        pipeline_id: stageFormData.pipeline_id || null,
      });
    } else {
      createStageMutation.mutate(stageFormData);
    }
  };

  const isLoading = pipelinesLoading || stagesLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Group stages by pipeline
  const stagesByPipeline = pipelineStages?.reduce((acc, stage) => {
    const key = stage.pipeline_id || 'unassigned';
    if (!acc[key]) acc[key] = [];
    acc[key].push(stage);
    return acc;
  }, {} as Record<string, typeof pipelineStages>);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Gestão de Funis e Etapas</h2>
        <p className="text-sm text-muted-foreground">
          Configure funis de vendas, etapas personalizadas e controle de acesso por perfil
        </p>
      </div>

      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <TabsList>
          <TabsTrigger value="pipelines" className="gap-2">
            <Target className="h-4 w-4" />
            Funis
          </TabsTrigger>
          <TabsTrigger value="stages" className="gap-2">
            <Palette className="h-4 w-4" />
            Etapas
          </TabsTrigger>
        </TabsList>

        {/* Funis Tab */}
        <TabsContent value="pipelines" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Configure funis para vendas, pós-venda e suporte, definindo quais perfis têm acesso
            </p>
            <Dialog open={isPipelineDialogOpen} onOpenChange={(open) => { setIsPipelineDialogOpen(open); if (!open) resetPipelineForm(); }}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Novo Funil
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>{editingPipeline ? 'Editar Funil' : 'Novo Funil'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handlePipelineSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="pipeline-name">Nome *</Label>
                    <Input
                      id="pipeline-name"
                      value={pipelineFormData.name}
                      onChange={(e) => setPipelineFormData({ ...pipelineFormData, name: e.target.value })}
                      placeholder="Ex: Vendas Corporativas"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="pipeline-description">Descrição</Label>
                    <Textarea
                      id="pipeline-description"
                      value={pipelineFormData.description}
                      onChange={(e) => setPipelineFormData({ ...pipelineFormData, description: e.target.value })}
                      placeholder="Descrição do funil..."
                      rows={2}
                    />
                  </div>
                  <div>
                    <Label htmlFor="pipeline-type">Tipo *</Label>
                    <Select
                      value={pipelineFormData.type}
                      onValueChange={(v) => setPipelineFormData({ ...pipelineFormData, type: v as 'sales' | 'post_sales' | 'support' })}
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

                  <div className="space-y-3">
                    <Label>Controle de Acesso</Label>
                    <p className="text-xs text-muted-foreground">
                      Defina quais perfis podem visualizar este funil. Deixe vazio para todos.
                    </p>
                    {ROLE_OPTIONS.map((role) => (
                      <div key={role.value} className="flex items-center gap-2">
                        <Checkbox
                          id={`pipeline-role-${role.value}`}
                          checked={pipelineFormData.allowed_roles?.includes(role.value)}
                          onCheckedChange={() => togglePipelineRole(role.value)}
                        />
                        <Label htmlFor={`pipeline-role-${role.value}`} className="cursor-pointer font-normal">
                          {role.label}
                        </Label>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      id="pipeline-is_active"
                      checked={pipelineFormData.is_active}
                      onCheckedChange={(checked) => setPipelineFormData({ ...pipelineFormData, is_active: checked })}
                    />
                    <Label htmlFor="pipeline-is_active" className="font-normal">Funil ativo</Label>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={resetPipelineForm}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={createPipeline.isPending || updatePipelineAccessMutation.isPending}>
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
                const pipelineWithRoles = pipeline as Pipeline & { allowed_roles?: string[] | null };
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
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline">{typeLabels[pipeline.type]?.label || pipeline.type}</Badge>
                          <div className="flex items-center gap-1">
                            {!pipeline.is_default && pipeline.is_active && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setDefaultPipeline.mutate(pipeline.id)}
                                title="Definir como padrão"
                              >
                                <Star className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleEditPipeline(pipelineWithRoles)}
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
                                      Esta ação não pode ser desfeita. Os deals associados não serão excluídos.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deletePipeline.mutate(pipeline.id)}
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
                        
                        {/* Access Info */}
                        <div className="pt-2 border-t">
                          {!pipelineWithRoles.allowed_roles || pipelineWithRoles.allowed_roles.length === 0 ? (
                            <div className="flex items-center gap-1 text-muted-foreground text-sm">
                              <Globe className="h-4 w-4" />
                              <span>Todos os perfis</span>
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              <Users className="h-4 w-4 text-muted-foreground" />
                              {pipelineWithRoles.allowed_roles.map((role) => (
                                <Badge key={role} variant="secondary" className="text-xs">
                                  {ROLE_OPTIONS.find((r) => r.value === role)?.label || role}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Stage Count */}
                        <div className="text-xs text-muted-foreground">
                          {stagesByPipeline?.[pipeline.id]?.length || 0} etapas vinculadas
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Etapas Tab */}
        <TabsContent value="stages" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Crie e gerencie etapas do funil, vinculando-as a funis específicos
            </p>
            <Dialog open={isStageDialogOpen} onOpenChange={(open) => { setIsStageDialogOpen(open); if (!open) resetStageForm(); }}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Nova Etapa
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingStage ? 'Editar Etapa' : 'Nova Etapa'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleStageSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="stage-name">Nome da Etapa *</Label>
                    <Input
                      id="stage-name"
                      value={stageFormData.name}
                      onChange={(e) => setStageFormData({ ...stageFormData, name: e.target.value })}
                      placeholder="Ex: Qualificação Inicial"
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="stage-pipeline">Vincular ao Funil</Label>
                    <Select
                      value={stageFormData.pipeline_id || "__GLOBAL__"}
                      onValueChange={(v) => setStageFormData({ ...stageFormData, pipeline_id: v === "__GLOBAL__" ? "" : v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um funil (opcional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__GLOBAL__">Sem vínculo (global)</SelectItem>
                        {allPipelines?.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Etapas sem vínculo aparecem em todos os funis
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="stage-type">Tipo de Etapa *</Label>
                    <Select
                      value={stageFormData.stage}
                      onValueChange={(v) => setStageFormData({ ...stageFormData, stage: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DEAL_STAGES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="stage-color">Cor</Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          id="stage-color"
                          value={stageFormData.color}
                          onChange={(e) => setStageFormData({ ...stageFormData, color: e.target.value })}
                          className="h-10 w-14 rounded border cursor-pointer"
                        />
                        <Input
                          value={stageFormData.color}
                          onChange={(e) => setStageFormData({ ...stageFormData, color: e.target.value })}
                          placeholder="#6366f1"
                          className="flex-1"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="stage-probability">Probabilidade (%)</Label>
                      <Input
                        type="number"
                        id="stage-probability"
                        min={0}
                        max={100}
                        value={stageFormData.probability}
                        onChange={(e) => setStageFormData({ ...stageFormData, probability: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="stage-order">Posição</Label>
                      <Input
                        type="number"
                        id="stage-order"
                        min={1}
                        value={stageFormData.sort_order}
                        onChange={(e) => setStageFormData({ ...stageFormData, sort_order: parseInt(e.target.value) || 1 })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="stage-sla">SLA (horas)</Label>
                      <Input
                        type="number"
                        id="stage-sla"
                        min={0}
                        value={stageFormData.sla_hours || ''}
                        onChange={(e) => setStageFormData({ ...stageFormData, sla_hours: e.target.value ? parseInt(e.target.value) : null })}
                        placeholder="Opcional"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={resetStageForm}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={createStageMutation.isPending || updateStageMutation.isPending}>
                      {editingStage ? 'Atualizar' : 'Criar'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Etapa</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Funil Vinculado</TableHead>
                    <TableHead>Probabilidade</TableHead>
                    <TableHead>SLA</TableHead>
                    <TableHead className="w-[100px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pipelineStages?.map((stage) => (
                    <TableRow key={stage.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div
                            className="h-4 w-4 rounded-full border shrink-0"
                            style={{ backgroundColor: stage.color || '#6366f1' }}
                          />
                          <span className="font-medium">{stage.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {DEAL_STAGES.find(s => s.value === stage.stage)?.label || stage.stage}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {stage.pipeline_id ? (
                          <div className="flex items-center gap-1">
                            <Link2 className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm">{(stage as any).pipelines?.name || 'Funil'}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">Global</span>
                        )}
                      </TableCell>
                      <TableCell>{stage.probability}%</TableCell>
                      <TableCell>
                        {stage.sla_hours ? `${stage.sla_hours}h` : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleEditStage(stage)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir etapa?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Isso pode afetar negócios que estão nesta etapa.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteStageMutation.mutate(stage.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
