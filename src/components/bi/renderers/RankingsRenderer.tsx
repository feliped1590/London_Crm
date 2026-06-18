import { Card } from '@/components/ui/card';
import { Trophy, Users, Package, Building2 } from 'lucide-react';

interface RankingItem {
  nome: string;
  valor?: number;
}

interface RankingsData {
  clientes?: RankingItem[];
  vendedores?: RankingItem[];
  produtos?: RankingItem[];
  entidades?: RankingItem[];
}

function fmtCurr(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v || 0);
}

function MiniBoard({
  title,
  icon: Icon,
  items,
}: {
  title: string;
  icon: any;
  items: RankingItem[];
}) {
  const top = [...(items || [])].sort((a, b) => (b.valor ?? 0) - (a.valor ?? 0)).slice(0, 10);
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {top.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem dados.</p>
      ) : (
        <ol className="space-y-1.5">
          {top.map((it, i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              <span className="w-5 text-xs font-bold text-muted-foreground tabular-nums text-right">
                {i + 1}.
              </span>
              <span className="flex-1 truncate" title={it.nome}>{it.nome}</span>
              <span className="tabular-nums font-medium">{fmtCurr(it.valor || 0)}</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

export function RankingsRenderer({ data }: { data: RankingsData }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Visão consolidada dos top 10 em cada dimensão. Útil como visão geral rápida quando você
        não quer abrir cada relatório individual.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <MiniBoard title="Top Clientes" icon={Trophy} items={data?.clientes || []} />
        <MiniBoard title="Top Vendedores" icon={Users} items={data?.vendedores || []} />
        <MiniBoard title="Top Produtos" icon={Package} items={data?.produtos || []} />
        <MiniBoard title="Top Entidades Jurídicas" icon={Building2} items={data?.entidades || []} />
      </div>
    </div>
  );
}
