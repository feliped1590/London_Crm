import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSalesRepAccess } from '@/hooks/useSalesRepAccess';
import type { DelegationPermissions } from '@/hooks/usePortfolioDelegations';

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
  const { user } = useAuth();
  const { hasDirectAccess: directAccessFn, isAdmin, isLoaded: salesRepLoaded } = useSalesRepAccess();

  // A UI não pode depender de ler user_sales_reps de outro usuário (RLS bloqueia isso).
  // A função do backend resolve o sales_rep_id com SECURITY DEFINER e aplica a delegação real.
  const { data: effectivePermissions, isLoading: permissionsLoading } = useQuery({
    queryKey: ['effective_customer_access', user?.id, salesRepId],
    queryFn: async () => {
      if (!user?.id || !salesRepId) {
        return {
          can_manage_companies: false,
          can_manage_contacts: false,
          can_manage_deals: false,
          can_manage_orders: false,
          can_manage_pipeline: false,
        } satisfies DelegationPermissions;
      }

      const entityMap: Record<string, keyof DelegationPermissions> = {
        company: 'can_manage_companies',
        contact: 'can_manage_contacts',
        deal: 'can_manage_deals',
        order: 'can_manage_orders',
        pipeline: 'can_manage_pipeline',
      };

      const { data, error } = await (supabase as any).rpc('can_manage_portfolio_batch', {
        p_user_id: user.id,
        p_owner_ids: [salesRepId],
        p_entity_types: Object.keys(entityMap),
      });
      if (error) throw error;

      const result: DelegationPermissions = {
        can_manage_companies: false,
        can_manage_contacts: false,
        can_manage_deals: false,
        can_manage_orders: false,
        can_manage_pipeline: false,
      };
      for (const row of (data ?? []) as Array<{ entity_type: string; allowed: boolean }>) {
        const key = entityMap[row.entity_type];
        if (key) result[key] = !!row.allowed;
      }
      return result;
    },
    enabled: !!user?.id && !!salesRepId,
    staleTime: 5 * 60 * 1000,
  });

  return useMemo<EffectiveCustomerAccess>(() => {
    const hasDirect = !!salesRepId && directAccessFn(salesRepId);
    const baseAllowed = isAdmin || hasDirect;
    const noOwner = !salesRepId;
    const delegatedPermissions = !baseAllowed && effectivePermissions
      ? effectivePermissions
      : null;
    const hasDelegation = !!delegatedPermissions && Object.values(delegatedPermissions).some(Boolean);

    return {
      isAdmin,
      hasDirectAccess: hasDirect,
      hasDelegation,
      delegationPermissions: delegatedPermissions,
      ownerUserId: null,
      canEditCompany: baseAllowed || noOwner || !!effectivePermissions?.can_manage_companies,
      canManageContacts: baseAllowed || noOwner || !!effectivePermissions?.can_manage_contacts,
      canManageDeals: baseAllowed || noOwner || !!effectivePermissions?.can_manage_deals,
      canManageOrders: baseAllowed || noOwner || !!effectivePermissions?.can_manage_orders,
      canManagePipeline: baseAllowed || noOwner || !!effectivePermissions?.can_manage_pipeline,
      isLoaded: salesRepLoaded && !permissionsLoading,
    };
  }, [salesRepId, directAccessFn, isAdmin, effectivePermissions, salesRepLoaded, permissionsLoading]);
}
