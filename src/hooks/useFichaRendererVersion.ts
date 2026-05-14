import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Lê a feature flag por tenant que decide o renderer da Ficha Técnica.
 * Default = 'v1' (renderer legacy hardcoded).
 */
export function useFichaRendererVersion() {
  return useQuery({
    queryKey: ['ficha_renderer_version'],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<'v1' | 'v2'> => {
      const { data, error } = await supabase
        .from('tenant_settings')
        .select('ficha_renderer_version')
        .limit(1)
        .maybeSingle();
      if (error) return 'v1';
      const v = (data as any)?.ficha_renderer_version;
      return v === 'v2' ? 'v2' : 'v1';
    },
  });
}
