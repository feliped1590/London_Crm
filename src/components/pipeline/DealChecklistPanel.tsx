import { useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckSquare, Circle, CheckCircle2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  useStageChecklistItems,
  useDealChecklistCompletions,
  useChecklistMutations,
  type ChecklistItem,
} from '@/hooks/useStageChecklists';
import type { PipelineStageRow } from '@/hooks/usePipelineData';

function itemMatchesStage(item: ChecklistItem, stage: PipelineStageRow) {
  const keys = [stage.id, stage.stage, stage.name].filter(Boolean) as string[];
  return keys.includes(item.stage);
}

export function DealChecklistPanel({
  dealId,
  pipelineId,
  currentStage,
  currentStageId,
  stageRows,
  canEdit,
}: {
  dealId: string;
  pipelineId?: string | null;
  currentStage?: string | null;
  currentStageId?: string | null;
  stageRows: PipelineStageRow[];
  canEdit: boolean;
}) {
  const { data: items = [], isLoading } = useStageChecklistItems(pipelineId);
  const { data: completions = [] } = useDealChecklistCompletions(dealId);
  const { completeItem, uncompleteItem } = useChecklistMutations();

  const completedByItemId = useMemo(
    () => new Map(completions.map((c) => [c.checklist_item_id, c])),
    [completions],
  );

  const currentKeys = [currentStageId, currentStage].filter(Boolean) as string[];
  const currentRow = stageRows.find(
    (row) => currentKeys.includes(row.id) || (row.stage && currentKeys.includes(row.stage)),
  );

  const grouped = useMemo(
    () =>
      stageRows.map((stage) => ({
        stage,
        items: items.filter((item) => itemMatchesStage(item, stage)),
        isCurrent: currentRow?.id === stage.id,
      })),
    [items, stageRows, currentRow?.id],
  );

  const relevant = grouped.filter((group) => group.items.length > 0);
  const totalItems = relevant.reduce((sum, group) => sum + group.items.length, 0);
  const completedCount = items.filter((item) => completedByItemId.has(item.id)).length;
  const progress = totalItems > 0 ? (completedCount / totalItems) * 100 : 0;

  const toggleItem = (item: ChecklistItem) => {
    if (!canEdit) return;
    if (completedByItemId.has(item.id)) {
      uncompleteItem.mutate({ dealId, checklistItemId: item.id });
    } else {
      completeItem.mutate({ dealId, checklistItemId: item.id });
    }
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground py-6 text-center">Carregando checklist...</p>;
  }

  if (relevant.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        Nenhuma checklist configurada para as etapas deste funil.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Progresso do checklist</span>
          <span className="font-medium tabular-nums">{completedCount}/{totalItems}</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {relevant.map(({ stage, items: stageItems, isCurrent }) => {
        const done = stageItems.filter((item) => completedByItemId.has(item.id)).length;
        return (
          <Card key={stage.id} className={cn('p-3 space-y-2', isCurrent && 'ring-1 ring-primary/40')}>
            <div className="flex items-center gap-2">
              <div
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: stage.color || '#64748b' }}
              />
              <p className="text-sm font-medium">{stage.name}</p>
              {isCurrent && <Badge variant="secondary">Etapa atual</Badge>}
              <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                {done}/{stageItems.length}
              </span>
            </div>
            <div className="space-y-1.5">
              {stageItems.map((item) => {
                const completion = completedByItemId.get(item.id);
                const checked = Boolean(completion);
                return (
                  <label
                    key={item.id}
                    className={cn(
                      'flex items-start gap-2 rounded-md border p-2',
                      canEdit && 'cursor-pointer hover:bg-muted/40',
                      checked && 'bg-primary/5 border-primary/20',
                    )}
                  >
                    {canEdit ? (
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleItem(item)}
                        className="mt-0.5"
                      />
                    ) : checked ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary shrink-0" />
                    ) : (
                      <Circle className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className={cn('text-sm', checked && 'line-through text-muted-foreground')}>
                        {item.title}
                        {item.is_required && <span className="ml-1 text-destructive">*</span>}
                      </p>
                      {item.description && (
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      )}
                      {completion?.completed_at && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Concluído em {format(new Date(completion.completed_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </p>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

export function DealChecklistSummary({
  dealId,
  pipelineId,
  currentStage,
  currentStageId,
  stageRows,
  canEdit,
}: {
  dealId: string;
  pipelineId?: string | null;
  currentStage?: string | null;
  currentStageId?: string | null;
  stageRows: PipelineStageRow[];
  canEdit: boolean;
}) {
  const { data: items = [] } = useStageChecklistItems(pipelineId);
  const { data: completions = [] } = useDealChecklistCompletions(dealId);
  const { completeItem, uncompleteItem } = useChecklistMutations();
  const completedByItemId = useMemo(
    () => new Map(completions.map((c) => [c.checklist_item_id, c])),
    [completions],
  );
  const currentKeys = [currentStageId, currentStage].filter(Boolean) as string[];
  const currentRow = stageRows.find(
    (row) => currentKeys.includes(row.id) || (row.stage && currentKeys.includes(row.stage)),
  );
  const currentItems = currentRow
    ? items.filter((item) => itemMatchesStage(item, currentRow))
    : [];
  const done = currentItems.filter((item) => completedByItemId.has(item.id)).length;

  if (currentItems.length === 0) return null;

  const toggleItem = (item: ChecklistItem) => {
    if (!canEdit) return;
    if (completedByItemId.has(item.id)) {
      uncompleteItem.mutate({ dealId, checklistItemId: item.id });
    } else {
      completeItem.mutate({ dealId, checklistItemId: item.id });
    }
  };

  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <CheckSquare className="h-4 w-4 text-primary" />
        Checklist da etapa {currentRow?.name}
        <Badge variant="outline" className="ml-auto tabular-nums">{done}/{currentItems.length}</Badge>
      </div>
      <Progress value={(done / currentItems.length) * 100} className="h-1.5" />
      <div className="space-y-1.5 pt-1">
        {currentItems.map((item) => {
          const completion = completedByItemId.get(item.id);
          const checked = Boolean(completion);
          return (
            <div
              key={item.id}
              className={cn(
                'flex items-start gap-2 rounded-md border p-2',
                canEdit && 'cursor-pointer hover:bg-muted/40',
                checked && 'bg-primary/5 border-primary/20',
              )}
              onClick={(e) => {
                e.preventDefault();
                toggleItem(item);
              }}
            >
              <Checkbox
                checked={checked}
                disabled={!canEdit || completeItem.isPending || uncompleteItem.isPending}
                onCheckedChange={() => toggleItem(item)}
                onClick={(e) => e.stopPropagation()}
                className="mt-0.5"
              />
              <div className="min-w-0 flex-1">
                <p className={cn('text-sm', checked && 'line-through text-muted-foreground')}>
                  {item.title}
                  {item.is_required && <span className="ml-1 text-destructive">*</span>}
                </p>
                {item.description && (
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
