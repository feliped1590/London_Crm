import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch stats by status
      const { data: allRecords } = await supabase
        .from('erp_products_staging')
        .select('status') as { data: { status: string }[] | null };

      if (allRecords) {
        const s: StagingStats = { total: allRecords.length, pending: 0, processed: 0, errors: 0, skipped: 0 };
        for (const r of allRecords) {
          if (r.status === 'pending' || r.status === 'processing') s.pending++;
          else if (r.status === 'processed') s.processed++;
          else if (r.status === 'error') s.errors++;
          else if (r.status === 'skipped') s.skipped++;
        }
        setStats(s);
      }

      // Fetch latest records
      const { data: latest } = await supabase
        .from('erp_products_staging')
        .select('id, erp_code, codigo_tipo_item, status, data_alteracao, hash_data, error_message, retry_count, created_at')
        .order('created_at', { ascending: false })
        .limit(20) as { data: StagingRecord[] | null };

      if (latest) setRecords(latest);

      // Fetch sync control
      const syncResult = await (supabase as any)
        .from('erp_sync_control')
        .select('last_sync_at, last_record_date, records_synced')
        .eq('entity_type', 'product_staging')
        .maybeSingle();
      const sync: SyncControl | null = syncResult?.data ?? null;

      setSyncControl(sync);
    } catch (err) {
      console.error('Fetch staging data error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleImportFromErp = async () => {
    setIsImporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const { data: profile } = await supabase
        .from('profiles')
        .select('active_tenant_id')
        .eq('id', session.user.id)
        .single();

      if (!profile?.active_tenant_id) throw new Error('Tenant não encontrado');

      toast.info('Importando produtos do ERP... isso pode levar alguns minutos.');

      const { data, error } = await supabase.functions.invoke('erp-import-products-staging', {
        body: { tenant_id: profile.active_tenant_id, source: 'erp' },
      });

      if (error) throw error;

      toast.success(
        `Importação concluída: ${data?.staging_inserted || 0} inseridos, ${data?.staging_skipped_unchanged || 0} sem alteração, ${data?.total_received || 0} recebidos do ERP`
      );
      fetchData();
    } catch (err: any) {
      toast.error('Erro na importação ERP: ' + (err.message || 'erro desconhecido'));
    } finally {
      setIsImporting(false);
    }
  };

  const handlePromote = async () => {
    setIsPromoting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const { data: profile } = await supabase
        .from('profiles')
        .select('active_tenant_id')
        .eq('id', session.user.id)
        .single();

      if (!profile?.active_tenant_id) throw new Error('Tenant não encontrado');

      const { data, error } = await supabase.functions.invoke('erp-promote-products', {
        body: { tenant_id: profile.active_tenant_id },
      });

      if (error) throw error;

      const summary = data?.summary;
      toast.success(
        `Promoção concluída: ${summary?.promoted || 0} promovidos, ${summary?.skipped_hash || 0} sem alteração, ${summary?.errors || 0} erros`
      );
      fetchData();
    } catch (err: any) {
      toast.error('Erro na promoção: ' + (err.message || 'erro desconhecido'));
    } finally {
      setIsPromoting(false);
    }
  };

  const handleReprocessErrors = async () => {
    setIsReprocessing(true);
    try {
      const { error } = await (supabase
        .from('erp_products_staging')
        .update({ status: 'pending' }) as any)
        .eq('status', 'error')
        .lt('retry_count', 5);

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
          <Button variant="outline" size="sm" onClick={handleReprocessErrors} disabled={isReprocessing || stats.errors === 0}>
            <RotateCcw className={`h-4 w-4 mr-1 ${isReprocessing ? 'animate-spin' : ''}`} />
            Reprocessar Erros
          </Button>
          <Button size="sm" onClick={handlePromote} disabled={isPromoting || stats.pending === 0}>
            <Play className={`h-4 w-4 mr-1 ${isPromoting ? 'animate-spin' : ''}`} />
            {isPromoting ? 'Promovendo...' : 'Promover Agora'}
          </Button>
        </div>
      </div>

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
