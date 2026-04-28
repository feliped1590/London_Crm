import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, ShoppingCart, Building2, Calendar, Plus, Edit, RefreshCw, FileText, Loader2, Truck, RefreshCcw, Lock } from 'lucide-react';
import { OrderSyncBadge, OrderSyncButton } from '@/components/orders/OrderSyncStatus';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { Order, orderStatusConfig, OrderStatus, orderTypeConfig, OrderType } from '@/types/products';
import { OrderDialog } from '@/components/orders/OrderDialog';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import { PermissionAction } from '@/lib/permissions/permissionEngine';
import { cn } from '@/lib/utils';

const freightBadgeStyles: Record<string, string> = {
  CIF: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
  FOB: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
  REDESPACHO: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800',
};

export default function Orders() {
  const queryClient = useQueryClient();
  const { isAdmin, can } = useModulePermissions();
  const canCreateOrders = can('orders', PermissionAction.Create);
  const canEditOrders = can('orders', PermissionAction.Edit);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCarrier, setFilterCarrier] = useState<string>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [generatingPdfId, setGeneratingPdfId] = useState<string | null>(null);
  const [filterErpStatus, setFilterErpStatus] = useState<string>('all');

  const { data: orders, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['orders', filterStatus],
    queryFn: async () => {
      let query = supabase
        .from('orders')
        .select(`
          *,
          company:companies(id, name),
          contact:contacts(id, first_name, last_name),
          proposal:proposals(id, number),
          carrier:carriers(id, name, trade_name)
        `)
        .order('created_at', { ascending: false })
        .limit(200);

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus as any);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as Order[];
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // Distinct carriers from loaded orders for filter dropdown
  const carrierFilterOptions = useMemo(() => {
    if (!orders) return [];
    const map = new Map<string, string>();
    orders.forEach((o: any) => {
      if (o.carrier) {
        map.set(o.carrier.id, o.carrier.trade_name || o.carrier.name);
      }
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [orders]);

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

  const filteredOrders = orders?.filter((o) => {
    const erpId = String((o as any).erp_order_id || '');
    const matchesSearch =
      o.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.company?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      erpId.includes(searchTerm);
    const matchesCarrier =
      filterCarrier === 'all' || (o as any).carrier?.id === filterCarrier;
    const matchesErpStatus =
      filterErpStatus === 'all' ||
      (filterErpStatus === 'synced' && (o as any).erp_order_id) ||
      (filterErpStatus === 'not_synced' && !(o as any).erp_order_id);
    return matchesSearch && matchesCarrier && matchesErpStatus;
  });

  const getStatusStats = () => {
    if (!orders) return [];
    const stats = Object.entries(orderStatusConfig).map(([status, config]) => ({
      status,
      label: config.label,
      color: config.color,
      count: orders.filter((o) => o.status === status).length,
      value: orders.filter((o) => o.status === status).reduce((sum, o) => sum + (o.total_value || 0), 0),
    }));
    return stats.filter((s) => s.count > 0);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Pedidos</h1>
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
          <Card key={stat.status}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-2 gap-2">
                <Badge className={cn(stat.color, "text-xs")}>{stat.label}</Badge>
                <span className="text-xl sm:text-2xl font-bold">{stat.count}</span>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">{formatCurrency(stat.value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
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
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
           ) : filteredOrders && filteredOrders.length > 0 ? (
             <div className="table-responsive">
               <Table className="min-w-[900px]">
                 <TableHeader>
                   <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Logística</TableHead>
                     <TableHead>Status</TableHead>
                     <TableHead>Pedido ERP</TableHead>
                     <TableHead>Sinc. ERP</TableHead>
                    <TableHead>Entrega Prevista</TableHead>
                    <TableHead>Valor Total</TableHead>
                    <TableHead>Data Criação</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {filteredOrders.map((order) => {
                     const carrier = (order as any).carrier;
                     const freightType = (order as any).freight_type;
                     const carrierName = carrier?.trade_name || carrier?.name;

                     return (
                       <TableRow key={order.id}>
                         <TableCell className="font-mono font-medium">
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
                         <TableCell>
                           {order.company && (
                             <div className="flex items-center gap-2">
                               <Building2 className="h-4 w-4 text-muted-foreground" />
                               {order.company.name}
                             </div>
                           )}
                          </TableCell>
                          <TableCell>
                            {(() => {
                              const ot = (order as any).order_type as OrderType || 'producao';
                              const cfg = orderTypeConfig[ot];
                              return <Badge variant="outline" className={cfg.color}>{cfg.label}</Badge>;
                            })()}
                          </TableCell>
                          <TableCell>
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
                          <TableCell className="font-mono text-sm">
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
                         <TableCell>
                           {order.delivery_date && (
                             <div className="flex items-center gap-2">
                               <Calendar className="h-4 w-4 text-muted-foreground" />
                               {formatDate(order.delivery_date)}
                             </div>
                           )}
                         </TableCell>
                         <TableCell className="font-medium">{formatCurrency(order.total_value || 0)}</TableCell>
                         <TableCell className="text-muted-foreground">{formatDate(order.created_at)}</TableCell>
                          <TableCell className="text-right">
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
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mb-4" />
              <p>Nenhum pedido encontrado</p>
              <p className="text-sm">Os pedidos são gerados automaticamente quando uma proposta é aprovada ou criados manualmente</p>
            </div>
          )}
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
