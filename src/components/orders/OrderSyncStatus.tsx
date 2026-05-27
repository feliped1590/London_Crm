import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CloudOff, Loader2, AlertTriangle, Check, Send, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { useEffect, useState } from 'react';
import { SyncValidationModal, type SyncValidationError } from '@/components/sync/SyncValidationModal';
import { useOrderSyncEntry } from '@/components/sync/SyncBatchProviders';

// Realtime channel per row — só é usado quando o componente NÃO está dentro de
// <OrderSyncProvider>. Dentro de listas (Orders.tsx), o provider abre 1 canal
// único e este hook fica desativado via `enabled=false`.
function useOrderSyncRealtime(orderId: string, enabled: boolean) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!orderId || !enabled) return;
    const channel = supabase
      .channel(`order-sync-ui-${orderId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['order_sync_status', orderId] });
        queryClient.invalidateQueries({ queryKey: ['order_sync_status_btn', orderId] });
        queryClient.invalidateQueries({ queryKey: ['orders'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_sync_queue', filter: `order_id=eq.${orderId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['order_sync_status', orderId] });
        queryClient.invalidateQueries({ queryKey: ['order_sync_status_btn', orderId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [orderId, queryClient, enabled]);
}

interface OrderSyncStatusProps {
  orderId: string;
  orderNumber?: string | null;
  erpOrderId?: string | null;
  erpSyncedAt?: string | null;
  updatedAt?: string | null;
  showAction?: boolean;
  onSyncTriggered?: () => void;
}

const PERMANENT_ORDER_SYNC_MESSAGE = 'A Projedata não permite sincronizar novamente este pedido porque ele já avançou no fluxo do ERP.';

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
  permanent_failure: {
    label: 'Bloqueado ERP',
    icon: AlertTriangle,
    className: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
  },
  blocked_validation: {
    label: 'Dados incompletos',
    icon: AlertTriangle,
    className: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800',
  },
};

