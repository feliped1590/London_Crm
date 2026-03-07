import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';

export const ITEMS_PER_PAGE = 25;

export interface ReallocationFilters {
  states?: string[];
  regions?: string[];
  ownerId?: string; // agora referencia sales_rep_id na UI, mas resolve para user_id no filtro
  salesRepId?: string; // novo: referência direta ao sales_rep
  noOwner?: boolean;
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
  sales_rep_name?: string;
  regiao: string | null;
  subregiao: string | null;
  last_interaction_at: string | null;
  days_since_interaction: number;
  last_order_at: string | null;
  days_since_order: number;
  total_orders: number;
  total_order_value: number;
  source: 'crm' | 'erp';
}

export interface ReallocationSeller {
  id: string;
  name: string;
  type: string | null;
  linkedUserId: string | null;
}

export interface ReallocationTransferRequest {
  companyIds: string[];
  toSalesRepId: string;
  toUserId: string | null; // resolved from user_sales_reps
  transferContacts: boolean;
  transferDeals: boolean;
  reason: string;
  filterContext: ReallocationFilters;
  companySources: Record<string, 'crm' | 'erp'>;
}

export function usePortfolioReallocation() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<ReallocationFilters>({});
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  // Buscar UFs disponíveis
  const { data: availableStates } = useQuery({
    queryKey: ['reallocation-states'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_distinct_states_for_reallocation');
      if (error) throw error;
      return (data as { state: string }[]).map(d => d.state);
    }
  });

  const availableRegions = ['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul'];

  // Buscar vendedores comerciais (sales_reps) + mapeamento para user_id
  const { data: sellers } = useQuery({
    queryKey: ['reallocation-sellers'],
    queryFn: async () => {
      const { data: reps, error: repsError } = await supabase
        .from('sales_reps')
        .select('id, name, type, active')
        .eq('active', true)
        .order('name');
      if (repsError) throw repsError;

      const { data: links } = await supabase
        .from('user_sales_reps')
        .select('user_id, sales_rep_id, is_default');

      // Map: sales_rep_id → user_id (prefer default)
      const repToUser: Record<string, string> = {};
      links?.forEach(l => {
        if (!repToUser[l.sales_rep_id]) repToUser[l.sales_rep_id] = l.user_id;
      });
      links?.forEach(l => {
        if (l.is_default) repToUser[l.sales_rep_id] = l.user_id;
      });

      return reps?.map(r => ({
        id: r.id,
        name: r.name,
        type: r.type,
        linkedUserId: repToUser[r.id] || null,
      })) as ReallocationSeller[] || [];
    }
  });

  // Usar sales_rep_id diretamente para filtro
  const resolvedSalesRepId = filters.salesRepId || null;

  // Contagem total
  const { data: totalItems = 0 } = useQuery({
    queryKey: ['reallocation-companies-count', filters, resolvedOwnerId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_companies_for_reallocation_count', {
        p_states: filters.states?.length ? filters.states : null,
        p_regions: filters.regions?.length ? filters.regions : null,
        p_owner_id: filters.noOwner ? null : (resolvedOwnerId || null),
        p_min_days_no_interaction: filters.minDaysNoInteraction || null,
        p_min_days_no_order: filters.minDaysNoOrder || null,
        p_search: filters.search || null,
        p_no_owner: filters.noOwner || null
      });
      if (error) throw error;
      return data as number;
    }
  });

  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

  // Buscar empresas com filtros e paginação
  const { data: companies, isLoading, refetch } = useQuery({
    queryKey: ['reallocation-companies', filters, currentPage, resolvedOwnerId],
    queryFn: async () => {
      const offset = (currentPage - 1) * ITEMS_PER_PAGE;
      const { data, error } = await supabase.rpc('get_companies_for_reallocation', {
        p_states: filters.states?.length ? filters.states : null,
        p_regions: filters.regions?.length ? filters.regions : null,
        p_owner_id: filters.noOwner ? null : (resolvedOwnerId || null),
        p_min_days_no_interaction: filters.minDaysNoInteraction || null,
        p_min_days_no_order: filters.minDaysNoOrder || null,
        p_search: filters.search || null,
        p_limit: ITEMS_PER_PAGE,
        p_offset: offset,
        p_no_owner: filters.noOwner || null
      });
      if (error) throw error;

      // Enriquecer com nome do vendedor comercial
      const companiesData = data as CompanyForReallocation[];
      
      if (sellers?.length && companiesData?.length) {
        // Buscar sales_rep_id das empresas retornadas
        const companyIds = companiesData.map(c => c.company_id);
        const { data: companyReps } = await supabase
          .from('companies')
          .select('id, sales_rep_id')
          .in('id', companyIds);

        const { data: allReps } = await supabase
          .from('sales_reps')
          .select('id, name');

        const repNameMap: Record<string, string> = {};
        allReps?.forEach(r => { repNameMap[r.id] = r.name; });

        companiesData.forEach(company => {
          const companyRep = companyReps?.find(cr => cr.id === company.company_id);
          if (companyRep?.sales_rep_id && repNameMap[companyRep.sales_rep_id]) {
            company.sales_rep_name = repNameMap[companyRep.sales_rep_id];
          }
        });
      }

      return companiesData;
    }
  });

  // Mutation para transferir empresas
  const transferMutation = useMutation({
    mutationFn: async (request: ReallocationTransferRequest) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const transferRecords: any[] = [];
      let totalTransferred = 0;

      for (const companyId of request.companyIds) {
        const source = request.companySources[companyId] || 'crm';
        
        if (source === 'crm') {
          const { data: company } = await supabase
            .from('companies')
            .select('id, name, owner_id, sales_rep_id')
            .eq('id', companyId)
            .single();

          if (!company) continue;

          const fromUserId = company.owner_id;

          // Atualizar sales_rep_id e owner_id
          const updateData: Record<string, any> = {
            sales_rep_id: request.toSalesRepId,
          };
          if (request.toUserId) {
            updateData.owner_id = request.toUserId;
          }

          const { error: updateError } = await supabase
            .from('companies')
            .update(updateData)
            .eq('id', companyId);

          if (updateError) throw updateError;

          transferRecords.push({
            entity_type: 'company',
            entity_id: companyId,
            entity_name: company.name,
            from_user_id: fromUserId,
            to_user_id: request.toUserId || request.toSalesRepId,
            transferred_by: user.id,
            notes: request.reason,
            reason: request.reason,
            filter_context: { ...request.filterContext, source: 'crm' }
          });

          totalTransferred++;

          // Transferir contatos relacionados
          if (request.transferContacts && request.toUserId) {
            const { data: contacts } = await supabase
              .from('contacts')
              .select('id, first_name, last_name')
              .eq('company_id', companyId);

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
                filter_context: { ...request.filterContext, source: 'crm' }
              });
            }
          }

          // Transferir negócios abertos
          if (request.transferDeals && request.toUserId) {
            const { data: deals } = await supabase
              .from('deals')
              .select('id, name')
              .eq('company_id', companyId)
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
                filter_context: { ...request.filterContext, source: 'crm' }
              });
            }
          }
        } else {
          // source === 'erp'
          const { data: client } = await supabase
            .from('crm_clients')
            .select('id, razao_social, nome_fantasia, owner_id')
            .eq('id', companyId)
            .single();

          if (!client) continue;

          const fromUserId = client.owner_id;
          const clientName = client.razao_social || client.nome_fantasia || 'Cliente ERP';

          const updateData: Record<string, any> = {};
          if (request.toUserId) updateData.owner_id = request.toUserId;

          const { error: updateError } = await supabase
            .from('crm_clients')
            .update(updateData)
            .eq('id', companyId);

          if (updateError) throw updateError;

          transferRecords.push({
            entity_type: 'company',
            entity_id: companyId,
            entity_name: clientName,
            from_user_id: fromUserId,
            to_user_id: request.toUserId || request.toSalesRepId,
            transferred_by: user.id,
            notes: request.reason,
            reason: request.reason,
            filter_context: { ...request.filterContext, source: 'erp' }
          });

          totalTransferred++;
        }
      }

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
      queryClient.invalidateQueries({ queryKey: ['reallocation-companies-count'] });
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

  const toggleSelectAllOnPage = () => {
    if (!companies) return;
    
    const pageIds = companies.map(c => c.company_id);
    const allPageSelected = pageIds.every(id => selectedCompanies.has(id));

    setSelectedCompanies(prev => {
      const next = new Set(prev);
      if (allPageSelected) {
        pageIds.forEach(id => next.delete(id));
      } else {
        pageIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const clearFilters = () => {
    setFilters({});
    setSelectedCompanies(new Set());
    setCurrentPage(1);
  };

  return {
    companies,
    availableStates,
    availableRegions,
    sellers,
    isLoading,
    
    currentPage,
    setCurrentPage,
    totalItems,
    totalPages,
    itemsPerPage: ITEMS_PER_PAGE,
    
    filters,
    setFilters,
    clearFilters,
    
    selectedCompanies,
    toggleSelectCompany,
    toggleSelectAllOnPage,
    
    transferCompanies: transferMutation.mutate,
    isTransferring: transferMutation.isPending,
    refetch
  };
}
