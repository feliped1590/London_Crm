import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LookupItem {
  id: string;
  value: string;
  label: string;
  sort_order: number;
  is_active: boolean;
}

type LookupTable = 'product_types' | 'product_groups' | 'product_subgroups' | 'product_families' | 'product_classes' | 'product_unit_measures';

function useLookupTable(table: LookupTable) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: [table],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data as LookupItem[];
    },
  });

  const { data: allData, isLoading: isLoadingAll } = useQuery({
    queryKey: [table, 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .order('sort_order');
      if (error) throw error;
      return data as LookupItem[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (item: { value: string; label: string; sort_order?: number }) => {
      const { error } = await supabase.from(table).insert(item);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [table] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...item }: { id: string; value?: string; label?: string; sort_order?: number; is_active?: boolean }) => {
      const { error } = await supabase.from(table).update(item).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [table] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [table] });
    },
  });

  return {
    items: data || [],
    allItems: allData || [],
    isLoading,
    isLoadingAll,
    create: createMutation,
    update: updateMutation,
    remove: deleteMutation,
  };
}

export function useProductLookups() {
  const tipos = useLookupTable('product_types');
  const grupos = useLookupTable('product_groups');
  const subgrupos = useLookupTable('product_subgroups');
  const familias = useLookupTable('product_families');
  const classes = useLookupTable('product_classes');
  const unitMeasures = useLookupTable('product_unit_measures');

  return { tipos, grupos, subgrupos, familias, classes, unitMeasures };
}
