/**
 * CustomerSyncMonitor — painel de testes da sincronização CRM → ERP de clientes.
 *
 * Mostra em tempo real:
 *  - Distribuição da fila por status
 *  - Últimos resultados (sucesso, erro, unknown pattern)
 *  - Taxa de "unknown pattern" (alerta de mudança no ERP)
 *  - Botões de teste: liberar 1 cliente / liberar lote / pausar tudo
 *  - Disparar processamento manual da fila
 */

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  Send,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { ERP_SYNC_PAUSED } from '@/config/features';

interface QueueStatusRow {
  status: string;
  total: number;
}

interface RecentLog {
  id: string;
  status: string;
  external_id: string | null;
  created_at: string;
  entity_id: string | null;
  response_payload: any;
  company_name?: string;
}

const REFRESH_INTERVAL_MS = 5000;

function statusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'completed' || status === 'success') return 'default';
  if (status === 'error' || status === 'failed') return 'destructive';
  if (status === 'paused') return 'outline';
  return 'secondary';
}

export function CustomerSyncMonitor() {
  const queryClient = useQueryClient();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isReleasing, setIsReleasing] = useState(false);

  // 1) Distribuição da fila
  const { data: queueStats = [] } = useQuery<QueueStatusRow[]>({
    queryKey: ['customer-sync-monitor', 'queue-stats'],
    refetchInterval: REFRESH_INTERVAL_MS,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('execute_sql_count_queue');
      if (error || !data) {
        // Fallback direto
        const { data: rows, error: e2 } = await supabase
          .from('company_sync_queue')
          .select('status');
        if (e2) throw e2;
        const counts: Record<string, number> = {};
        (rows || []).forEach((r: any) => {
          counts[r.status] = (counts[r.status] || 0) + 1;
        });
        return Object.entries(counts).map(([status, total]) => ({ status, total }));
      }
      return data;
    },
  });

  // 2) Últimos 20 logs de sync de clientes
  const { data: recentLogs = [] } = useQuery<RecentLog[]>({
    queryKey: ['customer-sync-monitor', 'recent-logs'],
    refetchInterval: REFRESH_INTERVAL_MS,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('erp_sync_logs')
        .select('id, status, external_id, created_at, entity_id, response_payload')
        .eq('entity_type', 'company')
        .eq('direction', 'crm_to_erp')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;

      // Buscar nomes das companies para enriquecer
      const ids = (data || [])
        .map((l) => l.entity_id)
        .filter((x): x is string => !!x);
      let nameMap: Record<string, string> = {};
      if (ids.length > 0) {
        const { data: companies } = await supabase
          .from('companies')
          .select('id, name')
          .in('id', ids);
        nameMap = Object.fromEntries((companies || []).map((c) => [c.id, c.name]));
      }
      return (data || []).map((l) => ({ ...l, company_name: l.entity_id ? nameMap[l.entity_id] : undefined }));
    },
  });

  // 3) Métricas derivadas
  const metrics = useMemo(() => {
    const totalQueue = queueStats.reduce((acc, s) => acc + s.total, 0);
    const byStatus = Object.fromEntries(queueStats.map((s) => [s.status, s.total]));

    const last20 = recentLogs;
    const successCount = last20.filter((l) => l.status === 'success').length;
    const errorCount = last20.filter((l) => l.status === 'error').length;
    const unknownCount = last20.filter((l) => {
      const parsed = l.response_payload?.parsed;
      return parsed && parsed.matchedPattern === null;
    }).length;
    const unknownRate = last20.length > 0 ? (unknownCount / last20.length) * 100 : 0;

    return { totalQueue, byStatus, successCount, errorCount, unknownCount, unknownRate };
  }, [queueStats, recentLogs]);

  // ─── Ações ────────────────────────────────────────────────
  const releaseOne = async () => {
    if (ERP_SYNC_PAUSED) {
      toast.warning('Sincronização ERP temporariamente bloqueada.');
      return;
    }
    setIsReleasing(true);
    try {
      // Buscar 1 cliente pausado com dados completos
      const { data: candidates, error: e1 } = await supabase
        .from('companies')
        .select('id, name, cnpj')
        .is('erp_code', null)
        .eq('active', true)
        .not('cnpj', 'is', null)
        .not('address', 'is', null)
        .not('zip_code', 'is', null)
        .not('city', 'is', null)
        .not('atividade_id', 'is', null)
        .not('sales_rep_id', 'is', null)
        .not('legal_entity_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1);
      if (e1) throw e1;
      const candidate = candidates?.[0];
      if (!candidate) {
        toast.error('Nenhum cliente elegível encontrado.');
        return;
      }

      const { error: e2 } = await supabase
        .from('company_sync_queue')
        .update({
          status: 'pending',
          error_message: null,
          attempts: 0,
          next_retry_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('company_id', candidate.id);
      if (e2) throw e2;

      toast.success(`Liberado: ${candidate.name} (${candidate.cnpj})`);
      queryClient.invalidateQueries({ queryKey: ['customer-sync-monitor'] });
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    } finally {
      setIsReleasing(false);
    }
  };

  const releaseBatch = async (n: number) => {
    if (ERP_SYNC_PAUSED) {
      toast.warning('Sincronização ERP temporariamente bloqueada.');
      return;
    }
    setIsReleasing(true);
    try {
      const { data: queueItems, error: e1 } = await supabase
        .from('company_sync_queue')
        .select('id, company_id')
        .eq('status', 'paused')
        .limit(n);
      if (e1) throw e1;
      if (!queueItems || queueItems.length === 0) {
        toast.info('Nenhum item pausado para liberar.');
        return;
      }
      const ids = queueItems.map((q) => q.id);
      const { error: e2 } = await supabase
        .from('company_sync_queue')
        .update({
          status: 'pending',
          error_message: null,
          attempts: 0,
          next_retry_at: null,
          updated_at: new Date().toISOString(),
        })
        .in('id', ids);
      if (e2) throw e2;
      toast.success(`${queueItems.length} clientes liberados para teste`);
      queryClient.invalidateQueries({ queryKey: ['customer-sync-monitor'] });
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    } finally {
      setIsReleasing(false);
    }
  };

  const pauseAll = async () => {
    if (!confirm('Pausar TODOS os itens pendentes/processando da fila?')) return;
    setIsReleasing(true);
    try {
      const { error } = await supabase
        .from('company_sync_queue')
        .update({
          status: 'paused',
          updated_at: new Date().toISOString(),
        })
        .in('status', ['pending', 'waiting_propagation', 'processing']);
      if (error) throw error;
      toast.success('Fila pausada');
      queryClient.invalidateQueries({ queryKey: ['customer-sync-monitor'] });
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    } finally {
      setIsReleasing(false);
    }
  };

  const triggerProcessing = async () => {
    if (ERP_SYNC_PAUSED) {
      toast.warning('Sincronização ERP temporariamente bloqueada.');
      return;
    }
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-company-sync', {
        body: { batchSize: 10 },
      });
      if (error) throw error;
      toast.success(`Processado: ${data?.processed ?? 0} | sucesso: ${data?.success ?? 0} | erros: ${data?.errors ?? 0}`);
      queryClient.invalidateQueries({ queryKey: ['customer-sync-monitor'] });
    } catch (err: any) {
      toast.error(`Erro ao processar: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['customer-sync-monitor'] });
  };

  // ─── Render ───────────────────────────────────────────────
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-5 w-5 text-primary" />
              Monitor de Sincronização — Clientes
            </CardTitle>
            <CardDescription>
              Painel de testes em tempo real (atualiza a cada 5s). Use para validar a sincronização CRM → ERP em fases.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={refreshAll} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Métricas resumidas */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <MetricCard
            label="Total na fila"
            value={metrics.totalQueue}
            icon={<Clock className="h-4 w-4" />}
          />
          <MetricCard
            label="Pausados"
            value={metrics.byStatus['paused'] || 0}
            icon={<PauseCircle className="h-4 w-4" />}
            tone="muted"
          />
          <MetricCard
            label="Pendentes"
            value={metrics.byStatus['pending'] || 0}
            icon={<PlayCircle className="h-4 w-4" />}
            tone="info"
          />
          <MetricCard
            label="Sucesso (últ. 20)"
            value={metrics.successCount}
            icon={<CheckCircle2 className="h-4 w-4" />}
            tone="success"
          />
          <MetricCard
            label="Erros (últ. 20)"
            value={metrics.errorCount}
            icon={<XCircle className="h-4 w-4" />}
            tone="destructive"
          />
        </div>

        {/* Alerta de unknown pattern */}
        {metrics.unknownCount > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>⚠️ Padrão desconhecido detectado</AlertTitle>
            <AlertDescription>
              {metrics.unknownCount} de {recentLogs.length} retornos recentes tiveram formato não reconhecido pelo parser
              ({metrics.unknownRate.toFixed(1)}%). Verifique se o ERP mudou o formato do <code>p_retorno</code>.
            </AlertDescription>
          </Alert>
        )}

        {/* Ações de teste */}
        <div className="flex flex-wrap gap-2 pt-2 border-t">
          <Button onClick={releaseOne} disabled={ERP_SYNC_PAUSED || isReleasing} variant="default" size="sm" className="gap-2">
            <PlayCircle className="h-4 w-4" />
            Liberar 1 cliente (Fase 1)
          </Button>
          <Button onClick={() => releaseBatch(10)} disabled={ERP_SYNC_PAUSED || isReleasing} variant="secondary" size="sm" className="gap-2">
            <PlayCircle className="h-4 w-4" />
            Liberar 10 (Fase 2)
          </Button>
          <Button onClick={() => releaseBatch(100)} disabled={ERP_SYNC_PAUSED || isReleasing} variant="secondary" size="sm" className="gap-2">
            <PlayCircle className="h-4 w-4" />
            Liberar 100
          </Button>
          <Button onClick={triggerProcessing} disabled={ERP_SYNC_PAUSED || isProcessing} variant="default" size="sm" className="gap-2">
            <Send className={`h-4 w-4 ${isProcessing ? 'animate-pulse' : ''}`} />
            {isProcessing ? 'Processando...' : 'Disparar processamento (10)'}
          </Button>
          <Button onClick={pauseAll} disabled={isReleasing} variant="outline" size="sm" className="gap-2">
            <PauseCircle className="h-4 w-4" />
            Pausar tudo
          </Button>
        </div>

        {/* Distribuição da fila */}
        <div>
          <h4 className="text-sm font-medium mb-2">Distribuição da fila</h4>
          <div className="flex flex-wrap gap-2">
            {queueStats.length === 0 ? (
              <p className="text-sm text-muted-foreground">Fila vazia.</p>
            ) : (
              queueStats.map((s) => (
                <Badge key={s.status} variant={statusBadgeVariant(s.status)} className="text-xs">
                  {s.status}: <span className="ml-1 font-bold">{s.total.toLocaleString('pt-BR')}</span>
                </Badge>
              ))
            )}
          </div>
        </div>

        {/* Últimos logs */}
        <div>
          <h4 className="text-sm font-medium mb-2">Últimos 20 retornos do ERP</h4>
          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[160px]">Quando</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>erp_code</TableHead>
                  <TableHead>Pattern</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Avisos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">
                      Nenhum log de sincronização ainda. Libere e processe pelo menos 1 cliente.
                    </TableCell>
                  </TableRow>
                ) : (
                  recentLogs.map((log) => {
                    const parsed = log.response_payload?.parsed || {};
                    const isUnknown = parsed.matchedPattern === null;
                    const warnings: string[] = parsed.warnings || [];
                    return (
                      <TableRow key={log.id} className={isUnknown ? 'bg-destructive/5' : ''}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString('pt-BR')}
                        </TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate" title={log.company_name}>
                          {log.company_name || '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusBadgeVariant(log.status)} className="text-xs">
                            {log.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{log.external_id || '—'}</TableCell>
                        <TableCell className="text-xs">
                          {isUnknown ? (
                            <Badge variant="destructive" className="text-xs">UNKNOWN</Badge>
                          ) : (
                            <span className="text-muted-foreground">{parsed.matchedPattern || '—'}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">{parsed.action || '—'}</TableCell>
                        <TableCell className="text-xs max-w-[240px]">
                          {warnings.length > 0 ? (
                            <span className="text-warning" title={warnings.join('\n')}>
                              ⚠ {warnings.length} aviso{warnings.length > 1 ? 's' : ''}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Subcomponente ───────────────────────────────────────────
function MetricCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone?: 'success' | 'destructive' | 'info' | 'muted';
}) {
  const toneClass =
    tone === 'success'
      ? 'text-emerald-600 dark:text-emerald-400'
      : tone === 'destructive'
      ? 'text-destructive'
      : tone === 'info'
      ? 'text-primary'
      : tone === 'muted'
      ? 'text-muted-foreground'
      : 'text-foreground';

  return (
    <div className="border rounded-md p-3 bg-card">
      <div className={`flex items-center gap-2 text-xs ${toneClass}`}>
        {icon}
        <span>{label}</span>
      </div>
      <div className={`text-2xl font-bold mt-1 ${toneClass}`}>{value.toLocaleString('pt-BR')}</div>
    </div>
  );
}
