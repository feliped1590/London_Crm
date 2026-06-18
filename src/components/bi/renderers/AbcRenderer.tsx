import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, Cell,
} from 'recharts';

interface AbcRow {
  company_id: string;
  nome: string;
  valor_vendido: number;
  qtd_pedidos: number;
  ticket_medio: number;
  ultima_compra: string | null;
  posicao: number;
  abc: 'A' | 'B' | 'C';
}

function fmtCurr(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v || 0);
}
function fmtDate(v: string | null) {
  if (!v) return '—';
  return new Date(v).toLocaleDateString('pt-BR');
}

const ABC_COLORS = { A: 'hsl(142 76% 36%)', B: 'hsl(43 96% 56%)', C: 'hsl(var(--muted-foreground))' };

export function AbcRenderer({ data }: { data: AbcRow[] }) {
  const rows = useMemo(() => [...(data || [])].sort((a, b) => (b.valor_vendido || 0) - (a.valor_vendido || 0)), [data]);

  if (!rows.length) {
    return <Card className="p-6 text-sm text-muted-foreground">Nenhuma venda no período.</Card>;
  }

  const total = rows.reduce((s, r) => s + (r.valor_vendido || 0), 0);
  const top = rows.slice(0, 20);
  let acc = 0;
  const chartData = top.map((r) => {
    acc += r.valor_vendido || 0;
    return {
      nome: r.nome?.length > 18 ? r.nome.slice(0, 18) + '…' : r.nome ?? '—',
      valor_vendido: r.valor_vendido || 0,
      acumulado_pct: total > 0 ? (acc / total) * 100 : 0,
      abc: r.abc,
    };
  });

  const counts = rows.reduce(
    (acc, r) => ({ ...acc, [r.abc]: (acc[r.abc] || 0) + 1 }),
    {} as Record<string, number>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <p className="text-xs uppercase text-muted-foreground">Clientes ativos</p>
          <p className="text-2xl font-bold mt-1 tabular-nums">{rows.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase text-muted-foreground">Receita total</p>
          <p className="text-2xl font-bold mt-1 tabular-nums">{fmtCurr(total)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase text-muted-foreground">Classe A (80% receita)</p>
          <p className="text-2xl font-bold mt-1 tabular-nums text-emerald-600 dark:text-emerald-400">
            {counts.A || 0}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase text-muted-foreground">Classes B+C</p>
          <p className="text-2xl font-bold mt-1 tabular-nums text-muted-foreground">
            {(counts.B || 0) + (counts.C || 0)}
          </p>
        </Card>
      </div>

      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-1">Curva ABC — Top 20</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Barras = receita por cliente. Linha = % acumulado. A=até 80%, B=80-95%, C=95-100%.
        </p>
        <div className="h-80">
          <ResponsiveContainer>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="nome" tick={{ fontSize: 10 }} interval={0} angle={-35} textAnchor="end" height={80} />
              <YAxis yAxisId="left" tickFormatter={(v) => fmtCurr(v)} tick={{ fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} domain={[0, 100]} />
              <Tooltip
                formatter={(v: any, k: any) =>
                  k === 'acumulado_pct' ? `${Number(v).toFixed(1)}%` : fmtCurr(Number(v))
                }
              />
              <Legend />
              <Bar yAxisId="left" dataKey="valor_vendido" name="Receita" radius={[4, 4, 0, 0]}>
                {chartData.map((d, i) => <Cell key={i} fill={ABC_COLORS[d.abc] ?? ABC_COLORS.C} />)}
              </Bar>
              <Line yAxisId="right" type="monotone" dataKey="acumulado_pct" name="% acumulado" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-4 overflow-hidden">
        <h3 className="text-sm font-semibold mb-3">Detalhamento ({rows.length} clientes)</h3>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Classe</TableHead>
                <TableHead className="text-right">Receita</TableHead>
                <TableHead className="text-right">Pedidos</TableHead>
                <TableHead className="text-right">Ticket médio</TableHead>
                <TableHead className="text-right">Última compra</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.slice(0, 100).map((r) => (
                <TableRow key={r.company_id}>
                  <TableCell className="tabular-nums">{r.posicao}</TableCell>
                  <TableCell className="font-medium">{r.nome ?? '—'}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      style={{ borderColor: ABC_COLORS[r.abc], color: ABC_COLORS[r.abc] }}
                    >
                      {r.abc}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{fmtCurr(r.valor_vendido)}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.qtd_pedidos}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtCurr(r.ticket_medio)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtDate(r.ultima_compra)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {rows.length > 100 && (
            <p className="text-xs text-muted-foreground mt-2">Mostrando 100 de {rows.length} clientes.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
