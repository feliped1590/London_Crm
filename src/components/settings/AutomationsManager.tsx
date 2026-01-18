import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Zap, MessageSquare, ListTodo, Tag, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

type AutomationTrigger = 'stage_enter' | 'stage_exit';
type AutomationAction = 'send_whatsapp' | 'create_task' | 'add_tag' | 'send_email';
type DealStage = 'prospeccao' | 'qualificacao' | 'proposta' | 'negociacao' | 'fechado_ganho' | 'fechado_perdido';

const stageLabels: Record<DealStage, string> = {
  prospeccao: 'Prospecção',
  qualificacao: 'Qualificação',
  proposta: 'Proposta',
  negociacao: 'Negociação',
  fechado_ganho: 'Fechado (Ganho)',
  fechado_perdido: 'Fechado (Perdido)',
};

const triggerLabels: Record<AutomationTrigger, string> = {
  stage_enter: 'Quando entrar em',
  stage_exit: 'Quando sair de',
};

const actionLabels: Record<AutomationAction, { label: string; icon: typeof Zap }> = {
  send_whatsapp: { label: 'Enviar WhatsApp', icon: MessageSquare },
  create_task: { label: 'Criar Tarefa', icon: ListTodo },
  add_tag: { label: 'Adicionar Tag', icon: Tag },
  send_email: { label: 'Enviar Email', icon: Mail },
};

const stages: DealStage[] = ['prospeccao', 'qualificacao', 'proposta', 'negociacao', 'fechado_ganho', 'fechado_perdido'];

interface Automation {
  id: string;
  name: string;
  trigger_type: AutomationTrigger;
  trigger_stage: DealStage;
  action_type: AutomationAction;
  action_config: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
}

