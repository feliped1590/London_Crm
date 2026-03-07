import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, Settings2, Pencil, Trash2, GripVertical, Palette, Users, UserPlus, Shield, Zap, Lock, Headphones, FolderOpen, Target, TrendingUp, Bell, CheckSquare, Bot, ClipboardCheck, Search, Calculator, Building2, ArrowLeftRight, RefreshCw, DollarSign, Monitor } from 'lucide-react';
import { useLegalEntities } from '@/hooks/useLegalEntities';
import { formatCNPJ } from '@/lib/cpfCnpjMask';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { AutomationsManager } from '@/components/settings/AutomationsManager';
import { PermissionsManager } from '@/components/settings/PermissionsManager';
import { LicenseCard } from '@/components/settings/LicenseCard';

import { PortfolioManager } from '@/components/settings/PortfolioManager';
import { PortfolioDelegationManager } from '@/components/settings/PortfolioDelegationManager';
import { SalesGoalsManager } from '@/components/settings/SalesGoalsManager';
import { CustomNotificationsManager } from '@/components/settings/CustomNotificationsManager';
import { StageChecklistManager } from '@/components/settings/StageChecklistManager';
import { AIAssistantConfig } from '@/components/settings/AIAssistantConfig';
import { OrderApprovalRulesManager } from '@/components/settings/OrderApprovalRulesManager';
import { UnifiedPipelineManager } from '@/components/settings/UnifiedPipelineManager';
import { ProspectingApiConfig } from '@/components/settings/ProspectingApiConfig';
import { AdminInterventionsViewer } from '@/components/settings/AdminInterventionsViewer';
import { FiscalSettingsTab } from '@/components/settings/FiscalSettingsTab';
import { LegalEntityPermissionsManager } from '@/components/settings/LegalEntityPermissionsManager';
import { PortfolioReallocationContent } from '@/components/settings/PortfolioReallocationContent';
import { BotsManager } from '@/components/settings/BotsManager';
import { ActiveSessionsManager } from '@/components/settings/ActiveSessionsManager';
import { SalesRepsManager } from '@/components/settings/SalesRepsManager';
import PricingTablesContent from '@/pages/PricingTables';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';

type CustomField = Tables<'custom_fields'>;
type PipelineStage = Tables<'pipeline_stages'>;
type CustomFieldEntity = 'company' | 'contact' | 'deal';
type CustomFieldType = 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'checkbox' | 'url' | 'email' | 'phone' | 'currency';
type AppRole = 'admin' | 'vendedor' | 'atendente';

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

const roleLabels: Record<AppRole, string> = {
  admin: 'Administrador',
  vendedor: 'Vendedor',
  atendente: 'Atendente',
};

