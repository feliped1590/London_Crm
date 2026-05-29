import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CalendarIcon, Trophy, TrendingUp, ArrowUpDown, Maximize2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
  PieChart,
  Pie,
  ReferenceLine,
} from 'recharts';
import {
  useSellerProductivity,
  type PeriodFilter,
} from '@/hooks/useSellerProductivity';

const PERIOD_OPTIONS: { value: PeriodFilter; label: string }[] = [
  { value: 'today', label: 'Hoje' },
  { value: '7days', label: 'Últimos 7 dias' },
  { value: 'month', label: 'Este mês' },
  { value: 'custom', label: 'Personalizado' },
];

const COLORS = [
  'hsl(var(--primary))',
  'hsl(210, 70%, 55%)',
  'hsl(190, 65%, 50%)',
  'hsl(170, 60%, 45%)',
  'hsl(150, 55%, 45%)',
  'hsl(130, 50%, 45%)',
  'hsl(220, 60%, 60%)',
  'hsl(240, 50%, 55%)',
  'hsl(260, 45%, 55%)',
  'hsl(280, 40%, 55%)',
];

type SortField = 'interaction_score' | 'total_interactions';
type ChartType = 'vertical' | 'horizontal' | 'pie';

const CHART_OPTIONS: { value: ChartType; label: string }[] = [
  { value: 'vertical', label: 'Barras Verticais' },
  { value: 'horizontal', label: 'Barras Horizontais' },
  { value: 'pie', label: 'Pizza (Participação)' },
];

const RANK_LABELS: Record<number, { emoji: string; variant: 'default' | 'secondary' | 'outline' }> = {
  1: { emoji: '🥇', variant: 'default' },
  2: { emoji: '🥈', variant: 'secondary' },
  3: { emoji: '🥉', variant: 'outline' },
};

