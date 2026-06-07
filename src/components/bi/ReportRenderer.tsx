import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle } from 'lucide-react';

interface ReportRendererProps {
  data: any;
  isLoading: boolean;
  error: unknown;
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
}
function formatNumber(v: number) {
  return new Intl.NumberFormat('pt-BR').format(v || 0);
}
function isCurrencyKey(k: string) {
  return /valor|ticket|receita|faturamento|meta|realizado|margem|forecast|projecao/i.test(k);
}
function isPercentKey(k: string) {
  return /percent|_pct|taxa|rate/i.test(k);
}
function formatCell(key: string, value: any) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number') {
    if (isCurrencyKey(key)) return formatCurrency(value);
    if (isPercentKey(key)) return `${value.toFixed(1)}%`;
    return formatNumber(value);
  }
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return new Date(value).toLocaleDateString('pt-BR');
    return value;
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
function humanizeKey(k: string) {
  return k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function KPICard({ label, value }: { label: string; value: any }) {
  const isCurr = isCurrencyKey(label);
  const display = typeof value === 'number'
    ? (isCurr ? formatCurrency(value) : isPercentKey(label) ? `${value.toFixed(1)}%` : formatNumber(value))
    : String(value ?? '—');
  return (
    <Card className="p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{humanizeKey(label)}</div>
      <div className="mt-2 text-2xl font-bold tabular-nums">{display}</div>
    </Card>
  );
}

function DataTable({ title, rows }: { title: string; rows: any[] }) {
  if (!rows || rows.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="text-sm font-semibold mb-3">{humanizeKey(title)}</h3>
        <p className="text-sm text-muted-foreground">Nenhum dado no período.</p>
      </Card>
    );
  }
  const cols = Object.keys(rows[0]);
  return (
    <Card className="p-4 overflow-hidden">
      <h3 className="text-sm font-semibold mb-3">{humanizeKey(title)}</h3>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {cols.map((c) => (
                <TableHead key={c}>{humanizeKey(c)}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.slice(0, 100).map((row, i) => (
              <TableRow key={i}>
                {cols.map((c) => (
                  <TableCell key={c} className="tabular-nums">
                    {formatCell(c, row[c])}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {rows.length > 100 && (
          <p className="text-xs text-muted-foreground mt-2">
            Mostrando 100 de {rows.length.toLocaleString('pt-BR')} linhas.
          </p>
        )}
      </div>
    </Card>
  );
}

export function ReportRenderer({ data, isLoading, error }: ReportRendererProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (error) {
    return (
      <Card className="p-6 border-destructive/50">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <span className="font-medium">Erro ao carregar relatório</span>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          {error instanceof Error ? error.message : 'Erro desconhecido'}
        </p>
      </Card>
    );
  }
  if (!data) return null;

  // Handle different shapes
  const kpis = data.kpis && typeof data.kpis === 'object' ? data.kpis : null;
  const period = data.period;

  // Collect all array fields for tables
  const arrayFields: Array<[string, any[]]> = [];
  if (Array.isArray(data)) {
    arrayFields.push(['Resultados', data]);
  } else if (typeof data === 'object') {
    for (const [k, v] of Object.entries(data)) {
      if (k === 'kpis' || k === 'period' || k === 'filters') continue;
      if (Array.isArray(v)) arrayFields.push([k, v as any[]]);
    }
  }

  return (
    <div className="space-y-6">
      {period && (
        <p className="text-xs text-muted-foreground">
          Período: {period.from} → {period.to}
        </p>
      )}
      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Object.entries(kpis).map(([k, v]) => (
            <KPICard key={k} label={k} value={v} />
          ))}
        </div>
      )}
      <div className="grid grid-cols-1 gap-4">
        {arrayFields.map(([k, rows]) => (
          <DataTable key={k} title={k} rows={rows} />
        ))}
      </div>
      {!kpis && arrayFields.length === 0 && (
        <Card className="p-4">
          <pre className="text-xs overflow-auto">{JSON.stringify(data, null, 2)}</pre>
        </Card>
      )}
    </div>
  );
}
