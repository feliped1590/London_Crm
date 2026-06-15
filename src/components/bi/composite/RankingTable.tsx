import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

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

export function RankingTable<T extends Record<string, any>>({
  rows,
  columns,
  limit = 10,
  emptyMessage = 'Sem dados.',
}: Props<T>) {
  const shown = rows.slice(0, limit);
  if (shown.length === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center">{emptyMessage}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">#</TableHead>
            {columns.map((c) => (
              <TableHead
                key={String(c.key)}
                className={c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : ''}
              >
                {c.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {shown.map((row, i) => (
            <TableRow key={i}>
              <TableCell className="text-muted-foreground tabular-nums">{i + 1}</TableCell>
              {columns.map((c) => (
                <TableCell
                  key={String(c.key)}
                  className={`tabular-nums ${c.className ?? ''} ${
                    c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : ''
                  }`}
                >
                  {c.render ? c.render(row) : formatVal(row[c.key as string], c.format)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
