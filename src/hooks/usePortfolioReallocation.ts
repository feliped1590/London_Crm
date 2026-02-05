import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useState } from 'react';

export interface ReallocationFilters {
  states?: string[];
  regions?: string[];
  ownerId?: string;
  minDaysNoInteraction?: number;
  minDaysNoOrder?: number;
  search?: string;
}

export interface CompanyForReallocation {
  company_id: string;
  company_name: string;
  cnpj: string | null;
  state: string | null;
  city: string | null;
  owner_id: string | null;
  owner_name: string;
  regiao: string | null;
  subregiao: string | null;
  last_interaction_at: string | null;
  days_since_interaction: number;
  last_order_at: string | null;
  days_since_order: number;
  total_orders: number;
  total_order_value: number;
}

export interface ReallocationTransferRequest {
  companyIds: string[];
  toUserId: string;
  transferContacts: boolean;
  transferDeals: boolean;
  reason: string;
  filterContext: ReallocationFilters;
}

export function usePortfolioReallocation() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<ReallocationFilters>({});
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set());

  // Buscar UFs disponíveis
  const { data: availableStates } = useQuery({
    queryKey: ['reallocation-states'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_distinct_states_for_reallocation');
      if (error) throw error;
      return (data as { state: string }[]).map(d => d.state);
    }
  });

  // Buscar regiões disponíveis
  const { data: availableRegions } = useQuery({
    queryKey: ['reallocation-regions'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_distinct_regions_for_reallocation');
      if (error) throw error;
      return (data as { regiao: string }[]).map(d => d.regiao);
    }
  });

  // Buscar vendedores para filtro e destino
  const { data: sellers } = useQuery({
    queryKey: ['reallocation-sellers'],
    queryFn: async () => {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name');
      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');
      if (rolesError) throw rolesError;

      return profiles?.map(p => ({
        id: p.user_id,
        name: p.full_name || 'Sem nome',
        role: roles?.find(r => r.user_id === p.user_id)?.role || 'vendedor'
      })) || [];
    }
  });

  // Buscar empresas com filtros
  const { data: companies, isLoading, refetch } = useQuery({
    queryKey: ['reallocation-companies', filters],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_companies_for_reallocation', {
        p_states: filters.states?.length ? filters.states : null,
        p_regions: filters.regions?.length ? filters.regions : null,
        p_owner_id: filters.ownerId || null,
        p_min_days_no_interaction: filters.minDaysNoInteraction || null,
        p_min_days_no_order: filters.minDaysNoOrder || null,
        p_search: filters.search || null,
        p_limit: 200,
        p_offset: 0
      });
      if (error) throw error;
      return data as CompanyForReallocation[];
    },
    enabled: Object.keys(filters).some(k => {
      const val = filters[k as keyof ReallocationFilters];
      if (Array.isArray(val)) return val.length > 0;
      return val !== undefined && val !== null && val !== '';
    })
  });

  // Mutation para transferir empresas
  const transferMutation = useMutation({
    mutationFn: async (request: ReallocationTransferRequest) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const transferRecords: any[] = [];
      let totalTransferred = 0;

      for (const companyId of request.companyIds) {
        // Buscar info da empresa
        const { data: company } = await supabase
          .from('companies')
          .select('id, name, owner_id')
          .eq('id', companyId)
          .single();

        if (!company) continue;

        const fromUserId = company.owner_id;

        // Atualizar owner_id da empresa
        const { error: updateError } = await supabase
          .from('companies')
          .update({ owner_id: request.toUserId })
          .eq('id', companyId);

        if (updateError) throw updateError;

        // Registrar transferência com reason e filter_context
        transferRecords.push({
          entity_type: 'company',
          entity_id: companyId,
          entity_name: company.name,
          from_user_id: fromUserId,
          to_user_id: request.toUserId,
          transferred_by: user.id,
          notes: request.reason,
          reason: request.reason,
          filter_context: request.filterContext
        });

        totalTransferred++;

        // Transferir contatos relacionados se solicitado
        if (request.transferContacts) {
          const { data: contacts } = await supabase
            .from('contacts')
            .select('id, first_name, last_name')
            .eq('company_id', companyId)
            .eq('owner_id', fromUserId);

          for (const contact of contacts || []) {
            await supabase
              .from('contacts')
              .update({ owner_id: request.toUserId })
              .eq('id', contact.id);

            const contactName = [contact.first_name, contact.last_name].filter(Boolean).join(' ');
            transferRecords.push({
              entity_type: 'contact',
              entity_id: contact.id,
              entity_name: contactName || 'Sem nome',
              from_user_id: fromUserId,
              to_user_id: request.toUserId,
              transferred_by: user.id,
              notes: request.reason,
              reason: request.reason,
              filter_context: request.filterContext
            });
          }
        }

        // Transferir negócios abertos se solicitado
        if (request.transferDeals) {
          const { data: deals } = await supabase
            .from('deals')
            .select('id, name')
            .eq('company_id', companyId)
            .eq('owner_id', fromUserId)
            .not('stage', 'in', '("fechado_ganho","fechado_perdido")');

          for (const deal of deals || []) {
            await supabase
              .from('deals')
              .update({ owner_id: request.toUserId })
              .eq('id', deal.id);

            transferRecords.push({
              entity_type: 'deal',
              entity_id: deal.id,
              entity_name: deal.name,
              from_user_id: fromUserId,
              to_user_id: request.toUserId,
              transferred_by: user.id,
              notes: request.reason,
              reason: request.reason,
              filter_context: request.filterContext
            });
          }
        }
      }

      // Inserir registros de histórico
      if (transferRecords.length > 0) {
        const { error } = await supabase
          .from('portfolio_transfers')
          .insert(transferRecords);

        if (error) throw error;
      }

      return totalTransferred;
    },
    onSuccess: (count) => {
      toast.success(`${count} cliente(s) remanejado(s) com sucesso!`);
      setSelectedCompanies(new Set());
      queryClient.invalidateQueries({ queryKey: ['reallocation-companies'] });
      queryClient.invalidateQueries({ queryKey: ['portfolios'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-transfers'] });
    },
    onError: (error: any) => {
      toast.error('Erro ao remanejar: ' + error.message);
    }
  });

  const toggleSelectCompany = (companyId: string) => {
    setSelectedCompanies(prev => {
      const next = new Set(prev);
      if (next.has(companyId)) {
        next.delete(companyId);
      } else {
        next.add(companyId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!companies) return;
    
    if (selectedCompanies.size === companies.length) {
      setSelectedCompanies(new Set());
    } else {
      setSelectedCompanies(new Set(companies.map(c => c.company_id)));
    }
  };

  const clearFilters = () => {
    setFilters({});
    setSelectedCompanies(new Set());
  };

  return {
    // Dados
    companies,
    availableStates,
    availableRegions,
    sellers,
    isLoading,
    
    // Filtros
    filters,
    setFilters,
    clearFilters,
    
    // Seleção
    selectedCompanies,
    toggleSelectCompany,
    toggleSelectAll,
    
    // Ações
    transferCompanies: transferMutation.mutate,
    isTransferring: transferMutation.isPending,
    refetch
  };
}
