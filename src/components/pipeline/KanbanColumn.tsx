import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { DollarSign, Calendar, Building2, User, GripVertical, Mail, ChevronLeft, ChevronRight } from 'lucide-react';
import { DaysInStageBadge } from '@/components/pipeline/DaysInStageBadge';
import { DelegationBadge } from '@/components/pipeline/DelegationBadge';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { Deal, DealStage, StageConfigEntry } from '@/hooks/usePipelineData';

interface KanbanColumnProps {
  stage: DealStage;
  config: StageConfigEntry;
  allStageDeals: Deal[];
  pagedDeals: Deal[];
  stageTotal: number;
  isMobile: boolean;
  isSalesPipeline?: boolean;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onDragStart: (e: React.DragEvent, dealId: string) => void;
  onDrop: (e: React.DragEvent, stage: DealStage) => void;
  onDragOver: (e: React.DragEvent) => void;
  onEdit: (deal: Deal) => void;
  onEmailDialog: (deal: Deal) => void;
}

export function KanbanColumn({
  stage,
  config,
  allStageDeals,
  pagedDeals,
  stageTotal,
  isMobile,
  isSalesPipeline = true,
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
        "flex flex-col bg-muted/30 rounded-lg min-w-[220px] shrink-0",
        isMobile && "snap-center",
      )}
      onDrop={(e) => onDrop(e, stage)}
      onDragOver={onDragOver}
    >
      <div className="p-3 border-b bg-muted/50 rounded-t-lg">
        <div className="flex items-center gap-2 mb-1">
          <div
            className={`h-3 w-3 rounded-full ${config?.hexColor ? '' : config?.color || 'bg-slate-500'}`}
            style={config?.hexColor ? { backgroundColor: config.hexColor } : undefined}
          />
          <h3 className="font-semibold text-sm">{config?.label || stage}</h3>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{allStageDeals.length} negócios</span>
          <span>{formatCurrency(stageTotal)}</span>
        </div>
      </div>
      <ScrollArea className="flex-1 p-2">
        <div className="space-y-2">
          {pagedDeals.map((deal) => (
            <Card
              key={deal.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              draggable
              onDragStart={(e) => onDragStart(e, deal.id)}
              onClick={() => onEdit(deal)}
            >
              <CardContent className="p-3">
                <div className="flex items-start gap-2">
                  <GripVertical className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5 cursor-grab" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <p className="font-medium text-sm truncate flex-1">{deal.name}</p>
                      <DelegationBadge ownerId={deal.owner_id} compact />
                    </div>
                    <div className="flex items-center gap-1 mt-1 text-primary font-semibold text-sm">
                      <DollarSign className="h-3 w-3" />
                      {formatCurrency(deal.value || 0)}
                    </div>
                    <div className="mt-2 space-y-1">
                      {(deal as any).companies?.name && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Building2 className="h-3 w-3" />
                          <span className="truncate">{(deal as any).companies.name}</span>
                        </div>
                      )}
                      {(deal as any).contacts && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <User className="h-3 w-3" />
                          <span className="truncate">{(deal as any).contacts.first_name} {(deal as any).contacts.last_name}</span>
                        </div>
                      )}
                      {deal.expected_close_date && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>{formatDate(deal.expected_close_date)}</span>
                        </div>
                      )}
                    </div>
                    <div className="mt-2 flex items-center gap-1 flex-wrap">
                      <DaysInStageBadge stageEnteredAt={deal.updated_at} />
                      {isSalesPipeline && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {deal.probability}% prob.
                        </Badge>
                      )}
                      {(deal as any).contacts?.email && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
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
        <div className="flex items-center justify-between px-3 py-2 border-t bg-muted/30 rounded-b-lg">
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
