import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DollarSign, Calendar, Building2, User, GripVertical, Mail, ChevronLeft, ChevronRight, ShieldAlert } from 'lucide-react';
import { DaysInStageBadge } from '@/components/pipeline/DaysInStageBadge';
import { DelegationBadge } from '@/components/pipeline/DelegationBadge';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { Deal, PipelineStageRow, StageConfigEntry } from '@/hooks/usePipelineData';

interface KanbanColumnProps {
  stageRow: PipelineStageRow;
  config: StageConfigEntry;
  allStageDeals: Deal[];
  pagedDeals: Deal[];
  stageTotal: number;
  isMobile: boolean;
  isSalesPipeline?: boolean;
  isBlocked?: boolean;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onDragStart: (e: React.DragEvent, dealId: string) => void;
  onDrop: (e: React.DragEvent, stage: PipelineStageRow) => void;
  onDragOver: (e: React.DragEvent) => void;
  onEdit: (deal: Deal) => void;
  onEmailDialog: (deal: Deal) => void;
}

export function KanbanColumn({
  stageRow,
  config,
  allStageDeals,
  pagedDeals,
  stageTotal,
  isMobile,
  isSalesPipeline = true,
  isBlocked = false,
  page,
  totalPages,
  onPageChange,
  onDragStart,
  onDrop,
  onDragOver,
  onEdit,
  onEmailDialog,
}: KanbanColumnProps) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-xl min-w-[240px] shrink-0 border border-border-subtle bg-surface-elevated/60 backdrop-blur-sm",
        isMobile && "snap-center",
        isBlocked && "opacity-60 ring-1 ring-destructive/30",
      )}
      onDrop={(e) => onDrop(e, stageRow)}
      onDragOver={(e) => {
        if (isBlocked) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'none';
        } else {
          onDragOver(e);
        }
      }}
      style={isBlocked ? { cursor: 'not-allowed' } : undefined}
    >
      <div className="relative p-3 border-b border-border-subtle rounded-t-xl">
        <div
          className="absolute inset-x-0 top-0 h-0.5 rounded-t-xl"
          style={config?.hexColor ? { backgroundColor: config.hexColor } : undefined}
        />
        <div className="flex items-center gap-2 mb-1.5">
          <div
            className={`h-2.5 w-2.5 rounded-full ring-2 ring-background ${config?.hexColor ? '' : config?.color || 'bg-slate-500'}`}
            style={config?.hexColor ? { backgroundColor: config.hexColor } : undefined}
          />
          <h3 className="font-display text-sm font-semibold tracking-tight">{config?.label || stageRow.name}</h3>
          {isBlocked && (
            <Tooltip>
              <TooltipTrigger asChild>
                <ShieldAlert className="h-3.5 w-3.5 text-destructive" />
              </TooltipTrigger>
              <TooltipContent>Sem permissão para mover para esta etapa</TooltipContent>
            </Tooltip>
          )}
        </div>
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="font-semibold tabular-nums text-foreground">{allStageDeals.length}</span>
            <span>negócios</span>
          </span>
          <span className="font-medium tabular-nums">{formatCurrency(stageTotal)}</span>
        </div>
      </div>
      <ScrollArea className="flex-1 p-2">
        <div className="space-y-2">
          {pagedDeals.map((deal) => (
            <Card
              key={deal.id}
              className="group cursor-pointer border-border-subtle bg-card hover:shadow-[var(--shadow-md)] hover:border-primary/30 hover:-translate-y-px transition-all duration-150"
              draggable
              onDragStart={(e) => onDragStart(e, deal.id)}
              onClick={() => onEdit(deal)}
            >
              <CardContent className="p-3">
                <div className="flex items-start gap-2">
                  <GripVertical className="h-4 w-4 text-muted-foreground/60 group-hover:text-muted-foreground shrink-0 mt-0.5 cursor-grab transition-colors" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <p className="font-medium text-sm truncate flex-1">{deal.name}</p>
                      <DelegationBadge ownerId={deal.owner_id} compact />
                    </div>
                    <div className="flex items-center gap-1 mt-1.5 text-primary font-semibold text-sm tabular-nums">
                      <DollarSign className="h-3.5 w-3.5" />
                      {formatCurrency(deal.value || 0)}
                    </div>
                    <div className="mt-2 space-y-1">
                      {(deal as any).companies?.name && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Building2 className="h-3 w-3 shrink-0" />
                          <span className="truncate">{(deal as any).companies.name}</span>
                        </div>
                      )}
                      {(deal as any).contacts && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <User className="h-3 w-3 shrink-0" />
                          <span className="truncate">{(deal as any).contacts.first_name} {(deal as any).contacts.last_name}</span>
                        </div>
                      )}
                      {deal.expected_close_date && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3 shrink-0" />
                          <span className="tabular-nums">{formatDate(deal.expected_close_date)}</span>
                        </div>
                      )}
                    </div>
                    <div className="mt-2.5 flex items-center gap-1 flex-wrap">
                      <DaysInStageBadge stageEnteredAt={deal.updated_at} />
                      {isSalesPipeline && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-medium tabular-nums">
                          {deal.probability}%
                        </Badge>
                      )}
                      {(deal as any).contacts?.email && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEmailDialog(deal);
                          }}
                        >
                          <Mail className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-3 py-1.5 border-t border-border-subtle rounded-b-xl">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="text-xs text-muted-foreground">
            {page}/{totalPages}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
