import { useEffect, useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, ShoppingCart, Building2, Calendar, Plus, Edit, RefreshCw, FileText, Loader2, Truck, RefreshCcw, Lock, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { OrderSyncBadge, OrderSyncButton } from '@/components/orders/OrderSyncStatus';
import { OrderSyncProvider } from '@/components/sync/SyncBatchProviders';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { Order, orderStatusConfig, OrderStatus, orderTypeConfig, OrderType } from '@/types/products';
import { OrderDialog } from '@/components/orders/OrderDialog';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import { useLegalEntities } from '@/hooks/useLegalEntities';
import { PermissionAction } from '@/lib/permissions/permissionEngine';
import { cn } from '@/lib/utils';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useResponsiveDensity } from '@/hooks/useResponsiveDensity';
import { ServerPagination } from '@/components/ui/server-pagination';

// Explicit columns used by the list (avoids `select('*')` payload).
const ORDER_LIST_COLUMNS = `
  id, number, status, order_type, total_value,
  payment_method, payment_terms, delivery_date, observations, freight_type,
  freight_value, is_locked, locked_at, locked_by, created_at, updated_at,
  delivery_same_as_company, delivery_city, delivery_state,
  legal_entity_id, company_id, contact_id, proposal_id, carrier_id, redespacho_carrier_id, sale_type, deal_id,
  sales_rep_id, erp_order_id, erp_synced_at,
  company:companies(id, name),
  contact:contacts(id, first_name, last_name),
  proposal:proposals(id, number),
  carrier:carriers!orders_carrier_id_fkey(id, name, trade_name),
  deal:deals(id, name, pipeline_stage:pipeline_stages(id, name))
`;

const freightBadgeStyles: Record<string, string> = {
  CIF: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
  FOB: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
  REDESPACHO: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800',
};

