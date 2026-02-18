import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, ShoppingCart, Building2, User, Calendar, Plus, Edit, RefreshCw, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { Order, orderStatusConfig, OrderStatus } from '@/types/products';
import { OrderDialog } from '@/components/orders/OrderDialog';
import { useModulePermissions } from '@/hooks/useModulePermissions';

export default function Orders() {
  const queryClient = useQueryClient();
  const { isAdmin } = useModulePermissions();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [orderToEdit, setOrderToEdit] = useState<Order | null>(null);
  const [generatingPdfId, setGeneratingPdfId] = useState<string | null>(null);

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

  const handleEditOrder = (order: Order) => {
    setOrderToEdit(order);
    setIsEditDialogOpen(true);
  };

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
             <div className="table-responsive">
               <Table className="min-w-[900px]">
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
                   ))}
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
