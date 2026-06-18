import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { TooltipProvider, Tooltip as UITip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';

interface PipelineData {
  por_etapa?: Array<{
    stage: string;
    stage_label?: string;
    qtd?: number;
    valor?: number;
    order_index?: number;
  }>;
  tempo_medio_etapa?: Array<{ stage: string; dias_medio: number }>;
}

function fmtCurr(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v || 0);
}

export function PipelineComercialRenderer({ data }: { data: PipelineData }) {
  const etapas = [...(data.por_etapa || [])].sort(
    (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)
  );
  const tempos = data.tempo_medio_etapa || [];
  const tempoMap = new Map(tempos.map((t) => [t.stage, t.dias_medio]));

  const chartData = etapas.map((e) => ({
    etapa: e.stage_label || e.stage,
    valor: e.valor || 0,
  }));

  return (
    <div className="space-y-4">
      {etapas.length > 0 ? (
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-1">Valor por etapa do pipeline</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Soma do valor de negócios em cada etapa, na ordem do funil.
          </p>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={chartData} margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="etapa" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={70} />
                <YAxis tickFormatter={(v) => fmtCurr(v)} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => fmtCurr(Number(v))} />
                <Bar dataKey="valor" name="Valor" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      ) : (
        <Card className="p-6 text-sm text-muted-foreground">Sem negócios ativos no funil para o período.</Card>
      )}

      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-3">Detalhamento por etapa</h3>
        <TooltipProvider>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Etapa</TableHead>
                <TableHead className="text-right">Negócios</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">
                  <span className="inline-flex items-center gap-1">
                    Dias médios
                    <UITip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>Tempo médio que um negócio permanece nesta etapa antes de avançar.</TooltipContent>
                    </UITip>
                  </span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {etapas.length === 0 && tempos.length > 0 && tempos.map((t) => (
                <TableRow key={t.stage}>
                  <TableCell className="font-medium">{t.stage}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">—</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">—</TableCell>
                  <TableCell className="text-right tabular-nums">{(t.dias_medio || 0).toFixed(1)}</TableCell>
                </TableRow>
              ))}
              {etapas.map((e) => (
                <TableRow key={e.stage}>
                  <TableCell className="font-medium">{e.stage_label || e.stage}</TableCell>
                  <TableCell className="text-right tabular-nums">{e.qtd ?? '—'}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtCurr(e.valor || 0)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {(tempoMap.get(e.stage) ?? 0).toFixed(1)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TooltipProvider>
      </Card>
    </div>
  );
}
