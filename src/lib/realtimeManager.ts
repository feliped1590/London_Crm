import { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { QueryClient } from '@tanstack/react-query';
import {
  insertItemInList,
  updateItemInList,
  removeItemFromList,
} from './queryCacheManager';

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
        // Skip events triggered by the current user's own mutations
        // to avoid double-updates (local cache was already updated)
        const record = (payload.new as any) || (payload.old as any);
        const eventUserId =
          record?.owner_id || record?.created_by || record?.assigned_to;
        
        // For INSERT/UPDATE from the same user, check if cache already has latest data
        if (payload.eventType === 'UPDATE' && eventUserId === currentUserId) {
          const existing = qc.getQueryData<any[]>(config.listQueryKey);
          if (existing) {
            const cached = existing.find((item) => item.id === (payload.new as any)?.id);
            if (cached && cached.updated_at === (payload.new as any)?.updated_at) {
              return; // Already up to date, skip
            }
          }
        }

        switch (payload.eventType) {
          case 'INSERT': {
            const newItem = payload.new as any;
            if (newItem?.id) {
              insertItemInList(qc, config.listQueryKey, newItem);
            }
            break;
          }
          case 'UPDATE': {
            const updated = payload.new as any;
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
            const deleted = payload.old as any;
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

        // Invalidate derived queries (e.g. today-tasks, calendar-tasks)
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
