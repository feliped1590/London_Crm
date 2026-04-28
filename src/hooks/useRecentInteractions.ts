import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type RecentEntityType = 'company' | 'product';
export type RecentInteractionType = 'create' | 'update' | 'view' | 'open';

export interface RecentCompanyItem {
  id: string;
  name: string;
  fantasia: string | null;
  cnpj: string | null;
  city: string | null;
  state: string | null;
  active: boolean | null;
  tenant_id: string;
  last_interaction_at: string;
  interaction_type: RecentInteractionType;
}

export interface RecentProductItem {
  id: string;
  sku: string;
  name: string;
  unit_measure: string | null;
  ncm_code: string | null;
  unit_price: number | null;
  active: boolean | null;
  tenant_id: string;
  last_interaction_at: string;
  interaction_type: RecentInteractionType;
}

type RecentItemMap = {
  company: RecentCompanyItem;
  product: RecentProductItem;
};

interface RecordRecentPayload {
  entityType: RecentEntityType;
  entityId: string;
  interactionType?: RecentInteractionType;
  tenantId?: string | null;
  metadata?: Record<string, unknown>;
}

const getEntityTable = (entityType: RecentEntityType) => entityType === 'company' ? 'companies' : 'products';

async function resolveTenantId(entityType: RecentEntityType, entityId: string, tenantId?: string | null) {
  if (tenantId) return tenantId;

  const { data, error } = await supabase
    .from(getEntityTable(entityType))
    .select('tenant_id')
    .eq('id', entityId)
    .maybeSingle();

  if (error) throw error;
  return data?.tenant_id ?? null;
}

export function getRecentInteractionLabel(type: RecentInteractionType) {
  const labels: Record<RecentInteractionType, string> = {
    create: 'Criado',
    update: 'Salvo',
    view: 'Consultado',
    open: 'Aberto',
  };
  return labels[type] || 'Consultado';
}

export function useRecentInteractions<T extends RecentEntityType>(entityType: T) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['recent-interactions', entityType, user?.id],
    queryFn: async () => {
      if (!user?.id) return [] as RecentItemMap[T][];

      const { data: interactions, error } = await supabase
        .from('user_recent_interactions' as any)
        .select('entity_id, interaction_type, last_interaction_at')
        .eq('user_id', user.id)
        .eq('entity_type', entityType)
        .order('last_interaction_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      if (!interactions?.length) return [] as RecentItemMap[T][];

      const ids = interactions.map((item: any) => item.entity_id);

      if (entityType === 'company') {
        const { data: companies, error: companiesError } = await supabase
          .from('companies')
          .select('id, name, fantasia, cnpj, city, state, active, tenant_id')
          .in('id', ids);

        if (companiesError) throw companiesError;
        const map = new Map((companies || []).map((company) => [company.id, company]));

        return interactions
          .map((interaction: any) => {
            const company = map.get(interaction.entity_id);
            if (!company) return null;
            return {
              ...company,
              last_interaction_at: interaction.last_interaction_at,
              interaction_type: interaction.interaction_type,
            };
          })
          .filter(Boolean) as RecentItemMap[T][];
      }

      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, sku, name, unit_measure, ncm_code, unit_price, active, tenant_id')
        .in('id', ids);

      if (productsError) throw productsError;
      const map = new Map((products || []).map((product) => [product.id, product]));

      return interactions
        .map((interaction: any) => {
          const product = map.get(interaction.entity_id);
          if (!product) return null;
          return {
            ...product,
            last_interaction_at: interaction.last_interaction_at,
            interaction_type: interaction.interaction_type,
          };
        })
        .filter(Boolean) as RecentItemMap[T][];
    },
    enabled: !!user?.id,
    staleTime: 30_000,
  });

  const recordRecent = useMutation({
    mutationFn: async ({ entityType: targetEntityType, entityId, interactionType = 'view', tenantId, metadata = {} }: RecordRecentPayload) => {
      if (!user?.id) return;

      const resolvedTenantId = await resolveTenantId(targetEntityType, entityId, tenantId);
      if (!resolvedTenantId) return;

      const now = new Date().toISOString();

      const { error } = await supabase
        .from('user_recent_interactions' as any)
        .upsert({
          user_id: user.id,
          tenant_id: resolvedTenantId,
          entity_type: targetEntityType,
          entity_id: entityId,
          interaction_type: interactionType,
          metadata,
          last_interaction_at: now,
        }, {
          onConflict: 'user_id,entity_type,entity_id',
        });

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['recent-interactions', variables.entityType] });
    },
  });

  const recordInteraction = useCallback((payload: Omit<RecordRecentPayload, 'entityType'> & { entityType?: RecentEntityType }) => {
    recordRecent.mutate({
      ...payload,
      entityType: payload.entityType || entityType,
    });
  }, [entityType, recordRecent]);

  return {
    recentItems: query.data || [],
    isLoading: query.isLoading,
    recordInteraction,
  };
}
