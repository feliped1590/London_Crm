import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Package, TrendingUp, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { OrderDialog } from '@/components/orders/OrderDialog';

interface CustomerOrdersTabProps {
  companyId: string;
  source: 'crm' | 'erp';
  cnpj?: string | null;
  canManageOrders?: boolean;
}

interface CRMOrder {
  id: string;
  number: string;
  status: string;
  total_value: number | null;
  created_at: string;
  delivery_date: string | null;
  erp_order_id: string | null;
}

interface ERPOrder {
  id: string;
  numero_pedido: string | null;
  situacao: string | null;
  valor_total: number | null;
  data_emissao: string | null;
  data_entrega: string | null;
}

const ORDER_DIALOG_COLUMNS = `
  id, number, status, order_type, total_value,
  payment_method, payment_terms, delivery_date, observations, freight_type,
  freight_value, is_locked, locked_at, locked_by, created_at, updated_at,
  delivery_same_as_company, delivery_city, delivery_state,
  legal_entity_id, company_id, contact_id, proposal_id, carrier_id, redespacho_carrier_id, sale_type, deal_id,
  sales_rep_id, erp_order_id, erp_synced_at, created_by,
  company:companies(id, name),
  contact:contacts(id, first_name, last_name),
  proposal:proposals(id, number),
  carrier:carriers!orders_carrier_id_fkey(id, name, trade_name),
  deal:deals(id, name, pipeline_stage:pipeline_stages(id, name))
`;

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Rascunho', variant: 'outline' },
  pending: { label: 'Pendente', variant: 'secondary' },
  approved: { label: 'Aprovado', variant: 'default' },
  rejected: { label: 'Rejeitado', variant: 'destructive' },
  shipped: { label: 'Enviado', variant: 'default' },
  delivered: { label: 'Entregue', variant: 'default' },
  cancelled: { label: 'Cancelado', variant: 'destructive' },
};

export function CustomerOrdersTab({ companyId, source, cnpj, canManageOrders = true }: CustomerOrdersTabProps) {
  const queryClient = useQueryClient();
  const [isCreateOrderOpen, setIsCreateOrderOpen] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);

  // Buscar pedidos CRM (tabela orders)
  const { data: crmOrders, isLoading: loadingCrm } = useQuery({
    queryKey: ['customer-orders-crm', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('id, number, status, total_value, created_at, delivery_date, erp_order_id')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as CRMOrder[];
    },
    enabled: source === 'crm',
  });

  // Buscar pedidos ERP (tabela crm_orders via crm_clients por CNPJ)
  const { data: erpOrders, isLoading: loadingErp } = useQuery({
    queryKey: ['customer-orders-erp', cnpj],
    queryFn: async () => {
      if (!cnpj) return [];
      const cleanCnpj = cnpj.replace(/\D/g, '');
      const { data: client, error: clientError } = await supabase
        .from('crm_clients')
        .select('id')
        .eq('cnpj_cpf', cleanCnpj)
        .maybeSingle();
      if (clientError || !client) return [];
      const { data: orders, error: ordersError } = await supabase
        .from('crm_orders')
        .select('id, numero_pedido, situacao, valor_total, data_emissao, data_entrega')
        .eq('client_id', client.id)
        .order('data_emissao', { ascending: false });
      if (ordersError) throw ordersError;
      return orders as ERPOrder[];
    },
    enabled: source === 'erp' && !!cnpj,
  });

  // Buscar pedido completo para edição (apenas CRM)
  const { data: editingOrder } = useQuery({
    queryKey: ['customer-order-edit', editingOrderId],
    queryFn: async () => {
      if (!editingOrderId) return null;
      const { data, error } = await supabase
        .from('orders')
        .select(ORDER_DIALOG_COLUMNS)
        .eq('id', editingOrderId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!editingOrderId,
  });

  const isLoading = loadingCrm || loadingErp;
  const orders = source === 'crm' ? crmOrders : erpOrders;

  const totalOrders = orders?.length || 0;
  const totalValue = orders?.reduce((acc, order) => {
    const value = source === 'crm'
      ? (order as CRMOrder).total_value
      : (order as ERPOrder).valor_total;
    return acc + (value || 0);
  }, 0) || 0;

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    try {
      return format(new Date(dateString), 'dd/MM/yyyy', { locale: ptBR });
    } catch {
      return '-';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-60" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <Package className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total de Pedidos</p>
                <p className="text-2xl font-bold">{totalOrders}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-success/10">
                <TrendingUp className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Valor Total</p>
                <p className="text-2xl font-bold">{formatCurrency(totalValue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Pedidos */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Histórico de Pedidos
              </CardTitle>
              <CardDescription>
                {source === 'crm'
                  ? 'Pedidos registrados no CRM — clique na linha para editar'
                  : 'Pedidos sincronizados do ERP Iniflex'
                }
              </CardDescription>
            </div>
            {source === 'crm' && canManageOrders && (
              <Button size="sm" className="gap-2" onClick={() => setIsCreateOrderOpen(true)}>
                <Plus className="h-4 w-4" />
                Novo Pedido
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!orders || orders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>Nenhum pedido encontrado para este cliente</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Cód. ERP</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Entrega</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {source === 'crm'
                  ? (orders as CRMOrder[]).map((order) => (
                      <TableRow
                        key={order.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setEditingOrderId(order.id)}
                      >
                        <TableCell className="font-medium">{order.number}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {order.erp_order_id || <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>{formatDate(order.created_at)}</TableCell>
                        <TableCell>{formatDate(order.delivery_date)}</TableCell>
                        <TableCell>
                          <Badge variant={statusLabels[order.status]?.variant || 'outline'}>
                            {statusLabels[order.status]?.label || order.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(order.total_value)}
                        </TableCell>
                      </TableRow>
                    ))
                  : (orders as ERPOrder[]).map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">
                          {order.numero_pedido || '-'}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {order.numero_pedido || <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>{formatDate(order.data_emissao)}</TableCell>
                        <TableCell>{formatDate(order.data_entrega)}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {order.situacao || 'N/A'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(order.valor_total)}
                        </TableCell>
                      </TableRow>
                    ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Order Dialog */}
      <OrderDialog
        open={isCreateOrderOpen}
        onOpenChange={setIsCreateOrderOpen}
        preSelectedCompanyId={companyId}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['customer-orders-crm', companyId] });
        }}
      />

      {/* Edit Order Dialog */}
      <OrderDialog
        open={!!editingOrderId && !!editingOrder}
        onOpenChange={(open) => {
          if (!open) setEditingOrderId(null);
        }}
        order={editingOrder as any}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['customer-orders-crm', companyId] });
          queryClient.invalidateQueries({ queryKey: ['customer-order-edit', editingOrderId] });
        }}
      />
    </div>
  );
}