// --- Edit User Form with CNPJ linking ---
function EditUserForm({ editingUser, editUserFormData, setEditUserFormData, onSubmit, onCancel, isPending }: {
  editingUser: { userId: string; currentRole: AppRole; fullName: string; email: string };
  editUserFormData: { full_name: string; email: string; password: string; role: AppRole };
  setEditUserFormData: (data: any) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const queryClient = useQueryClient();
  const { accessibleEntities } = useLegalEntities();
  const [newEntityId, setNewEntityId] = useState('');

  // Fetch user's profile id
  const { data: userProfile } = useQuery({
    queryKey: ['profile_for_edit', editingUser.userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id')
        .eq('user_id', editingUser.userId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch user's CNPJ links
  const { data: userLinks = [] } = useQuery({
    queryKey: ['user_legal_entities_edit', userProfile?.id],
    queryFn: async () => {
      if (!userProfile?.id) return [];
      const { data, error } = await supabase
        .from('user_legal_entities')
        .select('*')
        .eq('user_id', userProfile.id);
      if (error) throw error;
      return data;
    },
    enabled: !!userProfile?.id,
  });

  const addLinkMutation = useMutation({
    mutationFn: async (entityId: string) => {
      if (!userProfile) throw new Error('Profile not found');
      const { data: entity } = await supabase
        .from('legal_entities')
        .select('tenant_id')
        .eq('id', entityId)
        .single();
      if (!entity?.tenant_id) throw new Error('Não foi possível determinar o tenant da entidade jurídica');
      const { error } = await supabase.from('user_legal_entities').insert({
        user_id: userProfile.id,
        legal_entity_id: entityId,
        role: 'member',
        tenant_id: entity.tenant_id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user_legal_entities_edit'] });
      queryClient.invalidateQueries({ queryKey: ['user_legal_entities'] });
      toast.success('CNPJ vinculado');
      setNewEntityId('');
    },
    onError: (e: Error) => toast.error(e.message || 'Erro ao vincular CNPJ'),
  });

  const removeLinkMutation = useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await supabase.from('user_legal_entities').delete().eq('id', linkId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user_legal_entities_edit'] });
      queryClient.invalidateQueries({ queryKey: ['user_legal_entities'] });
      toast.success('Vínculo removido');
    },
    onError: () => toast.error('Erro ao remover vínculo'),
  });

  const linkedEntityIds = new Set(userLinks.map(l => l.legal_entity_id));
  const availableEntities = accessibleEntities.filter(e => !linkedEntityIds.has(e.id));

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Editando <strong>{editingUser.fullName}</strong>
      </p>
      <div>
        <Label htmlFor="edit-full_name">Nome Completo</Label>
        <Input
          id="edit-full_name"
          value={editUserFormData.full_name}
          onChange={(e) => setEditUserFormData({ ...editUserFormData, full_name: e.target.value })}
          placeholder="Nome completo do usuário"
        />
      </div>
      <div>
        <Label htmlFor="edit-email">Novo Email de Acesso</Label>
        <Input
          id="edit-email"
          type="email"
          value={editUserFormData.email}
          onChange={(e) => setEditUserFormData({ ...editUserFormData, email: e.target.value })}
          placeholder="Deixe em branco para manter o atual"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Deixe em branco para não alterar o email atual.
        </p>
      </div>
      <div>
        <Label htmlFor="edit-password">Nova Senha</Label>
        <Input
          id="edit-password"
          type="password"
          value={editUserFormData.password}
          onChange={(e) => setEditUserFormData({ ...editUserFormData, password: e.target.value })}
          placeholder="Deixe em branco para manter a atual"
          minLength={6}
        />
        <p className="text-xs text-muted-foreground mt-1">
          Mínimo 6 caracteres. Deixe em branco para não alterar.
        </p>
      </div>
      <div>
        <Label htmlFor="edit-user-role">Nível de Acesso</Label>
        <Select 
          value={editUserFormData.role} 
          onValueChange={(v) => setEditUserFormData({ ...editUserFormData, role: v as AppRole })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="atendente">
              <div className="flex items-center gap-2">
                <Headphones className="h-4 w-4" />
                Atendente
              </div>
            </SelectItem>
            <SelectItem value="vendedor">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Vendedor
              </div>
            </SelectItem>
            <SelectItem value="admin">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Administrador
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* CNPJ Links Section */}
      {accessibleEntities.length > 0 && (
        <div className="space-y-3 pt-2 border-t">
          <Label className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            CNPJs Vinculados
          </Label>
          <p className="text-xs text-muted-foreground">
            Sem vínculos = acesso a todos os CNPJs. Vincule para restringir.
          </p>
          
          {userLinks.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {userLinks.map(link => {
                const entity = accessibleEntities.find(e => e.id === link.legal_entity_id);
                return (
                  <Badge key={link.id} variant="outline" className="gap-1 pr-1">
                    {entity?.name || 'CNPJ'} — {entity ? formatCNPJ(entity.cnpj) : ''}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 ml-1 hover:text-destructive"
                      onClick={() => removeLinkMutation.mutate(link.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </Badge>
                );
              })}
            </div>
          )}
          
          {availableEntities.length > 0 && (
            <div className="flex gap-2">
              <Select value={newEntityId} onValueChange={setNewEntityId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Selecione um CNPJ" />
                </SelectTrigger>
                <SelectContent>
                  {availableEntities.map(e => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name} — {formatCNPJ(e.cnpj)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!newEntityId || addLinkMutation.isPending}
                onClick={() => newEntityId && addLinkMutation.mutate(newEntityId)}
              >
                Vincular
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Salvando...' : 'Salvar Alterações'}
        </Button>
      </div>
    </form>
  );
}

function TaskAlertSettings() {
  const queryClient = useQueryClient();
  
  const { data: config, isLoading } = useQuery({
    queryKey: ['task_alert_config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'task_alert_config')
        .maybeSingle();
      if (error) throw error;
      return {
        enable_task_login_alert: true,
        enable_task_login_sound: true,
        ...(data?.value as Record<string, boolean> || {}),
      };
    },
  });

  const mutation = useMutation({
    mutationFn: async (newConfig: Record<string, boolean>) => {
      const { error } = await supabase
        .from('system_settings')
        .upsert({ key: 'task_alert_config', value: newConfig as any }, { onConflict: 'key' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task_alert_config'] });
      toast.success('Configuração salva');
    },
    onError: () => toast.error('Erro ao salvar configuração'),
  });

  const toggle = (field: string) => {
    if (!config) return;
    mutation.mutate({ ...config, [field]: !config[field as keyof typeof config] });
  };

  if (isLoading || !config) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="h-4 w-4" />
          Alerta de Tarefas no Login
        </CardTitle>
        <CardDescription>
          Configurações do alerta automático de tarefas pendentes exibido ao realizar login.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Alerta no login</p>
            <p className="text-xs text-muted-foreground">Exibir modal com tarefas vencidas/vencendo hoje</p>
          </div>
          <Switch
            checked={config.enable_task_login_alert}
            onCheckedChange={() => toggle('enable_task_login_alert')}
          />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Som de notificação</p>
            <p className="text-xs text-muted-foreground">Tocar som ao exibir o alerta</p>
          </div>
          <Switch
            checked={config.enable_task_login_sound}
            onCheckedChange={() => toggle('enable_task_login_sound')}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export default function Settings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'pipelines';
  const [activeTab, setActiveTab] = useState(initialTab);
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

  // User management states
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<{ 
    userId: string; 
    currentRole: AppRole; 
    fullName: string;
    email: string;
  } | null>(null);
  const [editUserFormData, setEditUserFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'vendedor' as AppRole,
  });
  const [userFormData, setUserFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'vendedor' as AppRole,
  });

  // Check if current user is admin
  const { data: isAdmin } = useQuery({
    queryKey: ['is_admin', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data, error } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: 'admin'
      });
      if (error) throw error;
      return data as boolean;
    },
    enabled: !!user?.id,
  });

  // Check if current user is developer
  const { data: isDeveloper } = useQuery({
    queryKey: ['is_developer', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data, error } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: 'desenvolvedor' as any
      });
      if (error) throw error;
      return data as boolean;
    },
    enabled: !!user?.id,
  });

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

  const { data: userRoles, isLoading: usersLoading } = useQuery({
    queryKey: ['user_roles_with_profiles'],
    queryFn: async () => {
      // First fetch user roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*')
        .order('created_at', { ascending: false });
      if (rolesError) throw rolesError;
      
      // Then fetch profiles for all users
      const userIds = roles?.map(r => r.user_id) || [];
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds);
      if (profilesError) throw profilesError;
      
      // Combine the data
      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      return roles?.map(role => ({
        ...role,
        profile: profileMap.get(role.user_id) || null
      })) || [];
    },
  });

  // License status query
  const { data: licenseStatus } = useQuery({
    queryKey: ['license_status'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_license_status');
      if (error) throw error;
      // RPC returns an array, get the first element
      const result = Array.isArray(data) ? data[0] : data;
      return result as { can_add_user: boolean; current_users: number; max_users: number } | null;
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

  // User management mutations
  const createUserMutation = useMutation({
    mutationFn: async (data: typeof userFormData) => {
      const { data: response, error } = await supabase.functions.invoke('create-user', {
        body: data,
      });
      if (error) throw error;
      if (response?.error) throw new Error(response.error);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user_roles'] });
      queryClient.invalidateQueries({ queryKey: ['user_roles_with_profiles'] });
      queryClient.invalidateQueries({ queryKey: ['license_status'] });
      toast.success('Usuário criado com sucesso!');
      resetUserForm();
    },
    onError: (error: Error) => toast.error(error.message || 'Erro ao criar usuário'),
  });

  const updateUserMutation = useMutation({
    mutationFn: async (data: { 
      user_id: string; 
      email?: string; 
      password?: string; 
      full_name?: string; 
      role?: AppRole 
    }) => {
      const { data: response, error } = await supabase.functions.invoke('update-user', {
        body: data,
      });
      if (error) throw error;
      if (response?.error) throw new Error(response.error);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user_roles_with_profiles'] });
      toast.success('Usuário atualizado com sucesso!');
      resetEditUserDialog();
    },
    onError: (error: Error) => toast.error(error.message || 'Erro ao atualizar usuário'),
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data: response, error } = await supabase.functions.invoke('delete-user', {
        body: { user_id: userId },
      });
      if (error) throw error;
      if (response?.error) throw new Error(response.error);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user_roles'] });
      queryClient.invalidateQueries({ queryKey: ['user_roles_with_profiles'] });
      queryClient.invalidateQueries({ queryKey: ['license_status'] });
      toast.success('Usuário excluído com sucesso!');
    },
    onError: (error: Error) => toast.error(error.message || 'Erro ao excluir usuário'),
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

  const resetUserForm = () => {
    setUserFormData({ email: '', password: '', full_name: '', role: 'vendedor' });
    setIsUserDialogOpen(false);
  };

  const resetEditUserDialog = () => {
    setEditingUser(null);
    setEditUserFormData({ full_name: '', email: '', password: '', role: 'vendedor' });
    setIsEditUserDialogOpen(false);
  };

  const handleEditUser = (userId: string, currentRole: AppRole, fullName: string, email: string) => {
    setEditingUser({ userId, currentRole, fullName, email });
    setEditUserFormData({
      full_name: fullName,
      email: email,
      password: '',
      role: currentRole,
    });
    setIsEditUserDialogOpen(true);
  };

  const handleUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createUserMutation.mutate(userFormData);
  };

  const handleUserUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      const updateData: { 
        user_id: string; 
        email?: string; 
        password?: string; 
        full_name?: string; 
        role?: AppRole 
      } = {
        user_id: editingUser.userId,
      };

      // Only include fields that have changed
      if (editUserFormData.full_name && editUserFormData.full_name !== editingUser.fullName) {
        updateData.full_name = editUserFormData.full_name;
      }
      if (editUserFormData.email && editUserFormData.email !== editingUser.email) {
        updateData.email = editUserFormData.email;
      }
      if (editUserFormData.password) {
        updateData.password = editUserFormData.password;
      }
      if (editUserFormData.role !== editingUser.currentRole) {
        updateData.role = editUserFormData.role;
      }

      // Check if there are any changes
      if (Object.keys(updateData).length === 1) {
        toast.info('Nenhuma alteração detectada');
        return;
      }

      updateUserMutation.mutate(updateData);
    }
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
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="pipelines" className="gap-2">
            <Target className="h-4 w-4" />
            Config. Pipeline
          </TabsTrigger>
          <TabsTrigger value="goals" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Metas
          </TabsTrigger>
          <TabsTrigger value="permissions" className="gap-2">
            <Lock className="h-4 w-4" />
            Usuários e Permissões
          </TabsTrigger>
          <TabsTrigger value="portfolio" className="gap-2">
            <FolderOpen className="h-4 w-4" />
            Carteiras
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            Notificações
          </TabsTrigger>
          <TabsTrigger value="order-approval" className="gap-2">
            <ClipboardCheck className="h-4 w-4" />
            Tabelas e Aprovações
          </TabsTrigger>
          <TabsTrigger value="sales-reps" className="gap-2">
            <UserPlus className="h-4 w-4" />
            Vendedores
          </TabsTrigger>
          <TabsTrigger value="bots" className="gap-2">
            <Bot className="h-4 w-4" />
            Bots
          </TabsTrigger>
          {(isAdmin || isDeveloper) && (
            <TabsTrigger value="fiscal" className="gap-2">
              <Calculator className="h-4 w-4" />
              Fiscal
            </TabsTrigger>
          )}
          {(isAdmin || isDeveloper) && (
            <TabsTrigger value="cnpjs" className="gap-2">
              <Building2 className="h-4 w-4" />
              CNPJs
            </TabsTrigger>
          )}
          {isDeveloper && (
            <TabsTrigger value="ai-assistant" className="gap-2">
              <Bot className="h-4 w-4" />
              Assistente IA
            </TabsTrigger>
          )}
        </TabsList>


        {/* Tab "pipeline" foi unificada em "pipelines" via UnifiedPipelineManager */}

        <TabsContent value="pipelines" className="mt-6">
          <Tabs defaultValue="pipeline-sub">
            <TabsList>
              <TabsTrigger value="pipeline-sub" className="gap-2">
                <Target className="h-4 w-4" />
                Funis & Etapas
              </TabsTrigger>
              <TabsTrigger value="checklists-sub" className="gap-2">
                <CheckSquare className="h-4 w-4" />
                Checklists
              </TabsTrigger>
              <TabsTrigger value="automations-sub" className="gap-2">
                <Zap className="h-4 w-4" />
                Automações
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pipeline-sub" className="mt-4">
              <UnifiedPipelineManager />
            </TabsContent>

            <TabsContent value="checklists-sub" className="mt-4">
              <StageChecklistManager />
            </TabsContent>

            <TabsContent value="automations-sub" className="mt-4">
              <AutomationsManager />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="goals" className="mt-6">
          <SalesGoalsManager />
        </TabsContent>


        <TabsContent value="permissions" className="mt-6">
          <Tabs defaultValue="users-sub">
            <TabsList>
              <TabsTrigger value="users-sub" className="gap-2">
                <Users className="h-4 w-4" />
                Usuários
              </TabsTrigger>
              <TabsTrigger value="permissions-sub" className="gap-2">
                <Lock className="h-4 w-4" />
                Permissões por Módulo
              </TabsTrigger>
              {(isAdmin || isDeveloper) && (
                <TabsTrigger value="interventions-sub" className="gap-2">
                  <Shield className="h-4 w-4" />
                  Intervenções
                </TabsTrigger>
              )}
              {(isAdmin || isDeveloper) && (
                <TabsTrigger value="sessions-sub" className="gap-2">
                  <Monitor className="h-4 w-4" />
                  Sessões
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="users-sub" className="mt-4 space-y-6">
              {/* License Card */}
              <LicenseCard />

              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Usuários</h2>
                  <p className="text-sm text-muted-foreground">Gerencie os membros da equipe</p>
                </div>
                {isAdmin && (
                  <Dialog open={isUserDialogOpen} onOpenChange={(open) => { setIsUserDialogOpen(open); if (!open) resetUserForm(); }}>
                    <DialogTrigger asChild>
                      <Button 
                        className="gap-2"
                        disabled={!licenseStatus?.can_add_user}
                        title={!licenseStatus?.can_add_user ? 'Limite de usuários atingido' : undefined}
                      >
                        <UserPlus className="h-4 w-4" />
                        Novo Usuário
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Criar Novo Usuário</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleUserSubmit} className="space-y-4">
                        <div>
                          <Label htmlFor="full_name">Nome Completo *</Label>
                          <Input
                            id="full_name"
                            value={userFormData.full_name}
                            onChange={(e) => setUserFormData({ ...userFormData, full_name: e.target.value })}
                            placeholder="Ex: João Silva"
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="email">Email *</Label>
                          <Input
                            id="email"
                            type="email"
                            value={userFormData.email}
                            onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                            placeholder="joao@empresa.com"
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="password">Senha *</Label>
                          <Input
                            id="password"
                            type="password"
                            value={userFormData.password}
                            onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                            placeholder="Mínimo 6 caracteres"
                            minLength={6}
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="role">Nível de Acesso *</Label>
                          <Select 
                            value={userFormData.role} 
                            onValueChange={(v) => setUserFormData({ ...userFormData, role: v as AppRole })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="atendente">
                                <div className="flex items-center gap-2">
                                  <Headphones className="h-4 w-4" />
                                  Atendente
                                </div>
                              </SelectItem>
                              <SelectItem value="vendedor">
                                <div className="flex items-center gap-2">
                                  <Users className="h-4 w-4" />
                                  Vendedor
                                </div>
                              </SelectItem>
                              <SelectItem value="admin">
                                <div className="flex items-center gap-2">
                                  <Shield className="h-4 w-4" />
                                  Administrador
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground mt-1">
                            Administradores podem gerenciar usuários e configurações.
                          </p>
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button type="button" variant="outline" onClick={resetUserForm}>
                            Cancelar
                          </Button>
                          <Button type="submit" disabled={createUserMutation.isPending}>
                            {createUserMutation.isPending ? 'Criando...' : 'Criar Usuário'}
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                )}
              </div>

              <Card>
                <CardContent className="pt-6">
                  {usersLoading ? (
                    <div className="flex items-center justify-center py-10">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                    </div>
                  ) : userRoles?.length ? (
                    <div className="space-y-2">
                      {userRoles.filter(ur => ur.role !== 'desenvolvedor').map((ur) => {
                        const fullName = ur.profile?.full_name || 'Usuário';
                        const isCurrentUser = ur.user_id === user?.id;
                        
                        return (
                          <div
                            key={ur.id}
                            className="flex items-center justify-between p-3 rounded-lg border"
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                                {fullName[0]?.toUpperCase() || 'U'}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-medium">{fullName}</p>
                                  {isCurrentUser && (
                                    <Badge variant="outline" className="text-xs">Você</Badge>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground">{ur.user_id}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={ur.role === 'admin' ? 'default' : 'secondary'}>
                                {roleLabels[ur.role as AppRole] || ur.role}
                              </Badge>
                              {isAdmin && !isCurrentUser && (
                                <>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8"
                                    onClick={() => handleEditUser(ur.user_id, ur.role as AppRole, fullName, '')}
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
                                        <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Tem certeza que deseja excluir o usuário <strong>{fullName}</strong>? 
                                          Esta ação não pode ser desfeita e todos os dados associados serão removidos.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => deleteUserMutation.mutate(ur.user_id)}
                                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        >
                                          {deleteUserMutation.isPending ? 'Excluindo...' : 'Excluir'}
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhum usuário encontrado</p>
                  )}
                </CardContent>
              </Card>

              {/* Dialog de edição de usuário */}
              <Dialog open={isEditUserDialogOpen} onOpenChange={(open) => { setIsEditUserDialogOpen(open); if (!open) resetEditUserDialog(); }}>
                <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Editar Usuário</DialogTitle>
                  </DialogHeader>
                  {editingUser && (
                    <EditUserForm
                      editingUser={editingUser}
                      editUserFormData={editUserFormData}
                      setEditUserFormData={setEditUserFormData}
                      onSubmit={handleUserUpdate}
                      onCancel={resetEditUserDialog}
                      isPending={updateUserMutation.isPending}
                    />
                  )}
                </DialogContent>
              </Dialog>
            </TabsContent>

            <TabsContent value="permissions-sub" className="mt-4">
              <PermissionsManager />
            </TabsContent>

            {(isAdmin || isDeveloper) && (
              <TabsContent value="interventions-sub" className="mt-4">
                <AdminInterventionsViewer />
              </TabsContent>
            )}
            {(isAdmin || isDeveloper) && (
              <TabsContent value="sessions-sub" className="mt-4">
                <ActiveSessionsManager />
              </TabsContent>
            )}
          </Tabs>
        </TabsContent>

        <TabsContent value="portfolio" className="mt-6">
          <Tabs defaultValue="portfolio-sub">
            <TabsList>
              <TabsTrigger value="portfolio-sub" className="gap-2">
                <FolderOpen className="h-4 w-4" />
                Carteiras
              </TabsTrigger>
              <TabsTrigger value="delegations-sub" className="gap-2">
                <Users className="h-4 w-4" />
                Delegações
              </TabsTrigger>
              <TabsTrigger value="reallocation-sub" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Remanejamento
              </TabsTrigger>
            </TabsList>

            <TabsContent value="portfolio-sub" className="mt-4">
              <PortfolioManager />
            </TabsContent>

            <TabsContent value="delegations-sub" className="mt-4">
              <PortfolioDelegationManager />
            </TabsContent>

            <TabsContent value="reallocation-sub" className="mt-4">
              <PortfolioReallocationContent />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="notifications" className="mt-6 space-y-6">
          <CustomNotificationsManager />
          
          {isDeveloper && <TaskAlertSettings />}
        </TabsContent>


        <TabsContent value="order-approval" className="mt-6">
          <Tabs defaultValue="pricing-sub">
            <TabsList>
              <TabsTrigger value="pricing-sub" className="gap-2">
                <DollarSign className="h-4 w-4" />
                Tabelas de Preços
              </TabsTrigger>
              <TabsTrigger value="approval-sub" className="gap-2">
                <ClipboardCheck className="h-4 w-4" />
                Aprovação Pedidos
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pricing-sub" className="mt-4">
              <PricingTablesContent />
            </TabsContent>

            <TabsContent value="approval-sub" className="mt-4">
              <OrderApprovalRulesManager />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="sales-reps" className="mt-6 space-y-6">
          <SalesRepsManager />
        </TabsContent>

        <TabsContent value="bots" className="mt-6 space-y-6">
          <BotsManager />
        </TabsContent>


        {(isAdmin || isDeveloper) && (
          <TabsContent value="fiscal" className="mt-6 space-y-6">
            <FiscalSettingsTab />
          </TabsContent>
        )}

        {(isAdmin || isDeveloper) && (
          <TabsContent value="cnpjs" className="mt-6 space-y-6">
            <LegalEntityPermissionsManager />
          </TabsContent>
        )}



        {isDeveloper && (
          <TabsContent value="ai-assistant" className="mt-6 space-y-6">
            <AIAssistantConfig />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
