/**
 * Sync Batch Providers
 *
 * Substituem o padrão N+1 que cada linha de Orders/Products/Customers
 * usava: 1 useQuery + 1 canal Realtime + polling 15s POR LINHA.
 *
 * Cada provider:
 *  - Faz UMA query agregada em `*_sync_queue` filtrando por `in.(ids)`
 *  - Abre UM único canal Realtime filtrado pelos mesmos IDs
 *  - Para o polling em estados terminais (não há nada para atualizar)
 *  - Expõe um Map<id, entry> via Context
 *
 * Componentes filhos (badges/buttons) checam o context:
 *  - Se houver Provider, usam os dados do batch (sem query/realtime próprios)
 *  - Se não houver, caem no modo individual (compatível com telas de detalhe)
 */
import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

type Entry = Record<string, any>;
type EntryMap = Map<string, Entry>;

interface BatchContextValue {
  map: EntryMap;
}

function hasActiveStatus(map: EntryMap | undefined): boolean {
  if (!map) return false;
  for (const v of map.values()) {
    if (v?.status === 'pending' || v?.status === 'processing') return true;
  }
  return false;
}

interface BatchProviderConfig {
  /** Tabela da fila (ex.: 'order_sync_queue') */
  queueTable: string;
  /** Nome da coluna FK (ex.: 'order_id') */
  fkColumn: string;
  /** Colunas a selecionar */
  columns: string;
  /** Prefixo da queryKey */
  queryKeyPrefix: string;
  /** Nome do canal realtime (será sufixado com hash dos IDs) */
  channelPrefix: string;
  /** Tabela "mãe" para escutar UPDATEs (ex.: 'orders'). Quando dispara, invalida listas. */
  parentTable?: string;
  /** QueryKeys a invalidar quando a tabela mãe sofre UPDATE */
  parentInvalidateKeys?: string[][];
}

function createSyncBatch(config: BatchProviderConfig) {
  const Ctx = createContext<BatchContextValue | null>(null);

  function Provider({ ids, children }: { ids: string[]; children: ReactNode }) {
    const queryClient = useQueryClient();
    const stableIds = useMemo(() => Array.from(new Set(ids.filter(Boolean))).sort(), [ids]);
    const idsKey = stableIds.join(',');

    const { data: map } = useQuery({
      queryKey: [config.queryKeyPrefix, 'batch', idsKey],
      enabled: stableIds.length > 0,
      staleTime: 5_000,
      queryFn: async () => {
        const { data, error } = await (supabase as any)
          .from(config.queueTable)
          .select(`${config.fkColumn}, ${config.columns}, created_at`)
          .in(config.fkColumn, stableIds)
          .order('created_at', { ascending: false });
        if (error) throw error;
        const m: EntryMap = new Map();
        for (const row of (data as any[]) ?? []) {
          const key = row[config.fkColumn];
          if (key && !m.has(key)) m.set(key, row);
        }
        return m;
      },
      refetchInterval: (query) => {
        const m = query.state.data as EntryMap | undefined;
        return hasActiveStatus(m) ? 3_000 : false;
      },
    });

    // Single Realtime channel for the whole list
    useEffect(() => {
      if (stableIds.length === 0) return;
      const filterIds = stableIds.join(',');
      const channelName = `${config.channelPrefix}-${idsKey.slice(0, 40)}`;
      let channel: any = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: config.queueTable,
            filter: `${config.fkColumn}=in.(${filterIds})`,
          },
          () => {
            queryClient.invalidateQueries({ queryKey: [config.queryKeyPrefix, 'batch', idsKey] });
          },
        );

      if (config.parentTable) {
        channel = channel.on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: config.parentTable,
            filter: `id=in.(${filterIds})`,
          },
          () => {
            (config.parentInvalidateKeys ?? []).forEach((key) => {
              queryClient.invalidateQueries({ queryKey: key });
            });
          },
        );
      }

      channel.subscribe();
      return () => {
        supabase.removeChannel(channel);
      };
    }, [idsKey, queryClient]);

    const value = useMemo<BatchContextValue>(() => ({ map: map ?? new Map() }), [map]);

    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
  }

  function useEntry(id: string): { entry: Entry | null; isInBatch: boolean } {
    const ctx = useContext(Ctx);
    if (!ctx) return { entry: null, isInBatch: false };
    return { entry: ctx.map.get(id) ?? null, isInBatch: true };
  }

  return { Provider, useEntry };
}

/* ---------- Orders ---------- */
const orderBatch = createSyncBatch({
  queueTable: 'order_sync_queue',
  fkColumn: 'order_id',
  columns: 'status, error_message, attempt_count, processed_at, pedido_terceiro, validation_errors',
  queryKeyPrefix: 'order_sync_queue',
  channelPrefix: 'order-sync-batch',
  parentTable: 'orders',
  parentInvalidateKeys: [['orders']],
});
export const OrderSyncProvider = orderBatch.Provider;
export const useOrderSyncEntry = orderBatch.useEntry;

/* ---------- Products ---------- */
const productBatch = createSyncBatch({
  queueTable: 'product_sync_queue',
  fkColumn: 'product_id',
  columns: 'status, error_message, attempt_count, processed_at',
  queryKeyPrefix: 'product_sync_queue',
  channelPrefix: 'product-sync-batch',
  parentTable: 'products',
  parentInvalidateKeys: [['products']],
});
export const ProductSyncProvider = productBatch.Provider;
export const useProductSyncEntry = productBatch.useEntry;

/* ---------- Companies ---------- */
const companyBatch = createSyncBatch({
  queueTable: 'company_sync_queue',
  fkColumn: 'company_id',
  columns: 'status, error_message, attempts, processed_at, validation_errors, response',
  queryKeyPrefix: 'company_sync_queue',
  channelPrefix: 'company-sync-batch',
});
export const CompanySyncProvider = companyBatch.Provider;
export const useCompanySyncEntry = companyBatch.useEntry;
