import { BIFilters } from '@/hooks/useBIAdvanced';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, RefreshCw } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';

interface BIFiltersBarProps {
  filters: BIFilters;
  onFiltersChange: (filters: BIFilters) => void;
}

export function BIFiltersBar({ filters, onFiltersChange }: BIFiltersBarProps) {
  const dateRange: DateRange = {
    from: filters.startDate,
    to: filters.endDate,
  };

  const handleDateRangeChange = (range: DateRange | undefined) => {
    if (range?.from) {
      onFiltersChange({
        ...filters,
        startDate: range.from,
        endDate: range.to || range.from,
      });
    }
  };

  const presets = [
    { label: '7 dias', days: 7 },
    { label: '30 dias', days: 30 },
    { label: '90 dias', days: 90 },
  ];

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Período:</span>
        {presets.map((preset) => (
          <Button
            key={preset.days}
            variant={
              Math.round((filters.endDate.getTime() - filters.startDate.getTime()) / (1000 * 60 * 60 * 24)) === preset.days
                ? 'secondary'
                : 'ghost'
            }
            size="sm"
            onClick={() =>
              onFiltersChange({
                ...filters,
                startDate: subDays(new Date(), preset.days),
                endDate: new Date(),
              })
            }
          >
            {preset.label}
          </Button>
        ))}
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'justify-start text-left font-normal',
              !dateRange && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {dateRange?.from ? (
              dateRange.to ? (
                <>
                  {format(dateRange.from, 'dd/MM/yy', { locale: ptBR })} -{' '}
                  {format(dateRange.to, 'dd/MM/yy', { locale: ptBR })}
                </>
              ) : (
                format(dateRange.from, 'dd/MM/yy', { locale: ptBR })
              )
            ) : (
              <span>Selecionar período</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={dateRange?.from}
            selected={dateRange}
            onSelect={handleDateRangeChange}
            numberOfMonths={2}
            locale={ptBR}
          />
        </PopoverContent>
      </Popover>

      <Button
        variant="ghost"
        size="sm"
        onClick={() =>
          onFiltersChange({
            startDate: subDays(new Date(), 30),
            endDate: new Date(),
          })
        }
      >
        <RefreshCw className="h-4 w-4" />
      </Button>
    </div>
  );
}
