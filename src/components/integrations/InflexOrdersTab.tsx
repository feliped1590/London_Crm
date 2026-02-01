import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  XCircle,
  Loader2,
  ShoppingCart,
  Database,
  ChevronLeft,
  ChevronRight,
  Eye,
  Package,
  AlertCircle,
  Calendar,
  DollarSign,
  User,
} from 'lucide-react';
import { toast } from 'sonner';
import { useInflexConfig } from '@/hooks/useInflexConfig';

interface CRMOrder {
  id: string;
  external_id: string;
  numero_pedido: string | null;
  client_external_id: string | null;
  client_id: string | null;
  tipo_pedido: string | null;
  status: string | null;
  situacao: string | null;
  data_emissao: string | null;
  data_entrega: string | null;
  data_alteracao_erp: string | null;
  valor_total: number | null;
  valor_desconto: number | null;
  valor_frete: number | null;
  synced_at: string | null;
  crm_clients?: {
    razao_social: string | null;
    nome_fantasia: string | null;
  } | null;
}

interface CRMOrderItem {
  id: string;
  order_id: string;
  product_external_id: string | null;
  product_id: string | null;
  descricao: string | null;
  quantidade: number | null;
  unidade: string | null;
  valor_unitario: number | null;
  valor_total: number | null;
  crm_products?: {
    descricao: string | null;
    versao: string | null;
  } | null;
}

interface SyncResult {
  success: boolean;
  entity: string;
  processed: number;
  created: number;
  updated: number;
  last_sync_at: string;
}

const PAGE_SIZE = 25;

