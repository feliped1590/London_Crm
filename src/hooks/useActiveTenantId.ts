import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/**
 * Resolve o tenant ativo do usuário logado.
 * Usa o mesmo padrão de `get_user_tenant_ids` (profile.active_tenant_id, fallback user_tenants).
 */
export function useActiveTenantId() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['active_tenant_id', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data: profile } = await supabase
        .from('profiles')
        .select('active_tenant_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (profile?.active_tenant_id) return profile.active_tenant_id as string;
      const { data: ut } = await supabase
        .from('user_tenants')
        .select('tenant_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();
      return (ut?.tenant_id as string) || null;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });
}
