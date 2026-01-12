import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Plus, Settings2, Pencil, Trash2, GripVertical, Palette, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';

type CustomField = Tables<'custom_fields'>;
type PipelineStage = Tables<'pipeline_stages'>;
type CustomFieldEntity = 'company' | 'contact' | 'deal';
type CustomFieldType = 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'checkbox' | 'url' | 'email' | 'phone' | 'currency';

const fieldTypeLabels: Record<CustomFieldType, string> = {
  text: 'Texto',
  number: 'Número',
  date: 'Data',
  select: 'Seleção única',
  multiselect: 'Seleção múltipla',
  checkbox: 'Checkbox',
  url: 'URL',
  email: 'Email',
  phone: 'Telefone',
  currency: 'Moeda',
};

const entityLabels: Record<CustomFieldEntity, string> = {
  company: 'Empresas',
  contact: 'Contatos',
  deal: 'Negócios',
};

export default function Settings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('custom-fields');
  const [isFieldDialogOpen, setIsFieldDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<CustomField | null>(null);
  const [fieldFormData, setFieldFormData] = useState<Partial<TablesInsert<'custom_fields'>>>({
    name: '',
    label: '',
    entity: 'company',
    field_type: 'text',
    is_required: false,
    options: null,
  });
  const [optionsInput, setOptionsInput] = useState('');

  const { data: customFields, isLoading: fieldsLoading } = useQuery({
    queryKey: ['custom_fields'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('custom_fields')
        .select('*')
        .order('entity', { ascending: true })
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data as CustomField[];
    },
  });

  const { data: pipelineStages, isLoading: stagesLoading } = useQuery({
    queryKey: ['pipeline_stages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pipeline_stages')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data as PipelineStage[];
    },
  });

  const { data: userRoles } = useQuery({
    queryKey: ['user_roles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('*, profiles(full_name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createFieldMutation = useMutation({
    mutationFn: async (data: TablesInsert<'custom_fields'>) => {
      const { error } = await supabase.from('custom_fields').insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom_fields'] });
      toast.success('Campo criado com sucesso!');
      resetFieldForm();
    },
    onError: () => toast.error('Erro ao criar campo'),
  });

  const updateFieldMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<CustomField> & { id: string }) => {
      const { error } = await supabase.from('custom_fields').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom_fields'] });
      toast.success('Campo atualizado!');
      resetFieldForm();
    },
    onError: () => toast.error('Erro ao atualizar campo'),
  });

  const deleteFieldMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('custom_fields').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom_fields'] });
      toast.success('Campo excluído!');
    },
    onError: () => toast.error('Erro ao excluir campo'),
  });

  const resetFieldForm = () => {
    setFieldFormData({
      name: '',
      label: '',
      entity: 'company',
      field_type: 'text',
      is_required: false,
      options: null,
    });
    setOptionsInput('');
    setEditingField(null);
    setIsFieldDialogOpen(false);
  };

  const handleFieldSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const options = ['select', 'multiselect'].includes(fieldFormData.field_type || '')
      ? optionsInput.split('\n').filter(o => o.trim()).map(o => o.trim())
      : null;

    const data = {
      ...fieldFormData,
      name: fieldFormData.label?.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') || '',
      options: options ? JSON.stringify(options) : null,
    };

    if (editingField) {
      updateFieldMutation.mutate({ id: editingField.id, ...data });
    } else {
      createFieldMutation.mutate({
        ...data,
        created_by: user?.id,
      } as TablesInsert<'custom_fields'>);
    }
  };

  const handleEditField = (field: CustomField) => {
    setEditingField(field);
    setFieldFormData({
      name: field.name,
      label: field.label,
      entity: field.entity,
      field_type: field.field_type,
      is_required: field.is_required || false,
    });
    if (field.options) {
      try {
        const opts = typeof field.options === 'string' ? JSON.parse(field.options) : field.options;
        setOptionsInput(Array.isArray(opts) ? opts.join('\n') : '');
      } catch {
        setOptionsInput('');
      }
    }
    setIsFieldDialogOpen(true);
  };

  const groupedFields = customFields?.reduce((acc, field) => {
    if (!acc[field.entity]) acc[field.entity] = [];
    acc[field.entity].push(field);
    return acc;
  }, {} as Record<string, CustomField[]>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Configurações</h1>
          <p className="text-muted-foreground">Personalize seu CRM</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="custom-fields" className="gap-2">
            <Settings2 className="h-4 w-4" />
            Campos Personalizados
          </TabsTrigger>
          <TabsTrigger value="pipeline" className="gap-2">
            <Palette className="h-4 w-4" />
            Pipeline
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            Usuários
          </TabsTrigger>
        </TabsList>

        <TabsContent value="custom-fields" className="mt-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Campos Personalizados</h2>
              <p className="text-sm text-muted-foreground">Adicione campos extras para empresas, contatos e negócios</p>
            </div>
            <Dialog open={isFieldDialogOpen} onOpenChange={(open) => { setIsFieldDialogOpen(open); if (!open) resetFieldForm(); }}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Novo Campo
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingField ? 'Editar Campo' : 'Novo Campo'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleFieldSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="label">Nome do Campo *</Label>
                    <Input
                      id="label"
                      value={fieldFormData.label}
                      onChange={(e) => setFieldFormData({ ...fieldFormData, label: e.target.value })}
                      placeholder="Ex: Faturamento Anual"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="entity">Entidade *</Label>
                    <Select 
                      value={fieldFormData.entity} 
                      onValueChange={(v) => setFieldFormData({ ...fieldFormData, entity: v as CustomFieldEntity })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(entityLabels).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="field_type">Tipo do Campo *</Label>
                    <Select 
                      value={fieldFormData.field_type} 
                      onValueChange={(v) => setFieldFormData({ ...fieldFormData, field_type: v as CustomFieldType })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(fieldTypeLabels).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {['select', 'multiselect'].includes(fieldFormData.field_type || '') && (
                    <div>
                      <Label htmlFor="options">Opções (uma por linha)</Label>
                      <textarea
                        id="options"
                        value={optionsInput}
                        onChange={(e) => setOptionsInput(e.target.value)}
                        className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                        placeholder="Opção 1&#10;Opção 2&#10;Opção 3"
                      />
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Switch
                      id="is_required"
                      checked={fieldFormData.is_required || false}
                      onCheckedChange={(checked) => setFieldFormData({ ...fieldFormData, is_required: checked })}
                    />
                    <Label htmlFor="is_required" className="font-normal">Campo obrigatório</Label>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={resetFieldForm}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={createFieldMutation.isPending || updateFieldMutation.isPending}>
                      {editingField ? 'Atualizar' : 'Criar'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {fieldsLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : !customFields?.length ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                <Settings2 className="h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-semibold">Nenhum campo personalizado</h3>
                <p className="text-muted-foreground">Crie campos personalizados para armazenar informações específicas.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-3">
              {Object.entries(entityLabels).map(([entity, label]) => (
                <Card key={entity}>
                  <CardHeader>
                    <CardTitle className="text-lg">{label}</CardTitle>
                    <CardDescription>
                      {groupedFields?.[entity]?.length || 0} campos personalizados
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {groupedFields?.[entity]?.length ? (
                      <div className="space-y-2">
                        {groupedFields[entity].map((field) => (
                          <div
                            key={field.id}
                            className="flex items-center justify-between p-2 rounded-lg border hover:bg-muted/50"
                          >
                            <div className="flex items-center gap-2">
                              <GripVertical className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="font-medium text-sm">{field.label}</p>
                                <p className="text-xs text-muted-foreground">{fieldTypeLabels[field.field_type]}</p>
                              </div>
                              {field.is_required && (
                                <Badge variant="secondary" className="text-xs">Obrigatório</Badge>
                              )}
                            </div>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditField(field)}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => deleteFieldMutation.mutate(field.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">Nenhum campo</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="pipeline" className="mt-6 space-y-6">
          <div>
            <h2 className="text-xl font-semibold">Etapas do Pipeline</h2>
            <p className="text-sm text-muted-foreground">Configure as etapas do seu funil de vendas</p>
          </div>

          {stagesLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-2">
                  {pipelineStages?.map((stage) => (
                    <div
                      key={stage.id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div className="flex items-center gap-3">
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                        <div
                          className="h-4 w-4 rounded-full"
                          style={{ backgroundColor: stage.color || '#6366f1' }}
                        />
                        <div>
                          <p className="font-medium">{stage.name}</p>
                          <p className="text-xs text-muted-foreground">Probabilidade: {stage.probability}%</p>
                        </div>
                      </div>
                      <Badge variant="outline">{stage.stage}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="users" className="mt-6 space-y-6">
          <div>
            <h2 className="text-xl font-semibold">Usuários e Permissões</h2>
            <p className="text-sm text-muted-foreground">Gerencie os membros da equipe</p>
          </div>

          <Card>
            <CardContent className="pt-6">
              {userRoles?.length ? (
                <div className="space-y-2">
                  {userRoles.map((ur) => (
                    <div
                      key={ur.id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                          {((ur as any).profiles?.full_name?.[0] || 'U').toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">{(ur as any).profiles?.full_name || 'Usuário'}</p>
                          <p className="text-xs text-muted-foreground">{ur.user_id}</p>
                        </div>
                      </div>
                      <Badge variant={ur.role === 'admin' ? 'default' : 'secondary'}>
                        {ur.role === 'admin' ? 'Administrador' : 'Vendedor'}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum usuário encontrado</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
