import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Check, AlertTriangle, CloudOff, XCircle, Search, ChevronLeft, ChevronRight, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

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

const PAGE_SIZE = 20;

export function IntegrationValidationPanel() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(0);

  // Debounce search
  const [searchTimer, setSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (searchTimer) clearTimeout(searchTimer);
    const timer = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(0);
    }, 400);
    setSearchTimer(timer);
  };

  // Summary counts — lightweight grouped query, no full table scan
  const { data: summary } = useQuery({
    queryKey: ['integration-status-summary'],
    queryFn: async () => {
      // Use raw SQL via RPC for optimal grouped count
      const { data, error } = await (supabase as any).rpc('get_integration_status_summary');
      if (!error && data) {
        const counts: Record<string, number> = { ready: 0, not_synced: 0, missing_data: 0, sync_error: 0 };
        (data || []).forEach((r: any) => {
          counts[r.status] = Number(r.count);
        });
        return counts;
      }
      // Fallback: 4 lightweight HEAD requests (count only, no rows transferred)
      const statuses = ['ready', 'not_synced', 'missing_data', 'sync_error'] as const;
      const results = await Promise.all(
        statuses.map(s =>
          supabase
            .from('companies')
            .select('id', { count: 'exact', head: true })
            .eq('active', true)
            .eq('integration_status', s)
        )
      );
      const counts: Record<string, number> = { ready: 0, not_synced: 0, missing_data: 0, sync_error: 0 };
      statuses.forEach((s, i) => {
        counts[s] = results[i].count ?? 0;
      });
      return counts;
    },
    staleTime: 30_000,
  });

  // Paginated list
  const { data: listData, isLoading, refetch } = useQuery({
    queryKey: ['integration-validation-list', statusFilter, debouncedSearch, page],
    queryFn: async () => {
      let query = supabase
        .from('companies')
        .select('id, name, cnpj, city, state, address, erp_code, integration_status, sales_rep_id', { count: 'exact' })
        .eq('active', true)
        .order('name')
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (statusFilter !== 'all') {
        query = query.eq('integration_status', statusFilter);
      }
      if (debouncedSearch) {
        query = query.or(`name.ilike.%${debouncedSearch}%,cnpj.ilike.%${debouncedSearch}%`);
      }

      const { data, count, error } = await query;
      if (error) throw error;
      return { items: data || [], total: count || 0 };
    },
    staleTime: 10_000,
  });

  const totalPages = Math.ceil((listData?.total || 0) / PAGE_SIZE);

  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
  const [errorDetail, setErrorDetail] = useState<{ open: boolean; companyName: string; error: string | null; loading: boolean }>({
    open: false, companyName: '', error: null, loading: false,
  });

  const handleViewError = async (companyId: string, companyName: string) => {
    setErrorDetail({ open: true, companyName, error: null, loading: true });
    try {
      const { data } = await (supabase as any)
        .from('company_sync_queue')
        .select('error_message, attempts, processed_at, created_at')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setErrorDetail({
        open: true,
        companyName,
        error: data?.error_message || 'Erro desconhecido (sem mensagem registrada)',
        loading: false,
      });
    } catch {
      setErrorDetail({ open: true, companyName, error: 'Falha ao buscar detalhes do erro', loading: false });
    }
  };

  const handleSync = async (companyId: string) => {
    setSyncingIds(prev => new Set(prev).add(companyId));
    try {
      toast.success('Cliente adicionado à fila de envio ao ERP');
      await supabase.functions.invoke('process-company-sync', {
        body: { company_id: companyId },
      }).catch(() => {});
      // Refetch after response instead of fixed timeout
      refetch();
    } finally {
      setTimeout(() => {
        setSyncingIds(prev => {
          const next = new Set(prev);
          next.delete(companyId);
          return next;
        });
      }, 2000);
    }
  };

  const getMissingFields = (item: any) => {
    const missing: string[] = [];
    if (!item.cnpj) missing.push('CNPJ');
    if (!item.city) missing.push('Cidade');
    if (!item.state) missing.push('Estado');
    if (!item.address) missing.push('Endereço');
    return missing;
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

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou CNPJ..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
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
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : (listData?.items || []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhum cliente encontrado
                  </TableCell>
                </TableRow>
              ) : (
                (listData?.items || []).map((item: any) => {
                  const status = item.integration_status || 'not_synced';
                  const config = STATUS_CONFIG[status] || STATUS_CONFIG.not_synced;
                  const Icon = config.icon;
                  const missing = status === 'missing_data' ? getMissingFields(item) : [];
                  const isSyncing = syncingIds.has(item.id);

                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-sm">{item.cnpj || '—'}</TableCell>
                      <TableCell className="text-sm">
                        {item.city && item.state ? `${item.city}/${item.state}` : '—'}
                      </TableCell>
                      <TableCell className="text-sm">{item.erp_code || '—'}</TableCell>
                      <TableCell>
                        {status === 'sync_error' ? (
                          <Badge
                            variant="outline"
                            className={`gap-1 cursor-pointer hover:opacity-80 ${config.color}`}
                            onClick={() => handleViewError(item.id, item.name)}
                          >
                            <Icon className="h-3 w-3" />
                            {config.label}
                          </Badge>
                        ) : (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="outline" className={`gap-1 ${config.color}`}>
                                  <Icon className="h-3 w-3" />
                                  {config.label}
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
                        {(status === 'not_synced' || status === 'missing_data' || status === 'sync_error') && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => (status === 'not_synced' || status === 'sync_error') && handleSync(item.id)}
                                  disabled={isSyncing || status === 'missing_data'}
                                  className={status === 'missing_data' ? 'opacity-50 cursor-not-allowed' : ''}
                                >
                                  {isSyncing ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Send className="h-4 w-4" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {status === 'missing_data'
                                  ? `Complete os dados antes de enviar (falta: ${missing.join(', ')})`
                                  : status === 'sync_error' ? 'Retentar envio ao ERP' : 'Enviar ao ERP'}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
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
          <p className="text-sm text-muted-foreground">
            {(listData?.total || 0).toLocaleString('pt-BR')} clientes
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              {page + 1} / {totalPages}
            </span>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Error Detail Dialog */}
      <Dialog open={errorDetail.open} onOpenChange={(open) => setErrorDetail(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              Erro de Sincronização
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Cliente</p>
              <p className="font-medium">{errorDetail.companyName}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Detalhes do erro</p>
              {errorDetail.loading ? (
                <div className="flex items-center gap-2 py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Carregando...</span>
                </div>
              ) : (
                <pre className="mt-1 p-3 bg-muted rounded-md text-sm whitespace-pre-wrap break-words max-h-[300px] overflow-y-auto">
                  {errorDetail.error}
                </pre>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
