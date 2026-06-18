import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

interface MetaRow {
  id: string;
  alvo: string;
  meta: number;
  realizado: number;
  faltante: number;
  percent: number;
  scope: string;
  periodo: { inicio: string; fim: string };
}

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v || 0);
}

function toneFromPercent(p: number) {
  if (p >= 100) return { text: 'text-emerald-600 dark:text-emerald-400', badge: 'default' as const, fill: 'hsl(142 76% 36%)' };
  if (p >= 70) return { text: 'text-amber-600 dark:text-amber-400', badge: 'secondary' as const, fill: 'hsl(43 96% 56%)' };
  return { text: 'text-destructive', badge: 'destructive' as const, fill: 'hsl(var(--destructive))' };
}

export function MetasRenderer({ data }: { data: MetaRow[] }) {
  const rows = useMemo(
    () => [...(data || [])].sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0)),
    [data]
  );

  if (!rows.length) {
    return <Card className="p-6 text-sm text-muted-foreground">Nenhuma meta cadastrada no período.</Card>;
  }

  const totals = rows.reduce(
    (acc, r) => ({ meta: acc.meta + (r.meta || 0), realizado: acc.realizado + (r.realizado || 0) }),
    { meta: 0, realizado: 0 }
  );
  const totalPct = totals.meta > 0 ? (totals.realizado / totals.meta) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="p-4">
          <p className="text-xs uppercase text-muted-foreground">Meta consolidada</p>
          <p className="text-2xl font-bold tabular-nums mt-1">{fmt(totals.meta)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase text-muted-foreground">Realizado</p>
          <p className="text-2xl font-bold tabular-nums mt-1">{fmt(totals.realizado)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase text-muted-foreground">% atingido</p>
          <p className={`text-2xl font-bold tabular-nums mt-1 ${toneFromPercent(totalPct).text}`}>
            {totalPct.toFixed(1)}%
          </p>
        </Card>
      </div>

      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-3">Meta vs Realizado por vendedor</h3>
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={rows} margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="alvo" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={70} />
              <YAxis tickFormatter={(v) => fmt(v)} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: any) => fmt(Number(v))} />
              <Legend />
              <Bar dataKey="meta" name="Meta" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="realizado" name="Realizado" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-4 overflow-hidden">
        <h3 className="text-sm font-semibold mb-3">Detalhamento</h3>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendedor</TableHead>
                <TableHead className="text-right">Meta</TableHead>
                <TableHead className="text-right">Realizado</TableHead>
                <TableHead className="text-right">Faltante</TableHead>
                <TableHead className="w-[220px]">% atingida</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const tone = toneFromPercent(r.percent || 0);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.alvo}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(r.meta)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(r.realizado)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(r.faltante)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={Math.min(r.percent || 0, 100)} className="h-2 flex-1" />
                        <Badge variant={tone.badge} className="tabular-nums min-w-[60px] justify-center">
                          {(r.percent || 0).toFixed(1)}%
                        </Badge>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
