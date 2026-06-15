import { useEffect, useMemo } from 'react';
import {
  DollarSign,
  ShoppingCart,
  Users,
  TrendingUp,
  TrendingDown,
  Target,
  Package,
  Building2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import { useBIReport } from '@/hooks/useBIReports';
import { ExecutiveFilters } from './ExecutiveFiltersBar';
import { ExecutiveKpiGrid, KpiItem } from './ExecutiveKpiGrid';
import { ExecutiveSection } from './ExecutiveSection';
import { RankingTable } from './RankingTable';
import { ForecastSummaryCard } from './ForecastSummaryCard';
import { BI_COLORS } from './biTheme';
import { useLegalEntities } from '@/hooks/useLegalEntities';

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v || 0);

interface Props {
  filters: ExecutiveFilters;
  onStatusChange?: (status: { isLoading: boolean; isEmpty: boolean }) => void;
}

export function CommercialExecutiveReport({ filters, onStatusChange }: Props) {
  const baseFilters = {
    startDate: filters.startDate,
    endDate: filters.endDate,
    legalEntityId: filters.legalEntityId ?? undefined,
  };

  const dashboard = useBIReport<any>('dashboard_executivo', baseFilters);
  const entidade = useBIReport<any[]>('vendas_entidade', baseFilters);
  const vendedor = useBIReport<any[]>('vendas_vendedor', baseFilters);
  const cliente = useBIReport<any[]>('vendas_cliente', baseFilters);
  const produto = useBIReport<any[]>('vendas_produto', baseFilters);
  const pipeline = useBIReport<any>('pipeline_comercial', baseFilters);
  const perdasAt = useBIReport<any>('perdas_atendimento', baseFilters);
  const perdasCot = useBIReport<any>('perdas_cotacao', baseFilters);
  const forecast = useBIReport<any>('forecast_vendas', baseFilters);
  const conversao = useBIReport<any>('conversao', baseFilters);

  const { activeLegalEntityId } = useLegalEntities();
  const filterEntityId = filters.legalEntityId ?? activeLegalEntityId ?? null;

  const k = dashboard.data?.kpis ?? {};
  const valorPerdido =
    (Number(perdasAt.data?.valor_perdido) || 0) + (Number(perdasCot.data?.kpis?.valor_perdido) || 0);

  const kpis: KpiItem[] = [
    { key: 'valor', label: 'Valor vendido', value: k.valor_vendido, format: 'currency', icon: DollarSign, tone: 'primary' },
    { key: 'qtd', label: 'Pedidos', value: k.qtd_pedidos, format: 'number', icon: ShoppingCart, tone: 'secondary' },
    { key: 'ticket', label: 'Ticket médio', value: k.ticket_medio, format: 'currency', icon: TrendingUp, tone: 'secondary' },
    { key: 'clientes', label: 'Clientes atendidos', value: k.clientes_atendidos, format: 'number', icon: Users, tone: 'secondary' },
    {
      key: 'conv',
      label: 'Conversão',
      value: conversao.data?.taxa_conversao_venda,
      format: 'percent',
      icon: Target,
      tone: 'success',
    },
    { key: 'perdido', label: 'Valor perdido', value: valorPerdido, format: 'currency', icon: TrendingDown, tone: 'danger' },
  ];

  // Evolução: agregar por mês se período > 60 dias
  const evolucao = useMemo(() => {
    const raw: { dia: string; total: number }[] = dashboard.data?.evolucao ?? [];
    const days = Math.round((filters.endDate.getTime() - filters.startDate.getTime()) / 86400000);
    if (days <= 60) return raw.map((r) => ({ label: r.dia?.slice(5), total: Number(r.total) }));
    const map = new Map<string, number>();
    raw.forEach((r) => {
      const ym = r.dia?.slice(0, 7);
      map.set(ym, (map.get(ym) ?? 0) + Number(r.total || 0));
    });
    return Array.from(map.entries()).map(([label, total]) => ({ label, total }));
  }, [dashboard.data, filters.startDate, filters.endDate]);

  // Aplica filtro client-side de entidade ativa nos blocos que carregam legal_entity_id
  const entidadeRows = entidade.data ?? [];

  const motivosPerda = useMemo(() => {
    const at = (perdasAt.data?.por_motivo ?? []).map((m: any) => ({
      motivo: m.motivo,
      valor: Number(m.valor || 0),
      qtd: Number(m.qtd || 0),
      origem: 'Atendimento',
    }));
    const co = (perdasCot.data?.por_motivo ?? []).map((m: any) => ({
      motivo: m.motivo,
      valor: Number(m.valor || 0),
      qtd: Number(m.qtd || 0),
      origem: 'Cotação',
    }));
    return [...at, ...co].sort((a, b) => b.valor - a.valor);
  }, [perdasAt.data, perdasCot.data]);

  // Status agregado (loading / vazio) para o botão de exportação
  const mainLoading =
    dashboard.isLoading ||
    entidade.isLoading ||
    vendedor.isLoading ||
    cliente.isLoading ||
    produto.isLoading ||
    pipeline.isLoading;
  const mainEmpty =
    !mainLoading &&
    !(Number(k.valor_vendido) || 0) &&
    (entidadeRows.length === 0) &&
    ((vendedor.data ?? []).length === 0) &&
    ((cliente.data ?? []).length === 0) &&
    ((produto.data ?? []).length === 0);

  useEffect(() => {
    onStatusChange?.({ isLoading: mainLoading, isEmpty: mainEmpty });
  }, [mainLoading, mainEmpty, onStatusChange]);

  return (
    <div id="bi-export-executivo_comercial" className="bi-executive space-y-4">


      {/* KPIs */}
      <ExecutiveKpiGrid items={kpis} isLoading={dashboard.isLoading} columns={6} />

      {/* Evolução */}
      <ExecutiveSection
        title="Evolução de vendas"
        isLoading={dashboard.isLoading}
        error={dashboard.error}
        isEmpty={evolucao.length === 0}
      >
        <div className="h-64">
          <ResponsiveContainer>
            <AreaChart data={evolucao}>
              <defs>
                <linearGradient id="evol" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={BI_COLORS.primary} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={BI_COLORS.primary} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={BI_COLORS.grid} opacity={0.6} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: BI_COLORS.muted }} stroke={BI_COLORS.grid} />
              <YAxis tick={{ fontSize: 11, fill: BI_COLORS.muted }} tickFormatter={(v) => fmtBRL(v)} width={80} stroke={BI_COLORS.grid} />
              <Tooltip formatter={(v: any) => fmtBRL(Number(v))} contentStyle={{ borderRadius: 8, border: `1px solid ${BI_COLORS.border}` }} />
              <Area
                type="monotone"
                dataKey="total"
                stroke={BI_COLORS.primary}
                fill="url(#evol)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </ExecutiveSection>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Vendas por entidade */}
        <ExecutiveSection
          title="Vendas por entidade jurídica"
          isLoading={entidade.isLoading}
          error={entidade.error}
          isEmpty={entidadeRows.length === 0}
        >
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={entidadeRows} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke={BI_COLORS.grid} opacity={0.6} />
                <XAxis type="number" tick={{ fontSize: 11, fill: BI_COLORS.muted }} tickFormatter={fmtBRL} stroke={BI_COLORS.grid} />
                <YAxis dataKey="nome" type="category" tick={{ fontSize: 11, fill: BI_COLORS.muted }} width={140} stroke={BI_COLORS.grid} />
                <Tooltip formatter={(v: any) => fmtBRL(Number(v))} contentStyle={{ borderRadius: 8, border: `1px solid ${BI_COLORS.border}` }} />
                <Bar dataKey="valor_vendido" radius={[0, 4, 4, 0]}>
                  {entidadeRows.map((r: any, i: number) => (
                    <Cell
                      key={i}
                      fill={
                        filterEntityId && r.legal_entity_id === filterEntityId
                          ? BI_COLORS.primary
                          : BI_COLORS.secondary
                      }
                      fillOpacity={filterEntityId && r.legal_entity_id !== filterEntityId ? 0.55 : 1}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ExecutiveSection>

        {/* Ranking vendedores */}
        <ExecutiveSection
          title="Ranking de vendedores"
          isLoading={vendedor.isLoading}
          error={vendedor.error}
          isEmpty={(vendedor.data ?? []).length === 0}
        >
          <RankingTable
            rows={vendedor.data ?? []}
            columns={[
              { key: 'nome', label: 'Vendedor' },
              { key: 'valor_vendido', label: 'Vendido', align: 'right', format: 'currency' },
              { key: 'qtd_pedidos', label: 'Pedidos', align: 'right', format: 'number' },
              { key: 'ticket_medio', label: 'Ticket', align: 'right', format: 'currency' },
            ]}
            limit={10}
          />
        </ExecutiveSection>

        {/* Top clientes */}
        <ExecutiveSection
          title="Top clientes"
          isLoading={cliente.isLoading}
          error={cliente.error}
          isEmpty={(cliente.data ?? []).length === 0}
        >
          <RankingTable
            rows={cliente.data ?? []}
            columns={[
              { key: 'nome', label: 'Cliente' },
              { key: 'valor_vendido', label: 'Faturamento', align: 'right', format: 'currency' },
              { key: 'qtd_pedidos', label: 'Pedidos', align: 'right', format: 'number' },
              { key: 'abc', label: 'ABC', align: 'center' },
            ]}
            limit={10}
          />
        </ExecutiveSection>

        {/* Top produtos */}
        <ExecutiveSection
          title="Top produtos"
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

        {/* Funil comercial */}
        <ExecutiveSection
          title="Funil comercial"
          description="Distribuição de negócios em aberto por etapa"
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

        {/* Perdas */}
        <ExecutiveSection
          title="Principais motivos de perda"
          description="Combina perdas de atendimento e cotação"
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
      </div>

      {/* Forecast */}
      <ExecutiveSection
        title="Forecast / carteira"
        description="Projeção baseada em probabilidade por etapa"
        isLoading={forecast.isLoading}
        error={forecast.error}
        isEmpty={!forecast.data || (Array.isArray(forecast.data) && forecast.data.length === 0)}
        emptyMessage="Dados de forecast insuficientes neste período."
      >
        {Array.isArray(forecast.data) ? (
          <RankingTable
            rows={forecast.data}
            columns={[
              { key: 'stage', label: 'Etapa' },
              { key: 'qtd', label: 'Negócios', align: 'right', format: 'number' },
              { key: 'valor', label: 'Valor', align: 'right', format: 'currency' },
              { key: 'forecast', label: 'Forecast', align: 'right', format: 'currency' },
            ]}
            limit={10}
          />
        ) : forecast.data ? (
          <pre className="text-xs overflow-auto">{JSON.stringify(forecast.data, null, 2)}</pre>
        ) : null}
      </ExecutiveSection>
    </div>
  );
}
