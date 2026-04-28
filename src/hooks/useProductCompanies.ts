import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { CompanyProductRelationshipType } from '@/hooks/useCompanyProducts';

export interface ProductCompanyLink {
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
  company: {
    id: string;
    name: string;
    fantasia: string | null;
    cnpj: string | null;
    city: string | null;
    state: string | null;
    active: boolean | null;
  } | null;
}

export interface CompanyOption {
  id: string;
  name: string;
  fantasia: string | null;
  cnpj: string | null;
  city: string | null;
  state: string | null;
  tenant_id: string | null;
}

interface CreateProductCompanyInput {
  companyId: string;
  relationshipType: CompanyProductRelationshipType;
  notes?: string;
  isPreferred?: boolean;
}

export function useProductCompanies(productId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [companySearch, setCompanySearch] = useState('');

  const productTenantQuery = useQuery({
    queryKey: ['product-companies-tenant', productId],
    queryFn: async () => {
      if (!productId) return null;
      const { data, error } = await supabase
        .from('products')
        .select('tenant_id')
        .eq('id', productId)
        .maybeSingle();
      if (error) throw error;
      return data?.tenant_id ?? null;
    },
    enabled: !!productId,
  });

  const linksQuery = useQuery({
    queryKey: ['product-companies', productId],
    queryFn: async (): Promise<ProductCompanyLink[]> => {
      if (!productId) return [];
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
          company:companies(id, name, fantasia, cnpj, city, state, active)
        `)
        .eq('product_id', productId)
        .is('archived_at', null)
        .order('is_preferred', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ProductCompanyLink[];
    },
    enabled: !!productId,
  });

  const availableCompaniesQuery = useQuery({
    queryKey: ['product-companies-available-companies', productId, productTenantQuery.data, companySearch],
    queryFn: async (): Promise<CompanyOption[]> => {
      if (!productId || !productTenantQuery.data) return [];

      const linkedCompanyIds = (linksQuery.data ?? []).map((link) => link.company_id);
      const search = companySearch.trim();
      let query = supabase
        .from('companies')
        .select('id, name, fantasia, cnpj, city, state, tenant_id')
        .eq('tenant_id', productTenantQuery.data)
        .eq('active', true)
        .order('name')
        .limit(50);

      if (search) {
        query = query.or(`name.ilike.%${search}%,fantasia.ilike.%${search}%,cnpj.ilike.%${search}%`);
      }
      if (linkedCompanyIds.length > 0) {
        query = query.not('id', 'in', `(${linkedCompanyIds.join(',')})`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as CompanyOption[];
    },
    enabled: !!productId && !!productTenantQuery.data,
  });

  const invalidate = async (companyId?: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['product-companies', productId] }),
      queryClient.invalidateQueries({ queryKey: ['product-companies-available-companies', productId] }),
      queryClient.invalidateQueries({ queryKey: ['company-products'] }),
      companyId ? queryClient.invalidateQueries({ queryKey: ['company-products', companyId] }) : Promise.resolve(),
    ]);
  };

  const createLinkMutation = useMutation({
    mutationFn: async ({ companyId, relationshipType, notes, isPreferred }: CreateProductCompanyInput) => {
      if (!productId) throw new Error('Produto não informado');
      if (!user?.id) throw new Error('Usuário não autenticado');
      if (!productTenantQuery.data) throw new Error('Tenant do produto não encontrado');

      const { error } = await supabase.from('company_products').insert([{
        tenant_id: productTenantQuery.data,
        company_id: companyId,
        product_id: productId,
        relationship_type: relationshipType,
        notes: notes?.trim() || null,
        is_preferred: !!isPreferred,
        created_by: user.id,
        updated_by: user.id,
      }]);
      if (error) throw error;
      return companyId;
    },
    onSuccess: async (companyId) => {
      await invalidate(companyId);
      toast.success('Cliente vinculado com sucesso!');
    },
    onError: (error: Error) => {
      if (error.message.toLowerCase().includes('duplicate') || error.message.toLowerCase().includes('unique')) {
        toast.error('Este cliente já está vinculado ao produto.');
        return;
      }
      toast.error(error.message || 'Erro ao vincular cliente');
    },
  });

  const archiveLinkMutation = useMutation({
    mutationFn: async ({ linkId, companyId }: { linkId: string; companyId: string }) => {
      if (!user?.id) throw new Error('Usuário não autenticado');
      const { error } = await supabase
        .from('company_products')
        .update({ archived_at: new Date().toISOString(), archived_by: user.id, updated_by: user.id })
        .eq('id', linkId);
      if (error) throw error;
      return companyId;
    },
    onSuccess: async (companyId) => {
      await invalidate(companyId);
      toast.success('Vínculo arquivado com sucesso!');
    },
    onError: () => toast.error('Erro ao arquivar vínculo'),
  });

  return {
    productCompanies: linksQuery.data ?? [],
    isLoading: linksQuery.isLoading,
    availableCompanies: availableCompaniesQuery.data ?? [],
    isLoadingCompanies: availableCompaniesQuery.isLoading,
    setCompanySearch,
    createLinkMutation,
    archiveLinkMutation,
  };
}
