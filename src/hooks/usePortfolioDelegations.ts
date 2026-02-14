import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface PortfolioDelegation {
  id: string;
  tenant_id: string;
  manager_user_id: string;
  portfolio_owner_id: string;
  can_manage_companies: boolean;
  can_manage_contacts: boolean;
  can_manage_deals: boolean;
  can_manage_orders: boolean;
  can_manage_pipeline: boolean;
  active: boolean;
  created_at: string;
  created_by: string | null;
  manager_name?: string;
  owner_name?: string;
}

export interface DelegationPermissions {
  can_manage_companies: boolean;
  can_manage_contacts: boolean;
  can_manage_deals: boolean;
  can_manage_orders: boolean;
  can_manage_pipeline: boolean;
}

export function usePortfolioDelegations() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch delegations where current user is the manager
  const { data: myDelegations = [], isLoading } = useQuery({
    queryKey: ['portfolio_delegations_mine', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('user_portfolio_delegations')
        .select('*')
        .eq('manager_user_id', user.id)
        .eq('active', true);
      if (error) throw error;

      // Fetch owner names
      const ownerIds = data.map(d => d.portfolio_owner_id);
      if (ownerIds.length === 0) return [];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', ownerIds);

      const nameMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);

      return data.map(d => ({
        ...d,
        owner_name: nameMap.get(d.portfolio_owner_id) || 'Desconhecido',
      })) as PortfolioDelegation[];
    },
    enabled: !!user?.id,
  });

  // All delegations (admin view)
  const { data: allDelegations = [], isLoading: isLoadingAll } = useQuery({
    queryKey: ['portfolio_delegations_all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_portfolio_delegations')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;

      // Fetch all user names
      const userIds = new Set<string>();
      data.forEach(d => {
        userIds.add(d.manager_user_id);
        userIds.add(d.portfolio_owner_id);
        if (d.created_by) userIds.add(d.created_by);
      });

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', Array.from(userIds));

      const nameMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);

      return data.map(d => ({
        ...d,
        manager_name: nameMap.get(d.manager_user_id) || 'Desconhecido',
        owner_name: nameMap.get(d.portfolio_owner_id) || 'Desconhecido',
      })) as PortfolioDelegation[];
    },
  });

  // Derived: list of owner IDs the current user manages
  const delegatedOwners = myDelegations.map(d => d.portfolio_owner_id);

  const hasDelegationFor = (ownerId: string): boolean => {
    return delegatedOwners.includes(ownerId);
  };

  const permissions = (ownerId: string): DelegationPermissions | null => {
    const delegation = myDelegations.find(d => d.portfolio_owner_id === ownerId);
    if (!delegation) return null;
    return {
      can_manage_companies: delegation.can_manage_companies,
      can_manage_contacts: delegation.can_manage_contacts,
      can_manage_deals: delegation.can_manage_deals,
      can_manage_orders: delegation.can_manage_orders,
      can_manage_pipeline: delegation.can_manage_pipeline,
    };
  };

  const getOwnerName = (ownerId: string): string => {
    return myDelegations.find(d => d.portfolio_owner_id === ownerId)?.owner_name || '';
  };

  // Mutations for admin management
  const createDelegation = useMutation({
    mutationFn: async (data: {
      tenant_id: string;
      manager_user_id: string;
      portfolio_owner_id: string;
      can_manage_companies: boolean;
      can_manage_contacts: boolean;
      can_manage_deals: boolean;
      can_manage_orders: boolean;
      can_manage_pipeline: boolean;
    }) => {
      const { error } = await supabase.from('user_portfolio_delegations').insert({
        ...data,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio_delegations_all'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio_delegations_mine'] });
      toast.success('Delegação criada com sucesso');
    },
    onError: (e: Error) => {
      if (e.message?.includes('no_self_delegation')) {
        toast.error('Não é possível delegar a carteira para si mesmo');
      } else if (e.message?.includes('unique_delegation')) {
        toast.error('Esta delegação já existe');
      } else {
        toast.error('Erro ao criar delegação: ' + e.message);
      }
    },
  });

  const updateDelegation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<PortfolioDelegation>) => {
      const { error } = await supabase
        .from('user_portfolio_delegations')
        .update(data)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio_delegations_all'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio_delegations_mine'] });
      toast.success('Delegação atualizada');
    },
    onError: () => toast.error('Erro ao atualizar delegação'),
  });

  const deleteDelegation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('user_portfolio_delegations')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio_delegations_all'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio_delegations_mine'] });
      toast.success('Delegação removida');
    },
    onError: () => toast.error('Erro ao remover delegação'),
  });

  return {
    // For current user (manager perspective)
    myDelegations,
    delegatedOwners,
    hasDelegationFor,
    permissions,
    getOwnerName,
    isLoading,

    // For admin management
    allDelegations,
    isLoadingAll,
    createDelegation,
    updateDelegation,
    deleteDelegation,
  };
}