export function InflexOrdersTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const { config, isConfigured } = useInflexConfig();

  // Query para buscar pedidos do banco (crm_orders)
  const { data: orders, isLoading } = useQuery({
    queryKey: ['crm-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_orders')
        .select(`
          *,
          crm_clients (
            razao_social,
            nome_fantasia
          )
        `)
        .order('data_alteracao_erp', { ascending: false });
      if (error) throw error;
      return data as CRMOrder[];
    },
  });

  // Query para buscar itens do pedido selecionado
  const { data: orderItems, isLoading: isLoadingItems } = useQuery({
    queryKey: ['crm-order-items', selectedOrderId],
    queryFn: async () => {
      if (!selectedOrderId) return [];
      const { data, error } = await supabase
        .from('crm_order_items')
        .select(`
          *,
          crm_products (
            descricao,
            versao
          )
        `)
        .eq('order_id', selectedOrderId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as CRMOrderItem[];
    },
    enabled: !!selectedOrderId,
  });

  // Query para última sincronização
  const { data: syncControl } = useQuery({
    queryKey: ['erp-sync-control-pedidos'],
    queryFn: async () => {
      const { data } = await supabase
        .from('erp_sync_control')
        .select('*')
        .eq('entity', 'pedidos')
        .maybeSingle();
      return data;
    },
  });

  // Mutation para sincronizar pedidos
  const syncMutation = useMutation({
    mutationFn: async () => {
      if (!config.baseUrl || !config.token) {
        throw new Error('Configure as credenciais do Iniflex primeiro');
      }

      const { data, error } = await supabase.functions.invoke('sync-iniflex-orders', {
        body: {
          baseUrl: config.baseUrl,
          token: config.token,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Erro na sincronização');
      return data as SyncResult;
    },
    onSuccess: (data) => {
      setLastSyncResult(data);
      queryClient.invalidateQueries({ queryKey: ['crm-orders'] });
      queryClient.invalidateQueries({ queryKey: ['erp-sync-control-pedidos'] });
      toast.success(
        `Sincronização concluída: ${data.created} criados, ${data.updated} atualizados`
      );
    },
    onError: (error) => {
      toast.error(`Erro na sincronização: ${error.message}`);
    },
  });

  // Filtrar pedidos
  const filteredOrders = orders?.filter(order => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    const clientName = order.crm_clients?.razao_social || order.crm_clients?.nome_fantasia || '';
    return (
      order.numero_pedido?.toLowerCase().includes(searchLower) ||
      order.external_id?.toLowerCase().includes(searchLower) ||
      clientName.toLowerCase().includes(searchLower) ||
      order.status?.toLowerCase().includes(searchLower) ||
      order.situacao?.toLowerCase().includes(searchLower)
    );
  }) || [];

  // Paginação
  const totalPages = Math.ceil(filteredOrders.length / PAGE_SIZE);
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  // Estatísticas
  const totalOrders = orders?.length || 0;
  const totalValue = orders?.reduce((sum, o) => sum + (o.valor_total || 0), 0) || 0;
  const statusCounts = orders?.reduce((acc, o) => {
    const status = o.status || 'Sem status';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  // Formatar valor
  const formatCurrency = (value: number | null) => {
    if (value === null) return '-';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  // Badge de status
  const getStatusBadge = (status: string | null) => {
    if (!status) return <Badge variant="outline">-</Badge>;
    
    const statusLower = status.toLowerCase();
    if (statusLower.includes('faturado') || statusLower.includes('concluido')) {
      return <Badge variant="secondary" className="bg-primary/10 text-primary">{status}</Badge>;
    }
    if (statusLower.includes('cancelado')) {
      return <Badge variant="destructive">{status}</Badge>;
    }
    if (statusLower.includes('pendente') || statusLower.includes('aberto')) {
      return <Badge variant="secondary" className="bg-accent text-accent-foreground">{status}</Badge>;
    }
    return <Badge variant="outline">{status}</Badge>;
  };

  // Formatar data do ERP (DD/MM/YYYY ou DD/MM/YYYY HH:MI:SS)
  const formatErpDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    // Já está no formato DD/MM/YYYY, retornar apenas a data
    return dateStr.split(' ')[0];
  };

  // Pedido selecionado para modal
  const selectedOrder = orders?.find(o => o.id === selectedOrderId);

  return (
    <div className="space-y-6">
      {/* Card de Sincronização */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Sincronização de Pedidos
              </CardTitle>
              <CardDescription>
                Importação incremental de pedidos do ERP Iniflex
              </CardDescription>
            </div>
            
            <Button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending || !isConfigured}
            >
              {syncMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Sincronizar Pedidos
            </Button>
          </div>
        </CardHeader>
        
        <CardContent>
          {!isConfigured && (
            <div className="flex items-center gap-2 p-3 bg-accent/50 border border-border rounded-lg mb-4">
              <AlertCircle className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Configure as credenciais do Iniflex na aba Sandbox para habilitar a sincronização
              </span>
            </div>
          )}
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Última sincronização */}
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground">Última sincronização</div>
              <div className="text-lg font-semibold">
                {syncControl?.last_sync_at 
                  ? new Date(syncControl.last_sync_at).toLocaleString('pt-BR')
                  : 'Nunca'}
              </div>
            </div>
            
            {/* Último resultado */}
            {lastSyncResult && (
              <>
                <div className="p-3 bg-muted rounded-lg">
                  <div className="text-sm text-muted-foreground">Processados</div>
                  <div className="text-lg font-semibold">{lastSyncResult.processed}</div>
                </div>
                <div className="p-3 bg-primary/10 rounded-lg">
                  <div className="text-sm text-primary">Criados</div>
                  <div className="text-lg font-semibold text-primary">{lastSyncResult.created}</div>
                </div>
                <div className="p-3 bg-secondary rounded-lg">
                  <div className="text-sm text-secondary-foreground">Atualizados</div>
                  <div className="text-lg font-semibold text-secondary-foreground">{lastSyncResult.updated}</div>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <ShoppingCart className="h-8 w-8 text-primary" />
              <div>
                <div className="text-2xl font-bold">{totalOrders}</div>
                <div className="text-sm text-muted-foreground">Total de Pedidos</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-primary" />
              <div>
                <div className="text-2xl font-bold">{formatCurrency(totalValue)}</div>
                <div className="text-sm text-muted-foreground">Valor Total</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {Object.entries(statusCounts).slice(0, 2).map(([status, count]) => (
          <Card key={status}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Package className="h-8 w-8 text-muted-foreground" />
                <div>
                  <div className="text-2xl font-bold">{count}</div>
                  <div className="text-sm text-muted-foreground">{status}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabela de Pedidos */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Pedidos Sincronizados</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por número ou cliente..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {orders?.length === 0 
                ? 'Nenhum pedido sincronizado. Clique em "Sincronizar Pedidos" para iniciar.'
                : 'Nenhum pedido encontrado com os filtros aplicados.'
              }
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Data Emissão</TableHead>
                    <TableHead>Data Entrega</TableHead>
                    <TableHead className="text-right">Valor Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead className="w-[80px]">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">
                        {order.numero_pedido || order.external_id}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="truncate max-w-[200px]">
                            {order.crm_clients?.razao_social || 
                             order.crm_clients?.nome_fantasia || 
                             order.client_external_id || 
                             '-'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {formatErpDate(order.data_emissao)}
                        </div>
                      </TableCell>
                      <TableCell>{formatErpDate(order.data_entrega)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(order.valor_total)}
                      </TableCell>
                      <TableCell>{getStatusBadge(order.status)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{order.situacao || '-'}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedOrderId(order.id)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Paginação */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <div className="text-sm text-muted-foreground">
                    Mostrando {(currentPage - 1) * PAGE_SIZE + 1} a{' '}
                    {Math.min(currentPage * PAGE_SIZE, filteredOrders.length)} de{' '}
                    {filteredOrders.length} pedidos
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm">
                      Página {currentPage} de {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal de Detalhes do Pedido */}
      <Dialog open={!!selectedOrderId} onOpenChange={(open) => !open && setSelectedOrderId(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Pedido {selectedOrder?.numero_pedido || selectedOrder?.external_id}
            </DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="max-h-[60vh]">
            {selectedOrder && (
              <div className="space-y-6">
                {/* Dados do Cabeçalho */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Cliente</div>
                    <div className="font-medium">
                      {selectedOrder.crm_clients?.razao_social || 
                       selectedOrder.crm_clients?.nome_fantasia || 
                       selectedOrder.client_external_id || 
                       '-'}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Data Emissão</div>
                    <div className="font-medium">{formatErpDate(selectedOrder.data_emissao)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Data Entrega</div>
                    <div className="font-medium">{formatErpDate(selectedOrder.data_entrega)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Status</div>
                    <div>{getStatusBadge(selectedOrder.status)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Situação</div>
                    <div><Badge variant="outline">{selectedOrder.situacao || '-'}</Badge></div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Tipo</div>
                    <div className="font-medium">{selectedOrder.tipo_pedido || '-'}</div>
                  </div>
                </div>

                {/* Valores */}
                <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
                  <div>
                    <div className="text-sm text-muted-foreground">Valor Total</div>
                    <div className="text-xl font-bold text-primary">
                      {formatCurrency(selectedOrder.valor_total)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Desconto</div>
                    <div className="font-medium">{formatCurrency(selectedOrder.valor_desconto)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Frete</div>
                    <div className="font-medium">{formatCurrency(selectedOrder.valor_frete)}</div>
                  </div>
                </div>

                {/* Itens do Pedido */}
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Itens do Pedido
                  </h4>
                  
                  {isLoadingItems ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : orderItems && orderItems.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produto</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead className="text-right">Qtd</TableHead>
                          <TableHead>Un</TableHead>
                          <TableHead className="text-right">Vlr Unit</TableHead>
                          <TableHead className="text-right">Vlr Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orderItems.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-mono text-sm">
                              {item.product_external_id || '-'}
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate">
                              {item.descricao || item.crm_products?.descricao || '-'}
                            </TableCell>
                            <TableCell className="text-right">{item.quantidade || 0}</TableCell>
                            <TableCell>{item.unidade || '-'}</TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(item.valor_unitario)}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(item.valor_total)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground">
                      Nenhum item encontrado para este pedido
                    </div>
                  )}
                </div>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
