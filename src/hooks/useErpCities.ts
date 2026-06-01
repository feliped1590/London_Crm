import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ErpCity {
  nome: string;
  uf: string;
  codigo_erp: number;
}

export interface ErpCitiesData {
  ufs: string[];
  citiesByUf: Record<string, ErpCity[]>;
  all: ErpCity[];
}

const EMPTY: ErpCitiesData = { ufs: [], citiesByUf: {}, all: [] };

function normalize(s: string | null | undefined) {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

export function useErpCities() {
  const query = useQuery({
    queryKey: ['erp-cities'],
    staleTime: 1000 * 60 * 30,
    queryFn: async (): Promise<ErpCitiesData> => {
      const { data, error } = await supabase
        .from('erp_cities')
        .select('nome, uf, codigo_erp')
        .order('uf', { ascending: true })
        .order('nome', { ascending: true });

      if (error) throw error;

      const rows = (data ?? []) as ErpCity[];
      const citiesByUf: Record<string, ErpCity[]> = {};
      for (const row of rows) {
        const uf = (row.uf || '').toUpperCase();
        if (!citiesByUf[uf]) citiesByUf[uf] = [];
        citiesByUf[uf].push({ ...row, uf });
      }
      const ufs = Object.keys(citiesByUf).sort();
      return { ufs, citiesByUf, all: rows };
    },
  });

  return {
    ...query,
    data: query.data ?? EMPTY,
  };
}

/**
 * Try to find a mapped city given a free-text city+uf (e.g. from BrasilAPI).
 * Returns the canonical mapped name if found, otherwise null.
 */
export function matchMappedCity(
  data: ErpCitiesData,
  city: string | null | undefined,
  uf: string | null | undefined,
): ErpCity | null {
  if (!city || !uf) return null;
  const ufKey = uf.toUpperCase();
  const list = data.citiesByUf[ufKey];
  if (!list) return null;
  const target = normalize(city);
  return list.find((c) => normalize(c.nome) === target) ?? null;
}

export { normalize as normalizeCityName };
