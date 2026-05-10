import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useSetOperationalOwner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { orderId: string; pipelineId: string; ownerId: string | null }) => {
      const { error } = await supabase
        .from('orders')
        .update({ operational_owner_id: input.ownerId })
        .eq('id', input.orderId);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['operational_orders', v.pipelineId] });
      toast.success('Responsável atualizado');
    },
    onError: (e: any) => toast.error(e?.message ?? 'Erro ao atualizar responsável'),
  });
}

export function useSetOperationalPriority() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { orderId: string; pipelineId: string; priority: string }) => {
      const { error } = await supabase
        .from('orders')
        .update({ operational_priority: input.priority })
        .eq('id', input.orderId);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['operational_orders', v.pipelineId] });
      toast.success('Prioridade atualizada');
    },
    onError: (e: any) => toast.error(e?.message ?? 'Erro ao atualizar prioridade'),
  });
}
