import { supabase } from '@/integrations/supabase/client';

export type StageStatus =
  | 'open'
  | 'won'
  | 'lost'
  | 'rejected'
  | 'cancelled'
  | 'no_profile';

export interface StageStatusOption {
  value: StageStatus;
  label: string;
  description: string;
  /** Se true, só pode existir uma etapa deste status por funil. */
  unique: boolean;
  /** Se true, representa uma etapa terminal (negócio finalizado, não-aberto). */
  terminal: boolean;
}

export const STAGE_STATUS_OPTIONS: StageStatusOption[] = [
  {
    value: 'open',
    label: 'Em andamento',
    description: 'Etapa ativa do fluxo, negócio em movimento',
    unique: false,
    terminal: false,
  },
  {
    value: 'won',
    label: 'Ganho',
    description: 'Etapa de fechamento positivo (única por funil)',
    unique: true,
    terminal: true,
  },
  {
    value: 'lost',
    label: 'Perdido',
    description: 'Etapa de fechamento negativo (única por funil)',
    unique: true,
    terminal: true,
  },
  {
    value: 'rejected',
    label: 'Reprovado',
    description: 'Negócio reprovado em alguma análise (crédito, qualidade, etc.)',
    unique: true,
    terminal: true,
  },
  {
    value: 'cancelled',
    label: 'Cancelado',
    description: 'Negócio cancelado pelo cliente ou internamente',
    unique: true,
    terminal: true,
  },
  {
    value: 'no_profile',
    label: 'Sem Perfil',
    description: 'Cliente fora do perfil ideal (ICP) — descartado',
    unique: true,
    terminal: true,
  },
];

export function getStageStatusOption(status?: string | null): StageStatusOption {
  return (
    STAGE_STATUS_OPTIONS.find((o) => o.value === status) ??
    STAGE_STATUS_OPTIONS[0]
  );
}

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

/**
 * Etapas terminais são aquelas em que o negócio é considerado finalizado:
 * Ganho, Perdido, Reprovado, Cancelado ou Sem Perfil.
 */
export function isTerminalStage(stageStatus?: string | null, legacyStage?: string | null): boolean {
  if (stageStatus) {
    return ['won', 'lost', 'rejected', 'cancelled', 'no_profile'].includes(stageStatus);
  }
  return legacyStage === 'fechado_ganho' || legacyStage === 'fechado_perdido';
}

export function isOpenStage(stageStatus?: string | null, legacyStage?: string | null): boolean {
  return !isTerminalStage(stageStatus, legacyStage);
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
