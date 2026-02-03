import { Calendar } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface TaskCalendarSourceBadgeProps {
  source: 'crm' | 'google' | string;
  lastSyncedAt?: string | null;
}

export function TaskCalendarSourceBadge({ source, lastSyncedAt }: TaskCalendarSourceBadgeProps) {
  if (source !== 'google') {
    return null;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-600">
            <Calendar className="h-3 w-3" />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">Evento sincronizado do Google Calendar</p>
          {lastSyncedAt && (
            <p className="text-xs text-muted-foreground">
              Última sincronização: {new Date(lastSyncedAt).toLocaleString('pt-BR')}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
