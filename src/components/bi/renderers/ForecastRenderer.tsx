import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, Target, CheckCircle2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';

interface ForecastData {
  meta?: number;
  aberto?: number;
  fechado?: number;
  forecast?: number;
  percent_meta?: number;
}

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v || 0);
}

export function ForecastRenderer({ data }: { data: ForecastData }) {
  const meta = data.meta ?? 0;
  const fechado = data.fechado ?? 0;
  const aberto = data.aberto ?? 0;
  const forecast = data.forecast ?? fechado + aberto;
  const percent = data.percent_meta ?? (meta > 0 ? (forecast / meta) * 100 : 0);

  const status: 'low' | 'mid' | 'high' = percent < 70 ? 'low' : percent < 100 ? 'mid' : 'high';
  const statusColor = {
    low: 'text-destructive',
    mid: 'text-amber-600 dark:text-amber-400',
    high: 'text-emerald-600 dark:text-emerald-400',
  }[status];
  const barColor = {
    low: 'hsl(var(--destructive))',
    mid: 'hsl(43 96% 56%)',
    high: 'hsl(142 76% 36%)',
  }[status];

  const chartData = [
    { label: 'Meta', valor: meta, color: 'hsl(var(--muted-foreground))' },
    { label: 'Fechado', valor: fechado, color: 'hsl(142 76% 36%)' },
    { label: 'Aberto', valor: aberto, color: 'hsl(var(--primary))' },
    { label: 'Forecast', valor: forecast, color: barColor },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={Target} label="Meta do período" value={fmt(meta)} />
        <KpiCard icon={CheckCircle2} label="Fechado (ganho)" value={fmt(fechado)} tone="success" />
        <KpiCard icon={Clock} label="Em aberto" value={fmt(aberto)} tone="info" />
        <KpiCard icon={TrendingUp} label="Forecast total" value={fmt(forecast)} tone={status} />
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-sm text-muted-foreground">Atingimento projetado</p>
            <p className={cn('text-3xl font-bold tabular-nums', statusColor)}>
              {percent.toFixed(1)}%
            </p>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <p>Forecast: <span className="font-medium text-foreground">{fmt(forecast)}</span></p>
            <p>Meta: <span className="font-medium text-foreground">{fmt(meta)}</span></p>
          </div>
        </div>
        <Progress value={Math.min(percent, 100)} className="h-3" />
        <p className="text-xs text-muted-foreground mt-2">
          Forecast = Fechado ganho + (Aberto × probabilidade média por etapa do pipeline).
        </p>
      </Card>

      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-3">Comparativo</h3>
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis type="number" tickFormatter={(v) => fmt(v)} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="label" tick={{ fontSize: 12 }} width={80} />
              <Tooltip formatter={(v: any) => fmt(Number(v))} />
              <Bar dataKey="valor" radius={[0, 4, 4, 0]}>
                {chartData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  tone = 'neutral',
}: {
  icon: any;
  label: string;
  value: string;
  tone?: 'neutral' | 'success' | 'info' | 'low' | 'mid' | 'high';
}) {
  const toneClass = {
    neutral: 'text-muted-foreground',
    success: 'text-emerald-600 dark:text-emerald-400',
    info: 'text-primary',
    low: 'text-destructive',
    mid: 'text-amber-600 dark:text-amber-400',
    high: 'text-emerald-600 dark:text-emerald-400',
  }[tone];
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
        <Icon className={cn('h-4 w-4', toneClass)} />
      </div>
      <div className={cn('mt-2 text-2xl font-bold tabular-nums', toneClass)}>{value}</div>
    </Card>
  );
}
