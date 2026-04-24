import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { PermissionAction, permissionEngine, type AccessType } from '@/lib/permissions/permissionEngine';

export type { AccessType } from '@/lib/permissions/permissionEngine';

export interface ModulePermission {
  module_key: string;
  module_name: string;
  module_path: string;
  module_icon: string;
  access_type: AccessType;
  can_view?: boolean;
  can_create?: boolean;
  can_edit?: boolean;
  can_delete?: boolean;
}

export function useModulePermissions() {
  const { user } = useAuth();

  const { data: permissions, isLoading, error } = useQuery({
    queryKey: ['user_modules', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase.rpc('get_user_module_permissions', {
        _user_id: user.id
      });
      
      if (error) throw error;
      return (data as ModulePermission[]) || [];
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const { data: hasRoleAdmin } = useQuery({
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

  const { data: hasRoleDeveloper } = useQuery({
    queryKey: ['is_developer', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data, error } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: 'desenvolvedor'
      });
      if (error) throw error;
      return data as boolean;
    },
    enabled: !!user?.id,
  });

  const { data: hasRoleVendedor } = useQuery({
    queryKey: ['is_vendedor', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data, error } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: 'vendedor'
      });
      if (error) throw error;
      return data as boolean;
    },
    enabled: !!user?.id,
  });

  const isAdmin = hasRoleAdmin || hasRoleDeveloper || false;
  const permissionMap = permissionEngine.toMap(permissions || []);

  const can = (moduleKey: string, action: PermissionAction): boolean => {
    return permissionEngine.can(permissionMap, moduleKey, action, { isPrivileged: isAdmin });
  };

  const canAccess = (moduleKey: string): boolean => {
    return can(moduleKey, PermissionAction.View);
  };

  const getAccessType = (moduleKey: string): AccessType => {
    return permissionEngine.getAccessType(permissionMap, moduleKey, { isPrivileged: isAdmin });
  };

  const hasFullAccess = (moduleKey: string): boolean => {
    if (isAdmin) return true;
    return getAccessType(moduleKey) === 'total';
  };

  const hasRestrictedAccess = (moduleKey: string): boolean => {
    return getAccessType(moduleKey) === 'restrito';
  };

  // isFullyLoaded: true only when all 3 queries (modules + admin + developer) have completed
  const isFullyLoaded = !isLoading 
    && hasRoleAdmin !== undefined 
    && hasRoleDeveloper !== undefined
    && hasRoleVendedor !== undefined;

  return {
    permissions: permissions || [],
    isLoading,
    isFullyLoaded,
    error,
    isAdmin,
    isDeveloper: hasRoleDeveloper || false,
    isVendedor: hasRoleVendedor || false,
    can,
    canAccess,
    getAccessType,
    hasFullAccess,
    hasRestrictedAccess,
  };
}
