import { QueryClient, QueryKey } from '@tanstack/react-query';

/**
 * Smart Query Cache Manager
 * Updates React Query cache directly after mutations to avoid unnecessary refetches.
 * Falls back to invalidateQueries when cache is empty or item not found.
 */

type ItemWithId = { id: string; [key: string]: unknown };

/**
 * Updates an item in a cached list query and its detail query.
 * Falls back to invalidateQueries if the list cache doesn't exist or item is not found.
 */
export function updateItemInList<T extends ItemWithId>(
  qc: QueryClient,
  listKey: QueryKey,
  itemId: string,
  newData: Partial<T>,
  detailKeyPrefix?: string
): boolean {
  const existing = qc.getQueryData<T[]>(listKey);

  if (!existing) {
    qc.invalidateQueries({ queryKey: listKey });
    return false;
  }

  const index = existing.findIndex((item) => item.id === itemId);
  if (index === -1) {
    qc.invalidateQueries({ queryKey: listKey });
    return false;
  }

  const updated = [...existing];
  updated[index] = { ...updated[index], ...newData };
  qc.setQueryData(listKey, updated);

  // Also update detail query if prefix provided
  if (detailKeyPrefix) {
    updateItemDetail(qc, [detailKeyPrefix, itemId], newData);
  }

  return true;
}

/**
 * Updates a single-item detail query (e.g. ['company', id]).
 * Noop if cache doesn't exist for this key.
 */
export function updateItemDetail<T extends ItemWithId>(
  qc: QueryClient,
  detailKey: QueryKey,
  newData: Partial<T>
): void {
  const existing = qc.getQueryData<T>(detailKey);
  if (existing) {
    qc.setQueryData(detailKey, { ...existing, ...newData });
  }
}

/**
 * Inserts a new item at the beginning of a cached list query.
 * Falls back to invalidateQueries if the list cache doesn't exist.
 */
export function insertItemInList<T extends ItemWithId>(
  qc: QueryClient,
  listKey: QueryKey,
  newItem: T
): boolean {
  const existing = qc.getQueryData<T[]>(listKey);

  if (!existing) {
    qc.invalidateQueries({ queryKey: listKey });
    return false;
  }

  if (existing.some((item) => item.id === newItem.id)) {
    return false;
  }

  qc.setQueryData(listKey, [newItem, ...existing]);
  return true;
}

/**
 * Removes an item from a cached list query and clears its detail query.
 * Falls back to invalidateQueries if the list cache doesn't exist.
 */
export function removeItemFromList<T extends ItemWithId>(
  qc: QueryClient,
  listKey: QueryKey,
  itemId: string,
  detailKeyPrefix?: string
): boolean {
  const existing = qc.getQueryData<T[]>(listKey);

  if (!existing) {
    qc.invalidateQueries({ queryKey: listKey });
    return false;
  }

  qc.setQueryData(
    listKey,
    existing.filter((item) => item.id !== itemId)
  );

  // Remove detail cache if prefix provided
  if (detailKeyPrefix) {
    qc.removeQueries({ queryKey: [detailKeyPrefix, itemId] });
  }

  return true;
}
