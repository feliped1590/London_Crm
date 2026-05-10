import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface OperationalOrder {
  id: string;
  number: string;
  total_value: number | null;
  delivery_date: string | null;
  order_date: string | null;
  observations: string | null;
  status: string;
  erp_synced_at: string | null;
  operational_pipeline_id: string | null;
  operational_stage_id: string | null;
  legal_entity_id: string;
  company_id: string | null;
  company_name?: string | null;
}

/**
 * Fetch order-centric kanban data for an operational pipeline.
 * Independent from deal-centric usePipelineData.
 */
export function useOperationalKanbanData(pipelineId: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const ordersQuery = useQuery({
    queryKey: ['operational_orders', pipelineId],
    queryFn: async () => {
      if (!pipelineId) return [];
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id, number, total_value, delivery_date, order_date, observations,
          status, erp_synced_at, operational_pipeline_id, operational_stage_id,
          legal_entity_id, company_id,
          companies:company_id ( name )
        `)
        .eq('operational_pipeline_id', pipelineId)
        .order('order_date', { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []).map((o: any) => ({
        ...o,
        company_name: o.companies?.name ?? null,
      })) as OperationalOrder[];
    },
    enabled: !!user?.id && !!pipelineId,
  });

  // Realtime: canal isolado para esse pipeline operacional
  useEffect(() => {
    if (!pipelineId) return;
    const channel = supabase
      .channel(`operational_orders_${pipelineId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `operational_pipeline_id=eq.${pipelineId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['operational_orders', pipelineId] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [pipelineId, queryClient]);

  return {
    orders: ordersQuery.data ?? [],
    isLoading: ordersQuery.isLoading,
    refetch: ordersQuery.refetch,
  };
}
