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
import { getReportConfig, type ReportConfig, type ColumnFormat } from './reportConfigs';

interface ReportRendererProps {
  data: any;
  isLoading: boolean;
  error: unknown;
  chartType?: string;
  reportCode?: string;
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
}
function formatNumber(v: number) {
  return new Intl.NumberFormat('pt-BR').format(v || 0);
}
function isCurrencyKey(k: string) {
  return /valor|ticket|receita|faturamento|meta|realizado|margem|forecast|projecao|total|faltante|aberto|fechado/i.test(k);
}
function isPercentKey(k: string) {
  return /percent|_pct|taxa|rate|participacao/i.test(k);
}
function isHiddenKey(k: string) {
  return k === 'id' || /_id$/i.test(k) || k === 'uuid';
}
function applyFormat(format: ColumnFormat | undefined, key: string, value: any): string {
  if (value === null || value === undefined || value === '') return '—';
  const f = format ?? (
    typeof value === 'number'
      ? (isCurrencyKey(key) ? 'currency' : isPercentKey(key) ? 'percent' : 'number')
      : (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) ? 'date' : 'text'
  );
  if (f === 'currency') return formatCurrency(Number(value));
  if (f === 'percent') return `${Number(value).toFixed(1)}%`;
  if (f === 'number') return formatNumber(Number(value));
  if (f === 'date') return new Date(value).toLocaleDateString('pt-BR');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
function humanizeKey(k: string, labels?: Record<string, string>) {
  if (labels?.[k]) return labels[k];
  return k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function exportCSV(filename: string, rows: any[], hidden: Set<string>) {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]).filter((c) => !hidden.has(c) && !isHiddenKey(c));
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
  'hsl(173 58% 39%)',
  'hsl(43 96% 56%)',
  'hsl(27 87% 67%)',
  'hsl(280 65% 60%)',
  'hsl(var(--destructive))',
];

