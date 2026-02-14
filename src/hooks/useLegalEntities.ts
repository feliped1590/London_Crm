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
  created_at: string;
  [key: string]: any;
}

export function useLegalEntities() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all active legal entities for the tenant
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

  // Fetch user's active_legal_entity_id from profile
  const { data: profile } = useQuery({
    queryKey: ['profile_legal_entity', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('active_legal_entity_id')
        .eq('user_id', user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch user's linked legal entities (restrictions)
  const { data: userLinks = [] } = useQuery({
    queryKey: ['user_legal_entities', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_legal_entities')
        .select('*')
        .eq('user_id', user!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Check if user is admin
  const { data: isAdmin } = useQuery({
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

  // Accessible entities: admin or no restrictions = all; otherwise only linked
  const accessibleEntities = (() => {
    if (isAdmin || userLinks.length === 0) return allEntities;
    const linkedIds = new Set(userLinks.map(l => l.legal_entity_id));
    return allEntities.filter(e => linkedIds.has(e.id));
  })();

  const activeLegalEntityId = profile?.active_legal_entity_id ?? null;
  const activeLegalEntity = allEntities.find(e => e.id === activeLegalEntityId) ?? null;
  const defaultEntity = allEntities.find(e => (e as any).is_headquarters === true) ?? null;
  const effectiveEntity = activeLegalEntity ?? defaultEntity ?? allEntities[0] ?? null;
  const effectiveEntityId = effectiveEntity?.id ?? null;

  // Mutation to switch active legal entity
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
      queryClient.invalidateQueries({ queryKey: ['orders'] });
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
    isLoading: entitiesLoading,
    hasEntities: allEntities.length > 0,
    switchEntity: switchEntityMutation.mutate,
    isSwitching: switchEntityMutation.isPending,
    userLinks,
    isAdmin: isAdmin ?? false,
  };
}
