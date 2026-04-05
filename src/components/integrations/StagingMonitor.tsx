import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { RefreshCw, Play, RotateCcw, Database, CheckCircle, AlertCircle, Clock, Download } from 'lucide-react';

interface StagingStats {
  total: number;
  pending: number;
  processed: number;
  errors: number;
  skipped: number;
}

interface StagingRecord {
  id: string;
  erp_code: string;
  codigo_tipo_item: number | null;
  status: string;
  data_alteracao: string | null;
  hash_data: string;
  error_message: string | null;
  retry_count: number;
  created_at: string;
}

interface SyncControl {
  last_sync_at: string | null;
  last_record_date: string | null;
  records_synced: number;
}

export function StagingMonitor() {
  const [stats, setStats] = useState<StagingStats>({ total: 0, pending: 0, processed: 0, errors: 0, skipped: 0 });
  const [records, setRecords] = useState<StagingRecord[]>([]);
  const [syncControl, setSyncControl] = useState<SyncControl | null>(null);
  const [isPromoting, setIsPromoting] = useState(false);
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [promotionProgress, setPromotionProgress] = useState<{
    processed: number;
    total: number;
    promoted: number;
    skipped: number;
    errors: number;
  } | null>(null);
  const cancelRef = useRef(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [countsResult, latestResult, syncResult] = await Promise.all([
        (supabase as any).rpc('staging_status_counts'),
        supabase
          .from('erp_products_staging')
          .select('id, erp_code, codigo_tipo_item, status, data_alteracao, hash_data, error_message, retry_count, created_at')
          .order('created_at', { ascending: false })
          .limit(20),
        (supabase as any)
          .from('erp_sync_control')
          .select('last_sync_at, last_sync_count')
          .eq('entity', 'product_promotion')
          .maybeSingle(),
      ]);

      const countsData = countsResult.data;
      if (countsData) {
        const s: StagingStats = { total: 0, pending: 0, processed: 0, errors: 0, skipped: 0 };
        for (const row of countsData) {
          const c = Number(row.count) || 0;
          s.total += c;
          if (row.status === 'pending' || row.status === 'processing') s.pending += c;
          else if (row.status === 'processed' || row.status === 'promoted') s.processed += c;
          else if (row.status === 'error') s.errors += c;
          else if (row.status === 'skipped') s.skipped += c;
        }
        setStats(s);
      }

      const latest = latestResult.data as StagingRecord[] | null;
      if (latest) setRecords(latest);

      const syncData = syncResult?.data;
      setSyncControl(
        syncData
          ? {
              last_sync_at: syncData.last_sync_at,
              last_record_date: null,
              records_synced: syncData.last_sync_count ?? 0,
            }
          : null
      );
    } catch (err) {
      console.error('Fetch staging data error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const resolvetenantId = async (): Promise<string> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error('Não autenticado');

    const { data: profile } = await supabase
      .from('profiles')
      .select('active_tenant_id')
      .eq('id', session.user.id)
      .single();

    let tenantId = profile?.active_tenant_id;
    if (!tenantId) {
      const { data: ut } = await (supabase as any)
        .from('user_tenants')
        .select('tenant_id')
        .eq('user_id', session.user.id)
        .limit(1)
        .maybeSingle();
      tenantId = ut?.tenant_id;
    }
    if (!tenantId) throw new Error('Tenant não encontrado');
    return tenantId;
  };

  const handleImportFromErp = async () => {
    setIsImporting(true);
    try {
      const tenantId = await resolvetenantId();
      toast.info('Importando produtos do ERP... processamento em background iniciado.');

      const { data, error } = await supabase.functions.invoke('erp-import-products-staging', {
        body: { tenant_id: tenantId, source: 'erp' },
      });

      if (error) throw error;

      if (data?.status === 'processing') {
        toast.success(
          `${data.total_received} registros recebidos do ERP. Processamento em background — acompanhe o progresso atualizando o monitor.`
        );
        setTimeout(() => fetchData(), 5000);
        setTimeout(() => fetchData(), 15000);
        setTimeout(() => fetchData(), 30000);
      } else {
        toast.success(
          `Importação concluída: ${data?.staging_inserted || 0} inseridos, ${data?.staging_skipped_unchanged || 0} sem alteração`
        );
      }
      fetchData();
    } catch (err: any) {
      toast.error('Erro na importação ERP: ' + (err.message || 'erro desconhecido'));
    } finally {
      setIsImporting(false);
    }
  };

  const handlePromote = async () => {
    setIsPromoting(true);
    cancelRef.current = false;
    const totalPending = stats.pending;
    const progress = { processed: 0, total: totalPending, promoted: 0, skipped: 0, errors: 0 };
    setPromotionProgress({ ...progress });

    try {
      const tenantId = await resolvetenantId();
      const BATCH_SIZE = 500;
      let hasMore = true;

      while (hasMore && !cancelRef.current) {
        const { data, error } = await supabase.functions.invoke('erp-promote-products', {
          body: { tenant_id: tenantId, batch_size: BATCH_SIZE },
        });

        if (error) throw error;

        const batch = data?.summary ?? {};
        const batchPromoted = Number(batch?.promoted ?? 0);
        const batchSkipped = Number(batch?.skipped ?? batch?.skipped_type ?? 0);
        const batchErrors = Number(batch?.errors ?? 0);
        const batchTotal = Number(batch?.total ?? (batchPromoted + batchSkipped + batchErrors));

        progress.promoted += batchPromoted;
        progress.skipped += batchSkipped;
        progress.errors += batchErrors;
        progress.processed += batchTotal;
        setPromotionProgress({ ...progress });

        if (batchTotal === 0 || batchTotal < BATCH_SIZE) {
          hasMore = false;
        }
      }

      toast.success(
        `Promoção concluída: ${progress.promoted} promovidos, ${progress.skipped} ignorados, ${progress.errors} erros`
      );
      fetchData();
    } catch (err: any) {
      toast.error('Erro na promoção: ' + (err.message || 'erro desconhecido'));
    } finally {
      setIsPromoting(false);
      setTimeout(() => setPromotionProgress(null), 3000);
    }
  };

  const handleReprocessErrors = async () => {
    setIsReprocessing(true);
    try {
      const { error } = await (supabase
        .from('erp_products_staging')
        .update({ status: 'pending', error_message: null } as any)
        .eq('status', 'error')
        .lt('retry_count', 5));

      if (error) throw error;

      toast.success('Erros marcados para reprocessamento');
      fetchData();
    } catch (err: any) {
      toast.error('Erro ao reprocessar: ' + (err.message || 'erro desconhecido'));
    } finally {
      setIsReprocessing(false);
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      pending: { variant: 'outline', label: 'Pendente' },
      processing: { variant: 'secondary', label: 'Processando' },
      processed: { variant: 'default', label: 'Promovido' },
      promoted: { variant: 'default', label: 'Promovido' },
      error: { variant: 'destructive', label: 'Erro' },
      skipped: { variant: 'secondary', label: 'Ignorado' },
    };
    const m = map[status] || { variant: 'outline' as const, label: status };
    return <Badge variant={m.variant}>{m.label}</Badge>;
  };

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleString('pt-BR');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Staging de Produtos ERP</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={handleImportFromErp} disabled={isImporting}>
            <Download className={`h-4 w-4 mr-1 ${isImporting ? 'animate-spin' : ''}`} />
            {isImporting ? 'Importando...' : 'Importar do ERP'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleReprocessErrors} disabled={isReprocessing || stats.errors === 0}>
            <RotateCcw className={`h-4 w-4 mr-1 ${isReprocessing ? 'animate-spin' : ''}`} />
            Reprocessar Erros
          </Button>
          {isPromoting ? (
            <Button size="sm" variant="destructive" onClick={() => { cancelRef.current = true; }}>
              Cancelar
            </Button>
          ) : (
            <Button size="sm" onClick={handlePromote} disabled={stats.pending === 0}>
              <Play className="h-4 w-4 mr-1" />
              Promover Agora
            </Button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {promotionProgress && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">
                {isPromoting ? 'Promovendo produtos...' : 'Promoção concluída'}
              </span>
              <span className="text-muted-foreground">
                {promotionProgress.processed} / {promotionProgress.total}
              </span>
            </div>
            <Progress
              value={promotionProgress.total > 0 ? (promotionProgress.processed / promotionProgress.total) * 100 : 0}
              className="h-3"
            />
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span className="text-green-600">✓ {promotionProgress.promoted} promovidos</span>
              <span>⊘ {promotionProgress.skipped} ignorados</span>
              <span className="text-destructive">✗ {promotionProgress.errors} erros</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Database className="h-4 w-4" /> Total Staging
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Clock className="h-4 w-4" /> Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <CheckCircle className="h-4 w-4" /> Promovidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.processed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <AlertCircle className="h-4 w-4" /> Erros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.errors}</div>
          </CardContent>
        </Card>
      </div>

      {/* Sync Info */}
      {syncControl && (
        <div className="text-sm text-muted-foreground">
          Última sincronização: {formatDate(syncControl.last_sync_at)} | 
          Último registro ERP: {formatDate(syncControl.last_record_date)} | 
          Total promovidos: {syncControl.records_synced}
        </div>
      )}

      {/* Recent Records Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Últimos Registros</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código ERP</TableHead>
                <TableHead>Tipo Item</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data Alteração</TableHead>
                <TableHead>Recebido em</TableHead>
                <TableHead>Erro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhum registro na staging
                  </TableCell>
                </TableRow>
              ) : (
                records.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-sm">{r.erp_code}</TableCell>
                    <TableCell>{r.codigo_tipo_item === 1 ? 'PA' : r.codigo_tipo_item ?? '—'}</TableCell>
                    <TableCell>{statusBadge(r.status)}</TableCell>
                    <TableCell className="text-sm">{formatDate(r.data_alteracao)}</TableCell>
                    <TableCell className="text-sm">{formatDate(r.created_at)}</TableCell>
                    <TableCell className="text-sm text-destructive max-w-[200px] truncate" title={r.error_message || ''}>
                      {r.error_message || '—'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
