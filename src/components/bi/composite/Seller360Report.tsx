import { useMemo } from 'react';
import {
  DollarSign,
  ShoppingCart,
  Users,
  Target,
  TrendingDown,
  FileCheck,
  UserPlus,
  Clock,
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';
import { useBIReport } from '@/hooks/useBIReports';
import { ExecutiveFilters } from './ExecutiveFiltersBar';
import { ExecutiveKpiGrid, KpiItem } from './ExecutiveKpiGrid';
import { ExecutiveSection } from './ExecutiveSection';
import { RankingTable } from './RankingTable';
import { Info } from 'lucide-react';

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v || 0);

interface Props {
  filters: ExecutiveFilters;
}

export function Seller360Report({ filters }: Props) {
  const sellerId = filters.sellerId ?? null;

  if (!sellerId) {
    return (
      <Card className="p-8 text-center text-muted-foreground flex flex-col items-center gap-2">
        <Info className="h-5 w-5" />
        <p>Selecione um vendedor no filtro acima para visualizar a análise 360°.</p>
      </Card>
    );
  }

  const base = {
    startDate: filters.startDate,
    endDate: filters.endDate,
    legalEntityId: filters.legalEntityId ?? undefined,
    sellerId,
  };

  // Reuso de RPCs existentes — todas filtram por sales_rep_id quando passado
  const dashboard = useBIReport<any>('dashboard_executivo', base);
  const cliente = useBIReport<any[]>('vendas_cliente', base);
  const produto = useBIReport<any[]>('vendas_produto', base);
  const pipeline = useBIReport<any>('pipeline_comercial', base);
  const perdasAt = useBIReport<any>('perdas_atendimento', base);
  const perdasCot = useBIReport<any>('perdas_cotacao', base);
  const metas = useBIReport<any[]>('metas', base);
  const conversao = useBIReport<any>('conversao', base);
  const rankingAll = useBIReport<any[]>('vendas_vendedor', {
    startDate: filters.startDate,
    endDate: filters.endDate,
    legalEntityId: filters.legalEntityId ?? undefined,
  });
  const clientesAtendidos = useBIReport<any>('clientes_atendidos', base);

  const k = dashboard.data?.kpis ?? {};
  const valorPerdido =
    (Number(perdasAt.data?.valor_perdido) || 0) + (Number(perdasCot.data?.kpis?.valor_perdido) || 0);

  const metaTotal = useMemo(() => {
    const list = metas.data ?? [];
    return list.reduce(
      (acc, m: any) => ({
        meta: acc.meta + Number(m.meta || 0),
        realizado: acc.realizado + Number(m.realizado || 0),
      }),
      { meta: 0, realizado: 0 }
    );
  }, [metas.data]);
  const metaPct = metaTotal.meta > 0 ? (metaTotal.realizado / metaTotal.meta) * 100 : 0;
  const metaFalta = Math.max(0, metaTotal.meta - metaTotal.realizado);

  const posicao = useMemo(() => {
    const rows = rankingAll.data ?? [];
    const idx = rows.findIndex((r: any) => r.sales_rep_id === sellerId);
    return { posicao: idx >= 0 ? idx + 1 : null, total: rows.length };
  }, [rankingAll.data, sellerId]);

  const kpis: KpiItem[] = [
    { key: 'valor', label: 'Vendido', value: k.valor_vendido, format: 'currency', icon: DollarSign },
    { key: 'qtd', label: 'Pedidos', value: k.qtd_pedidos, format: 'number', icon: ShoppingCart },
    { key: 'ticket', label: 'Ticket médio', value: k.ticket_medio, format: 'currency' },
    { key: 'clientes', label: 'Clientes atendidos', value: k.clientes_atendidos, format: 'number', icon: Users },
    {
      key: 'novos',
      label: 'Novos clientes',
      value: clientesAtendidos.data?.novos,
      format: 'number',
      icon: UserPlus,
    },
    {
      key: 'conv',
      label: 'Conversão',
      value: conversao.data?.taxa_conversao_venda,
      format: 'percent',
      icon: Target,
    },
    { key: 'perdido', label: 'Valor perdido', value: valorPerdido, format: 'currency', icon: TrendingDown },
    {
      key: 'propostas',
      label: 'Propostas emitidas',
      value: perdasCot.data?.kpis?.emitidas,
      format: 'number',
      icon: FileCheck,
    },
  ];

  const motivosPerda = useMemo(() => {
    const at = (perdasAt.data?.por_motivo ?? []).map((m: any) => ({ ...m, origem: 'Atendimento' }));
    const co = (perdasCot.data?.por_motivo ?? []).map((m: any) => ({ ...m, origem: 'Cotação' }));
    return [...at, ...co].sort((a, b) => Number(b.valor || 0) - Number(a.valor || 0));
  }, [perdasAt.data, perdasCot.data]);

  return (
    <div className="space-y-4">
      <ExecutiveKpiGrid items={kpis} isLoading={dashboard.isLoading} columns={4} />

      {/* Meta x Realizado */}
      <ExecutiveSection
        title="Meta x Realizado"
        isLoading={metas.isLoading}
        error={metas.error}
        isEmpty={(metas.data ?? []).length === 0}
        emptyMessage="Nenhuma meta cadastrada para o período."
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Realizado</span>
            <span className="font-semibold tabular-nums">{fmtBRL(metaTotal.realizado)}</span>
          </div>
          <Progress value={Math.min(100, metaPct)} className="h-3" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Meta: {fmtBRL(metaTotal.meta)}</span>
            <span>
              {metaPct.toFixed(1)}% • falta {fmtBRL(metaFalta)}
            </span>
          </div>
          <div className="pt-2">
            <RankingTable
              rows={metas.data ?? []}
              columns={[
                { key: 'alvo', label: 'Alvo' },
                { key: 'meta', label: 'Meta', align: 'right', format: 'currency' },
                { key: 'realizado', label: 'Realizado', align: 'right', format: 'currency' },
                { key: 'percent', label: '% Atingido', align: 'right', format: 'percent' },
                { key: 'faltante', label: 'Falta', align: 'right', format: 'currency' },
              ]}
              limit={20}
            />
          </div>
        </div>
      </ExecutiveSection>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Funil */}
        <ExecutiveSection
          title="Funil do vendedor"
          isLoading={pipeline.isLoading}
          error={pipeline.error}
          isEmpty={!(pipeline.data?.por_etapa?.length)}
        >
          <RankingTable
            rows={pipeline.data?.por_etapa ?? []}
            columns={[
              { key: 'stage', label: 'Etapa' },
              { key: 'qtd', label: 'Negócios', align: 'right', format: 'number' },
              { key: 'valor', label: 'Valor', align: 'right', format: 'currency' },
              { key: 'dias_medio', label: 'Dias médios', align: 'right', format: 'number' },
            ]}
            limit={15}
          />
        </ExecutiveSection>

        {/* Conversão */}
        <ExecutiveSection
          title="Conversão de propostas"
          isLoading={perdasCot.isLoading}
          error={perdasCot.error}
          isEmpty={!perdasCot.data?.kpis}
        >
          {perdasCot.data?.kpis && (
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Emitidas', v: perdasCot.data.kpis.emitidas, fmt: 'num' },
                { label: 'Aprovadas', v: perdasCot.data.kpis.aprovadas, fmt: 'num' },
                { label: 'Recusadas', v: perdasCot.data.kpis.recusadas, fmt: 'num' },
                { label: 'Expiradas', v: perdasCot.data.kpis.expiradas, fmt: 'num' },
                { label: 'Valor aprovado', v: perdasCot.data.kpis.valor_aprovado, fmt: 'brl' },
                { label: 'Aproveitamento', v: perdasCot.data.taxa_aproveitamento, fmt: 'pct' },
              ].map((x, i) => (
                <div key={i} className="border rounded-md p-3">
                  <div className="text-[11px] uppercase text-muted-foreground">{x.label}</div>
                  <div className="text-lg font-semibold tabular-nums">
                    {x.fmt === 'brl'
                      ? fmtBRL(Number(x.v || 0))
                      : x.fmt === 'pct'
                      ? `${Number(x.v || 0).toFixed(1)}%`
                      : new Intl.NumberFormat('pt-BR').format(Number(x.v || 0))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ExecutiveSection>

        {/* Perdas */}
        <ExecutiveSection
          title="Perdas por motivo"
          isLoading={perdasAt.isLoading || perdasCot.isLoading}
          error={perdasAt.error || perdasCot.error}
          isEmpty={motivosPerda.length === 0}
        >
          <RankingTable
            rows={motivosPerda}
            columns={[
              { key: 'motivo', label: 'Motivo' },
              { key: 'origem', label: 'Origem', align: 'center' },
              { key: 'qtd', label: 'Qtd', align: 'right', format: 'number' },
              { key: 'valor', label: 'Valor', align: 'right', format: 'currency' },
            ]}
            limit={10}
          />
        </ExecutiveSection>

        {/* Clientes do vendedor */}
        <ExecutiveSection
          title="Top clientes do vendedor"
          isLoading={cliente.isLoading}
          error={cliente.error}
          isEmpty={(cliente.data ?? []).length === 0}
        >
          <RankingTable
            rows={cliente.data ?? []}
            columns={[
              { key: 'nome', label: 'Cliente' },
              { key: 'valor_vendido', label: 'Vendido', align: 'right', format: 'currency' },
              { key: 'qtd_pedidos', label: 'Pedidos', align: 'right', format: 'number' },
              { key: 'abc', label: 'ABC', align: 'center' },
            ]}
            limit={10}
          />
        </ExecutiveSection>

        {/* Produtos do vendedor */}
        <ExecutiveSection
          title="Top produtos do vendedor"
          isLoading={produto.isLoading}
          error={produto.error}
          isEmpty={(produto.data ?? []).length === 0}
        >
          <RankingTable
            rows={produto.data ?? []}
            columns={[
              { key: 'nome', label: 'Produto' },
              { key: 'valor_vendido', label: 'Vendido', align: 'right', format: 'currency' },
              { key: 'quantidade', label: 'Qtd', align: 'right', format: 'number' },
              { key: 'participacao_pct', label: '% Total', align: 'right', format: 'percent' },
            ]}
            limit={10}
          />
        </ExecutiveSection>

        {/* Comparativo */}
        <ExecutiveSection
          title="Comparativo no ranking"
          description="Posição do vendedor entre os demais"
          isLoading={rankingAll.isLoading}
          error={rankingAll.error}
          isEmpty={posicao.posicao === null}
        >
          <div className="flex flex-col items-center justify-center py-6 gap-2">
            <div className="text-5xl font-bold tabular-nums text-primary">
              #{posicao.posicao}
            </div>
            <div className="text-sm text-muted-foreground">
              entre {posicao.total} vendedores por faturamento
            </div>
          </div>
        </ExecutiveSection>
      </div>

      <Card className="p-3 text-xs text-muted-foreground flex items-center gap-2">
        <Clock className="h-3.5 w-3.5" />
        Atividades, tarefas atrasadas e follow-ups serão incorporados em uma próxima fase
        (depende de hook agregado por vendedor).
      </Card>
    </div>
  );
}
