import { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { QueryClient } from '@tanstack/react-query';
import {
  insertItemInList,
  updateItemInList,
  removeItemFromList,
} from './queryCacheManager';
import type { RealtimeRecord } from '@/types/realtime';

interface TableSubscriptionConfig {
  table: string;
  channelName: string;
  listQueryKey: string[];
  detailKeyPrefix: string;
  /** Extra query keys to invalidate on any event */
  invalidateKeys?: string[][];
}

const TABLE_CONFIGS: TableSubscriptionConfig[] = [
  {
    table: 'deals',
    channelName: 'crm-deals',
    listQueryKey: ['deals'],
    detailKeyPrefix: 'deal',
  },
  {
    table: 'companies',
    channelName: 'crm-companies',
    listQueryKey: ['companies'],
    detailKeyPrefix: 'company',
  },
  {
    table: 'tasks',
    channelName: 'crm-tasks',
    listQueryKey: ['tasks'],
    detailKeyPrefix: 'task',
    invalidateKeys: [['today-tasks'], ['calendar-tasks']],
  },
];

function subscribeToTable(
  supabaseClient: SupabaseClient,
  qc: QueryClient,
  config: TableSubscriptionConfig,
  currentUserId: string
): RealtimeChannel {
  const channel = supabaseClient
    .channel(config.channelName)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: config.table },
      (payload) => {
        const record = (payload.new as RealtimeRecord | null) || (payload.old as RealtimeRecord | null);
        const eventUserId =
          record?.owner_id || record?.created_by || record?.assigned_to;

        if (payload.eventType === 'UPDATE' && eventUserId === currentUserId) {
          const existing = qc.getQueryData<RealtimeRecord[]>(config.listQueryKey);
          if (existing) {
            const newRecord = payload.new as RealtimeRecord | null;
            const cached = existing.find((item) => item.id === newRecord?.id);
            if (cached && cached.updated_at === newRecord?.updated_at) {
              return;
            }
          }
        }

        switch (payload.eventType) {
          case 'INSERT': {
            const newItem = payload.new as RealtimeRecord | null;
            if (newItem?.id) {
              insertItemInList(qc, config.listQueryKey, newItem);
            }
            break;
          }
          case 'UPDATE': {
            const updated = payload.new as RealtimeRecord | null;
            if (updated?.id) {
              updateItemInList(
                qc,
                config.listQueryKey,
                updated.id,
                updated,
                config.detailKeyPrefix
              );
            }
            break;
          }
          case 'DELETE': {
            const deleted = payload.old as RealtimeRecord | null;
            if (deleted?.id) {
              removeItemFromList(
                qc,
                config.listQueryKey,
                deleted.id,
                config.detailKeyPrefix
              );
            }
            break;
          }
        }

        if (config.invalidateKeys) {
          config.invalidateKeys.forEach((key) => {
            qc.invalidateQueries({ queryKey: key });
          });
        }
      }
    )
    .subscribe();

  return channel;
}

/**
 * Subscribe to all CRM realtime channels.
 * Returns a cleanup function that removes all channels.
 */
export function subscribeAll(
  supabaseClient: SupabaseClient,
  qc: QueryClient,
  currentUserId: string
): () => void {
  const channels: RealtimeChannel[] = TABLE_CONFIGS.map((config) =>
    subscribeToTable(supabaseClient, qc, config, currentUserId)
  );

  return () => {
    channels.forEach((channel) => {
      supabaseClient.removeChannel(channel);
    });
  };
}
