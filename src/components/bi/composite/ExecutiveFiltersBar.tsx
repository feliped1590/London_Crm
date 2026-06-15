import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { CalendarIcon, RefreshCw } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { useLegalEntities } from '@/hooks/useLegalEntities';
import { useSalesReps } from '@/hooks/useSalesReps';
import { useModulePermissions } from '@/hooks/useModulePermissions';

export interface ExecutiveFilters {
  startDate: Date;
  endDate: Date;
  legalEntityId?: string | null;
  sellerId?: string | null;
}

interface Props {
  filters: ExecutiveFilters;
  onChange: (f: ExecutiveFilters) => void;
  showSellerSelector?: boolean;
  requireSeller?: boolean;
}

const presets = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: '12m', days: 365 },
];

export function ExecutiveFiltersBar({ filters, onChange, showSellerSelector, requireSeller }: Props) {
  const { accessibleEntities, activeLegalEntityId } = useLegalEntities();
  const { salesReps, mySalesReps } = useSalesReps();
  const { isAdmin } = useModulePermissions();

  const range: DateRange = { from: filters.startDate, to: filters.endDate };

  // Vendedor comum: trava no próprio rep
  const lockedSellerId = !isAdmin
    ? mySalesReps?.find((m) => m.is_default)?.sales_rep_id ?? mySalesReps?.[0]?.sales_rep_id ?? null
    : null;

  const sellerOptions = isAdmin
    ? salesReps ?? []
    : (mySalesReps ?? []).map((m) => m.sales_rep!).filter(Boolean);

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">Período</Label>
        <div className="flex items-center gap-1">
          {presets.map((p) => {
            const days = Math.round(
              (filters.endDate.getTime() - filters.startDate.getTime()) / 86400000
            );
            const active = days === p.days;
            return (
              <Button
                key={p.days}
                variant={active ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() =>
                  onChange({ ...filters, startDate: subDays(new Date(), p.days), endDate: new Date() })
                }
              >
                {p.label}
              </Button>
            );
          })}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <CalendarIcon className="h-3.5 w-3.5" />
                {format(filters.startDate, 'dd/MM/yy', { locale: ptBR })} –{' '}
                {format(filters.endDate, 'dd/MM/yy', { locale: ptBR })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={range}
                onSelect={(r) =>
                  r?.from && onChange({ ...filters, startDate: r.from, endDate: r.to ?? r.from })
                }
                numberOfMonths={2}
                locale={ptBR}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="flex flex-col gap-1 min-w-[200px]">
        <Label className="text-xs text-muted-foreground">Entidade jurídica</Label>
        <Select
          value={
            filters.legalEntityId === null
              ? '__all__'
              : filters.legalEntityId ?? activeLegalEntityId ?? '__all__'
          }
          onValueChange={(v) =>
            onChange({ ...filters, legalEntityId: v === '__all__' ? null : v })
          }
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Todas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas acessíveis</SelectItem>
            {accessibleEntities.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>


      {showSellerSelector && (
        <div className="flex flex-col gap-1 min-w-[220px]">
          <Label className="text-xs text-muted-foreground">
            Vendedor {requireSeller && <span className="text-destructive">*</span>}
          </Label>
          <Select
            value={filters.sellerId ?? lockedSellerId ?? ''}
            onValueChange={(v) => onChange({ ...filters, sellerId: v || null })}
            disabled={!isAdmin && !!lockedSellerId}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder={requireSeller ? 'Selecione um vendedor' : 'Todos'} />
            </SelectTrigger>
            <SelectContent>
              {!requireSeller && isAdmin && <SelectItem value="__all__">Todos</SelectItem>}
              {sellerOptions.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={() =>
          onChange({
            startDate: subDays(new Date(), 30),
            endDate: new Date(),
            legalEntityId: activeLegalEntityId,
            sellerId: filters.sellerId,
          })
        }
        className={cn('gap-2')}
      >
        <RefreshCw className="h-3.5 w-3.5" /> Resetar
      </Button>
    </div>
  );
}
