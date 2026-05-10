import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface MoveStageInput {
  orderId: string;
  pipelineId: string;
  toStageId: string;
  reason?: string | null;
}

export function useMoveOrderOperationalStage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId, pipelineId, toStageId, reason }: MoveStageInput) => {
      const { error } = await supabase
        .from('orders')
        .update({
          operational_pipeline_id: pipelineId,
          operational_stage_id: toStageId,
        })
        .eq('id', orderId);
      if (error) throw error;

      if (reason && reason.trim().length > 0) {
        const { data: lastRow } = await supabase
          .from('order_operational_stage_history')
          .select('id')
          .eq('order_id', orderId)
          .order('moved_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (lastRow?.id) {
          await supabase
            .from('order_operational_stage_history')
            .update({ reason })
            .eq('id', lastRow.id);
        }
      }
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['operational_orders', vars.pipelineId] });
      queryClient.invalidateQueries({ queryKey: ['operational_order_history', vars.orderId] });
      toast.success('Pedido movido');
    },
    onError: (err: any) => {
      toast.error(`Erro ao mover pedido: ${err?.message ?? 'desconhecido'}`);
    },
  });
}
