import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { KanbanColumn } from './KanbanColumn';
import type { Deal, PipelineStageRow, StageConfigEntry } from '@/hooks/usePipelineData';

const CARDS_PER_PAGE = 5;

interface StagePermissionInfo {
  stageId: string;
  stage: string;
  allowed: boolean;
}

interface KanbanBoardProps {
  stageRows: PipelineStageRow[];
  stageConfig: Record<string, StageConfigEntry>;
  filteredDeals: Deal[];
  isMobile: boolean;
  isSalesPipeline?: boolean;
  stagePermissions?: StagePermissionInfo[];
  /** Resolves a deal to its stage row id for the current pipeline */
  resolveDealStageId: (deal: Deal) => string | null;
  onDragStart: (e: React.DragEvent, dealId: string) => void;
  onDrop: (e: React.DragEvent, stage: PipelineStageRow) => void;
  onDragOver: (e: React.DragEvent) => void;
  onEdit: (deal: Deal) => void;
  onEmailDialog: (deal: Deal) => void;
  /** Reset pagination when this key changes (filters, pipeline, etc.) */
  paginationResetKey: string;
}

export function KanbanBoard({
  stageRows,
  stageConfig,
  filteredDeals,
  isMobile,
  isSalesPipeline = true,
  stagePermissions,
  resolveDealStageId,
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
    (stageId: string) => filteredDeals.filter(d => resolveDealStageId(d) === stageId),
    [filteredDeals, resolveDealStageId],
  );

  const getStageTotal = useCallback(
    (stageId: string) => getStageDeals(stageId).reduce((sum, d) => sum + (d.value || 0), 0),
    [getStageDeals],
  );

  const getStagePage = (stageId: string) => stagePages[stageId] || 1;

  const getPagedStageDeals = (stageId: string) => {
    const all = getStageDeals(stageId);
    const page = getStagePage(stageId);
    const start = (page - 1) * CARDS_PER_PAGE;
    return all.slice(start, start + CARDS_PER_PAGE);
  };

  const getStageTotalPages = (stageId: string) =>
    Math.max(1, Math.ceil(getStageDeals(stageId).length / CARDS_PER_PAGE));

  return (
    <div
      className={cn(
        "h-[calc(100vh-280px)] sm:h-[calc(100vh-300px)]",
        "flex gap-3 overflow-x-auto pb-4 -mx-2 px-2",
        isMobile && "snap-x snap-mandatory",
      )}
    >
      {stageRows.map((stageRow) => {
        const permInfo = stagePermissions?.find(p => p.stageId === stageRow.id);
        const isBlocked = permInfo ? !permInfo.allowed : false;
        const config = stageConfig[stageRow.id]
          || (stageRow.stage ? stageConfig[stageRow.stage] : null)
          || { label: stageRow.name, color: 'bg-slate-500' };
        return (
          <KanbanColumn
            key={stageRow.id}
            stageRow={stageRow}
            config={config}
            allStageDeals={getStageDeals(stageRow.id)}
            pagedDeals={getPagedStageDeals(stageRow.id)}
            stageTotal={getStageTotal(stageRow.id)}
            isMobile={isMobile}
            isBlocked={isBlocked}
            page={getStagePage(stageRow.id)}
            totalPages={getStageTotalPages(stageRow.id)}
            onPageChange={(page) => setStagePages(prev => ({ ...prev, [stageRow.id]: page }))}
            onDragStart={onDragStart}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onEdit={onEdit}
            onEmailDialog={onEmailDialog}
            isSalesPipeline={isSalesPipeline}
          />
        );
      })}
    </div>
  );
}
