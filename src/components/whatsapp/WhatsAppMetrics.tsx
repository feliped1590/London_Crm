import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  useWhatsAppMetrics, 
  useVolumeByDay, 
  useVolumeByHour,
  useSellerPerformance,
  useResponseTimeTrend 
} from '@/hooks/useWhatsAppMetrics';
import { 
  Clock, 
  MessageSquare, 
  Users, 
  TrendingUp,
  ArrowDownLeft,
  ArrowUpRight,
  Timer,
  Trophy,
  Percent
} from 'lucide-react';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  ResponsiveContainer,
  LineChart,
  Line,
  Tooltip,
  Legend,
  CartesianGrid
} from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Helper to format minutes to readable time
function formatMinutes(minutes: number | null): string {
  if (minutes === null) return '—';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
}

// Helper to get response time badge color
function getResponseTimeBadge(minutes: number | null): { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string } {
  if (minutes === null) return { variant: 'outline', label: 'Sem dados' };
  if (minutes <= 5) return { variant: 'default', label: 'Excelente' };
  if (minutes <= 15) return { variant: 'secondary', label: 'Bom' };
  if (minutes <= 60) return { variant: 'outline', label: 'Médio' };
  return { variant: 'destructive', label: 'Lento' };
}

export function WhatsAppMetrics() {
  const { data: metrics, isLoading: metricsLoading } = useWhatsAppMetrics(30);
  const { data: volumeByDay, isLoading: volumeLoading } = useVolumeByDay(30);
  const { data: volumeByHour, isLoading: hourLoading } = useVolumeByHour(30);
  const { data: sellerPerformance, isLoading: sellerLoading } = useSellerPerformance(30);
  const { data: responseTrend, isLoading: trendLoading } = useResponseTimeTrend(30);

  const chartConfig = {
    inbound: {
      label: 'Recebidas',
      color: 'hsl(var(--primary))',
    },
    outbound: {
      label: 'Enviadas',
      color: 'hsl(var(--secondary))',
    },
    total: {
      label: 'Total',
      color: 'hsl(var(--accent))',
    },
    avgMinutes: {
      label: 'Tempo médio (min)',
      color: 'hsl(var(--primary))',
    },
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Tempo de Primeira Resposta */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Primeira Resposta</CardTitle>
            <Timer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {formatMinutes(metrics?.avgFirstResponseTime ?? null)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Tempo médio para responder
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Tempo de Resposta */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Tempo de Resposta</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {formatMinutes(metrics?.avgResponseTime ?? null)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Entre mensagens
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Conversas Ativas */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Conversas Ativas</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {metrics?.activeConversations ?? 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Últimos 7 dias
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Taxa de Resposta */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Resposta</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {metrics?.responseRate ?? 0}%
                </div>
                <p className="text-xs text-muted-foreground">
                  Conversas respondidas
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Message Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total de Mensagens</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{metrics?.totalMessages ?? 0}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Recebidas</CardTitle>
            <ArrowDownLeft className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold text-green-600">
                {metrics?.inboundMessages ?? 0}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Enviadas</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold text-blue-600">
                {metrics?.outboundMessages ?? 0}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Volume by Day of Week */}
        <Card>
          <CardHeader>
            <CardTitle>Volume por Dia da Semana</CardTitle>
            <CardDescription>Mensagens nos últimos 30 dias</CardDescription>
          </CardHeader>
          <CardContent>
            {volumeLoading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : (
              <ChartContainer config={chartConfig} className="h-[250px] w-full">
                <BarChart data={volumeByDay} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <XAxis dataKey="dayName" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="inbound" fill="var(--color-inbound)" name="Recebidas" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="outbound" fill="var(--color-outbound)" name="Enviadas" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* Volume by Hour */}
        <Card>
          <CardHeader>
            <CardTitle>Volume por Hora</CardTitle>
            <CardDescription>Horários de pico de mensagens</CardDescription>
          </CardHeader>
          <CardContent>
            {hourLoading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : (
              <ChartContainer config={chartConfig} className="h-[250px] w-full">
                <BarChart data={volumeByHour} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <XAxis 
                    dataKey="label" 
                    tick={{ fontSize: 10 }}
                    interval={2}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="total" fill="var(--color-total)" name="Total" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Response Time Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Evolução do Tempo de Resposta</CardTitle>
          <CardDescription>Tempo médio de resposta por dia</CardDescription>
        </CardHeader>
        <CardContent>
          {trendLoading ? (
            <Skeleton className="h-[250px] w-full" />
          ) : responseTrend && responseTrend.length > 0 ? (
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
              <LineChart data={responseTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 10 }}
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    return `${date.getDate()}/${date.getMonth() + 1}`;
                  }}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <ChartTooltip 
                  content={<ChartTooltipContent />}
                  labelFormatter={(value) => {
                    const date = new Date(value);
                    return date.toLocaleDateString('pt-BR');
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="avgMinutes" 
                  stroke="var(--color-avgMinutes)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name="Tempo médio (min)"
                />
              </LineChart>
            </ChartContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground">
              Sem dados de resposta no período
            </div>
          )}
        </CardContent>
      </Card>

      {/* Seller Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            Ranking de Vendedores
          </CardTitle>
          <CardDescription>Performance por tempo de resposta (últimos 30 dias)</CardDescription>
        </CardHeader>
        <CardContent>
          {sellerLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : sellerPerformance && sellerPerformance.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead className="text-center">Tempo Médio</TableHead>
                  <TableHead className="text-center">Conversas</TableHead>
                  <TableHead className="text-center">Mensagens</TableHead>
                  <TableHead className="text-center">Taxa Resposta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sellerPerformance.map((seller, index) => {
                  const badge = getResponseTimeBadge(seller.avgResponseTime);
                  return (
                    <TableRow key={seller.userId}>
                      <TableCell className="font-medium">
                        {index === 0 && <span className="text-amber-500">🥇</span>}
                        {index === 1 && <span className="text-gray-400">🥈</span>}
                        {index === 2 && <span className="text-amber-700">🥉</span>}
                        {index > 2 && <span className="text-muted-foreground">{index + 1}</span>}
                      </TableCell>
                      <TableCell>{seller.userName}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span>{formatMinutes(seller.avgResponseTime)}</span>
                          <Badge variant={badge.variant} className="text-xs">
                            {badge.label}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">{seller.totalConversations}</TableCell>
                      <TableCell className="text-center">{seller.totalMessages}</TableCell>
                      <TableCell className="text-center">
                        <span className={cn(
                          "font-medium",
                          seller.responseRate >= 90 ? "text-green-600" :
                          seller.responseRate >= 70 ? "text-amber-600" : "text-red-600"
                        )}>
                          {seller.responseRate}%
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum dado de vendedor disponível
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
