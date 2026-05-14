import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { FichaSchema } from '@/components/ficha/engine/types';

/**
 * Busca o schema ativo (is_active=true) para uma `key`.
 * Cache por React Query; invalidação manual ao publicar nova versão (fase futura).
 */
export function useFichaSchema(key: string | null | undefined) {
  return useQuery({
    queryKey: ['ficha_schema', key],
    enabled: !!key && key !== 'none',
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ficha_schemas' as any)
        .select('id, key, version, definition')
        .eq('key', key as string)
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const row = data as unknown as { id: string; key: string; version: number; definition: FichaSchema };
      return { id: row.id, version: row.version, schema: row.definition };
    },
  });
}
