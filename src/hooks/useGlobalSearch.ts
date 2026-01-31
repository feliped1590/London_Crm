import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SearchResult {
  id: string;
  type: 'company' | 'contact' | 'deal' | 'task';
  title: string;
  subtitle?: string;
  href: string;
}

export function useGlobalSearch() {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const search = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }

    setIsSearching(true);

    try {
      const searchPattern = `%${query}%`;

      const [
        { data: companies },
        { data: contacts },
        { data: deals },
        { data: tasks },
      ] = await Promise.all([
        supabase
          .from('companies')
          .select('id, name, city')
          .ilike('name', searchPattern)
          .limit(5),
        supabase
          .from('contacts')
          .select('id, first_name, last_name, email, company:companies(name)')
          .or(`first_name.ilike.${searchPattern},last_name.ilike.${searchPattern},email.ilike.${searchPattern}`)
          .limit(5),
        supabase
          .from('deals')
          .select('id, name, value, company:companies(name)')
          .ilike('name', searchPattern)
          .limit(5),
        supabase
          .from('tasks')
          .select('id, title, status')
          .ilike('title', searchPattern)
          .limit(5),
      ]);

      const allResults: SearchResult[] = [
        ...(companies || []).map(c => ({
          id: c.id,
          type: 'company' as const,
          title: c.name,
          subtitle: c.city || undefined,
          href: `/companies?search=${encodeURIComponent(c.name)}`,
        })),
        ...(contacts || []).map(c => ({
          id: c.id,
          type: 'contact' as const,
          title: `${c.first_name} ${c.last_name || ''}`.trim(),
          subtitle: c.company?.name || c.email || undefined,
          href: `/contacts?search=${encodeURIComponent(c.first_name)}`,
        })),
        ...(deals || []).map(d => ({
          id: d.id,
          type: 'deal' as const,
          title: d.name,
          subtitle: d.company?.name || (d.value ? `R$ ${d.value.toLocaleString('pt-BR')}` : undefined),
          href: `/pipeline?deal=${d.id}`,
        })),
        ...(tasks || []).map(t => ({
          id: t.id,
          type: 'task' as const,
          title: t.title,
          subtitle: t.status === 'concluida' ? 'Concluída' : 'Pendente',
          href: `/tasks?task=${t.id}`,
        })),
      ];

      setResults(allResults);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const clearResults = useCallback(() => {
    setResults([]);
  }, []);

  return {
    results,
    isSearching,
    search,
    clearResults,
  };
}
