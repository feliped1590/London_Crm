import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export type PipelineMode = 'sales' | 'operational' | 'hybrid' | 'support';
export type PipelineScope = 'global' | 'restricted';

export interface Pipeline {
  id: string;
  name: string;
  description: string | null;
  type: 'sales' | 'post_sales' | 'support';
  is_default: boolean;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  legal_entity_id: string | null;
  pipeline_mode: PipelineMode;
  pipeline_scope: PipelineScope;
}

export interface PipelineInsert {
  name: string;
  description?: string;
  type?: 'sales' | 'post_sales' | 'support';
  is_default?: boolean;
  is_active?: boolean;
  legal_entity_id?: string | null;
  pipeline_mode?: PipelineMode;
  pipeline_scope?: PipelineScope;
}

export interface PipelineUpdate extends Partial<PipelineInsert> {
  id: string;
}

export function usePipelines(opts?: { legalEntityId?: string | null }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const legalEntityId = opts?.legalEntityId ?? null;

  // Buscar o role do usuário atual
  const { data: userRole } = useQuery({
    queryKey: ['user_role', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data?.role || null;
    },
    enabled: !!user?.id,
  });

  // Vínculos User ↔ Legal Entity (user_legal_entities.user_id → profiles.id)
  const { data: userLinks = [] } = useQuery({
    queryKey: ['user_legal_entity_links', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!profileData) return [];
      const { data, error } = await supabase
        .from('user_legal_entities')
        .select('legal_entity_id')
        .eq('user_id', profileData.id);
      if (error) throw error;
      return (data || []).map(l => l.legal_entity_id).filter(Boolean) as string[];
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  // Mapa N:N pipeline → [legal_entity_id]
  const { data: pipelineEntitiesMap = {} } = useQuery({
    queryKey: ['pipeline_legal_entities_map', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pipeline_legal_entities' as any)
        .select('pipeline_id, legal_entity_id');
      if (error) throw error;
      const map: Record<string, string[]> = {};
      for (const row of (data as any[]) || []) {
        if (!map[row.pipeline_id]) map[row.pipeline_id] = [];
        map[row.pipeline_id].push(row.legal_entity_id);
      }
      return map;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  // QueryKey robusta: inclui IDs concatenados (não apenas length) para invalidar
  // corretamente quando os vínculos mudam mas a quantidade permanece igual.
  const linksKey = [...userLinks].sort().join(',');
  const mapKey = Object.keys(pipelineEntitiesMap)
    .sort()
    .map(k => `${k}:${[...pipelineEntitiesMap[k]].sort().join('|')}`)
    .join(';');

  const { data: pipelines, isLoading, error } = useQuery({
    queryKey: ['pipelines', userRole, legalEntityId, linksKey, mapKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pipelines')
        .select('*')
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .order('name', { ascending: true });
      
      if (error) throw error;
      
      const allPipelines = data as (Pipeline & { allowed_roles?: string[] | null })[];
      const isPrivileged = userRole === 'admin' || userRole === 'desenvolvedor';
      const allowedEntityIds = new Set(userLinks);
      // Compat legado: usuário sem vínculos vê tudo (espelha useLegalEntities)
      const allowAllEntities = isPrivileged || userLinks.length === 0;

      let filtered = allPipelines.filter(p => {
        // N:N: lê vínculos do mapa (fallback seguro para array vazio)
        const entities = pipelineEntitiesMap[p.id] ?? [];
        const isGlobal = entities.length === 0;
        // Pipeline global sempre visível
        if (isGlobal) return true;
        if (allowAllEntities) return true;
        return entities.some(eid => allowedEntityIds.has(eid));
      });

      // Empresa ativa selecionada: restringir a globais + entidades vinculadas
      if (legalEntityId) {
        filtered = filtered.filter(p => {
          const entities = pipelineEntitiesMap[p.id] ?? [];
          return entities.length === 0 || entities.includes(legalEntityId);
        });
      }
      
      if (!userRole) return filtered as Pipeline[];
      if (isPrivileged) return filtered as Pipeline[];
      
      return filtered.filter(p => {
        if (!p.allowed_roles || p.allowed_roles.length === 0) return true;
        return p.allowed_roles.includes(userRole);
      }) as Pipeline[];
    },
    enabled: !!user?.id,
  });

  const getPipelineEntities = (pipelineId: string): string[] =>
    pipelineEntitiesMap[pipelineId] ?? [];

  const { data: allPipelines } = useQuery({
    queryKey: ['pipelines', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pipelines')
        .select('*')
        .order('is_default', { ascending: false })
        .order('name', { ascending: true });
      
      if (error) throw error;
      return data as Pipeline[];
    },
    enabled: !!user?.id,
  });

  const defaultPipeline = pipelines?.find(p => p.is_default) || pipelines?.[0];

  const createPipeline = useMutation({
    mutationFn: async (data: PipelineInsert) => {
      const { data: result, error } = await supabase
        .from('pipelines')
        .insert({
          ...data,
          created_by: user?.id,
          legal_entity_id: data.legal_entity_id ?? null,
          pipeline_mode: data.pipeline_mode ?? 'sales',
          pipeline_scope: data.pipeline_scope ?? 'global',
        } as any)
        .select()
        .single();
      
      if (error) throw error;
      return result as Pipeline;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines'] });
      toast.success('Pipeline criado com sucesso!');
    },
    onError: (error) => {
      console.error('Error creating pipeline:', error);
      toast.error('Erro ao criar pipeline');
    },
  });

  const updatePipeline = useMutation({
    mutationFn: async ({ id, ...data }: PipelineUpdate) => {
      const { data: result, error } = await supabase
        .from('pipelines')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return result as Pipeline;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines'] });
      toast.success('Pipeline atualizado!');
    },
    onError: (error) => {
      console.error('Error updating pipeline:', error);
      toast.error('Erro ao atualizar pipeline');
    },
  });

  const deletePipeline = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('pipelines')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines'] });
      toast.success('Pipeline excluído!');
    },
    onError: (error) => {
      console.error('Error deleting pipeline:', error);
      toast.error('Erro ao excluir pipeline');
    },
  });

  const setDefaultPipeline = useMutation({
    mutationFn: async (id: string) => {
      // First, unset all defaults
      const { error: unsetError } = await supabase
        .from('pipelines')
        .update({ is_default: false })
        .neq('id', id);
      
      if (unsetError) throw unsetError;

      // Then, set the new default
      const { error } = await supabase
        .from('pipelines')
        .update({ is_default: true })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines'] });
      toast.success('Pipeline padrão definido!');
    },
    onError: (error) => {
      console.error('Error setting default pipeline:', error);
      toast.error('Erro ao definir pipeline padrão');
    },
  });

  // Substitui o conjunto de legal_entities vinculadas ao pipeline (delete + insert)
  const setPipelineLegalEntities = useMutation({
    mutationFn: async ({ pipelineId, legalEntityIds }: { pipelineId: string; legalEntityIds: string[] }) => {
      const { error: delErr } = await supabase
        .from('pipeline_legal_entities' as any)
        .delete()
        .eq('pipeline_id', pipelineId);
      if (delErr) throw delErr;

      if (legalEntityIds.length > 0) {
        const rows = legalEntityIds.map(eid => ({
          pipeline_id: pipelineId,
          legal_entity_id: eid,
          created_by: user?.id ?? null,
        }));
        const { error: insErr } = await supabase
          .from('pipeline_legal_entities' as any)
          .insert(rows);
        if (insErr) throw insErr;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline_legal_entities_map'] });
    },
    onError: (e) => {
      console.error('Error setting pipeline legal entities:', e);
      toast.error('Erro ao salvar empresas do funil');
    },
  });

  return {
    pipelines,
    allPipelines,
    defaultPipeline,
    isLoading,
    error,
    createPipeline,
    updatePipeline,
    deletePipeline,
    setDefaultPipeline,
    pipelineEntitiesMap,
    getPipelineEntities,
    setPipelineLegalEntities,
  };
}
