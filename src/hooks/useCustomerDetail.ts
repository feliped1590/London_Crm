import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import { useSalesReps } from '@/hooks/useSalesReps';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

// Interface unificada para cliente (CRM ou ERP)
export interface UnifiedCustomer {
  id: string;
  name: string;
  fantasia: string | null;
  cnpj: string | null;
  inscricao_estadual: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  setor_id?: string | null;
  segmento_id?: string | null;
  atividade_id?: string | null;
  employee_count: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  notes: string | null;
  custom_fields: Json | null;
  regiao?: string | null;
  segmento?: string | null;
  tipo_pessoa?: string | null;
  parent_company_id?: string | null;
  is_matriz?: boolean;
  last_reviewed_at?: string | null;
  active?: boolean;
  contribuinte_ipi?: boolean;
  owner_id?: string | null;
  sales_rep_id?: string | null;
  contact_name?: string | null;
  source: 'crm' | 'erp';
  contacts?: CustomerContact[];
  deals?: any[];
}

export interface CustomerContact {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  job_title: string | null;
  department: string | null;
  linkedin_url: string | null;
  cpf: string | null;
  notes: string | null;
  custom_fields: Json | null;
}

export function useCustomerDetail(id: string | undefined) {
  const { user } = useAuth();
  const { isAdmin } = useModulePermissions();
  const { salesReps } = useSalesReps();
  const queryClient = useQueryClient();

  // Fetch profiles map for access resolution
  const { data: profilesMap } = useQuery({
    queryKey: ['profiles_map_for_access'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, full_name');
      const map: Record<string, string> = {};
      (data || []).forEach((p: any) => { map[p.user_id] = p.full_name || 'Usuário'; });
      return map;
    },
  });

  // Fetch customer with dual-source fallback (CRM → ERP)
  const { data: customer, isLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: async (): Promise<UnifiedCustomer | null> => {
      if (!id) return null;

      const { data: crmData } = await supabase
        .from('companies')
        .select(`*, contacts(*), deals(id, name, stage, value, expected_close_date, owner_id)`)
        .eq('id', id)
        .maybeSingle();

      if (crmData) {
        return { ...crmData, source: 'crm' as const };
      }

      const { data: erpData, error: erpError } = await supabase
        .from('crm_clients')
        .select(`*, crm_client_addresses(*)`)
        .eq('id', id)
        .maybeSingle();

      if (erpError) throw erpError;

      if (erpData) {
        const addresses = erpData.crm_client_addresses || [];
        const localAddress = addresses.find((a: any) => a.tipo === 'LOCAL') || addresses[0];

        let fullAddress = '';
        if (localAddress) {
          const parts = [localAddress.endereco, localAddress.numero, localAddress.bairro].filter(Boolean);
          fullAddress = parts.join(', ');
          if (localAddress.complemento) fullAddress += ` - ${localAddress.complemento}`;
        }

        return {
          id: erpData.id,
          name: erpData.razao_social || 'Sem nome',
          fantasia: erpData.nome_fantasia,
          cnpj: erpData.cnpj_cpf,
          inscricao_estadual: erpData.insc_estadual,
          phone: erpData.telefone || erpData.celular,
          email: erpData.emails?.[0] || null,
          website: null,
          employee_count: null,
          address: fullAddress || null,
          city: localAddress?.cidade || null,
          state: localAddress?.uf || null,
          country: 'Brasil',
          notes: null,
          custom_fields: null,
          regiao: erpData.regiao,
          segmento: erpData.segmento,
          tipo_pessoa: erpData.tipo_pessoa,
          owner_id: erpData.owner_id,
          source: 'erp' as const,
          contacts: [],
          deals: [],
        };
      }

      return null;
    },
    enabled: !!id,
  });

  // Fetch sellers for owner assignment (admin only)
  const { data: sellers } = useQuery({
    queryKey: ['sellers-for-assignment'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id, full_name')
        .order('full_name');
      if (error) throw error;
      return data || [];
    },
    enabled: isAdmin,
  });

  // Current owner resolution
  const currentOwner = React.useMemo(() => {
    if (!customer) return null;

    if (customer.source === 'crm') {
      return salesReps?.find(s => s.id === customer.sales_rep_id) || null;
    }

    if (!customer.owner_id || !sellers) return null;

    if (customer.source === 'erp') {
      return sellers.find(s => s.id === customer.owner_id);
    }

    return sellers.find(s => s.user_id === customer.owner_id);
  }, [customer, sellers, salesReps]);

  const selectValue = React.useMemo(() => {
    if (!customer) return 'none';
    if (customer.source === 'crm') return customer.sales_rep_id || 'none';
    if (!customer.owner_id) return 'none';
    if (customer.source === 'erp') return customer.owner_id;
    const seller = sellers?.find(s => s.user_id === customer.owner_id);
    return seller?.id || 'none';
  }, [customer, sellers]);

  // ── Mutations ──

  const assignOwnerMutation = useMutation({
    mutationFn: async (profileId: string | null) => {
      const isErp = customer?.source === 'erp';
      const tableName = isErp ? 'crm_clients' : 'companies';
      let ownerIdToSave: string | null = null;
      if (profileId && profileId !== 'none') {
        const seller = sellers?.find(s => s.id === profileId);
        ownerIdToSave = isErp ? profileId : (seller?.user_id || null);
      }
      const { error } = await supabase.from(tableName).update({ owner_id: ownerIdToSave }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer', id] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Vendedor responsável atualizado!');
    },
    onError: () => toast.error('Erro ao atualizar vendedor'),
  });

  const updateCompanyMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from('companies').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer', id] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Cliente atualizado com sucesso!');
    },
    onError: (error: any) => {
      const message = error?.message || '';
      if (message.includes('Este cliente pertence ao vendedor')) {
        toast.error(message, { duration: 6000 });
      } else {
        toast.error('Erro ao atualizar cliente');
      }
    },
  });

  const saveContactMutation = useMutation({
    mutationFn: async ({ data, editingContactId }: { data: any; editingContactId: string | null }) => {
      if (editingContactId) {
        const { error } = await supabase.from('contacts').update(data).eq('id', editingContactId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('contacts')
          .insert({ ...data, company_id: id, created_by: user?.id, owner_id: user?.id });
        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['customer', id] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success(variables.editingContactId ? 'Contato atualizado!' : 'Contato adicionado!');
    },
    onError: () => toast.error('Erro ao salvar contato'),
  });

  const deleteContactMutation = useMutation({
    mutationFn: async (contactId: string) => {
      const { error } = await supabase.from('contacts').delete().eq('id', contactId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer', id] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Contato removido!');
    },
    onError: () => toast.error('Erro ao remover contato'),
  });

  const markAsReviewedMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('companies')
        .update({ last_reviewed_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer', id] });
      toast.success('Cadastro marcado como revisado!');
    },
    onError: () => toast.error('Erro ao marcar como revisado'),
  });

  // ── Helpers ──

  const isReviewOverdue = (lastReviewedAt: string | null | undefined): boolean => {
    if (!lastReviewedAt) return true;
    const lastReview = new Date(lastReviewedAt);
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    return lastReview < sixMonthsAgo;
  };

  const formatReviewDate = (dateString: string | null | undefined): string => {
    if (!dateString) return 'Nunca revisado';
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return {
    customer,
    isLoading,
    sellers,
    currentOwner,
    selectValue,
    profilesMap,

    // Mutations
    assignOwnerMutation,
    updateCompanyMutation,
    saveContactMutation,
    deleteContactMutation,
    markAsReviewedMutation,

    // Helpers
    isReviewOverdue,
    formatReviewDate,
  };
}
