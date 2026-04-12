import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from './useAuth';
export type ChecklistItem = {
  id: string;
  stage: string;
  pipeline_id: string | null;
  title: string;
  description: string | null;
  is_required: boolean;
  sort_order: number;
  validation_type: string;
  auto_condition: unknown;
  created_at: string;
  created_by: string | null;
};

export type ChecklistCompletion = {
  id: string;
  deal_id: string;
  checklist_item_id: string;
  completed_at: string;
  completed_by: string | null;
  notes: string | null;
};

export function useStageChecklistItems(pipelineId?: string | null) {
  return useQuery({
    queryKey: ['stage_checklist_items', pipelineId],
    queryFn: async () => {
      let query = supabase
        .from('stage_checklist_items')
        .select('*')
        .order('stage')
        .order('sort_order');
      
      if (pipelineId) {
        query = query.or(`pipeline_id.eq.${pipelineId},pipeline_id.is.null`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as ChecklistItem[];
    },
  });
}

export function useDealChecklistCompletions(dealId?: string) {
  return useQuery({
    queryKey: ['deal_checklist_completions', dealId],
    queryFn: async () => {
      if (!dealId) return [];
      
      const { data, error } = await supabase
        .from('deal_checklist_completions')
        .select('*')
        .eq('deal_id', dealId);
      
      if (error) throw error;
      return data as ChecklistCompletion[];
    },
    enabled: !!dealId,
  });
}

export function useChecklistMutations() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const createItem = useMutation({
    mutationFn: async (data: {
      stage: DealStage;
      pipeline_id: string | null;
      title: string;
      description: string | null;
      is_required: boolean;
      sort_order: number;
      validation_type: string;
      auto_condition: null;
    }) => {
      const { error } = await supabase
        .from('stage_checklist_items')
        .insert({ ...data, created_by: user?.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stage_checklist_items'] });
      toast.success('Item de checklist criado!');
    },
    onError: () => toast.error('Erro ao criar item'),
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...data }: { 
      id: string;
      stage?: DealStage;
      pipeline_id?: string | null;
      title?: string;
      description?: string | null;
      is_required?: boolean;
      sort_order?: number;
      validation_type?: string;
      auto_condition?: null;
    }) => {
      const { error } = await supabase
        .from('stage_checklist_items')
        .update(data)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stage_checklist_items'] });
      toast.success('Item atualizado!');
    },
    onError: () => toast.error('Erro ao atualizar item'),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('stage_checklist_items')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stage_checklist_items'] });
      toast.success('Item removido!');
    },
    onError: () => toast.error('Erro ao remover item'),
  });

  const completeItem = useMutation({
    mutationFn: async ({ dealId, checklistItemId, notes }: { dealId: string; checklistItemId: string; notes?: string }) => {
      const { error } = await supabase
        .from('deal_checklist_completions')
        .insert({
          deal_id: dealId,
          checklist_item_id: checklistItemId,
          completed_by: user?.id,
          notes,
        });
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['deal_checklist_completions', variables.dealId] });
    },
    onError: () => toast.error('Erro ao marcar item'),
  });

  const uncompleteItem = useMutation({
    mutationFn: async ({ dealId, checklistItemId }: { dealId: string; checklistItemId: string }) => {
      const { error } = await supabase
        .from('deal_checklist_completions')
        .delete()
        .eq('deal_id', dealId)
        .eq('checklist_item_id', checklistItemId);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['deal_checklist_completions', variables.dealId] });
    },
    onError: () => toast.error('Erro ao desmarcar item'),
  });

  return { createItem, updateItem, deleteItem, completeItem, uncompleteItem };
}

/**
 * Get pending required checklist items for a deal at a specific stage.
 * This checks the CURRENT stage (from_stage) to validate if the deal can move OUT of it.
 * @param dealId - The deal ID
 * @param fromStage - The stage the deal is LEAVING (current stage)
 * @param pipelineId - Optional pipeline ID for pipeline-specific checklists
 */
export async function getPendingChecklistItems(dealId: string, fromStage: DealStage, pipelineId?: string | null): Promise<ChecklistItem[]> {
  // Get required checklist items for the stage the deal is LEAVING
  // These items must be completed before the deal can move to a new stage
  let query = supabase
    .from('stage_checklist_items')
    .select('*')
    .eq('stage', fromStage) // Check the FROM stage (current stage being exited)
    .eq('is_required', true)
    .order('sort_order');

  if (pipelineId) {
    query = query.or(`pipeline_id.eq.${pipelineId},pipeline_id.is.null`);
  } else {
    query = query.is('pipeline_id', null);
  }

  const { data: items, error: itemsError } = await query;
  if (itemsError) throw itemsError;
  if (!items || items.length === 0) return [];

  // Get completions for this deal
  const { data: completions, error: completionsError } = await supabase
    .from('deal_checklist_completions')
    .select('checklist_item_id')
    .eq('deal_id', dealId);
  
  if (completionsError) throw completionsError;

  const completedIds = new Set(completions?.map(c => c.checklist_item_id) || []);
  
  // Filter out completed items - return only pending required items
  return (items as ChecklistItem[]).filter(item => !completedIds.has(item.id));
}
