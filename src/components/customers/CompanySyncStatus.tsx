import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Cloud, CloudOff, Loader2, AlertTriangle, Check, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';

interface CompanySyncStatusProps {
  companyId: string;
  erpCode?: string | null;
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
  waiting_propagation: {
    label: 'Aguardando ERP',
    icon: Cloud,
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

export function CompanySyncBadge({ companyId, erpCode: erpCodeProp }: CompanySyncStatusProps) {
  // Fetch erp_code from companies if not provided
  const { data: companyData } = useQuery({
    queryKey: ['company_erp_code', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('erp_code')
        .eq('id', companyId)
        .single();
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
    enabled: erpCodeProp === undefined,
  });

  const erpCode = erpCodeProp ?? companyData?.erp_code;

  const { data: queueEntry } = useQuery({
    queryKey: ['company_sync_status', companyId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('company_sync_queue')
        .select('status, error_message, attempts, processed_at')
        .eq('company_id', companyId)
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

  let displayStatus: string;
  if (queueEntry && (queueEntry.status === 'pending' || queueEntry.status === 'processing')) {
    displayStatus = queueEntry.status;
  } else if (erpCode) {
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
          {erpCode && <p><span className="text-muted-foreground">Código ERP:</span> {erpCode}</p>}
          {queueEntry?.error_message && (
            <p className="text-destructive">{queueEntry.error_message}</p>
          )}
          {queueEntry?.attempts > 0 && (
            <p><span className="text-muted-foreground">Tentativas:</span> {queueEntry.attempts}</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function CompanySyncButton({ companyId, erpCode, onSyncTriggered }: CompanySyncStatusProps) {
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      toast.success('Cliente adicionado à fila de envio ao ERP');
      onSyncTriggered?.();

      const { data, error } = await supabase.functions.invoke('process-company-sync', {
        body: { company_id: companyId },
      });

      if (error) {
        console.error('[CompanySyncButton] Erro:', error);
        toast.error('Erro ao processar sincronização');
        return;
      }

      const result = data?.results?.[0];
      if (result?.erp_code) {
        toast.success(`Cliente sincronizado! Código ERP: ${result.erp_code}`);
      } else if (result?.status === 'waiting_propagation') {
        toast.info('Cliente enviado ao ERP. Tentando recuperar código...');
        // Auto-retry after 30s
        setTimeout(async () => {
          try {
            const { data: retryData } = await supabase.functions.invoke('process-company-sync', {
              body: { company_id: companyId },
            });
            const retryResult = retryData?.results?.[0];
            if (retryResult?.erp_code) {
              toast.success(`Código ERP recuperado: ${retryResult.erp_code}`);
            } else {
              toast.warning('Código ERP ainda não disponível. Tente novamente em alguns minutos.');
            }
            onSyncTriggered?.();
          } catch {
            // silent
          }
        }, 30000);
      } else if (result?.status === 'found_existing') {
        toast.success(`Cliente já existia no ERP: ${result.erp_code}`);
      }

      onSyncTriggered?.();
    } catch (err: any) {
      toast.error(`Erro ao enviar cliente: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const tooltipLabel = erpCode ? 'Reenviar ao ERP' : 'Enviar ao ERP';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => { e.stopPropagation(); handleSync(); }}
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
