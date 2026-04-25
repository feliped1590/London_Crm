import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Eye, Pencil, Plus, Shield, Trash2 } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';
import { PermissionAction } from '@/lib/permissions/permissionEngine';
import { useAuth } from '@/hooks/useAuth';
import {
  type AppRole,
  EDITABLE_PERMISSION_ROLES,
  getRoleDefinition,
} from '@/lib/roles';

type SystemModule = Tables<'system_modules'>;
type RoleModulePermission = Tables<'role_module_permissions'>;

type AccessLevel = 'restrito' | 'total';
type PermissionField = 'can_view' | 'can_create' | 'can_edit' | 'can_delete';

const actionConfig = [
  { action: PermissionAction.View, field: 'can_view' as PermissionField, label: 'Visualizar', icon: Eye },
  { action: PermissionAction.Create, field: 'can_create' as PermissionField, label: 'Criar', icon: Plus },
  { action: PermissionAction.Edit, field: 'can_edit' as PermissionField, label: 'Editar', icon: Pencil },
  { action: PermissionAction.Delete, field: 'can_delete' as PermissionField, label: 'Excluir', icon: Trash2, sensitive: true },
];

export function PermissionsManager() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: modules, isLoading: modulesLoading } = useQuery({
    queryKey: ['system_modules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_modules')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data as SystemModule[];
    },
  });

  const { data: permissions, isLoading: permissionsLoading } = useQuery({
    queryKey: ['role_module_permissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('role_module_permissions')
        .select('*');
      if (error) throw error;
      return data as RoleModulePermission[];
    },
  });

  const updatePermissionMutation = useMutation({
    mutationFn: async ({
      role,
      moduleId,
      canAccess,
      accessType,
      granular,
    }: {
      role: AppRole;
      moduleId: string;
      canAccess: boolean;
      accessType: AccessLevel;
      granular?: Partial<Record<PermissionField, boolean>>;
    }) => {
      const existing = permissions?.find(p => p.role === role && p.module_id === moduleId);
      const module = modules?.find(m => m.id === moduleId);
      const payload = {
        can_access: canAccess,
        access_type: accessType,
        can_view: granular?.can_view ?? canAccess,
        can_create: granular?.can_create ?? (canAccess && accessType === 'total'),
        can_edit: granular?.can_edit ?? (canAccess && accessType === 'total'),
        can_delete: granular?.can_delete ?? false,
      };

      if (existing) {
        const { error } = await supabase
          .from('role_module_permissions')
          .update(payload)
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('role_module_permissions')
          .insert({ role, module_id: moduleId, ...payload });
        if (error) throw error;
      }

      const trackedFields: PermissionField[] = ['can_view', 'can_create', 'can_edit', 'can_delete'];
      const changes = trackedFields
        .filter((field) => Boolean(existing) ? existing?.[field] !== payload[field] : payload[field] === true)
        .map((field) => ({
          changed_by: user?.id ?? null,
          target_role: role,
          module_id: moduleId,
          module_key: module?.key ?? null,
          action: field.replace('can_', '') as PermissionAction,
          change_type: existing ? 'permission_updated' : 'permission_created',
          old_value: existing ? existing[field] : null,
          new_value: payload[field],
          metadata: {
            access_type: accessType,
            module_name: module?.name ?? null,
            previous_access_type: existing?.access_type ?? null,
          },
        }));

      if (changes.length > 0) {
        const { error } = await supabase.from('user_permission_changes').insert(changes);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role_module_permissions'] });
      queryClient.invalidateQueries({ queryKey: ['user_permission_changes'] });
      toast.success('Permissão atualizada!');
    },
    onError: () => toast.error('Erro ao atualizar permissão'),
  });

  const getPermission = (role: AppRole, moduleId: string): RoleModulePermission | undefined => {
    return permissions?.find(p => p.role === role && p.module_id === moduleId);
  };

  const handleToggleAccess = (role: AppRole, moduleId: string, currentAccess: boolean) => {
    const currentPerm = getPermission(role, moduleId);
    updatePermissionMutation.mutate({
      role,
      moduleId,
      canAccess: !currentAccess,
      accessType: (currentPerm?.access_type as AccessLevel) || 'restrito',
    });
  };

  const handleChangeAccessType = (role: AppRole, moduleId: string, accessType: AccessLevel) => {
    const currentPerm = getPermission(role, moduleId);
    updatePermissionMutation.mutate({
      role,
      moduleId,
      canAccess: currentPerm?.can_access ?? true,
      accessType,
    });
  };

  const handleToggleAction = (role: AppRole, moduleId: string, field: PermissionField, checked: boolean) => {
    const currentPerm = getPermission(role, moduleId);
    const next = {
      can_view: currentPerm?.can_view ?? currentPerm?.can_access ?? false,
      can_create: currentPerm?.can_create ?? false,
      can_edit: currentPerm?.can_edit ?? false,
      can_delete: currentPerm?.can_delete ?? false,
      [field]: checked,
    };

    if (field !== 'can_view' && checked) next.can_view = true;
    if (field === 'can_view' && !checked) {
      next.can_create = false;
      next.can_edit = false;
      next.can_delete = false;
    }

    updatePermissionMutation.mutate({
      role,
      moduleId,
      canAccess: next.can_view,
      accessType: next.can_create || next.can_edit || next.can_delete ? 'total' : 'restrito',
      granular: next,
    });
  };

  const isLoading = modulesLoading || permissionsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const adminConfig = getRoleDefinition('admin');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Permissões por Módulo</h2>
        <p className="text-sm text-muted-foreground">
          Configure quais módulos cada tipo de usuário pode acessar e se o acesso é total ou restrito
        </p>
      </div>

      {/* Admin info card */}
      {adminConfig && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">{adminConfig.label}</CardTitle>
                <CardDescription>{adminConfig.description}</CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>
      )}

      {/* Editable roles */}
      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        {EDITABLE_PERMISSION_ROLES.map((config) => {
          const RoleIcon = config.icon;
          const role = config.value;

          return (
            <Card key={role}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <RoleIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{config.label}</CardTitle>
                    <CardDescription>{config.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {modules?.map((module) => {
                    const perm = getPermission(role, module.id);
                    const canAccess = perm?.can_access ?? false;
                    const accessType = (perm?.access_type as AccessLevel) || 'restrito';

                    return (
                      <div
                        key={module.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-background"
                      >
                        <div className="flex items-center gap-3">
                          <Switch
                            checked={canAccess}
                            onCheckedChange={() => handleToggleAccess(role, module.id, canAccess)}
                            disabled={updatePermissionMutation.isPending}
                          />
                          <div>
                            <p className="font-medium text-sm">{module.name}</p>
                            <p className="text-xs text-muted-foreground">{module.path}</p>
                          </div>
                        </div>

                        {canAccess && (
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <Select
                              value={accessType}
                              onValueChange={(v) => handleChangeAccessType(role, module.id, v as AccessLevel)}
                              disabled={updatePermissionMutation.isPending}
                            >
                              <SelectTrigger className="h-8 w-[120px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="total"><Badge variant="default" className="h-5">Total</Badge></SelectItem>
                                <SelectItem value="restrito"><Badge variant="secondary" className="h-5">Restrito</Badge></SelectItem>
                              </SelectContent>
                            </Select>
                            <div className="flex items-center gap-1 rounded-md border bg-muted/30 p-1">
                              {actionConfig.map(({ field, label, icon: Icon, sensitive }) => {
                                const checked = field === 'can_view'
                                  ? (perm?.can_view ?? perm?.can_access ?? false)
                                  : (perm?.[field] ?? false);

                                return (
                                  <button
                                    key={field}
                                    type="button"
                                    title={label}
                                    aria-label={label}
                                    onClick={() => handleToggleAction(role, module.id, field, !checked)}
                                    disabled={updatePermissionMutation.isPending}
                                    className={`inline-flex h-7 w-7 items-center justify-center rounded border transition-colors ${checked ? 'border-primary bg-primary text-primary-foreground' : 'border-transparent bg-background text-muted-foreground hover:text-foreground'} ${sensitive && checked ? 'ring-1 ring-destructive/40' : ''}`}
                                  >
                                    <Icon className="h-3.5 w-3.5" />
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {!canAccess && (
                          <Badge variant="outline" className="text-muted-foreground">
                            Sem acesso
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="space-y-3">
            <h3 className="font-medium">Legenda de Níveis de Acesso</h3>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="flex items-start gap-2 text-sm">
                <Badge variant="default" className="mt-0.5">Total</Badge>
                <span className="text-muted-foreground">
                  Usuário pode visualizar, criar, editar e excluir dados no módulo
                </span>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <Badge variant="secondary" className="mt-0.5">Restrito</Badge>
                <span className="text-muted-foreground">
                  Usuário pode apenas visualizar dados, sem poder criar, editar ou excluir
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
