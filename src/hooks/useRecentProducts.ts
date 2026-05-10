import { useState, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ProductSearchResult } from './useProductSearch';

const STORAGE_KEY = 'recent-product-ids';
const MAX_RECENT = 10;

function loadRecentIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Tracks and fetches recently selected products.
 * Stores up to 10 product IDs in localStorage, preserving usage order.
 */
export function useRecentProducts(legalEntityId?: string | null) {
  const [recentIds, setRecentIds] = useState<string[]>(loadRecentIds);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(recentIds)); } catch { /* noop */ }
  }, [recentIds]);

  const addRecent = useCallback((productId: string) => {
    setRecentIds(prev => {
      const filtered = prev.filter(id => id !== productId);
      return [productId, ...filtered].slice(0, MAX_RECENT);
    });
  }, []);

  const { data: recentProducts = [] } = useQuery({
    queryKey: ['recent-products', legalEntityId, recentIds],
    queryFn: async () => {
      if (recentIds.length === 0 || !legalEntityId) return [];
      const { data, error } = await supabase
        .from('products')
        .select('id, sku, name, tipo_id, grupo_id, subgrupo_id, family_id, class_id, unit_price, width, length, thickness, aliquota_ipi, fator_kg')
        .eq('legal_entity_id', legalEntityId)
        .in('id', recentIds);
      if (error) throw error;
      const map = new Map((data ?? []).map(p => [p.id, p]));
      return recentIds
        .map(id => map.get(id))
        .filter(Boolean) as unknown as ProductSearchResult[];
    },
    enabled: recentIds.length > 0 && !!legalEntityId,
    staleTime: 60_000,
  });

  return { recentIds, recentProducts, addRecent };
}
