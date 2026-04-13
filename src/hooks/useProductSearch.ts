import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ProductLookup } from '@/types/documents';
import { useEffect } from 'react';

const PRODUCT_SELECT_COLUMNS = 'id, sku, name, tipo_id, grupo_id, subgrupo_id, family_id, class_id, unit_price, width, length, thickness, aliquota_ipi, fator_kg';

export interface ProductSearchFilters {
  text?: string;
  family_id?: string;
  grupo_id?: string;
  subgrupo_id?: string;
  class_id?: string;
}

interface UseProductSearchOptions {
  filters: ProductSearchFilters;
  page?: number;
  limit?: number;
  enabled?: boolean;
}

export interface ProductSearchResult extends ProductLookup {
  grupo_id?: string | null;
  subgrupo_id?: string | null;
  family_id?: string | null;
  class_id?: string | null;
}

async function fetchProducts(filters: ProductSearchFilters, page: number, limit: number) {
  let query = supabase
    .from('products')
    .select(PRODUCT_SELECT_COLUMNS, { count: 'exact' })
    .eq('active', true)
    .order('name')
    .range(page * limit, (page + 1) * limit - 1);

  if (filters.text?.trim()) {
    const t = filters.text.trim();
    query = query.or(`name.ilike.%${t}%,sku.ilike.%${t}%`);
  }
  if (filters.family_id) query = query.eq('family_id', filters.family_id);
  if (filters.grupo_id) query = query.eq('grupo_id', filters.grupo_id);
  if (filters.subgrupo_id) query = query.eq('subgrupo_id', filters.subgrupo_id);
  if (filters.class_id) query = query.eq('class_id', filters.class_id);

  const { data, error, count } = await query;
  if (error) throw error;
  return { products: (data ?? []) as unknown as ProductSearchResult[], total: count ?? 0 };
}

/**
 * Base hook for product search — single source of truth.
 * Uses pg_trgm index for optimized ILIKE searches.
 * Prefetches next page for instant navigation.
 */
export function useProductSearch({ filters, page = 0, limit = 20, enabled = true }: UseProductSearchOptions) {
  const queryClient = useQueryClient();

  // Cancel stale queries on filter change
  useEffect(() => {
    return () => {
      queryClient.cancelQueries({ queryKey: ['products-search'] });
    };
  }, [filters, queryClient]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['products-search', filters, page, limit],
    queryFn: () => fetchProducts(filters, page, limit),
    enabled,
    staleTime: 120_000,
    gcTime: 5 * 60_000,
    placeholderData: (prev) => prev, // Keep previous data while fetching
  });

  const totalPages = Math.ceil((data?.total ?? 0) / limit);

  // Prefetch next page
  useEffect(() => {
    if (enabled && page < totalPages - 1) {
      queryClient.prefetchQuery({
        queryKey: ['products-search', filters, page + 1, limit],
        queryFn: () => fetchProducts(filters, page + 1, limit),
        staleTime: 120_000,
      });
    }
  }, [enabled, filters, page, limit, totalPages, queryClient]);

  return {
    products: data?.products ?? [],
    total: data?.total ?? 0,
    isLoading,
    isFetching,
  };
}

/**
 * Simple wrapper for autocomplete (backward compatible).
 */
export function useProductSimpleSearch(searchText: string) {
  return useProductSearch({
    filters: { text: searchText },
    limit: 50,
    enabled: true,
  });
}
