import { supabase } from '@/integrations/supabase/client';

export type StageStatus = 'open' | 'won' | 'lost';

export interface PipelineStageStatusMap {
  wonStageId: string | null;
  lostStageId: string | null;
  openStageIds: string[];
}

/**
 * Verdadeira fonte: stage_status na tabela pipeline_stages.
 * Fallback legado: o código textual antigo do campo `stage`.
 */
export function isWonStage(stageStatus?: string | null, legacyStage?: string | null): boolean {
  if (stageStatus) return stageStatus === 'won';
  return legacyStage === 'fechado_ganho';
}

export function isLostStage(stageStatus?: string | null, legacyStage?: string | null): boolean {
  if (stageStatus) return stageStatus === 'lost';
  return legacyStage === 'fechado_perdido';
}

export function isOpenStage(stageStatus?: string | null, legacyStage?: string | null): boolean {
  return !isWonStage(stageStatus, legacyStage) && !isLostStage(stageStatus, legacyStage);
}

/**
 * Busca, para um pipeline específico, qual é a etapa de Ganho, Perdido e quais são as Abertas.
 * Usa a função SQL get_pipeline_stage_status para evitar múltiplos round-trips.
 */
export async function getPipelineStageStatusMap(pipelineId: string): Promise<PipelineStageStatusMap> {
  const { data, error } = await supabase.rpc('get_pipeline_stage_status' as any, {
    p_pipeline_id: pipelineId,
  });

  if (error) throw error;

  const result = data as { won_stage_id: string | null; lost_stage_id: string | null; open_stage_ids: string[] };
  return {
    wonStageId: result?.won_stage_id ?? null,
    lostStageId: result?.lost_stage_id ?? null,
    openStageIds: result?.open_stage_ids ?? [],
  };
}

/**
 * Dado o pipeline_id de um deal, descobre o `stage` (texto legado) que representa Ganho.
 * Usado para mover o deal ao aprovar uma proposta sem hardcode de 'fechado_ganho'.
 */
export async function getWonStageForPipeline(pipelineId: string | null | undefined): Promise<{
  stageId: string | null;
  stageCode: string | null;
}> {
  if (!pipelineId) {
    return { stageId: null, stageCode: 'fechado_ganho' };
  }

  const { data, error } = await supabase
    .from('pipeline_stages')
    .select('id, stage')
    .eq('pipeline_id', pipelineId)
    .eq('stage_status', 'won')
    .maybeSingle();

  if (error) {
    console.error('getWonStageForPipeline error:', error);
    return { stageId: null, stageCode: 'fechado_ganho' };
  }

  return {
    stageId: data?.id ?? null,
    // fallback para o legado se a etapa won não tiver código textual
    stageCode: data?.stage ?? 'fechado_ganho',
  };
}