export function SellerProductivityReport() {
  const {
    data,
    isLoading,
    period,
    setPeriod,
    customStart,
    setCustomStart,
    customEnd,
    setCustomEnd,
    dateRange,
    targetMap,
    managers,
    isLoadingManagers,
    selectedManagerId,
    setSelectedManagerId,
    mode,
    setMode,
  } = useSellerProductivity();

  const [sortBy, setSortBy] = useState<SortField>('interaction_score');
  const [chartType, setChartType] = useState<ChartType>('vertical');
  const [expanded, setExpanded] = useState(false);

  const sorted = [...data].sort((a, b) => b[sortBy] - a[sortBy]);

  const chartData = sorted.map((row) => ({
    name: row.seller_name.split(' ').slice(0, 2).join(' '),
    score: row.interaction_score,
    interacoes: row.total_interactions,
    participacao: row.participation_percent,
    meta: targetMap.get(row.seller_id) ?? null,
  }));

  const topSeller = sorted[0];
  const dataKey = sortBy === 'interaction_score' ? 'score' : 'interacoes';
  const dataLabel = sortBy === 'interaction_score' ? 'Score' : 'Interações';

  // Compute average target for reference line (only when sorting by score)
  const avgTarget = sortBy === 'interaction_score' && targetMap.size > 0
    ? Math.round([...targetMap.values()].reduce((a, b) => a + b, 0) / targetMap.size)
    : null;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-1 block">Agrupar por</label>
          <Select value={mode} onValueChange={(v) => setMode(v as 'user' | 'sales_rep')}>
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="user">Usuário (quem operou)</SelectItem>
              <SelectItem value="sales_rep">Vendedor (sales_rep)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium text-muted-foreground mb-1 block">Período</label>
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodFilter)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {period === 'custom' && (
          <>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[160px] justify-start">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {customStart ? format(customStart, 'dd/MM/yyyy') : 'Início'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={customStart} onSelect={setCustomStart} locale={ptBR} />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[160px] justify-start">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {customEnd ? format(customEnd, 'dd/MM/yyyy') : 'Fim'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={customEnd} onSelect={setCustomEnd} locale={ptBR} />
              </PopoverContent>
            </Popover>
          </>
        )}

        <div>
          <label className="text-sm font-medium text-muted-foreground mb-1 block">Gerente</label>
          <Select
            value={selectedManagerId ?? 'all'}
            onValueChange={(value) => setSelectedManagerId(value === 'all' ? undefined : value)}
            disabled={isLoadingManagers}
          >
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Todos os vendedores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os vendedores</SelectItem>
              {managers.map((manager) => (
                <SelectItem key={manager.id} value={manager.id}>
                  {manager.label ? `${manager.name} (${manager.label})` : manager.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="ml-auto text-sm text-muted-foreground">
          {format(dateRange.start, "dd/MM/yyyy", { locale: ptBR })} — {format(dateRange.end, "dd/MM/yyyy", { locale: ptBR })}
        </div>
      </div>

      <div className="rounded-md border border-dashed border-muted-foreground/30 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        {mode === 'user' ? (
          <>
            <strong>Modo Usuário:</strong> conta interações de quem operou o sistema (criou atividade, tarefa, proposta, pedido etc.). Útil para medir adoção e uso do CRM.
          </>
        ) : (
          <>
            <strong>Modo Vendedor:</strong> conta interações atribuídas ao vendedor responsável pela empresa/negócio, mesmo quando lançadas por outro usuário (admin, back-office). Tarefas e e-mails sem vínculo a empresa não entram nesse modo.
          </>
        )}
      </div>

      {/* Top seller highlight */}
      {topSeller && !isLoading && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex items-center gap-4 py-4">
            <Trophy className="h-8 w-8 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">{mode === 'sales_rep' ? 'Vendedor mais produtivo' : 'Usuário mais produtivo'}</p>
              <p className="text-lg font-bold text-foreground">{topSeller.seller_name}</p>
            </div>
            <div className="ml-auto flex gap-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{topSeller.interaction_score}</p>
                <p className="text-xs text-muted-foreground">Score</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">{topSeller.total_interactions}</p>
                <p className="text-xs text-muted-foreground">Interações</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">{topSeller.participation_percent}%</p>
                <p className="text-xs text-muted-foreground">Participação</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Chart */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Ranking de Produtividade
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={chartType} onValueChange={(v) => setChartType(v as ChartType)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHART_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortField)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="interaction_score">Por Score</SelectItem>
                <SelectItem value="total_interactions">Por Interações</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[350px] w-full" />
          ) : data.length === 0 ? (
            <div className="flex items-center justify-center h-[200px] text-muted-foreground">
              {selectedManagerId ? 'Nenhuma interação encontrada para a equipe selecionada' : 'Nenhuma interação encontrada no período selecionado'}
            </div>
          ) : chartType === 'vertical' ? (
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={chartData} margin={{ left: 10, right: 30, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} angle={-25} textAnchor="end" height={60} />
                <YAxis />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    value,
                    name === 'score' ? 'Score' : name === 'meta' ? 'Meta' : 'Interações',
                  ]}
                />
                <Legend />
                {avgTarget && sortBy === 'interaction_score' && (
                  <ReferenceLine y={avgTarget} stroke="hsl(var(--destructive))" strokeDasharray="6 4" label={{ value: `Meta: ${avgTarget}`, position: 'insideTopRight', fill: 'hsl(var(--destructive))', fontSize: 12 }} />
                )}
                <Bar dataKey={dataKey} name={dataLabel} radius={[6, 6, 0, 0]}>
                  {chartData.map((entry, i) => {
                    const target = entry.meta;
                    const score = entry.score;
                    const isBelowTarget = target != null && sortBy === 'interaction_score' && score < target;
                    return (
                      <Cell key={i} fill={isBelowTarget ? 'hsl(var(--destructive))' : COLORS[i % COLORS.length]} opacity={isBelowTarget ? 0.7 : 1} />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : chartType === 'horizontal' ? (
            <ResponsiveContainer width="100%" height={Math.max(300, sorted.length * 50)}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 13 }} />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    value,
                    name === 'score' ? 'Score' : 'Interações',
                  ]}
                />
                <Legend />
                {avgTarget && sortBy === 'interaction_score' && (
                  <ReferenceLine x={avgTarget} stroke="hsl(var(--destructive))" strokeDasharray="6 4" label={{ value: `Meta: ${avgTarget}`, position: 'insideTopRight', fill: 'hsl(var(--destructive))', fontSize: 12 }} />
                )}
                <Bar dataKey={dataKey} name={dataLabel} radius={[0, 6, 6, 0]}>
                  {chartData.map((entry, i) => {
                    const target = entry.meta;
                    const score = entry.score;
                    const isBelowTarget = target != null && sortBy === 'interaction_score' && score < target;
                    return (
                      <Cell key={i} fill={isBelowTarget ? 'hsl(var(--destructive))' : COLORS[i % COLORS.length]} opacity={isBelowTarget ? 0.7 : 1} />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="participacao"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={120}
                  label={({ name, participacao }) => `${name}: ${participacao}%`}
                >
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [`${value}%`, 'Participação']} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Detail table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowUpDown className="h-5 w-5" />
            Detalhamento por Tipo de Interação
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[200px] w-full" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-background z-10">#</TableHead>
                    <TableHead className="sticky left-10 bg-background z-10">{mode === 'sales_rep' ? 'Vendedor' : 'Usuário'}</TableHead>
                    <TableHead className="text-center">Atividades</TableHead>
                    <TableHead className="text-center">Tarefas Criadas</TableHead>
                    <TableHead className="text-center">Tarefas Concluídas</TableHead>
                    <TableHead className="text-center">Mudanças Etapa</TableHead>
                    <TableHead className="text-center">Propostas</TableHead>
                    <TableHead className="text-center">Pedidos</TableHead>
                    <TableHead className="text-center">E-mails</TableHead>
                    <TableHead className="text-center">Observações</TableHead>
                    <TableHead className="text-center">Atualiz. Negócios</TableHead>
                    <TableHead className="text-center font-bold">Total</TableHead>
                    <TableHead className="text-center font-bold">Score</TableHead>
                    <TableHead className="text-center font-bold">Meta</TableHead>
                    <TableHead className="text-center font-bold">Status</TableHead>
                    <TableHead className="text-center font-bold">Part. %</TableHead>
                    <TableHead className="text-center font-bold">Eficiência</TableHead>
                    <TableHead className="text-center font-bold">Conv. Proposta</TableHead>
                    <TableHead className="text-center font-bold">Conv. Pipeline</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((row) => {
                    const rankInfo = RANK_LABELS[row.rank_position];
                    const target = targetMap.get(row.seller_id);
                    const hasTarget = target != null;
                    const metTarget = hasTarget && row.interaction_score >= target;
                    const progressPct = hasTarget ? Math.min(Math.round((row.interaction_score / target) * 100), 100) : null;

                    return (
                      <TableRow key={row.seller_id}>
                        <TableCell className="sticky left-0 bg-background z-10 text-center font-medium">
                          {rankInfo ? (
                            <Badge variant={rankInfo.variant} className="text-xs px-1.5">
                              {rankInfo.emoji} {row.rank_position}º
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">{row.rank_position}º</span>
                          )}
                        </TableCell>
                        <TableCell className="sticky left-10 bg-background z-10 font-medium">
                          {row.seller_name}
                        </TableCell>
                        <TableCell className="text-center">{row.activities}</TableCell>
                        <TableCell className="text-center">{row.tasks_created}</TableCell>
                        <TableCell className="text-center">{row.tasks_completed}</TableCell>
                        <TableCell className="text-center">{row.stage_changes}</TableCell>
                        <TableCell className="text-center">{row.proposals}</TableCell>
                        <TableCell className="text-center">{row.orders}</TableCell>
                        <TableCell className="text-center">{row.emails}</TableCell>
                        <TableCell className="text-center">{row.notes}</TableCell>
                        <TableCell className="text-center">{row.deal_updates}</TableCell>
                        <TableCell className="text-center font-bold">{row.total_interactions}</TableCell>
                        <TableCell className="text-center font-bold text-primary">{row.interaction_score}</TableCell>
                        <TableCell className="text-center">
                          {hasTarget ? target : <span className="text-muted-foreground text-xs">—</span>}
                        </TableCell>
                        <TableCell className="text-center min-w-[120px]">
                          {hasTarget ? (
                            <div className="flex flex-col items-center gap-1">
                              <Badge variant={metTarget ? 'default' : 'destructive'} className="text-[10px]">
                                {metTarget ? '🟢 Atingida' : '🔴 Abaixo'}
                              </Badge>
                              <Progress value={progressPct ?? 0} className="h-1.5 w-20" />
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center font-bold">{row.participation_percent}%</TableCell>
                        <TableCell className="text-center font-bold">
                          <Badge variant={row.efficiency_rate >= 5 ? 'default' : 'secondary'} className="text-[10px]">
                            {row.efficiency_rate}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center font-bold">
                          <Badge variant={row.proposal_conversion_rate >= 30 ? 'default' : 'secondary'} className="text-[10px]">
                            {row.proposal_conversion_rate}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center font-bold">
                          <Badge variant={row.pipeline_conversion_rate >= 10 ? 'default' : 'secondary'} className="text-[10px]">
                            {row.pipeline_conversion_rate}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
