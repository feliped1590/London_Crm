import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface TenantUser {
  id: string;
  full_name: string | null;
  email: string | null;
}

/** Lista usuários do tenant (via profiles) para seleção de responsável operacional. */
export function useTenantUsers() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['tenant_users_for_op'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .order('full_name', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as TenantUser[];
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });
}
