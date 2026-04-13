import { useState, useCallback, useEffect } from 'react';
import type { ProductSearchFilters } from './useProductSearch';

const STORAGE_KEY = 'product-search-filters';
const EXPIRY_DAYS = 7;

interface StoredState {
  filters: ProductSearchFilters;
  savedAt: number;
}

function loadFromStorage(): ProductSearchFilters {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const stored: StoredState = JSON.parse(raw);
    const ageMs = Date.now() - stored.savedAt;
    if (ageMs > EXPIRY_DAYS * 86_400_000) {
      localStorage.removeItem(STORAGE_KEY);
      return {};
    }
    return stored.filters;
  } catch {
    return {};
  }
}

function saveToStorage(filters: ProductSearchFilters) {
  try {
    const stored: StoredState = { filters, savedAt: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch { /* noop */ }
}

/**
 * Manages filter state, pagination, and localStorage persistence
 * for the advanced product search modal.
 */
export function useProductSearchState() {
  const [filters, setFiltersRaw] = useState<ProductSearchFilters>(loadFromStorage);
  const [page, setPage] = useState(0);

  // Persist on change
  useEffect(() => {
    saveToStorage(filters);
  }, [filters]);

  const setFilter = useCallback(<K extends keyof ProductSearchFilters>(key: K, value: ProductSearchFilters[K]) => {
    setFiltersRaw(prev => {
      const next = { ...prev, [key]: value || undefined };
      // Dependent filter cascade: clear children when parent changes
      if (key === 'family_id') {
        delete next.grupo_id;
        delete next.subgrupo_id;
      }
      if (key === 'grupo_id') {
        delete next.subgrupo_id;
      }
      return next;
    });
    setPage(0);
  }, []);

  const clearFilters = useCallback(() => {
    setFiltersRaw({});
    setPage(0);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const hasActiveFilters = Object.values(filters).some(v => !!v);

  return {
    filters,
    setFilter,
    clearFilters,
    hasActiveFilters,
    page,
    setPage,
  };
}
