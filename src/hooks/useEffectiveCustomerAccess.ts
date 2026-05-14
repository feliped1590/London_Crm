import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSalesRepAccess } from '@/hooks/useSalesRepAccess';
import { usePortfolioDelegations, type DelegationPermissions } from '@/hooks/usePortfolioDelegations';

export interface EffectiveCustomerAccess {
  /** Pode editar dados cadastrais da empresa */
  canEditCompany: boolean;
  /** Pode gerenciar contatos */
  canManageContacts: boolean;
  /** Pode gerenciar deals */
  canManageDeals: boolean;
  /** Pode gerenciar pedidos */
  canManageOrders: boolean;
  /** Pode mover/gerenciar pipeline */
  canManagePipeline: boolean;
  /** Acesso direto via user_sales_reps */
  hasDirectAccess: boolean;
  /** É admin/dev */
  isAdmin: boolean;
  /** Existe delegação ativa para o dono */
  hasDelegation: boolean;
  /** Permissões da delegação resolvidas (null se não há delegação) */
  delegationPermissions: DelegationPermissions | null;
  /** user_id do dono da carteira (resolvido a partir do sales_rep_id) */
  ownerUserId: string | null;
  isLoaded: boolean;
}

/**
 * Resolve o acesso efetivo da usuária logada sobre um cliente,
 * combinando: admin + acesso direto via user_sales_reps + delegação de carteira.
 */
export function useEffectiveCustomerAccess(
  salesRepId: string | null | undefined,
): EffectiveCustomerAccess {
  const { hasDirectAccess: directAccessFn, isAdmin, isLoaded: salesRepLoaded } = useSalesRepAccess();
  const { myDelegations, isLoading: delegationsLoading } = usePortfolioDelegations();

  // Resolve sales_rep_id -> user_id (dono da carteira) via user_sales_reps
  const { data: ownerUserId, isLoading: ownerLoading } = useQuery({
    queryKey: ['resolve_user_for_sales_rep', salesRepId],
    queryFn: async () => {
      if (!salesRepId) return null;
      const { data } = await supabase
        .from('user_sales_reps')
        .select('user_id, is_default, created_at')
        .eq('sales_rep_id', salesRepId)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      return data?.user_id || null;
    },
    enabled: !!salesRepId,
    staleTime: 5 * 60 * 1000,
  });

  return useMemo<EffectiveCustomerAccess>(() => {
    const hasDirect = !!salesRepId && directAccessFn(salesRepId);
    const delegation = ownerUserId
      ? myDelegations.find(d => d.portfolio_owner_id === ownerUserId && d.active)
      : undefined;

    const delegationPermissions: DelegationPermissions | null = delegation
      ? {
          can_manage_companies: delegation.can_manage_companies,
          can_manage_contacts: delegation.can_manage_contacts,
          can_manage_deals: delegation.can_manage_deals,
          can_manage_orders: delegation.can_manage_orders,
          can_manage_pipeline: delegation.can_manage_pipeline,
        }
      : null;

    const baseAllowed = isAdmin || hasDirect;
    const noOwner = !salesRepId;

    return {
      isAdmin,
      hasDirectAccess: hasDirect,
      hasDelegation: !!delegation,
      delegationPermissions,
      ownerUserId: ownerUserId ?? null,
      canEditCompany: baseAllowed || noOwner || !!delegationPermissions?.can_manage_companies,
      canManageContacts: baseAllowed || noOwner || !!delegationPermissions?.can_manage_contacts,
      canManageDeals: baseAllowed || noOwner || !!delegationPermissions?.can_manage_deals,
      canManageOrders: baseAllowed || noOwner || !!delegationPermissions?.can_manage_orders,
      canManagePipeline: baseAllowed || noOwner || !!delegationPermissions?.can_manage_pipeline,
      isLoaded: salesRepLoaded && !delegationsLoading && !ownerLoading,
    };
  }, [salesRepId, directAccessFn, isAdmin, ownerUserId, myDelegations, salesRepLoaded, delegationsLoading, ownerLoading]);
}
