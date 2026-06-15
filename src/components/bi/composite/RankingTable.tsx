import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v || 0);
const fmtNumber = (v: number) => new Intl.NumberFormat('pt-BR').format(v || 0);

export interface RankingColumn<T> {
  key: keyof T | string;
  label: string;
  align?: 'left' | 'right' | 'center';
  format?: 'currency' | 'number' | 'percent' | 'text';
  render?: (row: T) => React.ReactNode;
  className?: string;
}

interface Props<T> {
  rows: T[];
  columns: RankingColumn<T>[];
  limit?: number;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
}

function formatVal(v: unknown, fmt?: string) {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'number') {
    if (fmt === 'currency') return fmtCurrency(v);
    if (fmt === 'percent') return `${v.toFixed(1)}%`;
    return fmtNumber(v);
  }
  return String(v);
}

function rankBadgeClass(idx: number): string {
  if (idx === 0) return 'bg-[#0F172A] text-white';
  if (idx === 1) return 'bg-[#334155] text-white';
  if (idx === 2) return 'bg-[#64748B] text-white';
  return 'bg-[#EFF4FB] text-[#475569]';
}

export function RankingTable<T extends Record<string, any>>({
  rows,
  columns,
  limit = 10,
  emptyMessage = 'Sem dados.',
  onRowClick,
}: Props<T>) {
  const shown = rows.slice(0, limit);
  if (shown.length === 0) {
    return <p className="text-sm text-[#64748B] py-6 text-center">{emptyMessage}</p>;
  }
  return (
    <div className="overflow-x-auto bi-table-wrap">
      <Table className="bi-ranking-table">
        <TableHeader>
          <TableRow className="bg-[#EFF4FB] hover:bg-[#EFF4FB]">
            <TableHead className="w-10 text-[10px] uppercase text-[#334155] font-semibold tracking-wide">#</TableHead>
            {columns.map((c) => (
              <TableHead
                key={String(c.key)}
                className={cn(
                  'text-[10px] uppercase text-[#334155] font-semibold tracking-wide',
                  c.align === 'right' && 'text-right',
                  c.align === 'center' && 'text-center'
                )}
              >
                {c.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {shown.map((row, i) => (
            <TableRow key={i} className={i % 2 === 1 ? 'bg-[#F8FAFC]' : ''}>
              <TableCell className="py-1.5">
                <span
                  className={cn(
                    'inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums',
                    rankBadgeClass(i)
                  )}
                >
                  {i + 1}
                </span>
              </TableCell>
              {columns.map((c) => {
                const isMoney = c.format === 'currency';
                return (
                  <TableCell
                    key={String(c.key)}
                    className={cn(
                      'tabular-nums py-1.5 text-[#1F2937]',
                      isMoney && 'font-semibold text-[#0F172A]',
                      c.align === 'right' && 'text-right',
                      c.align === 'center' && 'text-center',
                      c.className
                    )}
                  >
                    {c.render ? c.render(row) : formatVal(row[c.key as string], c.format)}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
