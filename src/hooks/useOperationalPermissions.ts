import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface PermissionRow {
  pipeline_id: string;
  department: string;
  role: string;
  access_level: 'move' | 'observe';
}

/**
 * Lê o role do usuário e as permissões setoriais para decidir
 * se ele pode mover cards em uma etapa específica.
 * admin/desenvolvedor sempre podem (defesa em profundidade — banco também valida).
 */
export function useOperationalPermissions() {
  const { user } = useAuth();

  const rolesQuery = useQuery({
    queryKey: ['user_roles_for_op', user?.id],
    queryFn: async () => {
      if (!user?.id) return [] as string[];
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      if (error) throw error;
      return (data ?? []).map((r: any) => r.role as string);
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  const permsQuery = useQuery({
    queryKey: ['operational_stage_permissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operational_stage_permissions')
        .select('pipeline_id, department, role, access_level');
      if (error) throw error;
      return (data ?? []) as PermissionRow[];
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  const roles = rolesQuery.data ?? [];
  const isAdminOrDev = roles.includes('admin') || roles.includes('desenvolvedor');

  function canMove(pipelineId: string, department: string | null): boolean {
    if (isAdminOrDev) return true;
    if (!department) return true; // etapa sem departamento = liberada
    return (permsQuery.data ?? []).some(
      p =>
        p.pipeline_id === pipelineId &&
        p.department === department &&
        p.access_level === 'move' &&
        roles.includes(p.role),
    );
  }

  return {
    roles,
    isAdminOrDev,
    canMove,
    isLoading: rolesQuery.isLoading || permsQuery.isLoading,
  };
}
