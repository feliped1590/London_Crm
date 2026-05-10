import { Badge } from '@/components/ui/badge';
import { computeSlaLevel, formatDuration, hoursSince } from '@/lib/operationalConstants';
import { Clock, AlertTriangle, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  enteredAt: string | null;
  warningHours: number | null;
  criticalHours: number | null;
}

export function OperationalSlaBadge({ enteredAt, warningHours, criticalHours }: Props) {
  if (!enteredAt) return null;
  const lvl = computeSlaLevel(enteredAt, warningHours, criticalHours);
  const hrs = hoursSince(enteredAt) ?? 0;
  const seconds = Math.floor(hrs * 3600);
  const Icon = lvl === 'critical' ? Flame : lvl === 'warning' ? AlertTriangle : Clock;
  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1 text-[10px] font-normal',
        lvl === 'critical' && 'border-red-400 text-red-700 bg-red-50 dark:bg-red-950/30 dark:text-red-300',
        lvl === 'warning' && 'border-amber-400 text-amber-800 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-300',
        lvl === 'ok' && 'border-muted text-muted-foreground',
      )}
    >
      <Icon className="h-3 w-3" />
      {formatDuration(seconds)}
    </Badge>
  );
}
