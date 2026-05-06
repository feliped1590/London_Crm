import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Cloud, CloudOff, Loader2, AlertTriangle, Check, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import { SyncValidationModal, type SyncValidationError } from '@/components/sync/SyncValidationModal';

interface ProductSyncStatusProps {
  productId: string;
  erpProductCode?: string | null;
  showAction?: boolean;
  onSyncTriggered?: () => void;
}

const syncStatusConfig: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  not_synced: {
    label: 'Não enviado',
    icon: CloudOff,
    className: 'bg-muted text-muted-foreground border-border',
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
  retry: {
    label: 'Reagendado',
    icon: Cloud,
    className: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800',
  },
};

function useProductErpCode(productId: string, erpCodeProp?: string | null) {
  const { data } = useQuery({
    queryKey: ['product_erp_code', productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('erp_product_code')
        .eq('id', productId)
        .single();
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
    enabled: erpCodeProp === undefined,
  });
  return erpCodeProp ?? data?.erp_product_code ?? null;
}

function useProductQueueEntry(productId: string) {
  return useQuery({
    queryKey: ['product_sync_status', productId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('product_sync_queue')
        .select('status, error_message, attempt_count, processed_at')
        .eq('product_id', productId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 5_000,
    refetchInterval: (query: any) => {
      const status = query.state.data?.status;
      return (status === 'pending' || status === 'processing') ? 3_000 : 15_000;
    },
  });
}

export function ProductSyncBadge({ productId, erpProductCode }: ProductSyncStatusProps) {
  const erpCode = useProductErpCode(productId, erpProductCode);
  const { data: queueEntry } = useProductQueueEntry(productId);

  let displayStatus: string;
  if (queueEntry && (queueEntry.status === 'pending' || queueEntry.status === 'processing' || queueEntry.status === 'retry')) {
    displayStatus = queueEntry.status;
  } else if (erpCode) {
    displayStatus = 'completed';
  } else if (queueEntry?.status === 'failed') {
    displayStatus = 'failed';
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
        <TooltipContent side="bottom" className="text-xs space-y-1 max-w-[280px]">
          {erpCode && <p><span className="text-muted-foreground">Código ERP:</span> {erpCode}</p>}
          {queueEntry?.error_message && (
            <p className="text-destructive">{queueEntry.error_message}</p>
          )}
          {queueEntry?.attempt_count > 0 && (
            <p><span className="text-muted-foreground">Tentativas:</span> {queueEntry.attempt_count}</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function ProductSyncButton({ productId, erpProductCode, onSyncTriggered }: ProductSyncStatusProps) {
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);
  const [validationOpen, setValidationOpen] = useState(false);
  const [validationErrors, setValidationErrors] = useState<SyncValidationError[]>([]);
  const [productName, setProductName] = useState<string>('');

  const erpCode = useProductErpCode(productId, erpProductCode);

  const refreshSyncStatus = () => {
    queryClient.invalidateQueries({ queryKey: ['product_sync_status', productId] });
    queryClient.invalidateQueries({ queryKey: ['product_erp_code', productId] });
    queryClient.invalidateQueries({ queryKey: ['products'] });
    onSyncTriggered?.();
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      // 1. Pré-validação
      const { data: validation, error: validationErr } = await supabase.functions.invoke('validate-product-sync', {
        body: { product_id: productId },
      });

      if (validationErr) {
        toast.error('Erro ao validar produto: ' + validationErr.message);
        return;
      }

      if (validation && !validation.valid) {
        const errs: SyncValidationError[] = (validation.errors || []).map((e: any) => ({
          field: e.field,
          message: e.message,
          fixHint: e.fixHint || 'Edite o produto e preencha o campo obrigatório.',
          fixRoute: e.fixRoute,
        }));
        setValidationErrors(errs);
        setProductName(validation.product?.name || '');
        setValidationOpen(true);
        toast.warning('Produto possui pendências. Corrija antes de enviar ao ERP.');
        return;
      }

      // 2. Enfileirar
      const { error: queueErr } = await (supabase as any)
        .from('product_sync_queue')
        .upsert(
          { product_id: productId, status: 'pending', attempt_count: 0, error_message: null, next_retry_at: null },
          { onConflict: 'product_id' },
        );
      if (queueErr) {
        // fallback insert se onConflict não estiver disponível
        await (supabase as any).from('product_sync_queue').insert({ product_id: productId, status: 'pending' });
      }

      toast.success('Produto adicionado à fila de envio ao ERP');
      refreshSyncStatus();

      // 3. Disparar processamento
      const { data, error } = await supabase.functions.invoke('process-product-sync', {
        body: { product_id: productId },
      });

      if (error) {
        console.error('[ProductSyncButton] Erro:', error);
        toast.error('Erro ao processar sincronização');
        return;
      }

      const result = data?.results?.find((r: any) => r.product_id === productId) || data?.results?.[0];
      if (result?.status === 'success') {
        toast.success('Produto sincronizado com sucesso!');
      } else if (result?.status === 'error') {
        toast.error(result.error || 'ERP recusou o envio do produto.');
      } else if (result?.status === 'deferred') {
        toast.info(result.error || 'Envio adiado por janela de acesso.');
      }

      refreshSyncStatus();
    } catch (err: any) {
      toast.error(`Erro ao enviar produto: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const tooltipLabel = erpCode ? 'Reenviar ao ERP' : 'Enviar ao ERP';

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
                handleSync();
              }}
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

      <SyncValidationModal
        open={validationOpen}
        onOpenChange={setValidationOpen}
        entityLabel={productName ? `Produto: ${productName}` : 'Produto'}
        title="Não foi possível enviar o produto ao ERP"
        errors={validationErrors}
      />
    </>
  );
}
