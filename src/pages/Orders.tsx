import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, ShoppingCart, Eye, Building2, User, Calendar, Package, Plus, Edit, History, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { Order, OrderItem, orderStatusConfig, OrderStatus } from '@/types/products';
import { OrderDialog } from '@/components/orders/OrderDialog';
import { OrderHistoryTab } from '@/components/orders/OrderHistoryTab';
import { useModulePermissions } from '@/hooks/useModulePermissions';

export default function Orders() {
  const queryClient = useQueryClient();
  const { isAdmin } = useModulePermissions();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [orderToEdit, setOrderToEdit] = useState<Order | null>(null);
  const [newStatus, setNewStatus] = useState<OrderStatus | null>(null);

  const { data: orders, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['orders', filterStatus],
    queryFn: async () => {
      let query = supabase
        .from('orders')
        .select(`
          *,
          company:companies(id, name),
          contact:contacts(id, first_name, last_name),
          proposal:proposals(id, number)
        `)
        .order('created_at', { ascending: false })
        .limit(200);

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus as OrderStatus);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as Order[];
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const handleRefresh = async () => {
    await refetch();
    toast.success('Dados atualizados!');
  };

  const { data: orderItems } = useQuery({
    queryKey: ['order_items', selectedOrder?.id],
    queryFn: async () => {
      if (!selectedOrder) return [];
      const { data, error } = await supabase
        .from('order_items')
        .select(`
          *,
          product:products(id, sku, name)
        `)
        .eq('order_id', selectedOrder.id)
        .order('sort_order');

      if (error) throw error;
      return data as OrderItem[];
    },
    enabled: !!selectedOrder,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: OrderStatus }) => {
      const { error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order_audit_log'] });
      toast.success('Status atualizado!');
      setNewStatus(null);
    },
    onError: () => toast.error('Erro ao atualizar status'),
  });

  const handleViewOrder = (order: Order) => {
    setSelectedOrder(order);
    setNewStatus(order.status);
    setIsViewDialogOpen(true);
  };

  const handleEditOrder = (order: Order) => {
    setOrderToEdit(order);
    setIsEditDialogOpen(true);
  };

  const handleUpdateStatus = () => {
    if (selectedOrder && newStatus) {
      updateStatusMutation.mutate({ id: selectedOrder.id, status: newStatus });
    }
  };

  // Check if user can edit a specific order
  const canEditOrder = (order: Order) => {
    if (order.status === 'pendente') return true;
    return isAdmin;
  };

  const filteredOrders = orders?.filter((o) =>
    o.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.company?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Pedidos</h1>
          <p className="text-muted-foreground">Gerencie os pedidos de venda</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isFetching}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Pedido
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {getStatusStats().map((stat) => (
          <Card key={stat.status}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-2">
                <Badge className={stat.color}>{stat.label}</Badge>
                <span className="text-2xl font-bold">{stat.count}</span>
              </div>
              <p className="text-sm text-muted-foreground">{formatCurrency(stat.value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por número ou empresa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                {Object.entries(orderStatusConfig).map(([value, config]) => (
                  <SelectItem key={value} value={value}>{config.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Entrega Prevista</TableHead>
                  <TableHead>Valor Total</TableHead>
                  <TableHead>Data Criação</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono font-medium">{order.number}</TableCell>
                    <TableCell>
                      {order.company && (
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          {order.company.name}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {order.contact && (
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          {order.contact.first_name} {order.contact.last_name}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={orderStatusConfig[order.status].color}>
                        {orderStatusConfig[order.status].label}
                      </Badge>
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
                          onClick={() => handleViewOrder(order)}
                          title="Visualizar pedido"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mb-4" />
              <p>Nenhum pedido encontrado</p>
              <p className="text-sm">Os pedidos são gerados automaticamente quando uma proposta é aprovada ou criados manualmente</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Order Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Pedido {selectedOrder?.number}
            </DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="details">Detalhes</TabsTrigger>
                <TabsTrigger value="items">Itens</TabsTrigger>
                <TabsTrigger value="history" className="flex items-center gap-1">
                  <History className="h-3 w-3" />
                  Histórico
                </TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-6">
                {/* Order Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Empresa</Label>
                    <p className="font-medium">{selectedOrder.company?.name || '-'}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Contato</Label>
                    <p className="font-medium">
                      {selectedOrder.contact
                        ? `${selectedOrder.contact.first_name} ${selectedOrder.contact.last_name || ''}`
                        : '-'}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Proposta Origem</Label>
                    <p className="font-medium">{selectedOrder.proposal?.number || '-'}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Data de Entrega</Label>
                    <p className="font-medium">
                      {selectedOrder.delivery_date ? formatDate(selectedOrder.delivery_date) : '-'}
                    </p>
                  </div>
                </div>

                {/* Status Update */}
                <div className="flex items-end gap-4 p-4 bg-muted rounded-lg">
                  <div className="flex-1">
                    <Label>Status do Pedido</Label>
                    <Select
                      value={newStatus || selectedOrder.status}
                      onValueChange={(v) => setNewStatus(v as OrderStatus)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(orderStatusConfig).map(([value, config]) => (
                          <SelectItem key={value} value={value}>{config.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={handleUpdateStatus}
                    disabled={newStatus === selectedOrder.status || updateStatusMutation.isPending}
                  >
                    Atualizar Status
                  </Button>
                </div>

                {/* Total */}
                <div className="flex justify-end">
                  <div className="text-right">
                    <p className="text-muted-foreground">Valor Total</p>
                    <p className="text-2xl font-bold">{formatCurrency(selectedOrder.total_value || 0)}</p>
                  </div>
                </div>

                {/* Observations */}
                {selectedOrder.observations && (
                  <div>
                    <Label className="text-muted-foreground">Observações</Label>
                    <p className="mt-1 p-3 bg-muted rounded-lg">{selectedOrder.observations}</p>
                  </div>
                )}

                {/* Edit Button */}
                {canEditOrder(selectedOrder) && (
                  <div className="flex justify-end pt-4 border-t">
                    <Button 
                      variant="outline"
                      onClick={() => {
                        setIsViewDialogOpen(false);
                        handleEditOrder(selectedOrder);
                      }}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Editar Pedido
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="items">
                {/* Order Items */}
                <div>
                  <Label className="text-lg font-semibold mb-4 block">Itens do Pedido</Label>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Medidas</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                        <TableHead className="text-right">Preço Unit.</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orderItems?.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Package className="h-4 w-4 text-muted-foreground" />
                              <span className="font-mono text-sm">{item.product?.sku || '-'}</span>
                            </div>
                          </TableCell>
                          <TableCell>{item.description}</TableCell>
                          <TableCell className="font-mono text-sm">
                            {(item.width || item.length || item.thickness)
                              ? `${item.width || '-'}x${item.length || '-'}x${item.thickness || '-'}`
                              : '-'}
                          </TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.unit_price)}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(item.subtotal)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Total */}
                  <div className="flex justify-end mt-4">
                    <div className="text-right">
                      <p className="text-muted-foreground">Valor Total</p>
                      <p className="text-2xl font-bold">{formatCurrency(selectedOrder.total_value || 0)}</p>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="history">
                <OrderHistoryTab orderId={selectedOrder.id} />
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Order Dialog */}
      <OrderDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['orders'] })}
      />

      {/* Edit Order Dialog */}
      <OrderDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        order={orderToEdit}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['orders'] });
          setOrderToEdit(null);
        }}
      />
    </div>
  );
}
