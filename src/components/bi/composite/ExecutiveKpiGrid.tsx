import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BiTone } from './biTheme';

export interface KpiItem {
  key: string;
  label: string;
  value: number | string | null | undefined;
  format?: 'currency' | 'number' | 'percent' | 'text';
  icon?: LucideIcon;
  hint?: string;
  /** Tom visual do acento (borda esquerda + chip do ícone). */
  tone?: BiTone;
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

const TONE_CLASS: Record<BiTone, { border: string; chip: string; icon: string }> = {
  primary:   { border: 'border-l-[#2563EB]', chip: 'bg-[#2563EB]/10',  icon: 'text-[#2563EB]' },
  secondary: { border: 'border-l-[#4F46E5]', chip: 'bg-[#4F46E5]/10',  icon: 'text-[#4F46E5]' },
  success:   { border: 'border-l-[#16A34A]', chip: 'bg-[#16A34A]/10',  icon: 'text-[#16A34A]' },
  warning:   { border: 'border-l-[#F59E0B]', chip: 'bg-[#F59E0B]/15',  icon: 'text-[#B45309]' },
  danger:    { border: 'border-l-[#DC2626]', chip: 'bg-[#DC2626]/10',  icon: 'text-[#DC2626]' },
  neutral:   { border: 'border-l-[#CBD5E1]', chip: 'bg-[#64748B]/10',  icon: 'text-[#64748B]' },
};

interface Props {
  items: KpiItem[];
  isLoading?: boolean;
  columns?: number;
  onItemClick?: (key: string) => void;
}

export function ExecutiveKpiGrid({ items, isLoading, columns = 4, onItemClick }: Props) {
  const colsMap: Record<number, string> = {
    2: 'grid-cols-2',
    3: 'grid-cols-2 md:grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-4',
    5: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-5',
    6: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6',
    8: 'grid-cols-2 md:grid-cols-4 lg:grid-cols-8',
  };
  const cols = colsMap[columns] ?? colsMap[4];
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
        const tone = TONE_CLASS[k.tone ?? 'neutral'];
        return (
          <Card
            key={k.key}
            className={cn(
              'bi-kpi-card p-4 bg-white border border-[#E2E8F0] shadow-none rounded-[10px] border-l-[3px]',
              tone.border
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="text-[10px] uppercase tracking-wide text-[#64748B] font-semibold">
                {k.label}
              </div>
              {Icon && (
                <span className={cn('inline-flex h-6 w-6 items-center justify-center rounded-md', tone.chip)}>
                  <Icon className={cn('h-3.5 w-3.5', tone.icon)} />
                </span>
              )}
            </div>
            <div className="mt-2 text-[22px] font-bold tabular-nums text-[#0F172A] leading-tight">
              {display(k.value, k.format)}
            </div>
            {k.hint && <div className="text-[10px] text-[#64748B] mt-1">{k.hint}</div>}
          </Card>
        );
      })}
    </div>
  );
}