function ChartBlock({
  chartType,
  rows,
  config,
}: {
  chartType: string;
  rows: any[];
  config?: ReportConfig;
}) {
  const { labelKey, valueKeys } = useMemo(() => {
    if (rows.length === 0) return { labelKey: null as string | null, valueKeys: [] as string[] };
    const keys = Object.keys(rows[0]).filter((k) => !isHiddenKey(k));
    const labelKey =
      config?.chartLabelKey ??
      keys.find((k) => typeof rows[0][k] === 'string') ??
      keys[0];
    const valueKeys = config?.chartValueKeys?.filter((k) => keys.includes(k))
      ?? keys.filter((k) => k !== labelKey && typeof rows[0][k] === 'number').slice(0, 3);
    return { labelKey, valueKeys };
  }, [rows, config]);

  if (!labelKey || valueKeys.length === 0) return null;

  const limit = config?.topN ?? 20;
  const data = rows.slice(0, limit);
  const fmtVal = (v: any, k?: string) => {
    const key = k ?? valueKeys[0];
    if (isCurrencyKey(key)) return formatCurrency(Number(v));
    if (isPercentKey(key)) return `${Number(v).toFixed(1)}%`;
    return formatNumber(Number(v));
  };

  if (chartType === 'pie' || chartType === 'donut') {
    const k = valueKeys[0];
    return (
      <div className="h-72 w-full">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey={k} nameKey={labelKey} outerRadius={100} label={(e: any) => e[labelKey]}>
              {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(v: any) => fmtVal(v, k)} />
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
            <Tooltip formatter={(v: any, k: any) => fmtVal(v, k as string)} />
            <Legend formatter={(k) => humanizeKey(k as string, config?.columnLabels)} />
            {valueKeys.map((k, i) => (
              <Line key={k} type="monotone" dataKey={k} stroke={CHART_COLORS[i]} strokeWidth={2} dot={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis dataKey={labelKey} tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={70} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => isCurrencyKey(valueKeys[0]) ? formatCurrency(Number(v)) : formatNumber(Number(v))} />
          <Tooltip formatter={(v: any, k: any) => fmtVal(v, k as string)} />
          <Legend formatter={(k) => humanizeKey(k as string, config?.columnLabels)} />
          {valueKeys.map((k, i) => (
            <Bar key={k} dataKey={k} fill={CHART_COLORS[i]} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function DataBlock({
  title,
  rows,
  chartType,
  config,
}: {
  title: string;
  rows: any[];
  chartType?: string;
  config?: ReportConfig;
}) {
  const hidden = new Set<string>(config?.hiddenColumns ?? []);
  const sorted = useMemo(() => {
    if (!config?.sortBy) return rows;
    const dir = config.sortDir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = a[config.sortBy!]; const bv = b[config.sortBy!];
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [rows, config]);

  if (!sorted || sorted.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="text-sm font-semibold mb-3">{humanizeKey(title, config?.columnLabels)}</h3>
        <p className="text-sm text-muted-foreground">Nenhum dado no período.</p>
      </Card>
    );
  }

  const allCols = Object.keys(sorted[0]).filter((c) => !hidden.has(c) && !isHiddenKey(c));
  const cols = config?.columnOrder
    ? [...config.columnOrder.filter((c) => allCols.includes(c)), ...allCols.filter((c) => !config.columnOrder!.includes(c))]
    : allCols;
  const showChart = chartType && chartType !== 'table' && chartType !== 'kpi';

  return (
    <Card className="p-4 overflow-hidden">
      <div className="flex items-center justify-between mb-3 gap-2">
        <h3 className="text-sm font-semibold">{humanizeKey(title, config?.columnLabels)}</h3>
        <Button variant="ghost" size="sm" className="gap-2 h-7" onClick={() => exportCSV(title, sorted, hidden)}>
          <Download className="h-3.5 w-3.5" /> CSV
        </Button>
      </div>
      {showChart && <ChartBlock chartType={chartType!} rows={sorted} config={config} />}
      <div className="overflow-x-auto mt-3">
        <Table>
          <TableHeader>
            <TableRow>
              {cols.map((c) => (
                <TableHead key={c}>{humanizeKey(c, config?.columnLabels)}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.slice(0, 100).map((row, i) => (
              <TableRow key={i}>
                {cols.map((c) => (
                  <TableCell key={c} className="tabular-nums">
                    {applyFormat(config?.columnFormat?.[c], c, row[c])}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {sorted.length > 100 && (
          <p className="text-xs text-muted-foreground mt-2">
            Mostrando 100 de {sorted.length.toLocaleString('pt-BR')} linhas.
          </p>
        )}
      </div>
    </Card>
  );
}

function PlainObjectKpis({ obj }: { obj: Record<string, any> }) {
  const entries = Object.entries(obj).filter(([k, v]) => !isHiddenKey(k) && (typeof v === 'number' || typeof v === 'string'));
  if (entries.length === 0) return null;
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      {entries.map(([k, v]) => <KPICard key={k} label={k} value={v} />)}
    </div>
  );
}

export function ReportRenderer({ data, isLoading, error, chartType, reportCode }: ReportRendererProps) {
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

  const config = getReportConfig(reportCode);
  const kpis = data.kpis && typeof data.kpis === 'object' ? data.kpis : null;
  const period = data.period;

  const arrayFields: Array<[string, any[]]> = [];
  const nestedObjects: Array<[string, Record<string, any>]> = [];
  if (Array.isArray(data)) {
    arrayFields.push(['Resultados', data]);
  } else if (typeof data === 'object') {
    for (const [k, v] of Object.entries(data)) {
      if (k === 'kpis' || k === 'period' || k === 'filters') continue;
      if (Array.isArray(v)) arrayFields.push([k, v as any[]]);
      else if (v && typeof v === 'object') nestedObjects.push([k, v as Record<string, any>]);
    }
  }

  // Caso "objeto plano" (Forecast genérico, sem array nem kpis explícitos)
  const isPlainObject =
    !Array.isArray(data) &&
    typeof data === 'object' &&
    !kpis &&
    arrayFields.length === 0 &&
    nestedObjects.length === 0;

  return (
    <div className="space-y-6">
      {period && (
        <p className="text-xs text-muted-foreground">
          Período: {period.from} → {period.to}
        </p>
      )}
      {isPlainObject && <PlainObjectKpis obj={data} />}
      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Object.entries(kpis).map(([k, v]) => (
            <KPICard key={k} label={k} value={v} />
          ))}
        </div>
      )}
      <div className="grid grid-cols-1 gap-4">
        {arrayFields.map(([k, rows], idx) => (
          <DataBlock
            key={k}
            title={k}
            rows={rows}
            chartType={idx === 0 ? chartType : 'table'}
            config={config}
          />
        ))}
      </div>
      {!isPlainObject && !kpis && arrayFields.length === 0 && (
        <Card className="p-4">
          <pre className="text-xs overflow-auto">{JSON.stringify(data, null, 2)}</pre>
        </Card>
      )}
    </div>
  );
}
