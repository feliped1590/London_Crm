import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type CompanyProductRelationshipType =
  | 'INTEREST'
  | 'HOMOLOGATED'
  | 'RECURRENT'
  | 'STRATEGIC'
  | 'BLACKLIST';

export interface CompanyProductLink {
  id: string;
  company_id: string;
  product_id: string;
  relationship_type: CompanyProductRelationshipType;
  notes: string | null;
  is_preferred: boolean;
  created_at: string;
  updated_at: string;
  last_interaction_at: string | null;
  metadata: Record<string, unknown> | null;
  product: {
    id: string;
    name: string;
    sku: string;
    unit_price: number | null;
    active: boolean | null;
  } | null;
}

export interface ProductOption {
  id: string;
  name: string;
  sku: string;
  unit_price: number | null;
  active: boolean | null;
  tenant_id?: string;
  is_already_ordered?: boolean;
  last_order_at?: string | null;
}

interface CreateCompanyProductInput {
  productId: string;
  relationshipType: CompanyProductRelationshipType;
  notes?: string;
  isPreferred?: boolean;
}

export const relationshipTypeOptions: Array<{ value: CompanyProductRelationshipType; label: string }> = [
  { value: 'INTEREST', label: 'Interesse' },
  { value: 'HOMOLOGATED', label: 'Homologado' },
  { value: 'RECURRENT', label: 'Recorrente' },
  { value: 'STRATEGIC', label: 'Estratégico' },
  { value: 'BLACKLIST', label: 'Bloqueado' },
];

export function useCompanyProducts(companyId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [productSearch, setProductSearch] = useState('');

  const companyTenantQuery = useQuery({
    queryKey: ['company-products-tenant', companyId],
    queryFn: async () => {
      if (!companyId) return null;

      const { data, error } = await supabase
        .from('companies')
        .select('tenant_id')
        .eq('id', companyId)
        .maybeSingle();

      if (error) throw error;
      return data?.tenant_id ?? null;
    },
    enabled: !!companyId,
  });

  const linksQuery = useQuery({
    queryKey: ['company-products', companyId],
    queryFn: async (): Promise<CompanyProductLink[]> => {
      if (!companyId) return [];

      const { data, error } = await supabase
        .from('company_products')
        .select(`
          id,
          company_id,
          product_id,
          relationship_type,
          notes,
          is_preferred,
          created_at,
          updated_at,
          last_interaction_at,
          metadata,
          product:products(id, name, sku, unit_price, active)
        `)
        .eq('company_id', companyId)
        .is('archived_at', null)
        .order('is_preferred', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as CompanyProductLink[];
    },
    enabled: !!companyId,
  });

  const availableProductsQuery = useQuery({
    queryKey: ['company-products-available-products', companyId, companyTenantQuery.data, productSearch],
    queryFn: async (): Promise<ProductOption[]> => {
      if (!companyId) return [];
      if (!companyTenantQuery.data) throw new Error('Tenant do cliente não encontrado');

      const search = productSearch.trim();

      const { data, error } = await supabase.rpc('get_available_company_products', {
        p_company_id: companyId,
        p_search: search || null,
        p_limit: 50,
      });

      if (error) throw error;

      return (data ?? []) as ProductOption[];
    },
    enabled: !!companyId && !!companyTenantQuery.data,
  });

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['company-products', companyId] }),
      queryClient.invalidateQueries({ queryKey: ['company-products-available-products', companyId] }),
      queryClient.invalidateQueries({ queryKey: ['customer', companyId] }),
    ]);
  };

  const createLinkMutation = useMutation({
    mutationFn: async ({ productId, relationshipType, notes, isPreferred }: CreateCompanyProductInput) => {
      if (!companyId) throw new Error('Cliente não informado');
      if (!user?.id) throw new Error('Usuário não autenticado');
      if (!companyTenantQuery.data) throw new Error('Tenant do cliente não encontrado');

      const { error } = await supabase.from('company_products').insert([{
        tenant_id: companyTenantQuery.data,
        company_id: companyId,
        product_id: productId,
        relationship_type: relationshipType,
        notes: notes?.trim() || null,
        is_preferred: !!isPreferred,
        created_by: user.id,
        updated_by: user.id,
      }]);

      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidate();
      toast.success('Produto vinculado com sucesso!');
    },
    onError: (error: Error) => {
      if (error.message.toLowerCase().includes('duplicate') || error.message.toLowerCase().includes('unique')) {
        toast.error('Este produto já está vinculado ao cliente.');
        return;
      }
      toast.error(error.message || 'Erro ao vincular produto');
    },
  });

  const archiveLinkMutation = useMutation({
    mutationFn: async (linkId: string) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('company_products')
        .update({ archived_at: new Date().toISOString(), archived_by: user.id, updated_by: user.id })
        .eq('id', linkId);

      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidate();
      toast.success('Vínculo arquivado com sucesso!');
    },
    onError: () => toast.error('Erro ao arquivar vínculo'),
  });

  return {
    companyProducts: linksQuery.data ?? [],
    isLoading: linksQuery.isLoading,
    availableProducts: availableProductsQuery.data ?? [],
    isLoadingProducts: availableProductsQuery.isLoading,
    productSearch,
    setProductSearch,
    createLinkMutation,
    archiveLinkMutation,
  };
}