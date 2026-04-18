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

export function usePipelines() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

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

  const { data: pipelines, isLoading, error } = useQuery({
    queryKey: ['pipelines', userRole],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pipelines')
        .select('*')
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .order('name', { ascending: true });
      
      if (error) throw error;
      
      // Filtrar baseado no role do usuário
      const allPipelines = data as (Pipeline & { allowed_roles?: string[] | null })[];
      
      if (!userRole) return allPipelines as Pipeline[];
      
      // Desenvolvedores e admins têm acesso a todos os pipelines
      if (userRole === 'admin' || userRole === 'desenvolvedor') {
        return allPipelines as Pipeline[];
      }
      
      return allPipelines.filter(p => {
        // Se allowed_roles é null ou vazio, todos podem acessar
        if (!p.allowed_roles || p.allowed_roles.length === 0) return true;
        // Senão, verifica se o role do usuário está na lista
        return p.allowed_roles.includes(userRole);
      }) as Pipeline[];
    },
    enabled: !!user?.id,
  });

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
  };
}
