import { useState, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Check, AlertTriangle, CloudOff, XCircle, Search, ChevronLeft, ChevronRight, Send, Loader2, Clock, RefreshCw, Trash2, PlayCircle, StopCircle, ChevronRight as ArrowRight, X, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { useValidationBreakdown } from '@/hooks/useValidationBreakdown';
import { SyncValidationModal, type SyncValidationError } from '@/components/sync/SyncValidationModal';

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; cardColor: string }> = {
  ready: {
    label: 'Prontos',
    icon: Check,
    color: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300',
    cardColor: 'border-green-200 dark:border-green-800',
  },
  not_synced: {
    label: 'Não sincronizados',
    icon: CloudOff,
    color: 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300',
    cardColor: 'border-yellow-200 dark:border-yellow-800',
  },
  missing_data: {
    label: 'Dados incompletos',
    icon: AlertTriangle,
    color: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300',
    cardColor: 'border-orange-200 dark:border-orange-800',
  },
  sync_error: {
    label: 'Erro',
    icon: XCircle,
    color: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300',
    cardColor: 'border-red-200 dark:border-red-800',
  },
};

// Extended statuses for queue-aware display
const QUEUE_STATUS_MAP: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  processing: {
    label: 'Processando',
    icon: RefreshCw,
    color: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300',
  },
  waiting_propagation: {
    label: 'Aguardando ERP',
    icon: Clock,
    color: 'bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300',
  },
  pending_retry: {
    label: 'Aguardando retentativa',
    icon: Clock,
    color: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300',
  },
};

const PAGE_SIZE = 20;

interface ErrorDetailState {
  open: boolean;
  companyId: string | null;
  companyName: string;
  loading: boolean;
  queueStatus: string | null;
  errorMessage: string | null;
  attempts: number;
  nextRetry: string | null;
  payload: any | null;
  response: any | null;
  processedAt: string | null;
}

