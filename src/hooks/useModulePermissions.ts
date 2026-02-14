import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type AccessType = 'total' | 'restrito' | 'none';

export interface ModulePermission {
  module_key: string;
  module_name: string;
  module_path: string;
  module_icon: string;
  access_type: AccessType;
}

export function useModulePermissions() {
  const { user } = useAuth();

  const { data: permissions, isLoading, error } = useQuery({
    queryKey: ['user_modules', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase.rpc('get_user_modules', {
        _user_id: user.id
      });
      
      if (error) throw error;
      return (data as ModulePermission[]) || [];
    },
    enabled: !!user?.id,
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

  const isAdmin = hasRoleAdmin || hasRoleDeveloper || false;

  const canAccess = (moduleKey: string): boolean => {
    if (isAdmin) return true;
    const permission = permissions?.find(p => p.module_key === moduleKey);
    return permission?.access_type !== 'none' && !!permission;
  };

  const getAccessType = (moduleKey: string): AccessType => {
    if (isAdmin) return 'total';
    const permission = permissions?.find(p => p.module_key === moduleKey);
    return (permission?.access_type as AccessType) || 'none';
  };

  const hasFullAccess = (moduleKey: string): boolean => {
    if (isAdmin) return true;
    return getAccessType(moduleKey) === 'total';
  };

  const hasRestrictedAccess = (moduleKey: string): boolean => {
    return getAccessType(moduleKey) === 'restrito';
  };

  return {
    permissions: permissions || [],
    isLoading,
    error,
    isAdmin,
    canAccess,
    getAccessType,
    hasFullAccess,
    hasRestrictedAccess,
  };
}
