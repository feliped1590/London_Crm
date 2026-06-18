import { Card } from '@/components/ui/card';
import { ArrowRight } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface ConversaoData {
  kpis: {
    leads_criados: number;
    negocios_criados: number;
    ganhos: number;
    perdidos: number;
    valor_ganho: number;
  };
  taxa_conversao_venda: number;
  por_vendedor: Array<{ vendedor: string; criados: number; ganhos: number; taxa: number }>;
}

function fmtCurr(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v || 0);
}
function pct(num: number, den: number) {
  return den > 0 ? (num / den) * 100 : 0;
}

function Step({ label, count, sub }: { label: string; count: number; sub?: string }) {
  return (
    <div className="flex-1 text-center">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="text-3xl font-bold tabular-nums mt-1">{count.toLocaleString('pt-BR')}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

function Arrow({ rate }: { rate: number }) {
  const tone =
    rate >= 50 ? 'text-emerald-600 dark:text-emerald-400'
    : rate >= 25 ? 'text-amber-600 dark:text-amber-400'
    : 'text-destructive';
  return (
    <div className="flex flex-col items-center px-2">
      <ArrowRight className="h-6 w-6 text-muted-foreground" />
      <span className={`text-sm font-semibold tabular-nums mt-1 ${tone}`}>{rate.toFixed(1)}%</span>
      <span className="text-[10px] text-muted-foreground">conversão</span>
    </div>
  );
}

export function ConversaoRenderer({ data }: { data: ConversaoData }) {
  const k = data?.kpis || ({} as ConversaoData['kpis']);
  const leadToDeal = pct(k.negocios_criados, k.leads_criados);
  const dealToWin = pct(k.ganhos, k.negocios_criados);
  const leadToWin = pct(k.ganhos, k.leads_criados);

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <h3 className="text-sm font-semibold mb-4">Funil de conversão</h3>
        <div className="flex items-stretch gap-2 flex-wrap">
          <Step label="Leads" count={k.leads_criados || 0} />
          <Arrow rate={leadToDeal} />
          <Step label="Negócios" count={k.negocios_criados || 0} />
          <Arrow rate={dealToWin} />
          <Step label="Ganhos" count={k.ganhos || 0} sub={fmtCurr(k.valor_ganho || 0)} />
        </div>
        <div className="mt-6 pt-4 border-t grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-muted-foreground">Lead → Negócio</p>
            <p className="text-xl font-bold tabular-nums">{leadToDeal.toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Negócio → Ganho</p>
            <p className="text-xl font-bold tabular-nums">{dealToWin.toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Lead → Ganho (geral)</p>
            <p className="text-xl font-bold tabular-nums text-primary">{leadToWin.toFixed(1)}%</p>
          </div>
        </div>
      </Card>

      {data.por_vendedor?.length > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">Conversão por vendedor</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendedor</TableHead>
                <TableHead className="text-right">Negócios criados</TableHead>
                <TableHead className="text-right">Ganhos</TableHead>
                <TableHead className="text-right">Taxa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...data.por_vendedor]
                .sort((a, b) => (b.taxa || 0) - (a.taxa || 0))
                .map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{r.vendedor}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.criados}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.ganhos}</TableCell>
                    <TableCell className="text-right tabular-nums">{(r.taxa || 0).toFixed(1)}%</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