export function IntegrationValidationPanel() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(0);
  const [searchTimer, setSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
  const [selectedIssue, setSelectedIssue] = useState<string | null>(null);
  const [validationModal, setValidationModal] = useState<{ open: boolean; companyName: string; errors: SyncValidationError[] }>({
    open: false, companyName: '', errors: [],
  });

  const { data: breakdown = [] } = useValidationBreakdown();

  const [errorDetail, setErrorDetail] = useState<ErrorDetailState>({
    open: false, companyId: null, companyName: '', loading: false,
    queueStatus: null, errorMessage: null, attempts: 0,
    nextRetry: null, payload: null, response: null, processedAt: null,
  });

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (searchTimer) clearTimeout(searchTimer);
    const timer = setTimeout(() => { setDebouncedSearch(value); setPage(0); }, 400);
    setSearchTimer(timer);
  };

  // Summary counts
  const { data: summary } = useQuery({
    queryKey: ['integration-status-summary'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_integration_status_summary');
      if (!error && data) {
        const counts: Record<string, number> = { ready: 0, not_synced: 0, missing_data: 0, sync_error: 0 };
        (data || []).forEach((r: any) => { counts[r.status] = Number(r.count); });
        return counts;
      }
      const statuses = ['ready', 'not_synced', 'missing_data', 'sync_error'] as const;
      const results = await Promise.all(
        statuses.map(s => supabase.from('companies').select('id', { count: 'exact', head: true }).eq('active', true).eq('integration_status', s))
      );
      const counts: Record<string, number> = { ready: 0, not_synced: 0, missing_data: 0, sync_error: 0 };
      statuses.forEach((s, i) => { counts[s] = results[i].count ?? 0; });
      return counts;
    },
    staleTime: 30_000,
  });

  // Paginated list with queue status — também filtra por issue (validation_fields) quando selecionado
  const { data: listData, isLoading, refetch } = useQuery({
    queryKey: ['integration-validation-list', statusFilter, debouncedSearch, page, selectedIssue],
    queryFn: async () => {
      // Se houver filtro de issue, primeiro pegamos os company_ids da fila com aquele field
      let restrictedIds: string[] | null = null;
      if (selectedIssue) {
        const { data: queueRows } = await (supabase as any)
          .from('company_sync_queue')
          .select('company_id')
          .eq('status', 'blocked_validation')
          .contains('validation_fields', [selectedIssue]);
        restrictedIds = (queueRows || []).map((r: any) => r.company_id);
        if (restrictedIds.length === 0) {
          return { items: [], total: 0 };
        }
      }

      let query = supabase
        .from('companies')
        .select('id, name, cnpj, city, state, address, erp_code, integration_status, sales_rep_id', { count: 'exact' })
        .eq('active', true)
        .order('name')
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (selectedIssue && restrictedIds) {
        query = query.in('id', restrictedIds);
      }
      if (statusFilter !== 'all') query = query.eq('integration_status', statusFilter);
      if (debouncedSearch) query = query.or(`name.ilike.%${debouncedSearch}%,cnpj.ilike.%${debouncedSearch}%`);

      const { data, count, error } = await query;
      if (error) throw error;

      const items = data || [];

      // Enrich with queue status for sync_error AND blocked_validation items
      const enrichItems = items.filter((i: any) =>
        i.integration_status === 'sync_error' || i.integration_status === 'missing_data'
      );
      let queueMap = new Map<string, any>();
      if (enrichItems.length > 0) {
        const { data: queueData } = await (supabase as any)
          .from('company_sync_queue')
          .select('company_id, status, error_message, next_retry_at, validation_errors, validation_fields')
          .in('company_id', enrichItems.map((i: any) => i.id));

        (queueData || []).forEach((q: any) => queueMap.set(q.company_id, q));
      }

      return {
        items: items.map((item: any) => ({
          ...item,
          _queue: queueMap.get(item.id) || null,
        })),
        total: count || 0,
      };
    },
    staleTime: 10_000,
  });

  const totalPages = Math.ceil((listData?.total || 0) / PAGE_SIZE);

  const handleViewError = async (companyId: string, companyName: string) => {
    setErrorDetail({
      open: true, companyId: companyId, companyName, loading: true,
      queueStatus: null, errorMessage: null, attempts: 0,
      nextRetry: null, payload: null, response: null, processedAt: null,
    });
    try {
      const { data } = await (supabase as any)
        .from('company_sync_queue')
        .select('status, error_message, attempts, processed_at, next_retry_at, payload, response')
        .eq('company_id', companyId)
        .maybeSingle();

      setErrorDetail({
        open: true, companyId: companyId, companyName, loading: false,
        queueStatus: data?.status || null,
        errorMessage: data?.error_message || null,
        attempts: data?.attempts || 0,
        nextRetry: data?.next_retry_at || null,
        payload: data?.payload || null,
        response: data?.response || null,
        processedAt: data?.processed_at || null,
      });
    } catch {
      setErrorDetail(prev => ({ ...prev, loading: false, errorMessage: 'Falha ao buscar detalhes' }));
    }
  };

  const handleSync = async (companyId: string) => {
    setSyncingIds(prev => new Set(prev).add(companyId));
    try {
      const { data, error } = await supabase.functions.invoke('process-company-sync', {
        body: { company_id: companyId },
      });
      if (error) throw error;

      const result = data as any;
      if (result?.error_count && result.error_count > 0) {
        const firstError = result.results?.find((item: any) => item.error)?.error;
        toast.error(firstError || 'Falha ao enviar cliente ao ERP');
      } else if (result?.message) {
        toast.info(result.message);
      } else {
        toast.success('Cliente enviado para processamento no ERP');
      }
      refetch();
    } finally {
      setTimeout(() => {
        setSyncingIds(prev => { const next = new Set(prev); next.delete(companyId); return next; });
      }, 2000);
    }
  };

  const [clearingIds, setClearingIds] = useState<Set<string>>(new Set());

  // Bulk sync state
  const [bulkSync, setBulkSync] = useState<{
    running: boolean;
    total: number;
    processed: number;
    succeeded: number;
    failed: number;
    currentBatch: number;
  }>({ running: false, total: 0, processed: 0, succeeded: 0, failed: 0, currentBatch: 0 });
  const cancelBulkRef = useRef(false);

  const handleBulkSync = useCallback(async () => {
    cancelBulkRef.current = false;

    // Step 1: Enqueue all not_synced companies via RPC
    const { data: enqueueResult, error: enqueueError } = await (supabase as any).rpc('enqueue_bulk_company_sync');

    if (enqueueError) {
      toast.error('Erro ao enfileirar clientes: ' + enqueueError.message);
      return;
    }

    const enqueued = enqueueResult?.enqueued ?? 0;
    if (enqueued === 0) {
      toast.info('Nenhum cliente pendente para sincronizar');
      return;
    }

    setBulkSync({ running: true, total: enqueued, processed: 0, succeeded: 0, failed: 0, currentBatch: 0 });
    toast.info(`${enqueued.toLocaleString('pt-BR')} clientes enfileirados. Processando em lotes de 30...`);

    let totalProcessed = 0;
    let totalSucceeded = 0;
    let totalFailed = 0;
    let batchNum = 0;
    let consecutiveErrors = 0;

    while (!cancelBulkRef.current) {
      batchNum++;

      try {
        const batchStart = Date.now();

        const { data, error: batchError } = await supabase.functions.invoke('process-company-sync', {
          body: {},
        });

        if (batchError) throw batchError;

        const batchDuration = Date.now() - batchStart;
        const result = data as any;
        const processed = result?.processed ?? 0;

        console.log(`[bulk-sync] Lote #${batchNum}: ${processed} processados em ${batchDuration}ms | ✓${result?.success_count ?? 0} ✗${result?.error_count ?? 0}`);

        if (processed === 0) break; // Queue empty

        totalProcessed += processed;
        totalSucceeded += result?.success_count ?? 0;
        totalFailed += result?.error_count ?? 0;

        setBulkSync(prev => ({
          ...prev,
          processed: totalProcessed,
          succeeded: totalSucceeded,
          failed: totalFailed,
          currentBatch: batchNum,
        }));

        // Reset consecutive errors on any success
        if ((result?.success_count ?? 0) > 0) {
          consecutiveErrors = 0;
        } else if ((result?.error_count ?? 0) > 0) {
          consecutiveErrors++;
        }

        if (consecutiveErrors >= 5) {
          toast.warning('Muitos erros consecutivos. Sincronização pausada.');
          break;
        }

        // Dynamic delay: fast when healthy, slower on errors
        const delay = consecutiveErrors > 0 ? 3000 : 500;
        await new Promise(r => setTimeout(r, delay));
      } catch (err: any) {
        consecutiveErrors++;
        console.error(`[bulk-sync] Lote #${batchNum} falhou:`, err.message);
        if (consecutiveErrors >= 5) {
          toast.error('Muitos erros consecutivos. Sincronização interrompida.');
          break;
        }
        await new Promise(r => setTimeout(r, 3000));
      }
    }

    if (cancelBulkRef.current) {
      toast.warning(`Cancelado. ${totalSucceeded} enviados, ${totalFailed} erros em ${batchNum} lotes.`);
    } else {
      toast.success(`Concluído! ${totalSucceeded} enviados, ${totalFailed} erros em ${batchNum} lotes.`);
    }

    setBulkSync(prev => ({ ...prev, running: false }));
    refetch();
  }, [refetch]);

  const handleCancelBulkSync = useCallback(() => {
    cancelBulkRef.current = true;
  }, []);

  const handleClearQueue = async (companyId: string) => {
    setClearingIds(prev => new Set(prev).add(companyId));
    try {
      await (supabase as any)
        .from('company_sync_queue')
        .delete()
        .eq('company_id', companyId);

      await supabase
        .from('companies')
        .update({ integration_status: 'not_synced' } as any)
        .eq('id', companyId);

      toast.success('Fila limpa. O cliente pode ser reenviado.');
      setErrorDetail(prev => ({ ...prev, open: false }));
      refetch();
    } catch (err: any) {
      toast.error('Erro ao limpar fila: ' + (err.message || 'erro desconhecido'));
    } finally {
      setClearingIds(prev => { const n = new Set(prev); n.delete(companyId); return n; });
    }
  };

  const getEffectiveStatus = (item: any) => {
    const status = item.integration_status || 'not_synced';
    const q = item._queue;
    // Bloqueio por validação tem prioridade visual
    if (q?.status === 'blocked_validation') return 'blocked_validation';
    if (status !== 'sync_error') return status;

    if (!q) return status;
    if (q.status === 'processing') return 'processing';
    if (q.status === 'pending' && q.error_message?.includes('propagação')) return 'waiting_propagation';
    if (q.status === 'pending' && q.next_retry_at) return 'pending_retry';
    if (q.status === 'completed') return 'ready';
    return status;
  };

  const getStatusDisplay = (effectiveStatus: string) => {
    if (effectiveStatus === 'blocked_validation') {
      return {
        label: 'Dados incompletos',
        icon: AlertTriangle,
        color: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300',
      };
    }
    if (QUEUE_STATUS_MAP[effectiveStatus]) {
      return QUEUE_STATUS_MAP[effectiveStatus];
    }
    return STATUS_CONFIG[effectiveStatus] || STATUS_CONFIG.not_synced;
  };

  const openValidationModal = (item: any) => {
    const errors = (item._queue?.validation_errors || []) as SyncValidationError[];
    setValidationModal({ open: true, companyName: item.name, errors });
  };

  const getMissingFields = (item: any) => {
    const missing: string[] = [];
    if (!item.cnpj) missing.push('CNPJ');
    if (!item.city) missing.push('Cidade');
    if (!item.state) missing.push('Estado');
    if (!item.address) missing.push('Endereço');
    return missing;
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('pt-BR');
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Validação de Clientes</h3>
      <p className="text-sm text-muted-foreground">
        Status de integração pré-calculado para todos os clientes ativos.
      </p>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(STATUS_CONFIG).map(([key, config]) => {
          const Icon = config.icon;
          const count = summary?.[key] ?? 0;
          const isActive = statusFilter === key;
          return (
            <Card
              key={key}
              className={`cursor-pointer transition-all hover:shadow-md ${config.cardColor} ${isActive ? 'ring-2 ring-primary' : ''}`}
              onClick={() => { setStatusFilter(isActive ? 'all' : key); setPage(0); }}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <Icon className="h-5 w-5 flex-shrink-0" />
                <div>
                  <p className="text-2xl font-bold">{count.toLocaleString('pt-BR')}</p>
                  <p className="text-xs text-muted-foreground">{config.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Breakdown de pendências (clicável) */}
      {breakdown.length > 0 && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <p className="text-sm font-semibold">Principais pendências</p>
                <span className="text-xs text-muted-foreground">
                  (clique para filtrar a tabela)
                </span>
              </div>
              {selectedIssue && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1 h-7"
                  onClick={() => { setSelectedIssue(null); setPage(0); }}
                >
                  <X className="h-3 w-3" />
                  Limpar filtro
                </Button>
              )}
            </div>
            <ul className="space-y-1">
              {breakdown.map((item) => {
                const isActive = selectedIssue === item.field;
                return (
                  <li key={item.field}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedIssue(isActive ? null : item.field);
                        setStatusFilter('all');
                        setPage(0);
                      }}
                      className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-md text-sm transition-colors hover:bg-warning/10 ${
                        isActive ? 'bg-warning/15 ring-1 ring-warning/40' : ''
                      }`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="truncate">{item.label}</span>
                      </span>
                      <span className="flex items-center gap-2 shrink-0">
                        <span className="font-semibold tabular-nums">
                          {item.count.toLocaleString('pt-BR')}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Indicador de filtro ativo */}
      {selectedIssue && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-warning/10 border border-warning/30 text-sm">
          <span className="text-muted-foreground">Filtrando:</span>
          <span className="font-medium">
            {breakdown.find((b) => b.field === selectedIssue)?.label ?? selectedIssue}
          </span>
          <span className="text-muted-foreground">
            ({(listData?.total ?? 0).toLocaleString('pt-BR')} clientes)
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto gap-1 h-6"
            onClick={() => { setSelectedIssue(null); setPage(0); }}
          >
            <X className="h-3 w-3" />
            Limpar
          </Button>
        </div>
      )}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome ou CNPJ..." value={search} onChange={(e) => handleSearchChange(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Todos os status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                <SelectItem key={key} value={key}>{config.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {bulkSync.running ? (
            <Button variant="destructive" size="sm" className="gap-2" onClick={handleCancelBulkSync}>
              <StopCircle className="h-4 w-4" />
              Cancelar
            </Button>
          ) : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2" onClick={handleBulkSync} disabled={(summary?.not_synced ?? 0) === 0}>
                    <PlayCircle className="h-4 w-4" />
                    Sincronizar Todos
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Envia todos os clientes "Não sincronizados" ao ERP, um por vez</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        {/* Bulk Sync Progress */}
        {bulkSync.running && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processando lote #{bulkSync.currentBatch} <span className="text-muted-foreground">(30 por lote)</span>
                </span>
                <span className="text-muted-foreground">
                  {bulkSync.processed.toLocaleString('pt-BR')}/{bulkSync.total.toLocaleString('pt-BR')} · {bulkSync.succeeded} ✓ · {bulkSync.failed} ✗
                </span>
              </div>
              <Progress value={bulkSync.total > 0 ? (bulkSync.processed / bulkSync.total) * 100 : 0} className="h-2" />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Cidade/UF</TableHead>
                <TableHead>Código ERP</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell>
                </TableRow>
              ) : (listData?.items || []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum cliente encontrado</TableCell>
                </TableRow>
              ) : (
                (listData?.items || []).map((item: any) => {
                  const baseStatus = item.integration_status || 'not_synced';
                  const effectiveStatus = getEffectiveStatus(item);
                  const display = getStatusDisplay(effectiveStatus);
                  const Icon = display.icon;
                  const missing = baseStatus === 'missing_data' ? getMissingFields(item) : [];
                  const isSyncing = syncingIds.has(item.id);
                  const isClickable = baseStatus === 'sync_error' || effectiveStatus === 'waiting_propagation' || effectiveStatus === 'pending_retry';
                  const isBlocked = effectiveStatus === 'blocked_validation';
                  const validationErrors = (item._queue?.validation_errors || []) as SyncValidationError[];

                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-sm">{item.cnpj || '—'}</TableCell>
                      <TableCell className="text-sm">{item.city && item.state ? `${item.city}/${item.state}` : '—'}</TableCell>
                      <TableCell className="text-sm">{item.erp_code || '—'}</TableCell>
                      <TableCell>
                        {isBlocked ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge
                                  variant="outline"
                                  className={`gap-1 cursor-pointer hover:opacity-80 ${display.color}`}
                                  onClick={() => openValidationModal(item)}
                                >
                                  <Icon className="h-3 w-3" />
                                  {display.label}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-[280px]">
                                <p className="text-xs font-semibold mb-1">Pendências:</p>
                                <ul className="text-xs list-disc pl-4 space-y-0.5">
                                  {validationErrors.slice(0, 5).map((e, i) => (
                                    <li key={i}>{e.message}</li>
                                  ))}
                                  {validationErrors.length > 5 && (
                                    <li>+{validationErrors.length - 5} outros</li>
                                  )}
                                </ul>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : isClickable ? (
                          <Badge
                            variant="outline"
                            className={`gap-1 cursor-pointer hover:opacity-80 ${display.color}`}
                            onClick={() => handleViewError(item.id, item.name)}
                          >
                            <Icon className={`h-3 w-3 ${effectiveStatus === 'processing' ? 'animate-spin' : ''}`} />
                            {display.label}
                          </Badge>
                        ) : (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="outline" className={`gap-1 ${display.color}`}>
                                  <Icon className="h-3 w-3" />
                                  {display.label}
                                </Badge>
                              </TooltipTrigger>
                              {missing.length > 0 && (
                                <TooltipContent>
                                  <p className="text-xs">Faltando: {missing.join(', ')}</p>
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {isBlocked ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => openValidationModal(item)}
                                  >
                                    <Wrench className="h-4 w-4 text-warning" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Corrigir dados pendentes</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (baseStatus === 'not_synced' || baseStatus === 'missing_data' || baseStatus === 'sync_error') && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => (baseStatus === 'not_synced' || baseStatus === 'sync_error') && handleSync(item.id)}
                                    disabled={isSyncing || baseStatus === 'missing_data'}
                                    className={baseStatus === 'missing_data' ? 'opacity-50 cursor-not-allowed' : ''}
                                  >
                                    {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {baseStatus === 'missing_data'
                                    ? `Complete os dados antes de enviar (falta: ${missing.join(', ')})`
                                    : baseStatus === 'sync_error' ? 'Retentar envio ao ERP' : 'Enviar ao ERP'}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          {item._queue && (baseStatus === 'sync_error' || effectiveStatus === 'waiting_propagation' || effectiveStatus === 'pending_retry') && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleClearQueue(item.id)}
                                    disabled={clearingIds.has(item.id)}
                                    className="text-destructive hover:text-destructive"
                                  >
                                    {clearingIds.has(item.id) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Limpar fila e permitir reenvio</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{(listData?.total || 0).toLocaleString('pt-BR')} clientes</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">{page + 1} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Enhanced Diagnostic Dialog */}
      <Dialog open={errorDetail.open} onOpenChange={(open) => setErrorDetail(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Diagnóstico de Sincronização
            </DialogTitle>
          </DialogHeader>
          {errorDetail.loading ? (
            <div className="flex items-center gap-2 py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Carregando...</span>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Cliente</p>
                  <p className="font-medium text-sm">{errorDetail.companyName}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status da Fila</p>
                  <Badge variant="outline" className="mt-1">
                    {errorDetail.queueStatus || 'Sem registro na fila'}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tentativas</p>
                  <p className="font-medium text-sm">{errorDetail.attempts}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Próxima Retentativa</p>
                  <p className="text-sm">{formatDate(errorDetail.nextRetry)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Processado em</p>
                  <p className="text-sm">{formatDate(errorDetail.processedAt)}</p>
                </div>
              </div>

              {/* Error/Status Message */}
              <div>
                <p className="text-xs text-muted-foreground mb-1">Mensagem</p>
                {errorDetail.errorMessage ? (
                  <pre className="p-3 bg-muted rounded-md text-xs whitespace-pre-wrap break-words max-h-[150px] overflow-y-auto">
                    {errorDetail.errorMessage}
                  </pre>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Nenhuma mensagem registrada</p>
                )}
              </div>

              {/* Payload sent */}
              {errorDetail.payload && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Payload Enviado</p>
                  <pre className="p-3 bg-muted rounded-md text-xs whitespace-pre-wrap break-words max-h-[200px] overflow-y-auto">
                    {JSON.stringify(errorDetail.payload, null, 2)}
                  </pre>
                </div>
              )}

              {/* ERP Response */}
              {errorDetail.response && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Resposta do ERP</p>
                  <pre className="p-3 bg-muted rounded-md text-xs whitespace-pre-wrap break-words max-h-[200px] overflow-y-auto">
                    {JSON.stringify(errorDetail.response, null, 2)}
                  </pre>
                </div>
              )}

              {/* Clear Queue Action */}
              {errorDetail.companyId && errorDetail.queueStatus && (
                <div className="flex justify-end pt-2 border-t">
                  <Button
                    variant="destructive"
                    size="sm"
                    className="gap-2"
                    disabled={!!(errorDetail.companyId && clearingIds.has(errorDetail.companyId))}
                    onClick={() => errorDetail.companyId && handleClearQueue(errorDetail.companyId)}
                  >
                    {errorDetail.companyId && clearingIds.has(errorDetail.companyId) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    Limpar Fila e Permitir Reenvio
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de pendências de validação */}
      <SyncValidationModal
        open={validationModal.open}
        onOpenChange={(open) => setValidationModal((prev) => ({ ...prev, open }))}
        companyName={validationModal.companyName}
        errors={validationModal.errors}
      />
    </div>
  );
}