export function AutomationsManager() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<Automation | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    trigger_type: 'stage_enter' as AutomationTrigger,
    trigger_stage: 'proposta' as DealStage,
    action_type: 'create_task' as AutomationAction,
    is_active: true,
    // Action config fields
    message_template: '',
    task_title: '',
    task_priority: 'media',
    task_due_days: 1,
    task_description: '',
    tag: '',
    email_template_id: '',
  });

  const { data: automations, isLoading } = useQuery({
    queryKey: ['pipeline_automations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pipeline_automations')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Automation[];
    },
  });

  const { data: emailTemplates } = useQuery({
    queryKey: ['email_templates'],
    queryFn: async () => {
      const { data, error } = await supabase.from('email_templates').select('id, name').order('name');
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from('pipeline_automations').insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline_automations'] });
      toast.success('Automação criada com sucesso!');
      resetForm();
    },
    onError: () => toast.error('Erro ao criar automação'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const { error } = await supabase.from('pipeline_automations').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline_automations'] });
      toast.success('Automação atualizada!');
      resetForm();
    },
    onError: () => toast.error('Erro ao atualizar automação'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('pipeline_automations').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline_automations'] });
      toast.success('Automação excluída!');
    },
    onError: () => toast.error('Erro ao excluir automação'),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('pipeline_automations').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline_automations'] });
      toast.success('Status alterado!');
    },
    onError: () => toast.error('Erro ao alterar status'),
  });

  const resetForm = () => {
    setFormData({
      name: '',
      trigger_type: 'stage_enter',
      trigger_stage: 'proposta',
      action_type: 'create_task',
      is_active: true,
      message_template: '',
      task_title: '',
      task_priority: 'media',
      task_due_days: 1,
      task_description: '',
      tag: '',
      email_template_id: '',
    });
    setEditingAutomation(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (automation: Automation) => {
    setEditingAutomation(automation);
    const config = automation.action_config || {};
    setFormData({
      name: automation.name,
      trigger_type: automation.trigger_type,
      trigger_stage: automation.trigger_stage,
      action_type: automation.action_type,
      is_active: automation.is_active,
      message_template: (config.message_template as string) || '',
      task_title: (config.title as string) || '',
      task_priority: (config.priority as string) || 'media',
      task_due_days: (config.due_days as number) || 1,
      task_description: (config.description as string) || '',
      tag: (config.tag as string) || '',
      email_template_id: (config.template_id as string) || '',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let action_config: Record<string, unknown> = {};

    switch (formData.action_type) {
      case 'send_whatsapp':
        action_config = { message_template: formData.message_template };
        break;
      case 'create_task':
        action_config = {
          title: formData.task_title,
          priority: formData.task_priority,
          due_days: formData.task_due_days,
          description: formData.task_description,
        };
        break;
      case 'add_tag':
        action_config = { tag: formData.tag };
        break;
      case 'send_email':
        action_config = { template_id: formData.email_template_id };
        break;
    }

    const data = {
      name: formData.name,
      trigger_type: formData.trigger_type,
      trigger_stage: formData.trigger_stage,
      action_type: formData.action_type,
      action_config,
      is_active: formData.is_active,
    };

    if (editingAutomation) {
      updateMutation.mutate({ id: editingAutomation.id, ...data });
    } else {
      createMutation.mutate({ ...data, created_by: user?.id });
    }
  };

  const ActionIcon = actionLabels[formData.action_type]?.icon || Zap;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Automações de Pipeline</h2>
          <p className="text-sm text-muted-foreground">
            Configure ações automáticas baseadas em mudanças de etapa
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Automação
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingAutomation ? 'Editar Automação' : 'Nova Automação'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Nome da Automação *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Criar tarefa ao entrar em proposta"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Gatilho</Label>
                  <Select
                    value={formData.trigger_type}
                    onValueChange={(v) => setFormData({ ...formData, trigger_type: v as AutomationTrigger })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(triggerLabels).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Etapa</Label>
                  <Select
                    value={formData.trigger_stage}
                    onValueChange={(v) => setFormData({ ...formData, trigger_stage: v as DealStage })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {stages.map((stage) => (
                        <SelectItem key={stage} value={stage}>{stageLabels[stage]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Ação</Label>
                <Select
                  value={formData.action_type}
                  onValueChange={(v) => setFormData({ ...formData, action_type: v as AutomationAction })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(actionLabels).map(([key, { label, icon: Icon }]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Action-specific fields */}
              {formData.action_type === 'send_whatsapp' && (
                <div>
                  <Label>Mensagem *</Label>
                  <Textarea
                    value={formData.message_template}
                    onChange={(e) => setFormData({ ...formData, message_template: e.target.value })}
                    placeholder="Olá {{contact_name}}, sua proposta está pronta!"
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Use: {"{{contact_name}}"}, {"{{deal_name}}"}, {"{{deal_value}}"}, {"{{company_name}}"}
                  </p>
                </div>
              )}

              {formData.action_type === 'create_task' && (
                <>
                  <div>
                    <Label>Título da Tarefa *</Label>
                    <Input
                      value={formData.task_title}
                      onChange={(e) => setFormData({ ...formData, task_title: e.target.value })}
                      placeholder="Ligar para {{contact_name}}"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Prioridade</Label>
                      <Select
                        value={formData.task_priority}
                        onValueChange={(v) => setFormData({ ...formData, task_priority: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="baixa">Baixa</SelectItem>
                          <SelectItem value="media">Média</SelectItem>
                          <SelectItem value="alta">Alta</SelectItem>
                          <SelectItem value="urgente">Urgente</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Prazo (dias)</Label>
                      <Input
                        type="number"
                        min="1"
                        value={formData.task_due_days}
                        onChange={(e) => setFormData({ ...formData, task_due_days: parseInt(e.target.value) || 1 })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Descrição (opcional)</Label>
                    <Textarea
                      value={formData.task_description}
                      onChange={(e) => setFormData({ ...formData, task_description: e.target.value })}
                      placeholder="Detalhes da tarefa..."
                      rows={2}
                    />
                  </div>
                </>
              )}

              {formData.action_type === 'add_tag' && (
                <div>
                  <Label>Nome da Tag *</Label>
                  <Input
                    value={formData.tag}
                    onChange={(e) => setFormData({ ...formData, tag: e.target.value })}
                    placeholder="proposta_enviada"
                  />
                </div>
              )}

              {formData.action_type === 'send_email' && (
                <div>
                  <Label>Template de Email</Label>
                  <Select
                    value={formData.email_template_id || 'none'}
                    onValueChange={(v) => setFormData({ ...formData, email_template_id: v === 'none' ? '' : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um template" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum template</SelectItem>
                      {emailTemplates?.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label htmlFor="is_active" className="font-normal">Automação ativa</Label>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingAutomation ? 'Atualizar' : 'Criar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : automations && automations.length > 0 ? (
        <div className="grid gap-4">
          {automations.map((automation) => {
            const ActionIcon = actionLabels[automation.action_type]?.icon || Zap;
            return (
              <Card key={automation.id} className={!automation.is_active ? 'opacity-60' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <ActionIcon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{automation.name}</h4>
                          {!automation.is_active && (
                            <Badge variant="secondary" className="text-xs">Inativa</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {triggerLabels[automation.trigger_type]} <strong>{stageLabels[automation.trigger_stage]}</strong> → {actionLabels[automation.action_type]?.label}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={automation.is_active}
                        onCheckedChange={(checked) => toggleActiveMutation.mutate({ id: automation.id, is_active: checked })}
                      />
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(automation)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir automação?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação não pode ser desfeita. A automação "{automation.name}" será excluída permanentemente.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteMutation.mutate(automation.id)}>
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center">
            <Zap className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="font-medium mb-1">Nenhuma automação configurada</h3>
            <p className="text-sm text-muted-foreground">
              Crie automações para executar ações quando negócios mudarem de etapa.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
