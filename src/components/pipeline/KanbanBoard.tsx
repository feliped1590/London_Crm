import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { KanbanColumn } from './KanbanColumn';
import type { Deal, DealStage, StageConfigEntry } from '@/hooks/usePipelineData';

const CARDS_PER_PAGE = 5;

interface KanbanBoardProps {
  stages: DealStage[];
  stageConfig: Record<string, StageConfigEntry>;
  filteredDeals: Deal[];
  isMobile: boolean;
  onDragStart: (e: React.DragEvent, dealId: string) => void;
  onDrop: (e: React.DragEvent, stage: DealStage) => void;
  onDragOver: (e: React.DragEvent) => void;
  onEdit: (deal: Deal) => void;
  onEmailDialog: (deal: Deal) => void;
  /** Reset pagination when this key changes (filters, pipeline, etc.) */
  paginationResetKey: string;
}

export function KanbanBoard({
  stages,
  stageConfig,
  filteredDeals,
  isMobile,
  onDragStart,
  onDrop,
  onDragOver,
  onEdit,
  onEmailDialog,
  paginationResetKey,
}: KanbanBoardProps) {
  const [stagePages, setStagePages] = useState<Record<string, number>>({});

  // Reset pagination when filters change
  useEffect(() => {
    setStagePages({});
  }, [paginationResetKey]);

  const getStageDeals = useCallback(
    (stage: DealStage) => filteredDeals.filter(d => d.stage === stage),
    [filteredDeals],
  );

  const getStageTotal = useCallback(
    (stage: DealStage) => getStageDeals(stage).reduce((sum, d) => sum + (d.value || 0), 0),
    [getStageDeals],
  );

  const getStagePage = (stage: DealStage) => stagePages[stage] || 1;

  const getPagedStageDeals = (stage: DealStage) => {
    const all = getStageDeals(stage);
    const page = getStagePage(stage);
    const start = (page - 1) * CARDS_PER_PAGE;
    return all.slice(start, start + CARDS_PER_PAGE);
  };

  const getStageTotalPages = (stage: DealStage) =>
    Math.max(1, Math.ceil(getStageDeals(stage).length / CARDS_PER_PAGE));

  return (
    <div
      className={cn(
        "h-[calc(100vh-280px)] sm:h-[calc(100vh-300px)]",
        "flex gap-3 overflow-x-auto pb-4 -mx-2 px-2",
        isMobile && "snap-x snap-mandatory",
        "xl:grid xl:gap-4 xl:overflow-x-visible xl:pb-0 xl:mx-0 xl:px-0",
        stages.length === 1 && "xl:grid-cols-1",
        stages.length === 2 && "xl:grid-cols-2",
        stages.length === 3 && "xl:grid-cols-3",
        stages.length === 4 && "xl:grid-cols-4",
        stages.length === 5 && "xl:grid-cols-5",
        stages.length >= 6 && "xl:grid-cols-6"
      )}
    >
      {stages.map((stage) => (
        <KanbanColumn
          key={stage}
          stage={stage}
          config={stageConfig[stage] || { label: stage, color: 'bg-slate-500' }}
          allStageDeals={getStageDeals(stage)}
          pagedDeals={getPagedStageDeals(stage)}
          stageTotal={getStageTotal(stage)}
          isMobile={isMobile}
          page={getStagePage(stage)}
          totalPages={getStageTotalPages(stage)}
          onPageChange={(page) => setStagePages(prev => ({ ...prev, [stage]: page }))}
          onDragStart={onDragStart}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onEdit={onEdit}
          onEmailDialog={onEmailDialog}
        />
      ))}
    </div>
  );
}