export default function Orders() {
  const queryClient = useQueryClient();
  const { isAdmin, can } = useModulePermissions();
  const { activeLegalEntityId, isContextReady } = useLegalEntities();
  const density = useResponsiveDensity();
  const canCreateOrders = can('orders', PermissionAction.Create);
  const canEditOrders = can('orders', PermissionAction.Edit);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebouncedValue(searchTerm, 350);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCarrier, setFilterCarrier] = useState<string>('all');
  const [filterErpStatus, setFilterErpStatus] = useState<string>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [generatingPdfId, setGeneratingPdfId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filterStatus, filterCarrier, filterErpStatus, activeLegalEntityId, pageSize]);

  const { data: ordersPage, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['orders', activeLegalEntityId, filterStatus, filterCarrier, filterErpStatus, debouncedSearch, page, pageSize],
    queryFn: async () => {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('orders')
        .select(ORDER_LIST_COLUMNS, { count: 'exact' })
        .eq('legal_entity_id', activeLegalEntityId!)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (filterStatus !== 'all') query = query.eq('status', filterStatus as any);
      if (filterCarrier !== 'all') query = query.eq('carrier_id', filterCarrier);
      if (filterErpStatus === 'synced') query = query.not('erp_order_id', 'is', null);
      if (filterErpStatus === 'not_synced') query = query.is('erp_order_id', null);

      if (debouncedSearch) {
        const term = debouncedSearch.trim();
        query = query.or(`number.ilike.%${term}%,erp_order_id.ilike.%${term}%`);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { rows: (data ?? []) as unknown as Order[], count: count ?? 0 };
    },
    enabled: isContextReady,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  const orders = ordersPage?.rows;
  const totalOrders = ordersPage?.count ?? 0;

  // Aggregated status stats (independent of pagination/page).
  const { data: statusStats } = useQuery({
    queryKey: ['orders_status_stats', activeLegalEntityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('status, total_value')
        .eq('legal_entity_id', activeLegalEntityId!);
      if (error) throw error;
      const agg = new Map<string, { count: number; value: number }>();
      (data ?? []).forEach((o: any) => {
        const cur = agg.get(o.status) ?? { count: 0, value: 0 };
        cur.count += 1;
        cur.value += Number(o.total_value || 0);
        agg.set(o.status, cur);
      });
      return agg;
    },
    enabled: isContextReady,
    staleTime: 60_000,
  });

  // Carrier filter options come from a small dedicated query so the dropdown
  // is stable across pagination changes.
  const { data: carrierFilterOptions = [] } = useQuery({
    queryKey: ['orders_carrier_options', activeLegalEntityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('carriers')
        .select('id, name, trade_name')
        .order('name');
      if (error) throw error;
      return (data ?? []).map((c: any) => ({ id: c.id, name: c.trade_name || c.name }));
    },
    enabled: isContextReady,
    staleTime: 10 * 60_000,
  });


  const handleRefresh = async () => {
    await refetch();
    toast.success('Dados atualizados!');
  };

  const handleEditOrder = (order: Order) => {
    setEditingOrderId(order.id);
    setIsEditDialogOpen(true);
  };

  // Derive the live order from the query cache so lock/unlock changes
  // are reflected immediately in the open dialog (no stale snapshot).
  const editingOrder = useMemo(
    () => (editingOrderId ? orders?.find((o) => o.id === editingOrderId) ?? null : null),
    [orders, editingOrderId],
  );

  const handleGeneratePdf = async (order: Order) => {
    setGeneratingPdfId(order.id);
    try {
      const { data, error } = await supabase.functions.invoke('generate-order-pdf', {
        body: { order_id: order.id },
      });

      if (error) throw error;

      if (data?.html) {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(data.html);
          printWindow.document.close();
          printWindow.focus();
          setTimeout(() => printWindow.print(), 500);
        } else {
          toast.error('Pop-up bloqueado. Permita pop-ups para gerar o PDF.');
        }
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Erro ao gerar PDF do pedido');
    } finally {
      setGeneratingPdfId(null);
    }
  };

  const canEditOrder = (order: Order) => {
    if (!canEditOrders) return false;
    if (order.status === 'pendente') return true;
    return isAdmin;
  };

  // Server-side filters + pagination already applied.
  const filteredOrders = orders;
  // IDs visíveis na página — usados pelo OrderSyncProvider para fazer
  // uma única query agregada de sync status em vez de 1 por linha.
  const visibleOrderIds = useMemo(() => (filteredOrders ?? []).map((o) => o.id), [filteredOrders]);

  const getStatusStats = () => {
    if (!statusStats) return [];
    return Object.entries(orderStatusConfig)
      .map(([status, config]) => {
        const agg = statusStats.get(status);
        return {
          status,
          label: config.label,
          color: config.color,
          count: agg?.count ?? 0,
          value: agg?.value ?? 0,
        };
      })
      .filter((s) => s.count > 0);
  };


  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">Pedidos</h1>
          <p className="text-sm text-muted-foreground">Gerencie os pedidos de venda</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isFetching}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Atualizar</span>
          </Button>
          {canCreateOrders && (
            <Button onClick={() => setIsCreateDialogOpen(true)} size="sm">
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Novo Pedido</span>
              <span className="sm:hidden">Novo</span>
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {getStatusStats().map((stat) => (
          <Card
            key={stat.status}
            className="relative overflow-hidden border-border-subtle shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] hover:-translate-y-0.5 transition-all duration-200"
          >
            <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-brand" />
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-2 gap-2">
                <Badge className={cn(stat.color, "text-xs")}>{stat.label}</Badge>
                <span className="text-xl sm:text-2xl font-display font-semibold tabular-nums">{stat.count}</span>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground truncate tabular-nums">{formatCurrency(stat.value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="border-border-subtle shadow-[var(--shadow-sm)]">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por número ou empresa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="grid grid-cols-1 sm:flex sm:flex-row gap-2 sm:gap-3">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Status</SelectItem>
                  {Object.entries(orderStatusConfig).map(([value, config]) => (
                    <SelectItem key={value} value={value}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterCarrier} onValueChange={setFilterCarrier}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <Truck className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Transportadora" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas Transportadoras</SelectItem>
                  {carrierFilterOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterErpStatus} onValueChange={setFilterErpStatus}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Status ERP" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos (ERP)</SelectItem>
                  <SelectItem value="synced">Sincronizados</SelectItem>
                  <SelectItem value="not_synced">Não enviados</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card className="border-border-subtle shadow-[var(--shadow-sm)] overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
           ) : filteredOrders && filteredOrders.length > 0 ? (
             <OrderSyncProvider ids={visibleOrderIds}>
             <div className="table-responsive">
               <Table className="min-w-[760px]" data-density={density}>
                 <TableHeader>
                   <TableRow>
                     <TableHead className="sticky-col-start">Número</TableHead>
                     <TableHead className="hidden xl:table-cell">Tipo</TableHead>
                     <TableHead>Empresa</TableHead>
                     <TableHead className="hidden 2xl:table-cell">Logística</TableHead>
                     <TableHead>Status</TableHead>
                     <TableHead className="hidden xl:table-cell">Pedido ERP</TableHead>
                     <TableHead>Sinc. ERP</TableHead>
                    <TableHead className="hidden lg:table-cell">Entrega Prevista</TableHead>
                    <TableHead className="hidden md:table-cell">Valor Total</TableHead>
                    <TableHead className="hidden 2xl:table-cell">Data Criação</TableHead>
                    <TableHead className="text-right sticky-col-end">Ações</TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {filteredOrders.map((order) => {
                     const carrier = (order as any).carrier;
                     const freightType = (order as any).freight_type;
                     const carrierName = carrier?.trade_name || carrier?.name;

                     return (
                       <TableRow key={order.id}>
                         <TableCell className="font-mono font-medium sticky-col-start">
                           <div className="flex items-center gap-1.5">
                             {(order as any).is_locked && (
                               <Tooltip>
                                 <TooltipTrigger asChild>
                                   <Lock className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
                                 </TooltipTrigger>
                                 <TooltipContent>Pedido bloqueado</TooltipContent>
                               </Tooltip>
                             )}
                             {order.number}
                           </div>
                          </TableCell>
                          <TableCell className="hidden xl:table-cell">
                            {(() => {
                              const ot = (order as any).order_type as OrderType || 'Novo/Alteração';
                              const cfg = orderTypeConfig[ot] || orderTypeConfig['Novo/Alteração'];
                              return <Badge variant="outline" className={cfg.color}>{cfg.label}</Badge>;
                            })()}
                          </TableCell>
                          <TableCell>
                            {order.company && (
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                  <Building2 className="h-4 w-4 text-muted-foreground" />
                                  {order.company.name}
                                </div>
                                {(order as any).deal && (
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground pl-6">
                                    <span className="truncate max-w-[180px]" title={(order as any).deal.name}>
                                      Negócio: {(order as any).deal.name}
                                    </span>
                                    {(order as any).deal.pipeline_stage?.name && (
                                      <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4">
                                        {(order as any).deal.pipeline_stage.name}
                                      </Badge>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="hidden 2xl:table-cell">
                            {(carrierName || freightType) ? (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex items-center gap-1.5 cursor-default">
                                      {freightType === 'REDESPACHO' ? (
                                        <RefreshCcw className="h-3.5 w-3.5 text-orange-500 flex-shrink-0" />
                                      ) : (
                                        <Truck className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                      )}
                                      {carrierName && (
                                        <span className="text-sm font-medium truncate max-w-[120px]">{carrierName}</span>
                                      )}
                                      {freightType && (
                                        <Badge variant="outline" className={`text-xs font-semibold ${freightBadgeStyles[freightType] || ''}`}>
                                          {freightType}
                                        </Badge>
                                      )}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="bottom" className="text-xs space-y-1">
                                    {carrierName && <p><span className="text-muted-foreground">Transportadora:</span> {carrierName}</p>}
                                    {freightType && <p><span className="text-muted-foreground">Frete:</span> {freightType}</p>}
                                    {(order as any).delivery_same_as_company === false && (order as any).delivery_city ? (
                                      <p><span className="text-muted-foreground">Entrega:</span> {(order as any).delivery_city}{(order as any).delivery_state ? `/${(order as any).delivery_state}` : ''}</p>
                                    ) : (
                                      <p><span className="text-muted-foreground">Entrega:</span> Mesmo endereço do cliente</p>
                                    )}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge className={orderStatusConfig[order.status].color}>
                              {orderStatusConfig[order.status].label}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm hidden xl:table-cell">
                            {(order as any).erp_order_id ? (
                              <span className="font-medium">{(order as any).erp_order_id}</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <OrderSyncBadge
                              orderId={order.id}
                              erpOrderId={(order as any).erp_order_id}
                              erpSyncedAt={(order as any).erp_synced_at}
                              updatedAt={(order as any).updated_at}
                            />
                          </TableCell>
                         <TableCell className="hidden lg:table-cell">
                           {order.delivery_date && (
                             <div className="flex items-center gap-2">
                               <Calendar className="h-4 w-4 text-muted-foreground" />
                               {formatDate(order.delivery_date)}
                             </div>
                           )}
                         </TableCell>
                         <TableCell className="font-medium hidden md:table-cell">{formatCurrency(order.total_value || 0)}</TableCell>
                         <TableCell className="text-muted-foreground hidden 2xl:table-cell">{formatDate(order.created_at)}</TableCell>
                          <TableCell className="text-right sticky-col-end">
                            <div className="flex items-center justify-end gap-1">
                              <OrderSyncButton
                                orderId={order.id}
                                orderNumber={order.number}
                                erpOrderId={(order as any).erp_order_id}
                                onSyncTriggered={() => {
                                  queryClient.invalidateQueries({ queryKey: ['orders'] });
                                  queryClient.invalidateQueries({ queryKey: ['order_sync_status', order.id] });
                                  queryClient.invalidateQueries({ queryKey: ['order_sync_status_btn', order.id] });
                                }}
                              />
                             {canEditOrder(order) && (
                               <Button 
                                 variant="ghost" 
                                 size="icon" 
                                 onClick={() => handleEditOrder(order)}
                                 title="Editar pedido"
                               >
                                 <Edit className="h-4 w-4" />
                               </Button>
                             )}
                             <Button 
                               variant="ghost" 
                               size="icon" 
                               onClick={() => handleGeneratePdf(order)}
                               disabled={generatingPdfId === order.id}
                               title="Gerar PDF"
                             >
                               {generatingPdfId === order.id ? (
                                 <Loader2 className="h-4 w-4 animate-spin" />
                               ) : (
                                 <FileText className="h-4 w-4" />
                               )}
                             </Button>
                           </div>
                         </TableCell>
                       </TableRow>
                     );
                   })}
                 </TableBody>
               </Table>
             </div>
             </OrderSyncProvider>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mb-4" />
              <p>Nenhum pedido encontrado</p>
              <p className="text-sm">Os pedidos são gerados automaticamente quando uma proposta é aprovada ou criados manualmente</p>
            </div>
          )}
          <div className="px-4">
            <ServerPagination
              page={page}
              pageSize={pageSize}
              total={totalOrders}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              isFetching={isFetching}
            />
          </div>
        </CardContent>
      </Card>


      {/* Create Order Dialog */}
      <OrderDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['orders'] })}
        canClone={canCreateOrders}
      />

      {/* Edit Order Dialog */}
      <OrderDialog
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) setEditingOrderId(null);
        }}
        order={editingOrder}
        canClone={canCreateOrders}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['orders'] });
        }}
      />
    </div>
  );
}
