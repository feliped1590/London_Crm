import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { AlertCircle, Download } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart, Bar,
  LineChart, Line,
  PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts';

interface ReportRendererProps {
  data: any;
  isLoading: boolean;
  error: unknown;
  chartType?: string;
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
}
function formatNumber(v: number) {
  return new Intl.NumberFormat('pt-BR').format(v || 0);
}
function isCurrencyKey(k: string) {
  return /valor|ticket|receita|faturamento|meta|realizado|margem|forecast|projecao|total/i.test(k);
}
function isPercentKey(k: string) {
  return /percent|_pct|taxa|rate/i.test(k);
}
function isHiddenKey(k: string) {
  // Oculta colunas técnicas de UUID/chave (id, company_id, product_id, etc.)
  return k === 'id' || /_id$/i.test(k) || k === 'uuid';
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

function exportCSV(filename: string, rows: any[]) {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]);
  const escape = (v: any) => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [cols.join(';'), ...rows.map((r) => cols.map((c) => escape(r[c])).join(';'))].join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
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

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2, 173 58% 39%))',
  'hsl(var(--chart-3, 197 37% 24%))',
  'hsl(var(--chart-4, 43 74% 66%))',
  'hsl(var(--chart-5, 27 87% 67%))',
  'hsl(var(--destructive))',
];

function pickChartKeys(rows: any[]): { labelKey: string | null; valueKeys: string[] } {
  if (!rows || rows.length === 0) return { labelKey: null, valueKeys: [] };
  const keys = Object.keys(rows[0]);
  const labelKey = keys.find((k) => typeof rows[0][k] === 'string') ?? keys[0];
  const valueKeys = keys.filter((k) => k !== labelKey && typeof rows[0][k] === 'number').slice(0, 3);
  return { labelKey, valueKeys };
}

function ChartBlock({ chartType, rows }: { chartType: string; rows: any[] }) {
  const { labelKey, valueKeys } = useMemo(() => pickChartKeys(rows), [rows]);
  if (!labelKey || valueKeys.length === 0) return null;

  const data = rows.slice(0, 20);

  if (chartType === 'pie' || chartType === 'donut') {
    const k = valueKeys[0];
    return (
      <div className="h-72 w-full">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey={k} nameKey={labelKey} outerRadius={100} label>
              {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(v: any) => isCurrencyKey(k) ? formatCurrency(Number(v)) : formatNumber(Number(v))} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (chartType === 'line' || chartType === 'area') {
    return (
      <div className="h-72 w-full">
        <ResponsiveContainer>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey={labelKey} tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            {valueKeys.map((k, i) => (
              <Line key={k} type="monotone" dataKey={k} stroke={CHART_COLORS[i]} strokeWidth={2} dot={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // default: bar (also funnel fallback)
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis dataKey={labelKey} tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Legend />
          {valueKeys.map((k, i) => (
            <Bar key={k} dataKey={k} fill={CHART_COLORS[i]} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function DataBlock({ title, rows, chartType }: { title: string; rows: any[]; chartType?: string }) {
  if (!rows || rows.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="text-sm font-semibold mb-3">{humanizeKey(title)}</h3>
        <p className="text-sm text-muted-foreground">Nenhum dado no período.</p>
      </Card>
    );
  }
  const cols = Object.keys(rows[0]);
  const showChart = chartType && chartType !== 'table' && chartType !== 'kpi';

  return (
    <Card className="p-4 overflow-hidden">
      <div className="flex items-center justify-between mb-3 gap-2">
        <h3 className="text-sm font-semibold">{humanizeKey(title)}</h3>
        <Button variant="ghost" size="sm" className="gap-2 h-7" onClick={() => exportCSV(title, rows)}>
          <Download className="h-3.5 w-3.5" /> CSV
        </Button>
      </div>
      {showChart && <ChartBlock chartType={chartType!} rows={rows} />}
      <div className="overflow-x-auto mt-3">
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

export function ReportRenderer({ data, isLoading, error, chartType }: ReportRendererProps) {
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

  const kpis = data.kpis && typeof data.kpis === 'object' ? data.kpis : null;
  const period = data.period;

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
        {arrayFields.map(([k, rows], idx) => (
          <DataBlock key={k} title={k} rows={rows} chartType={idx === 0 ? chartType : 'table'} />
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
