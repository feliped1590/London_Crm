import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Cloud, CloudOff, Loader2, AlertTriangle, Check, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';

interface OrderSyncStatusProps {
  orderId: string;
  erpOrderId?: string | null;
  erpSyncedAt?: string | null;
  updatedAt?: string | null;
  showAction?: boolean;
  onSyncTriggered?: () => void;
}

type SyncQueueStatus = 'pending' | 'processing' | 'completed' | 'failed';

const syncStatusConfig: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  not_synced: {
    label: 'Não enviado',
    icon: CloudOff,
    className: 'bg-muted text-muted-foreground border-border',
  },
  outdated: {
    label: 'Desatualizado',
    icon: AlertTriangle,
    className: 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800',
  },
  pending: {
    label: 'Na fila',
    icon: Loader2,
    className: 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800',
  },
  processing: {
    label: 'Processando',
    icon: Loader2,
    className: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
  },
  completed: {
    label: 'Sincronizado',
    icon: Check,
    className: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
  },
  failed: {
    label: 'Erro',
    icon: AlertTriangle,
    className: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
  },
};

export function OrderSyncBadge({ orderId, erpOrderId, erpSyncedAt, updatedAt }: OrderSyncStatusProps) {
  const { data: queueEntry } = useQuery({
    queryKey: ['order_sync_status', orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('order_sync_queue')
        .select('status, error_message, attempt_count, processed_at, pedido_terceiro')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 5_000,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return (status === 'pending' || status === 'processing') ? 3_000 : 15_000;
    },
  });

  // Determine display status
  let displayStatus: string;
  if (queueEntry && (queueEntry.status === 'pending' || queueEntry.status === 'processing')) {
    displayStatus = queueEntry.status;
  } else if (erpOrderId && erpSyncedAt && updatedAt && new Date(updatedAt) > new Date(erpSyncedAt)) {
    displayStatus = 'outdated';
  } else if (erpOrderId) {
    displayStatus = 'completed';
  } else if (queueEntry) {
    displayStatus = queueEntry.status;
  } else {
    displayStatus = 'not_synced';
  }

  const config = syncStatusConfig[displayStatus] || syncStatusConfig.not_synced;
  const Icon = config.icon;
  const isAnimated = displayStatus === 'pending' || displayStatus === 'processing';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={`gap-1 cursor-default ${config.className}`}>
            <Icon className={`h-3 w-3 ${isAnimated ? 'animate-spin' : ''}`} />
            {config.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs space-y-1 max-w-[250px]">
          {erpOrderId && <p><span className="text-muted-foreground">Pedido ERP:</span> {erpOrderId}</p>}
          {erpSyncedAt && (
            <p><span className="text-muted-foreground">Sincronizado em:</span> {new Date(erpSyncedAt).toLocaleString('pt-BR')}</p>
          )}
          {queueEntry?.pedido_terceiro && (
            <p><span className="text-muted-foreground">Pedido Terceiro:</span> {String(queueEntry.pedido_terceiro)}</p>
          )}
          {queueEntry?.error_message && (
            <p className="text-destructive">{queueEntry.error_message}</p>
          )}
          {queueEntry?.attempt_count && queueEntry.attempt_count > 0 && (
            <p><span className="text-muted-foreground">Tentativas:</span> {queueEntry.attempt_count}</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function OrderSyncButton({ orderId, erpOrderId, onSyncTriggered }: OrderSyncStatusProps) {
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      // 1. Resetar na fila diretamente (instantâneo)
      const { data: existing } = await supabase
        .from('order_sync_queue')
        .select('id')
        .eq('order_id', orderId)
        .maybeSingle();

      if (existing) {
        await supabase.from('order_sync_queue')
          .update({ status: 'pending' as any, attempt_count: 0, error_message: null, next_retry_at: null })
          .eq('id', existing.id);
      }

      toast.success('Pedido adicionado à fila de envio');
      onSyncTriggered?.();

      // 2. Disparar Edge Function em background (fire-and-forget)
      supabase.functions.invoke('process-order-sync', {
        body: { order_id: orderId },
      }).catch(() => {});

    } catch (err: any) {
      toast.error(`Erro ao enviar pedido: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const tooltipLabel = erpOrderId ? 'Reenviar ao ERP' : 'Enviar ao ERP';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSync}
            disabled={isSyncing}
            title={tooltipLabel}
          >
            {isSyncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{tooltipLabel}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
