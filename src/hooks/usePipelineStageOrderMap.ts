import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { OrderStatus } from '@/types/products';
import { toast } from 'sonner';

export interface StageOrderMapping {
  id: string;
  pipeline_stage_id: string;
  target_order_status: OrderStatus;
  auto_apply: boolean;
  applies_to_order_type: 'producao' | 'pronta_entrega' | null;
  notes: string | null;
}

/**
 * Hook to read/write pipeline_stage_order_status_map.
 * Each stage may have at most one mapping per order_type (or one global mapping with type = NULL).
 */
export function usePipelineStageOrderMap() {
  const queryClient = useQueryClient();

  const { data: mappings, isLoading } = useQuery({
    queryKey: ['pipeline_stage_order_status_map'],
    queryFn: async (): Promise<StageOrderMapping[]> => {
      const { data, error } = await supabase
        .from('pipeline_stage_order_status_map')
        .select('id, pipeline_stage_id, target_order_status, auto_apply, applies_to_order_type, notes');
      if (error) throw error;
      return (data || []) as StageOrderMapping[];
    },
  });

  const getMappingForStage = (stageId: string): StageOrderMapping | undefined => {
    return mappings?.find((m) => m.pipeline_stage_id === stageId);
  };

  const upsertMapping = useMutation({
    mutationFn: async (payload: {
      pipeline_stage_id: string;
      target_order_status: OrderStatus;
      auto_apply: boolean;
      applies_to_order_type: 'producao' | 'pronta_entrega' | null;
      existing_id?: string | null;
    }) => {
      const { existing_id, ...row } = payload;
      if (existing_id) {
        const { error } = await supabase
          .from('pipeline_stage_order_status_map')
          .update(row)
          .eq('id', existing_id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('pipeline_stage_order_status_map')
          .insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline_stage_order_status_map'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao salvar mapeamento');
    },
  });

  const deleteMapping = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('pipeline_stage_order_status_map')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline_stage_order_status_map'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao remover mapeamento');
    },
  });

  return {
    mappings: mappings || [],
    isLoading,
    getMappingForStage,
    upsertMapping,
    deleteMapping,
  };
}
