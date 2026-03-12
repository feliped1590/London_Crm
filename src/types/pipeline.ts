export type { Deal, DealStage, StageConfigEntry, PipelineStageRow } from '@/hooks/usePipelineData';

/**
 * Shape used for the intervention modal pending action.
 */
export interface PendingInterventionAction {
  type: 'CREATE_DEAL' | 'UPDATE_DEAL' | 'MOVE_STAGE';
  data: Record<string, unknown>;
}