export function OrderSyncBadge({ orderId, erpOrderId, erpSyncedAt, updatedAt }: OrderSyncStatusProps) {
  const { entry: batchEntry, isInBatch } = useOrderSyncEntry(orderId);
  useOrderSyncRealtime(orderId, !isInBatch);
  const { data: individualEntry } = useQuery({
    queryKey: ['order_sync_status', orderId],
    enabled: !isInBatch,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('order_sync_queue')
        .select('status, error_message, attempt_count, processed_at, pedido_terceiro, validation_errors')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 5_000,
    refetchInterval: (query) => {
      const status = (query.state.data as any)?.status;
      // Polling APENAS em estados ativos. Estados terminais não mudam sozinhos.
      return (status === 'pending' || status === 'processing') ? 3_000 : false;
    },
  });
  const queueEntry = isInBatch ? batchEntry : individualEntry;

  // Prioridade: blocked_validation/permanent_failure > pending/processing > outdated > completed > demais
  let displayStatus: string;
  if (queueEntry?.status === 'blocked_validation') {
    displayStatus = 'blocked_validation';
  } else if (queueEntry?.status === 'permanent_failure') {
    displayStatus = 'permanent_failure';
  } else if (queueEntry && (queueEntry.status === 'pending' || queueEntry.status === 'processing')) {
    displayStatus = queueEntry.status;
  } else if (erpOrderId && erpSyncedAt && updatedAt && (new Date(updatedAt).getTime() - new Date(erpSyncedAt).getTime()) > 5000) {
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
  const validationErrors = (queueEntry?.validation_errors || []) as SyncValidationError[];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={`gap-1 cursor-default ${config.className}`}>
            <Icon className={`h-3 w-3 ${isAnimated ? 'animate-spin' : ''}`} />
            {config.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs space-y-1 max-w-[280px]">
          {erpOrderId && <p><span className="text-muted-foreground">Pedido ERP:</span> {erpOrderId}</p>}
          {erpSyncedAt && (
            <p><span className="text-muted-foreground">Sincronizado em:</span> {new Date(erpSyncedAt).toLocaleString('pt-BR')}</p>
          )}
          {queueEntry?.pedido_terceiro && (
            <p><span className="text-muted-foreground">Pedido Terceiro:</span> {String(queueEntry.pedido_terceiro)}</p>
          )}
          {displayStatus === 'blocked_validation' && validationErrors.length > 0 && (
            <div className="space-y-0.5">
              <p className="font-semibold">Pendências:</p>
              <ul className="list-disc pl-4">
                {validationErrors.slice(0, 5).map((e, i) => (
                  <li key={i}>{e.message}</li>
                ))}
                {validationErrors.length > 5 && <li>+{validationErrors.length - 5} outros</li>}
              </ul>
            </div>
          )}
          {displayStatus === 'permanent_failure' && (
            <p className="text-destructive">{PERMANENT_ORDER_SYNC_MESSAGE}</p>
          )}
          {displayStatus !== 'blocked_validation' && displayStatus !== 'permanent_failure' && queueEntry?.error_message && (
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

export function OrderSyncButton({ orderId, orderNumber, erpOrderId, onSyncTriggered }: OrderSyncStatusProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [validationOpen, setValidationOpen] = useState(false);
  const [validationErrors, setValidationErrors] = useState<SyncValidationError[]>([]);
  const [entityLabel, setEntityLabel] = useState<string>('');

  // Saber se já está bloqueado para mostrar "Corrigir dados"
  const { data: queueEntry } = useQuery({
    queryKey: ['order_sync_status_btn', orderId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('order_sync_queue')
        .select('status, validation_errors, error_message')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    staleTime: 10_000,
  });

  const isBlocked = queueEntry?.status === 'blocked_validation';
  const isPermanentFailure = queueEntry?.status === 'permanent_failure';

  const buildLabel = (orderNum?: string | null) =>
    orderNum ? `Pedido ${orderNum}` : 'Pedido';

  const handleShowBlocked = () => {
    setValidationErrors((queueEntry?.validation_errors || []) as SyncValidationError[]);
    setEntityLabel(buildLabel(orderNumber));
    setValidationOpen(true);
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      // 1. Pré-validação
      const { data: validation, error: validationErr } = await supabase.functions.invoke('validate-order-sync', {
        body: { order_id: orderId },
      });

      if (validationErr) {
        toast.error('Erro ao validar pedido: ' + validationErr.message);
        return;
      }

      if (validation && !validation.valid) {
        setValidationErrors(validation.errors || []);
        setEntityLabel(buildLabel(validation.order_number ?? orderNumber));
        setValidationOpen(true);
        toast.warning('Pedido possui pendências. Corrija antes de enviar ao ERP.');
        return;
      }

      // 2. Resetar fila e enfileirar
      const { data: existing } = await (supabase as any)
        .from('order_sync_queue')
        .select('id')
        .eq('order_id', orderId)
        .maybeSingle();

      if (existing) {
        await (supabase as any).from('order_sync_queue')
          .update({
            status: 'pending',
            attempt_count: 0,
            error_message: null,
            next_retry_at: null,
            validation_errors: null,
            validation_fields: null,
          })
          .eq('id', existing.id);
      }

      toast.success('Pedido adicionado à fila de envio');
      onSyncTriggered?.();

      // 3. Disparar Edge Function em background
      supabase.functions.invoke('process-order-sync', {
        body: { order_id: orderId },
      }).catch(() => {});
    } catch (err: any) {
      toast.error(`Erro ao enviar pedido: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const tooltipLabel = isBlocked
    ? 'Revalidar e enviar ao ERP'
    : isPermanentFailure ? 'Pedido bloqueado no ERP'
      : erpOrderId ? 'Reenviar ao ERP' : 'Enviar ao ERP';

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                if (isPermanentFailure) toast.error(PERMANENT_ORDER_SYNC_MESSAGE);
                else handleSync();
              }}
              disabled={isSyncing || isPermanentFailure}
              title={tooltipLabel}
            >
              {isSyncing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isBlocked ? (
                <Wrench className="h-4 w-4 text-warning" />
              ) : isPermanentFailure ? (
                <AlertTriangle className="h-4 w-4 text-destructive" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{tooltipLabel}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <SyncValidationModal
        open={validationOpen}
        onOpenChange={setValidationOpen}
        entityLabel={entityLabel}
        errors={validationErrors}
      />
    </>
  );
}
