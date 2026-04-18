import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePipelines, Pipeline, PipelineInsert, PipelineMode, PipelineScope } from '@/hooks/usePipelines';
import { useLegalEntities } from '@/hooks/useLegalEntities';
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
import { Plus, Pencil, Trash2, Star, Target, Headphones, RotateCcw, Users, Globe, Palette, GripVertical, Link2, Trophy, XCircle, Circle, ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { StageStatus } from '@/lib/stageStatus';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';
import { PipelineConsistencyWarnings } from './PipelineConsistencyWarnings';

type PipelineStage = Tables<'pipeline_stages'>;

const typeLabels: Record<string, { label: string; icon: typeof Target }> = {
  sales: { label: 'Vendas', icon: Target },
  post_sales: { label: 'Pós-Venda', icon: RotateCcw },
  support: { label: 'Suporte', icon: Headphones },
};

const PIPELINE_MODE_OPTIONS: { value: PipelineMode; label: string; description: string }[] = [
  { value: 'sales', label: 'Vendas', description: 'Funil comercial puro (prospecção → fechamento)' },
  { value: 'operational', label: 'Operacional', description: 'Pós-venda, produção, faturamento, entrega' },
  { value: 'hybrid', label: 'Híbrido', description: 'Combina etapas comerciais e operacionais' },
  { value: 'support', label: 'Suporte', description: 'Atendimento, qualidade, RNC' },
];

const PIPELINE_SCOPE_OPTIONS: { value: PipelineScope; label: string; description: string }[] = [
  { value: 'global', label: 'Global', description: 'Acessível a todas as empresas emissoras' },
  { value: 'restricted', label: 'Restrito', description: 'Apenas a empresa emissora vinculada' },
];

const STAGE_CATEGORY_OPTIONS: { value: string; label: string; tone: string }[] = [
  { value: 'commercial', label: 'Comercial', tone: 'bg-blue-500/10 text-blue-700 border-blue-500/30 dark:text-blue-300' },
  { value: 'operational', label: 'Operacional', tone: 'bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300' },
  { value: 'loss', label: 'Perda', tone: 'bg-destructive/10 text-destructive border-destructive/30' },
  { value: 'quality', label: 'Qualidade', tone: 'bg-purple-500/10 text-purple-700 border-purple-500/30 dark:text-purple-300' },
];

const STAGE_PHASE_OPTIONS: { value: string; label: string }[] = [
  { value: 'pre_sale', label: 'Pré-venda' },
  { value: 'sale', label: 'Venda' },
  { value: 'post_sale', label: 'Pós-venda' },
];

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
  const { allPipelines, isLoading: pipelinesLoading, createPipeline, updatePipeline, deletePipeline, setDefaultPipeline, getPipelineEntities, setPipelineLegalEntities } = usePipelines();
  const { allEntities: legalEntities } = useLegalEntities();
  
  const [activeSubTab, setActiveSubTab] = useState('pipelines');
  
  // Pipeline form state
  const [isPipelineDialogOpen, setIsPipelineDialogOpen] = useState(false);
  const [editingPipeline, setEditingPipeline] = useState<Pipeline | null>(null);
  const [selectedEntityIds, setSelectedEntityIds] = useState<string[]>([]);
  const [pipelineFormData, setPipelineFormData] = useState<PipelineInsert & { allowed_roles?: string[] }>({
    name: '',
    description: '',
    type: 'sales',
    is_active: true,
    allowed_roles: [],
    legal_entity_id: null,
    pipeline_mode: 'sales',
    pipeline_scope: 'global',
  });

  // Stage form state
  const [isStageDialogOpen, setIsStageDialogOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<PipelineStage | null>(null);
  const [showLegacyType, setShowLegacyType] = useState(false);
  const [stageFormData, setStageFormData] = useState<{
    name: string;
    color: string;
    probability: number;
    sort_order: number;
    stage: string;
    stage_status: StageStatus;
    pipeline_id: string;
    sla_hours: number | null;
    sla_warning_hours: number | null;
    allowed_roles: string[];
    stage_category: string;
    stage_phase: string;
  }>({
    name: '',
    color: '#6366f1',
    probability: 10,
    sort_order: 1,
    stage: '',
    stage_status: 'open',
    pipeline_id: '',
    sla_hours: null,
    sla_warning_hours: null,
    allowed_roles: [],
    stage_category: 'commercial',
    stage_phase: 'sale',
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
        stage: data.stage || null,
        stage_status: data.stage_status,
        pipeline_id: data.pipeline_id || null,
        sla_hours: data.sla_hours,
        sla_warning_hours: data.sla_warning_hours,
        stage_category: data.stage_category,
        stage_phase: data.stage_phase,
      } as any);
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
      legal_entity_id: null,
      pipeline_mode: 'sales',
      pipeline_scope: 'global',
    });
    setSelectedEntityIds([]);
    setEditingPipeline(null);
    setIsPipelineDialogOpen(false);
  };

  const handleEditPipeline = (pipeline: Pipeline & { allowed_roles?: string[] | null }) => {
    setEditingPipeline(pipeline);
    const entities = getPipelineEntities(pipeline.id);
    setSelectedEntityIds(entities);
    setPipelineFormData({
      name: pipeline.name,
      description: pipeline.description || '',
      type: pipeline.type,
      is_active: pipeline.is_active,
      allowed_roles: pipeline.allowed_roles || [],
      legal_entity_id: pipeline.legal_entity_id ?? null,
      pipeline_mode: (pipeline.pipeline_mode || 'sales') as PipelineMode,
      pipeline_scope: (entities.length === 0 ? 'global' : 'restricted') as PipelineScope,
    });
    setIsPipelineDialogOpen(true);
  };

  const toggleEntitySelection = (entityId: string) => {
    setSelectedEntityIds(prev =>
      prev.includes(entityId) ? prev.filter(id => id !== entityId) : [...prev, entityId]
    );
  };

  const handlePipelineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data, error } = await supabase.rpc('save_pipeline_with_entities' as any, {
        _pipeline_id: editingPipeline?.id ?? null,
        _name: pipelineFormData.name,
        _description: pipelineFormData.description ?? '',
        _type: pipelineFormData.type ?? 'sales',
        _is_active: pipelineFormData.is_active ?? true,
        _allowed_roles: pipelineFormData.allowed_roles ?? [],
        _pipeline_mode: pipelineFormData.pipeline_mode ?? 'sales',
        _legal_entity_ids: selectedEntityIds,
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['pipelines'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline_legal_entities_map'] });
      toast.success(editingPipeline ? 'Funil atualizado!' : 'Funil criado!');
      resetPipelineForm();
    } catch (err: any) {
      console.error('Pipeline submit error:', err);
      toast.error(err?.message || 'Erro ao salvar funil');
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
      stage: '',
      stage_status: 'open',
      pipeline_id: '',
      sla_hours: null,
      sla_warning_hours: null,
      allowed_roles: [],
      stage_category: 'commercial',
      stage_phase: 'sale',
    });
    setEditingStage(null);
    setShowLegacyType(false);
    setIsStageDialogOpen(false);
  };

  const handleEditStage = (stage: PipelineStage) => {
    setEditingStage(stage);
    setStageFormData({
      name: stage.name,
      color: stage.color || '#6366f1',
      probability: stage.probability || 10,
      sort_order: stage.sort_order,
      stage: stage.stage || '',
      stage_status: ((stage as any).stage_status || 'open') as StageStatus,
      pipeline_id: stage.pipeline_id || '',
      sla_hours: stage.sla_hours,
      sla_warning_hours: stage.sla_warning_hours,
      allowed_roles: (stage as any).allowed_roles || [],
      stage_category: ((stage as any).stage_category || 'commercial') as string,
      stage_phase: ((stage as any).stage_phase || 'sale') as string,
    });
    setShowLegacyType(!!stage.stage);
    setIsStageDialogOpen(true);
  };

  // Validação client-side: avisar duplicidade de won/lost no mesmo pipeline
  const validateStageStatus = (): string | null => {
    const targetPipeline = stageFormData.pipeline_id;
    if (!targetPipeline) return null;
    if (stageFormData.stage_status === 'open') return null;

    const conflict = pipelineStages?.find(
      (s) =>
        s.pipeline_id === targetPipeline &&
        (s as any).stage_status === stageFormData.stage_status &&
        s.id !== editingStage?.id,
    );
    if (conflict) {
      return stageFormData.stage_status === 'won'
        ? `Já existe uma etapa de Ganho neste funil ("${conflict.name}").`
        : `Já existe uma etapa de Perdido neste funil ("${conflict.name}").`;
    }
    return null;
  };

  const handleStageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const conflict = validateStageStatus();
    if (conflict) {
      toast.error(conflict);
      return;
    }
    if (editingStage) {
      updateStageMutation.mutate({
        id: editingStage.id,
        ...stageFormData,
        stage: stageFormData.stage || null,
        pipeline_id: stageFormData.pipeline_id || null,
        allowed_roles: stageFormData.allowed_roles.length > 0 ? stageFormData.allowed_roles : null,
      } as any);
    } else {
      createStageMutation.mutate({
        ...stageFormData,
        allowed_roles: stageFormData.allowed_roles.length > 0 ? stageFormData.allowed_roles : null,
      });
    }
  };

  const stageStatusBadge = (status: string | undefined) => {
    const s = (status || 'open') as StageStatus;
    if (s === 'won')
      return (
        <Badge className="bg-success text-success-foreground border-transparent hover:bg-success/90 gap-1 font-semibold shadow-sm">
          <Trophy className="h-3 w-3" /> Ganho
        </Badge>
      );
    if (s === 'lost')
      return (
        <Badge className="bg-destructive text-destructive-foreground border-transparent hover:bg-destructive/90 gap-1 font-semibold shadow-sm">
          <XCircle className="h-3 w-3" /> Perdido
        </Badge>
      );
    return (
      <Badge variant="secondary" className="gap-1 text-muted-foreground">
        <Circle className="h-3 w-3" /> Em andamento
      </Badge>
    );
  };

  // Group stages by pipeline (memoized)
  const stagesByPipeline = useMemo(() => {
    return (pipelineStages || []).reduce((acc, stage) => {
      const key = stage.pipeline_id || 'unassigned';
      if (!acc[key]) acc[key] = [];
      acc[key].push(stage);
      return acc;
    }, {} as Record<string, NonNullable<typeof pipelineStages>>);
  }, [pipelineStages]);

  // Ordered pipeline groups: respect allPipelines order, then unassigned last
  const orderedPipelineGroups = useMemo(() => {
    const groups: { id: string; pipeline: Pipeline | null; stages: NonNullable<typeof pipelineStages> }[] = [];
    (allPipelines || []).forEach((p) => {
      const stages = stagesByPipeline[p.id];
      if (stages && stages.length > 0) {
        groups.push({ id: p.id, pipeline: p, stages });
      }
    });
    if (stagesByPipeline['unassigned']?.length) {
      groups.push({ id: 'unassigned', pipeline: null, stages: stagesByPipeline['unassigned'] });
    }
    return groups;
  }, [allPipelines, stagesByPipeline]);

  const isLoading = pipelinesLoading || stagesLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

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
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="pipeline-mode">Modo do Funil *</Label>
                      <Select
                        value={pipelineFormData.pipeline_mode || 'sales'}
                        onValueChange={(v) => setPipelineFormData({ ...pipelineFormData, pipeline_mode: v as PipelineMode })}
                      >
                        <SelectTrigger id="pipeline-mode">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PIPELINE_MODE_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              <div className="flex flex-col">
                                <span>{opt.label}</span>
                                <span className="text-xs text-muted-foreground">{opt.description}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="pipeline-type">Tipo (legado)</Label>
                      <Select
                        value={pipelineFormData.type}
                        onValueChange={(v) => setPipelineFormData({ ...pipelineFormData, type: v as 'sales' | 'post_sales' | 'support' })}
                      >
                        <SelectTrigger id="pipeline-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(typeLabels).map(([key, { label }]) => (
                            <SelectItem key={key} value={key}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Empresas Emissoras</Label>
                      {selectedEntityIds.length === 0 ? (
                        <Badge variant="outline" className="gap-1 text-xs">
                          <Globe className="h-3 w-3" /> Global (todas as empresas)
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1 text-xs">
                          <Link2 className="h-3 w-3" /> Restrito a {selectedEntityIds.length} {selectedEntityIds.length === 1 ? 'empresa' : 'empresas'}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Marque as empresas que terão acesso a este funil. Sem seleção = funil global (visível para todas).
                    </p>
                    <div className="rounded-md border p-3 space-y-2 max-h-48 overflow-y-auto">
                      {legalEntities.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Nenhuma empresa cadastrada.</p>
                      ) : (
                        legalEntities.map((le) => (
                          <div key={le.id} className="flex items-center gap-2">
                            <Checkbox
                              id={`pipeline-le-${le.id}`}
                              checked={selectedEntityIds.includes(le.id)}
                              onCheckedChange={() => toggleEntitySelection(le.id)}
                            />
                            <Label htmlFor={`pipeline-le-${le.id}`} className="cursor-pointer font-normal text-sm">
                              {le.name}
                            </Label>
                          </div>
                        ))
                      )}
                    </div>
                    {selectedEntityIds.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {selectedEntityIds.map((eid) => {
                          const e = legalEntities.find(x => x.id === eid);
                          if (!e) return null;
                          return (
                            <Badge key={eid} variant="secondary" className="text-xs gap-1">
                              {e.name}
                              <button
                                type="button"
                                className="ml-1 hover:text-destructive"
                                onClick={() => toggleEntitySelection(eid)}
                                aria-label={`Remover ${e.name}`}
                              >
                                ×
                              </button>
                            </Badge>
                          );
                        })}
                      </div>
                    )}
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
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge variant="outline" className="capitalize">
                              {PIPELINE_MODE_OPTIONS.find(m => m.value === (pipeline as any).pipeline_mode)?.label || typeLabels[pipeline.type]?.label || pipeline.type}
                            </Badge>
                            {(() => {
                              const linked = getPipelineEntities(pipeline.id);
                              if (linked.length === 0) {
                                return (
                                  <Badge variant="outline" className="text-xs gap-1 text-muted-foreground">
                                    <Globe className="h-3 w-3" />
                                    Global
                                  </Badge>
                                );
                              }
                              if (linked.length === 1) {
                                const e = legalEntities.find(x => x.id === linked[0]);
                                return (
                                  <Badge variant="secondary" className="text-xs gap-1">
                                    <Link2 className="h-3 w-3" />
                                    {e?.name || 'Empresa'}
                                  </Badge>
                                );
                              }
                              return (
                                <Badge variant="secondary" className="text-xs gap-1" title={linked.map(id => legalEntities.find(e => e.id === id)?.name).filter(Boolean).join(', ')}>
                                  <Link2 className="h-3 w-3" />
                                  {linked.length} empresas
                                </Badge>
                              );
                            })()}
                          </div>
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
                    <Label htmlFor="stage-status">Status da Etapa *</Label>
                    <Select
                      value={stageFormData.stage_status}
                      onValueChange={(v) => setStageFormData({ ...stageFormData, stage_status: v as StageStatus })}
                    >
                      <SelectTrigger id="stage-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">
                          <span className="flex items-center gap-2">
                            <Circle className="h-3 w-3 text-muted-foreground" /> Em andamento
                          </span>
                        </SelectItem>
                        <SelectItem value="won">
                          <span className="flex items-center gap-2">
                            <Trophy className="h-3 w-3 text-success" /> Ganho
                          </span>
                        </SelectItem>
                        <SelectItem value="lost">
                          <span className="flex items-center gap-2">
                            <XCircle className="h-3 w-3 text-destructive" /> Perdido
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Apenas uma etapa de Ganho e uma de Perdido por funil.
                    </p>
                    {validateStageStatus() && (
                      <p className="text-xs text-destructive mt-1">{validateStageStatus()}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="stage-category">Categoria *</Label>
                      <Select
                        value={stageFormData.stage_category}
                        onValueChange={(v) => setStageFormData({ ...stageFormData, stage_category: v })}
                      >
                        <SelectTrigger id="stage-category">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STAGE_CATEGORY_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        Para BI e relatórios. Independe do nome.
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="stage-phase">Fase *</Label>
                      <Select
                        value={stageFormData.stage_phase}
                        onValueChange={(v) => setStageFormData({ ...stageFormData, stage_phase: v })}
                      >
                        <SelectTrigger id="stage-phase">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STAGE_PHASE_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        Pré-venda, venda ou pós-venda.
                      </p>
                    </div>
                  </div>

                  <Collapsible open={showLegacyType} onOpenChange={setShowLegacyType}>
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <ChevronDown className={cn('h-3 w-3 transition-transform', showLegacyType && 'rotate-180')} />
                        Avançado (legado)
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-2">
                      <Label htmlFor="stage-type" className="text-xs">Tipo de Etapa (legado)</Label>
                      <Select
                        value={stageFormData.stage || '__NONE__'}
                        onValueChange={(v) => setStageFormData({ ...stageFormData, stage: v === '__NONE__' ? '' : v })}
                      >
                        <SelectTrigger id="stage-type">
                          <SelectValue placeholder="Sem tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__NONE__">Sem tipo</SelectItem>
                          {DEAL_STAGES.map((s) => (
                            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        Mantido apenas por compatibilidade. A regra de negócio agora usa "Status da Etapa".
                      </p>
                    </CollapsibleContent>
                  </Collapsible>

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

                  <div className="space-y-2">
                    <Label>Perfis que podem mover para esta etapa</Label>
                    <p className="text-xs text-muted-foreground">
                      Nenhum selecionado = todos podem mover. Admin sempre tem acesso.
                    </p>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      {ROLE_OPTIONS.filter(r => r.value !== 'admin').map((role) => (
                        <label
                          key={role.value}
                          className="flex items-center gap-2 text-sm cursor-pointer"
                        >
                          <Checkbox
                            checked={stageFormData.allowed_roles.includes(role.value)}
                            onCheckedChange={(checked) => {
                              setStageFormData(prev => ({
                                ...prev,
                                allowed_roles: checked
                                  ? [...prev.allowed_roles, role.value]
                                  : prev.allowed_roles.filter(r => r !== role.value),
                              }));
                            }}
                          />
                          {role.label}
                        </label>
                      ))}
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

          {orderedPipelineGroups.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Palette className="h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-semibold">Nenhuma etapa cadastrada</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Crie a primeira etapa para começar a estruturar seus funis.
                </p>
                <Button className="gap-2" onClick={() => setIsStageDialogOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Nova Etapa
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {orderedPipelineGroups.map(({ id, pipeline, stages }) => {
                const isUnassigned = pipeline === null;
                const TypeIcon = isUnassigned
                  ? Globe
                  : (typeLabels[pipeline!.type]?.icon || Target);
                const typeLabel = isUnassigned ? null : typeLabels[pipeline!.type]?.label;
                const groupTitle = isUnassigned ? 'Etapas sem funil' : pipeline!.name;

                return (
                  <Card key={id} className="rounded-xl shadow-sm overflow-hidden">
                    <CardHeader className="bg-muted/30 border-b py-3 px-4 sm:px-6">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-lg shrink-0",
                            isUnassigned ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
                          )}>
                            <TypeIcon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <CardTitle className="text-base font-semibold truncate">
                              {groupTitle}
                            </CardTitle>
                            {pipeline?.description && (
                              <p className="text-xs text-muted-foreground truncate">
                                {pipeline.description}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {typeLabel && (
                            <Badge variant="outline" className="text-xs">
                              {typeLabel}
                            </Badge>
                          )}
                          <Badge variant="secondary" className="text-xs">
                            {stages.length} {stages.length === 1 ? 'etapa' : 'etapas'}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    {!isUnassigned && pipeline?.id && (
                      <PipelineConsistencyWarnings pipelineId={pipeline.id} />
                    )}
                    <CardContent className="p-0">
                      <div className="divide-y">
                        {stages.map((stage) => {
                          const allowedRoles = ((stage as any).allowed_roles || []) as string[];
                          const hasRoles = allowedRoles.length > 0;
                          const slaHours = stage.sla_hours;

                          return (
                            <div
                              key={stage.id}
                              role="button"
                              tabIndex={0}
                              onClick={() => handleEditStage(stage)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  handleEditStage(stage);
                                }
                              }}
                              className="flex flex-col gap-2 px-4 sm:px-6 py-3 hover:bg-muted/60 cursor-pointer transition-colors sm:flex-row sm:items-center sm:justify-between focus:outline-none focus-visible:bg-muted/60"
                            >
                              {/* Left: color + name + role badges */}
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div
                                  className="h-3 w-3 rounded-full border shrink-0"
                                  style={{ backgroundColor: stage.color || '#6366f1' }}
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="font-semibold text-sm text-foreground truncate">{stage.name}</span>
                                    {(() => {
                                      const cat = (stage as any).stage_category as string | undefined;
                                      const opt = STAGE_CATEGORY_OPTIONS.find(o => o.value === cat);
                                      if (!opt) return null;
                                      return (
                                        <Badge variant="outline" className={cn('text-[10px] py-0 h-4 border', opt.tone)}>
                                          {opt.label}
                                        </Badge>
                                      );
                                    })()}
                                    {(stage as any).stage_phase && (stage as any).stage_phase !== 'sale' && (
                                      <Badge variant="outline" className="text-[10px] py-0 h-4 text-muted-foreground">
                                        {STAGE_PHASE_OPTIONS.find(p => p.value === (stage as any).stage_phase)?.label}
                                      </Badge>
                                    )}
                                    {hasRoles && allowedRoles.map((role) => (
                                      <Badge key={role} variant="outline" className="text-[10px] py-0 h-4">
                                        {ROLE_OPTIONS.find(r => r.value === role)?.label || role}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              {/* Right: status + probability + sla + actions */}
                              <div className="flex items-center gap-3 sm:gap-4 flex-wrap justify-end">
                                {stageStatusBadge((stage as any).stage_status)}
                                <span className="text-xs font-medium text-muted-foreground tabular-nums min-w-[2.5rem] text-right">
                                  {stage.probability}%
                                </span>
                                {slaHours ? (
                                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                                    ⏱ {slaHours}h
                                  </span>
                                ) : null}
                                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEditStage(stage);
                                    }}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-destructive hover:text-destructive"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent onClick={(e) => e.stopPropagation()}>
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
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
