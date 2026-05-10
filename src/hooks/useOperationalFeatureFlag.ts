import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/**
 * Feature flag tenant-level que controla a ativação da experiência
 * operacional Qualyvac (independente da estrutura `is_operational` no banco).
 *
 * Categoria em tenant_settings: 'operational_pipelines'
 * Setting:                       qualyvac_operational_enabled (boolean)
 */
export function useOperationalFeatureFlag() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['operational_feature_flag', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_settings')
        .select('settings')
        .eq('category', 'operational_pipelines')
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      const settings = (data?.settings ?? {}) as Record<string, unknown>;
      return Boolean(settings.qualyvac_operational_enabled);
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  return { isEnabled: data ?? false, isLoading };
}
