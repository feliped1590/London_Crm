import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RefreshCw, Eye, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SyncLog {
  id: string;
  entity_type: string;
  entity_id: string;
  external_id: string | null;
  direction: string;
  status: string;
  error_message: string | null;
  request_payload: any;
  response_payload: any;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'destructive' | 'secondary' | 'outline'; icon: React.ReactNode }> = {
  success: { label: 'Sucesso', variant: 'default', icon: <CheckCircle className="h-3 w-3" /> },
  failed: { label: 'Erro', variant: 'destructive', icon: <XCircle className="h-3 w-3" /> },
  pending: { label: 'Pendente', variant: 'secondary', icon: <Clock className="h-3 w-3" /> },
  warning: { label: 'Aviso', variant: 'outline', icon: <AlertTriangle className="h-3 w-3" /> },
};

const ENTITY_LABELS: Record<string, string> = {
  product: 'Produto',
  customer_lookup: 'Consulta Cliente',
  company: 'Empresa',
  contact: 'Contato',
  order: 'Pedido',
};

const DIRECTION_LABELS: Record<string, string> = {
  crm_to_erp: 'CRM → ERP',
  erp_to_crm: 'ERP → CRM',
};

export function SyncLogsTab() {
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterEntity, setFilterEntity] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedLog, setSelectedLog] = useState<SyncLog | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('erp_sync_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (filterEntity !== 'all') {
        query = query.eq('entity_type', filterEntity);
      }
      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }

      const { data, error } = await query;
      if (error) throw error;
      setLogs((data as SyncLog[]) || []);
    } catch (err) {
      console.error('Erro ao buscar logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [filterEntity, filterStatus]);

  const successCount = logs.filter(l => l.status === 'success').length;
  const errorCount = logs.filter(l => l.status === 'failed').length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Sucesso</p>
                <p className="text-2xl font-bold">{successCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              <div>
                <p className="text-sm text-muted-foreground">Erros</p>
                <p className="text-2xl font-bold">{errorCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Total registros</p>
                <p className="text-2xl font-bold">{logs.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-lg">Histórico de Sincronizações</CardTitle>
            <div className="flex items-center gap-2">
              <Select value={filterEntity} onValueChange={setFilterEntity}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="product">Produto</SelectItem>
                  <SelectItem value="customer_lookup">Consulta Cliente</SelectItem>
                  <SelectItem value="company">Empresa</SelectItem>
                  <SelectItem value="contact">Contato</SelectItem>
                  <SelectItem value="order">Pedido</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="success">Sucesso</SelectItem>
                  <SelectItem value="failed">Erro</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              {loading ? 'Carregando...' : 'Nenhum log de sincronização encontrado'}
            </p>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Direção</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Erro</TableHead>
                    <TableHead className="text-right">Detalhes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => {
                    const statusCfg = STATUS_CONFIG[log.status] || STATUS_CONFIG.pending;
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {format(new Date(log.created_at), "dd/MM/yy HH:mm:ss", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {ENTITY_LABELS[log.entity_type] || log.entity_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {DIRECTION_LABELS[log.direction] || log.direction}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusCfg.variant} className="gap-1">
                            {statusCfg.icon}
                            {statusCfg.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[250px] truncate text-sm text-destructive">
                          {log.error_message || '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedLog(log)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
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

      {/* Modal de detalhes */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Detalhes da Sincronização</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 pr-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Tipo</p>
                    <p className="font-medium">{ENTITY_LABELS[selectedLog.entity_type] || selectedLog.entity_type}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Direção</p>
                    <p className="font-medium">{DIRECTION_LABELS[selectedLog.direction] || selectedLog.direction}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <Badge variant={STATUS_CONFIG[selectedLog.status]?.variant || 'secondary'}>
                      {STATUS_CONFIG[selectedLog.status]?.label || selectedLog.status}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Data/Hora</p>
                    <p className="font-medium">
                      {format(new Date(selectedLog.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Entity ID</p>
                    <p className="font-mono text-xs break-all">{selectedLog.entity_id}</p>
                  </div>
                </div>

                {selectedLog.error_message && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Mensagem de Erro</p>
                    <div className="bg-destructive/10 text-destructive rounded p-3 text-sm">
                      {selectedLog.error_message}
                    </div>
                  </div>
                )}

                {selectedLog.request_payload && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Payload Enviado</p>
                    <pre className="bg-muted rounded p-3 text-xs overflow-auto max-h-48 whitespace-pre-wrap">
                      {JSON.stringify(selectedLog.request_payload, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedLog.response_payload && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Resposta do ERP</p>
                    <pre className="bg-muted rounded p-3 text-xs overflow-auto max-h-48 whitespace-pre-wrap">
                      {JSON.stringify(selectedLog.response_payload, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
