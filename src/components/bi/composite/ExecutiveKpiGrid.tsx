import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { LucideIcon } from 'lucide-react';

export interface KpiItem {
  key: string;
  label: string;
  value: number | string | null | undefined;
  format?: 'currency' | 'number' | 'percent' | 'text';
  icon?: LucideIcon;
  hint?: string;
}

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v || 0);
const fmtNumber = (v: number) => new Intl.NumberFormat('pt-BR').format(v || 0);

function display(v: KpiItem['value'], fmt: KpiItem['format']) {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'number') {
    if (fmt === 'currency') return fmtCurrency(v);
    if (fmt === 'percent') return `${v.toFixed(1)}%`;
    return fmtNumber(v);
  }
  return String(v);
}

interface Props {
  items: KpiItem[];
  isLoading?: boolean;
  columns?: number;
}

export function ExecutiveKpiGrid({ items, isLoading, columns = 4 }: Props) {
  const cols = `grid-cols-2 md:grid-cols-3 lg:grid-cols-${Math.min(columns, 6)}`;
  if (isLoading) {
    return (
      <div className={`grid gap-3 ${cols}`}>
        {Array.from({ length: items.length || columns }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }
  return (
    <div className={`grid gap-3 ${cols}`}>
      {items.map((k) => {
        const Icon = k.icon;
        return (
          <Card key={k.key} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                {k.label}
              </div>
              {Icon && <Icon className="h-4 w-4 text-muted-foreground shrink-0" />}
            </div>
            <div className="mt-2 text-2xl font-bold tabular-nums">{display(k.value, k.format)}</div>
            {k.hint && <div className="text-[11px] text-muted-foreground mt-1">{k.hint}</div>}
          </Card>
        );
      })}
    </div>
  );
}
