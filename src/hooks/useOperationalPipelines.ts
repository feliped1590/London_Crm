import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface OperationalPipeline {
  id: string;
  name: string;
  pipeline_mode: string;
  is_operational: boolean;
}

export interface OperationalStage {
  id: string;
  pipeline_id: string;
  name: string;
  sort_order: number;
  color: string | null;
}

/**
 * Lista pipelines operacionais (is_operational = true) acessíveis ao usuário,
 * já filtrados via RLS por tenant + entidades vinculadas.
 */
export function useOperationalPipelines() {
  const { user } = useAuth();

  const pipelinesQuery = useQuery({
    queryKey: ['operational_pipelines'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pipelines')
        .select('id, name, pipeline_mode, is_operational')
        .eq('is_operational', true)
        .order('name');
      if (error) throw error;
      return (data ?? []) as OperationalPipeline[];
    },
    enabled: !!user?.id,
  });

  const stagesQuery = useQuery({
    queryKey: ['operational_pipeline_stages', pipelinesQuery.data?.map(p => p.id).join(',')],
    queryFn: async () => {
      const ids = (pipelinesQuery.data ?? []).map(p => p.id);
      if (!ids.length) return [];
      const { data, error } = await supabase
        .from('pipeline_stages')
        .select('id, pipeline_id, name, position, color')
        .in('pipeline_id', ids)
        .order('position');
      if (error) throw error;
      return (data ?? []) as OperationalStage[];
    },
    enabled: !!user?.id && (pipelinesQuery.data?.length ?? 0) > 0,
  });

  return {
    pipelines: pipelinesQuery.data ?? [],
    stages: stagesQuery.data ?? [],
    isLoading: pipelinesQuery.isLoading || stagesQuery.isLoading,
  };
}
