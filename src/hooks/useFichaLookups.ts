import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { LookupItem } from '@/hooks/useProductLookups';

type FichaLookupTable =
  | 'product_ficha_machines'
  | 'product_ficha_cylinders'
  | 'product_ficha_accessories';

function useFichaTable(table: FichaLookupTable) {
  const queryClient = useQueryClient();

  const { data: items, isLoading } = useQuery({
    queryKey: [table],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(table as any)
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return (data as unknown) as LookupItem[];
    },
  });

  const { data: allItems, isLoading: isLoadingAll } = useQuery({
    queryKey: [table, 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(table as any)
        .select('*')
        .order('sort_order');
      if (error) throw error;
      return (data as unknown) as LookupItem[];
    },
  });

  const create = useMutation({
    mutationFn: async (item: { value: string; label: string; sort_order?: number }) => {
      const { error } = await supabase.from(table as any).insert(item as any);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [table] }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...item }: { id: string; value?: string; label?: string; sort_order?: number; is_active?: boolean }) => {
      const { error } = await supabase.from(table as any).update(item as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [table] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [table] }),
  });

  return {
    items: items || [],
    allItems: allItems || [],
    isLoading,
    isLoadingAll,
    create,
    update,
    remove,
  };
}

export function useFichaLookups() {
  const machines = useFichaTable('product_ficha_machines');
  const cylinders = useFichaTable('product_ficha_cylinders');
  const accessories = useFichaTable('product_ficha_accessories');
  return { machines, cylinders, accessories };
}
