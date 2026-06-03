import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

type Level = 'setor' | 'segmento' | 'atividade';

const TABLES: Record<Level, 'setores' | 'segmentos' | 'atividades'> = {
  setor: 'setores',
  segmento: 'segmentos',
  atividade: 'atividades',
};

export interface UpsertInput {
  level: Level;
  id?: string;
  nome: string;
  sort_order?: number;
  is_active?: boolean;
  /** Para segmento: setor_id. Para atividade: segmento_id. */
  parent_id?: string;
}

export function useClassificacaoAdmin() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: tenantId } = useQuery({
    queryKey: ['active_tenant_id', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('user_tenants')
        .select('tenant_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();
      return data?.tenant_id || null;
    },
    enabled: !!user?.id,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['classificacao-options'] });
    qc.invalidateQueries({ queryKey: ['classificacao-admin'] });
  };

  const upsert = useMutation({
    mutationFn: async (input: UpsertInput) => {
      if (!tenantId) throw new Error('Tenant não identificado');
      const table = TABLES[input.level];
      const nome = input.nome.trim();
      if (!nome) throw new Error('Nome é obrigatório');

      const payload: any = {
        nome,
        sort_order: input.sort_order ?? 0,
        is_active: input.is_active ?? true,
        tenant_id: tenantId,
      };
      if (input.level === 'segmento') {
        if (!input.parent_id) throw new Error('Setor é obrigatório');
        payload.setor_id = input.parent_id;
      }
      if (input.level === 'atividade') {
        if (!input.parent_id) throw new Error('Segmento é obrigatório');
        payload.segmento_id = input.parent_id;
      }

      if (input.id) {
        const { error } = await supabase.from(table).update(payload).eq('id', input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from(table).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: (_, vars) => {
      invalidate();
      toast.success(vars.id ? 'Atualizado' : 'Cadastrado');
    },
    onError: (e: Error) => toast.error(e.message || 'Erro ao salvar'),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ level, id, is_active }: { level: Level; id: string; is_active: boolean }) => {
      const { error } = await supabase.from(TABLES[level]).update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Status alterado');
    },
    onError: (e: Error) => toast.error(e.message || 'Erro'),
  });

  const remove = useMutation({
    mutationFn: async ({ level, id }: { level: Level; id: string }) => {
      // Soft delete (preserva histórico)
      const { error } = await supabase.from(TABLES[level]).update({ is_active: false }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Removido (inativado)');
    },
    onError: (e: Error) => toast.error(e.message || 'Erro ao remover'),
  });

  return { tenantId, upsert, toggleActive, remove };
}

// Lista completa (inclui inativos) para a tela de admin.
export function useClassificacaoAll() {
  return useQuery({
    queryKey: ['classificacao-admin'],
    queryFn: async () => {
      const [setoresRes, segmentosRes, atividadesRes] = await Promise.all([
        supabase.from('setores').select('id, nome, sort_order, is_active').order('sort_order').order('nome'),
        supabase.from('segmentos').select('id, nome, setor_id, sort_order, is_active').order('sort_order').order('nome'),
        supabase.from('atividades').select('id, nome, segmento_id, sort_order, is_active').order('sort_order').order('nome'),
      ]);
      return {
        setores: setoresRes.data || [],
        segmentos: segmentosRes.data || [],
        atividades: atividadesRes.data || [],
      };
    },
    staleTime: 30_000,
  });
}
