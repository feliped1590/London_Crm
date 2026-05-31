import { useQuery } from '@tanstack/react-query';
import { getPipelineStageStatusMap, PipelineStageStatusMap } from '@/lib/stageStatus';

/**
 * Hook cacheado para resolver, dado um pipeline, qual etapa é Ganho/Perdido/Aberto.
 * Pode ser usado em dashboards, regras de negócio e automações.
 */
export function usePipelineStageStatus(pipelineId: string | null | undefined) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['pipeline-stage-status', pipelineId],
    queryFn: () => getPipelineStageStatusMap(pipelineId!),
    enabled: !!pipelineId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const map: PipelineStageStatusMap = data ?? {
    wonStageIds: [],
    lostStageIds: [],
    openStageIds: [],
    wonStageId: null,
    lostStageId: null,
  };

  return {
    ...map,
    isLoading,
    error,
  };
}
