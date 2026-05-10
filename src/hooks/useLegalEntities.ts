import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface LegalEntity {
  id: string;
  tenant_id: string;
  name: string;
  cnpj: string;
  active: boolean;
  erp_company_code: string | null;
  logo_url: string | null;
  created_at: string;
  [key: string]: any;
}

/**
 * Razão de bloqueio do contexto de entidade jurídica.
 * - 'no_entities': usuário sem nenhum vínculo acessível.
 * - 'no_active': tem vínculos mas não há entidade ativa válida selecionada.
 * - null: contexto pronto.
 */
export type LegalEntityBlockReason = 'no_entities' | 'no_active' | null;

export function useLegalEntities() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: allEntities = [], isLoading: entitiesLoading } = useQuery({
    queryKey: ['legal_entities'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('legal_entities')
        .select('*')
        .eq('active', true)
        .order('name');
      if (error) throw error;
      return data as LegalEntity[];
    },
    enabled: !!user?.id,
  });

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile_legal_entity', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, active_legal_entity_id')
        .eq('user_id', user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: userLinks = [], isLoading: linksLoading } = useQuery({
    queryKey: ['user_legal_entities', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data, error } = await supabase
        .from('user_legal_entities')
        .select('*')
        .eq('user_id', profile.id);
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.id,
  });

  const { data: isAdmin, isLoading: adminLoading } = useQuery({
    queryKey: ['is_admin_legal', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('has_role', {
        _user_id: user!.id,
        _role: 'admin',
      });
      if (error) throw error;
      return data as boolean;
    },
    enabled: !!user?.id,
  });

  const { data: isDeveloper, isLoading: devLoading } = useQuery({
    queryKey: ['is_dev_legal', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('has_role', {
        _user_id: user!.id,
        _role: 'desenvolvedor',
      });
      if (error) throw error;
      return data as boolean;
    },
    enabled: !!user?.id,
  });

  const isPrivileged = !!isAdmin || !!isDeveloper;

  // Acessíveis: admin/dev veem todas; demais SOMENTE as vinculadas (sem fallback "todas").
  const accessibleEntities = (() => {
    if (isPrivileged) return allEntities;
    const linkedIds = new Set(userLinks.map(l => l.legal_entity_id));
    return allEntities.filter(e => linkedIds.has(e.id));
  })();

  const activeLegalEntityId = profile?.active_legal_entity_id ?? null;
  const activeLegalEntity =
    accessibleEntities.find(e => e.id === activeLegalEntityId) ?? null;

  const isLoading = entitiesLoading || profileLoading || linksLoading || adminLoading || devLoading;

  const blockReason: LegalEntityBlockReason = (() => {
    if (isLoading) return null;
    if (accessibleEntities.length === 0) return 'no_entities';
    if (!activeLegalEntity) return 'no_active';
    return null;
  })();

  const isContextReady = !isLoading && blockReason === null;

  // Backward-compat: effectiveEntity/Id agora são aliases ESTRITOS do active.
  // Sem fallback de "primeira acessível" ou "headquarters". Quando bloqueado, retorna null.
  const effectiveEntity = activeLegalEntity;
  const effectiveEntityId = activeLegalEntity?.id ?? null;
  const defaultEntity = activeLegalEntity;

  const switchEntityMutation = useMutation({
    mutationFn: async (entityId: string | null) => {
      const { error } = await supabase
        .from('profiles')
        .update({ active_legal_entity_id: entityId })
        .eq('user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile_legal_entity'] });
      // Tudo que depende de entidade ativa
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['products-count'] });
      queryClient.invalidateQueries({ queryKey: ['product_search'] });
      queryClient.invalidateQueries({ queryKey: ['recent_products'] });
      queryClient.invalidateQueries({ queryKey: ['pipelines'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline_stages'] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      toast.success('CNPJ ativo alterado');
    },
    onError: () => toast.error('Erro ao trocar CNPJ ativo'),
  });

  return {
    allEntities,
    accessibleEntities,
    activeLegalEntityId,
    activeLegalEntity,
    defaultEntity,
    effectiveEntity,
    effectiveEntityId,
    isLoading,
    isContextReady,
    blockReason,
    hasEntities: allEntities.length > 0,
    switchEntity: switchEntityMutation.mutate,
    isSwitching: switchEntityMutation.isPending,
    userLinks,
    isAdmin: isAdmin ?? false,
    isDeveloper: isDeveloper ?? false,
    isPrivileged,
  };
}
