import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  OPERATIONAL_PRIORITIES,
  PRIORITY_COLOR,
  PRIORITY_LABEL,
  type OperationalPriority,
} from '@/lib/operationalConstants';
import { cn } from '@/lib/utils';
import { useSetOperationalPriority } from '@/hooks/useOperationalOrderActions';

interface Props {
  orderId: string;
  pipelineId: string;
  value: string;
  disabled?: boolean;
}

export function OperationalPriorityMenu({ orderId, pipelineId, value, disabled }: Props) {
  const mutation = useSetOperationalPriority();
  const current = (value ?? 'media') as OperationalPriority;

  return (
    <Popover>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="focus:outline-none"
          aria-label="Alterar prioridade"
        >
          <Badge className={cn('text-[10px] cursor-pointer', PRIORITY_COLOR[current])}>
            {PRIORITY_LABEL[current]}
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-44 p-1" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-col gap-0.5">
          {OPERATIONAL_PRIORITIES.map((p) => (
            <Button
              key={p}
              variant="ghost"
              size="sm"
              className="justify-start h-8"
              onClick={() => mutation.mutate({ orderId, pipelineId, priority: p })}
              disabled={mutation.isPending || disabled}
            >
              <Badge className={cn('text-[10px] mr-2', PRIORITY_COLOR[p])}>{PRIORITY_LABEL[p]}</Badge>
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
