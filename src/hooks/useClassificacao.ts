import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMemo } from 'react';

export interface SetorOption { id: string; nome: string; }
export interface SegmentoOption { id: string; nome: string; setor_id: string; }
export interface AtividadeOption { id: string; nome: string; segmento_id: string; }

export function useClassificacao() {
  const { data, isLoading } = useQuery({
    queryKey: ['classificacao-options'],
    queryFn: async () => {
      const [setoresRes, segmentosRes, atividadesRes] = await Promise.all([
        supabase.from('setores').select('id, nome, sort_order').eq('is_active', true).order('sort_order'),
        supabase.from('segmentos').select('id, nome, setor_id, sort_order').eq('is_active', true).order('sort_order'),
        supabase.from('atividades').select('id, nome, segmento_id, sort_order').eq('is_active', true).order('sort_order'),
      ]);
      return {
        setores: (setoresRes.data || []) as SetorOption[],
        segmentos: (segmentosRes.data || []) as SegmentoOption[],
        atividades: (atividadesRes.data || []) as AtividadeOption[],
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  const setores = data?.setores || [];
  const segmentos = data?.segmentos || [];
  const atividades = data?.atividades || [];

  const getSegmentosBySetor = useMemo(() => {
    return (setorId: string | null) => {
      if (!setorId) return segmentos;
      return segmentos.filter(s => s.setor_id === setorId);
    };
  }, [segmentos]);

  const getAtividadesBySegmento = useMemo(() => {
    return (segmentoId: string | null) => {
      if (!segmentoId) return atividades;
      return atividades.filter(a => a.segmento_id === segmentoId);
    };
  }, [atividades]);

  const getNomeById = useMemo(() => {
    const setorMap = new Map(setores.map(s => [s.id, s.nome]));
    const segmentoMap = new Map(segmentos.map(s => [s.id, s.nome]));
    const atividadeMap = new Map(atividades.map(a => [a.id, a.nome]));
    return {
      setor: (id: string | null) => (id ? setorMap.get(id) || null : null),
      segmento: (id: string | null) => (id ? segmentoMap.get(id) || null : null),
      atividade: (id: string | null) => (id ? atividadeMap.get(id) || null : null),
    };
  }, [setores, segmentos, atividades]);

  return {
    setores,
    segmentos,
    atividades,
    getSegmentosBySetor,
    getAtividadesBySegmento,
    getNomeById,
    isLoading,
  };
}
