import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, Loader2 } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { orderStatusConfig, type OrderStatus } from '@/types/products';

interface DealOrdersTabProps {
  dealId: string;
}

export function DealOrdersTab({ dealId }: DealOrdersTabProps) {
  const { data: orders, isLoading } = useQuery({
    queryKey: ['deal-linked-orders', dealId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('id, number, status, total_value, delivery_date, created_at, erp_order_id')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!dealId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Carregando pedidos…
      </div>
    );
  }

  if (!orders?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <ShoppingCart className="h-10 w-10 mb-3" />
        <p className="text-sm">Nenhum pedido vinculado a este negócio ainda.</p>
        <p className="text-xs mt-1">Pedidos são criados automaticamente quando uma proposta é aprovada.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {orders.map((o: any) => {
        const cfg = orderStatusConfig[o.status as OrderStatus];
        return (
          <div
            key={o.id}
            className="flex items-center justify-between p-3 rounded-md border bg-card hover:bg-accent/40 transition-colors"
          >
            <div className="flex items-center gap-3">
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="font-mono font-medium text-sm">{o.number}</div>
                <div className="text-xs text-muted-foreground">
                  Criado em {formatDate(o.created_at)}
                  {o.delivery_date && ` · Entrega ${formatDate(o.delivery_date)}`}
                  {o.erp_order_id && ` · ERP ${o.erp_order_id}`}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-medium text-sm">{formatCurrency(o.total_value || 0)}</span>
              {cfg && <Badge className={cfg.color}>{cfg.label}</Badge>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
