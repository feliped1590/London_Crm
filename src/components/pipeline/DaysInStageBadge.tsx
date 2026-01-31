import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Clock } from 'lucide-react';
import { differenceInDays, differenceInHours, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

interface DaysInStageBadgeProps {
  /** The date when the deal entered the current stage (from deal_stage_history or updated_at) */
  stageEnteredAt: string;
  /** Optional SLA warning threshold in days (shows yellow) */
  slaWarningDays?: number;
  /** Optional SLA critical threshold in days (shows red) */
  slaCriticalDays?: number;
  /** Size variant */
  size?: 'sm' | 'md';
  /** Show clock icon */
  showIcon?: boolean;
}

export function DaysInStageBadge({
  stageEnteredAt,
  slaWarningDays = 3,
  slaCriticalDays = 7,
  size = 'sm',
  showIcon = true,
}: DaysInStageBadgeProps) {
  const now = new Date();
  const enteredDate = parseISO(stageEnteredAt);
  const days = differenceInDays(now, enteredDate);
  const hours = differenceInHours(now, enteredDate);

  // Determine display text
  let displayText: string;
  if (days === 0) {
    if (hours <= 1) {
      displayText = 'Agora';
    } else {
      displayText = `${hours}h`;
    }
  } else if (days === 1) {
    displayText = '1 dia';
  } else {
    displayText = `${days} dias`;
  }

  // Determine color based on SLA thresholds
  let colorClass: string;
  let tooltipText: string;
  
  if (days >= slaCriticalDays) {
    colorClass = 'bg-destructive/15 text-destructive border-destructive/30 hover:bg-destructive/20';
    tooltipText = `⚠️ Atenção: ${days} dias nesta etapa (SLA excedido)`;
  } else if (days >= slaWarningDays) {
    colorClass = 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/20';
    tooltipText = `${days} dias nesta etapa (atenção ao SLA)`;
  } else {
    colorClass = 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20';
    tooltipText = `${days === 0 ? 'Menos de 1 dia' : `${days} dia(s)`} nesta etapa`;
  }

  const sizeClass = size === 'sm' ? 'text-[10px] px-1.5 py-0' : 'text-xs px-2 py-0.5';
  const iconSize = size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3';

  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn(
              'gap-0.5 font-medium transition-colors cursor-default',
              colorClass,
              sizeClass
            )}
          >
            {showIcon && <Clock className={iconSize} />}
            {displayText}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {tooltipText}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
