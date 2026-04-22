import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';

import type { AccessSchedule } from '@/hooks/useAccessWindowConfig';
import { WEEKDAYS } from '@/hooks/useAccessWindowConfig';

interface Props {
  weekday: number;
  intervals: AccessSchedule[];
  disabled: boolean;
  onAdd: (start: string, end: string) => void;
  onToggle: (id: string, isActive: boolean) => void;
  onDelete: (id: string) => void;
}

export function AccessWindowDayRow({
  weekday,
  intervals,
  disabled,
  onAdd,
  onToggle,
  onDelete,
}: Props) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [start, setStart] = useState('08:00');
  const [end, setEnd] = useState('18:00');

  const handleAdd = () => {
    onAdd(start, end);
    setPopoverOpen(false);
  };

  const sorted = [...intervals].sort((a, b) => a.start_time.localeCompare(b.start_time));

  return (
    <div className="flex items-center gap-3 py-2 border-b last:border-b-0">
      <div className="w-24 shrink-0 text-sm font-medium">{WEEKDAYS[weekday]}</div>

      <div className="flex-1 flex flex-wrap items-center gap-2">
        {sorted.length === 0 && (
          <span className="text-xs text-muted-foreground italic">— bloqueado —</span>
        )}
        {sorted.map((iv) => (
          <Badge
            key={iv.id}
            variant={iv.is_active ? 'default' : 'outline'}
            className="gap-2 pr-1 py-1"
          >
            <span className="font-mono text-xs">
              {iv.start_time.slice(0, 5)}–{iv.end_time.slice(0, 5)}
            </span>
            <Switch
              checked={iv.is_active}
              onCheckedChange={(v) => onToggle(iv.id, v)}
              disabled={disabled}
              className="scale-75"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-5 w-5 hover:text-destructive"
              disabled={disabled}
              onClick={() => onDelete(iv.id)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </Badge>
        ))}
      </div>

      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-1 shrink-0"
            disabled={disabled}
          >
            <Plus className="h-3.5 w-3.5" />
            Intervalo
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72">
          <div className="space-y-3">
            <div className="text-sm font-medium">Adicionar intervalo</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Início</Label>
                <Input
                  type="time"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">Fim</Label>
                <Input
                  type="time"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </div>
            </div>
            <Button className="w-full" onClick={handleAdd} disabled={start >= end}>
              Adicionar
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
