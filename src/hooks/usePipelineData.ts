import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePipelines } from '@/hooks/usePipelines';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import { useSalesRepAccess } from '@/hooks/useSalesRepAccess';
import { usePortfolioGovernance } from '@/hooks/usePortfolioGovernance';
import { useLegalEntities } from '@/hooks/useLegalEntities';
import { getPendingChecklistItems, type ChecklistItem } from '@/hooks/useStageChecklists';
import { insertItemInList, updateItemInList, removeItemFromList } from '@/lib/queryCacheManager';
import { cleanDocument } from '@/lib/cpfCnpjMask';
import { toast } from 'sonner';
import { differenceInDays, parseISO } from 'date-fns';
import type { Tables, TablesInsert, Json } from '@/integrations/supabase/types';
import type { SearchableSelectOption } from '@/components/ui/searchable-select';

export type Deal = Tables<'deals'>;
export type DealStage = Tables<'deals'>['stage'];

export const defaultStageConfig: Record<DealStage, { label: string; color: string }> = {
  prospeccao: { label: 'Prospecção', color: 'bg-slate-500' },
  qualificacao: { label: 'Qualificação', color: 'bg-blue-500' },
  proposta: { label: 'Proposta', color: 'bg-yellow-500' },
  negociacao: { label: 'Negociação', color: 'bg-orange-500' },
  fechado_ganho: { label: 'Fechado (Ganho)', color: 'bg-green-500' },
  fechado_perdido: { label: 'Fechado (Perdido)', color: 'bg-red-500' },
};

const defaultStages: DealStage[] = ['prospeccao', 'qualificacao', 'proposta', 'negociacao', 'fechado_ganho', 'fechado_perdido'];

export interface PipelineStageRow {
  id: string;
  name: string;
  stage: DealStage;
  color: string | null;
  sort_order: number;
  pipeline_id: string;
}

export interface StageConfigEntry {
  label: string;
  color: string;
  hexColor?: string;
}

export function usePipelineData(selectedPipelineId: string | null) {
  const { user } = useAuth();
  const { isAdmin } = useModulePermissions();
  const { canAccessBySalesRep } = useSalesRepAccess();
  const queryClient = useQueryClient();
  const { pipelines, defaultPipeline } = usePipelines();
  const { requiresJustification, logIntervention } = usePortfolioGovernance();
  const { accessibleEntities: legalEntities, effectiveEntityId: effectiveLegalEntityId } = useLegalEntities();

  const currentPipelineId = selectedPipelineId || defaultPipeline?.id || null;

  // ── Pipeline Stages ──────────────────────────────────────────────
  const { data: pipelineStagesData } = useQuery({
    queryKey: ['pipeline_stages', currentPipelineId],
    queryFn: async () => {
      if (!currentPipelineId) return null;
      const { data, error } = await supabase
        .from('pipeline_stages')
        .select('*')
        .eq('pipeline_id', currentPipelineId)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data as PipelineStageRow[];
    },
    enabled: !!currentPipelineId,
  });

  const stages: DealStage[] = useMemo(() => {
    if (pipelineStagesData && pipelineStagesData.length > 0) {
      return pipelineStagesData.map(s => s.stage);
    }
    return defaultStages;
  }, [pipelineStagesData]);

  const stageConfig: Record<string, StageConfigEntry> = useMemo(() => {
    if (pipelineStagesData && pipelineStagesData.length > 0) {
      const config: Record<string, StageConfigEntry> = {};
      pipelineStagesData.forEach(s => {
        config[s.stage] = {
          label: s.name,
          color: defaultStageConfig[s.stage]?.color || 'bg-slate-500',
          hexColor: s.color || undefined,
        };
      });
      return config;
    }
    return defaultStageConfig;
  }, [pipelineStagesData]);

  // ── Sellers (admin filter) ────────────────────────────────────────
  const { data: sellers } = useQuery({
    queryKey: ['sellers-for-pipeline'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id, full_name')
        .order('full_name');
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  // ── Deals ─────────────────────────────────────────────────────────
  const { data: deals, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['deals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deals')
        .select('*, companies(name, sales_rep_id), contacts(first_name, last_name, email)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const handleRefresh = useCallback(async () => {
    await refetch();
    toast.success('Dados atualizados!');
  }, [refetch]);

  // ── Company search (form) ────────────────────────────────────────
  const [companySearch, setCompanySearch] = useState('');
  const { data: companiesSearchResult } = useQuery({
    queryKey: ['companies-search', companySearch],
    queryFn: async () => {
      let query = supabase.from('companies').select('id, name, cnpj').order('name').limit(50);
      if (companySearch) {
        query = query.or(`name.ilike.%${companySearch}%,cnpj.ilike.%${companySearch}%,fantasia.ilike.%${companySearch}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // ── Company search (filter bar) ──────────────────────────────────
  const [filterCompanySearch, setFilterCompanySearch] = useState('');
  const { data: filterCompaniesRaw } = useQuery({
    queryKey: ['companies-filter-search', filterCompanySearch],
    queryFn: async () => {
      let query = supabase.from('companies').select('id, name').order('name').limit(50);
      if (filterCompanySearch) {
        query = query.or(`name.ilike.%${filterCompanySearch}%,fantasia.ilike.%${filterCompanySearch}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // ── Selected company/contact queries ─────────────────────────────
  const getSelectedCompanyQuery = (companyId: string | null | undefined) => {
    return useQuery({
      queryKey: ['company-selected', companyId],
      queryFn: async () => {
        if (!companyId) return null;
        const { data, error } = await supabase.from('companies').select('id, name, cnpj').eq('id', companyId).maybeSingle();
        if (error) throw error;
        return data;
      },
      enabled: !!companyId,
    });
  };

  const [contactSearch, setContactSearch] = useState('');

  const getContactsSearch = (companyId: string | null | undefined) => {
    return useQuery({
      queryKey: ['contacts-search', contactSearch, companyId],
      queryFn: async () => {
        let query = supabase.from('contacts').select('id, first_name, last_name, email, phone, mobile, cpf, company_id').order('first_name').limit(50);
        if (companyId) {
          query = query.eq('company_id', companyId);
        }
        if (contactSearch) {
          query = query.or(`first_name.ilike.%${contactSearch}%,last_name.ilike.%${contactSearch}%,cpf.ilike.%${contactSearch}%`);
        }
        const { data, error } = await query;
        if (error) throw error;
        return data;
      },
    });
  };

  const getSelectedContactQuery = (contactId: string | null | undefined) => {
    return useQuery({
      queryKey: ['contact-selected', contactId],
      queryFn: async () => {
        if (!contactId) return null;
        const { data, error } = await supabase.from('contacts').select('id, first_name, last_name, email, phone, mobile, cpf, company_id').eq('id', contactId).maybeSingle();
        if (error) throw error;
        return data;
      },
      enabled: !!contactId,
    });
  };

  // ── Deal contacts (for kanban cards) ──────────────────────────────
  const allDealContactIds = useMemo(() => {
    return [...new Set(deals?.map(d => d.contact_id).filter(Boolean) || [])];
  }, [deals]);

  const { data: dealContacts } = useQuery({
    queryKey: ['deal-contacts', allDealContactIds],
    queryFn: async () => {
      if (allDealContactIds.length === 0) return [];
      const batchSize = 50;
      const results: any[] = [];
      for (let i = 0; i < allDealContactIds.length; i += batchSize) {
        const batch = allDealContactIds.slice(i, i + batchSize);
        const { data, error } = await supabase.from('contacts').select('id, first_name, last_name, email, phone, mobile, cpf, company_id').in('id', batch);
        if (error) throw error;
        if (data) results.push(...data);
      }
      return results;
    },
    enabled: allDealContactIds.length > 0,
  });

  // ── Filter companies (selected) ──────────────────────────────────
  const getFilterCompanySelected = (filterCompany: string) => {
    return useQuery({
      queryKey: ['company-filter-selected', filterCompany],
      queryFn: async () => {
        if (!filterCompany || filterCompany === 'all') return null;
        const { data, error } = await supabase.from('companies').select('id, name').eq('id', filterCompany).maybeSingle();
        if (error) throw error;
        return data;
      },
      enabled: !!filterCompany && filterCompany !== 'all',
    });
  };

  // ── Email templates ───────────────────────────────────────────────
  const { data: templates } = useQuery({
    queryKey: ['email_templates'],
    queryFn: async () => {
      const { data, error } = await supabase.from('email_templates').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });

  // ── Mutations ─────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async (data: TablesInsert<'deals'>) => {
      const { data: created, error } = await supabase.from('deals').insert(data).select('*, companies(name, sales_rep_id), contacts(first_name, last_name, email)').single();
      if (error) throw error;
      return created;
    },
    onSuccess: (created) => {
      insertItemInList(queryClient, ['deals'], created);
      toast.success('Negócio criado com sucesso!');
    },
    onError: (error: any) => {
      const message = error?.message || '';
      if (message.includes('Este cliente pertence ao vendedor')) {
        toast.error(message, { duration: 6000 });
      } else {
        toast.error('Erro ao criar negócio');
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Deal> & { id: string }) => {
      const currentDeal = deals?.find(d => d.id === id);
      const stageChanged = currentDeal && data.stage && currentDeal.stage !== data.stage;

      const updateData: any = { ...data };
      if (data.stage === 'fechado_ganho' || data.stage === 'fechado_perdido') {
        updateData.closed_at = new Date().toISOString();
      }
      const { error } = await supabase.from('deals').update(updateData).eq('id', id);
      if (error) throw error;

      if (stageChanged && currentDeal && data.stage) {
        const { data: lastHistory } = await supabase
          .from('deal_stage_history')
          .select('changed_at')
          .eq('deal_id', id)
          .order('changed_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const duration = lastHistory
          ? Math.floor((Date.now() - new Date(lastHistory.changed_at).getTime()) / 1000)
          : null;

        await supabase.from('deal_stage_history').insert({
          deal_id: id,
          from_stage: currentDeal.stage,
          to_stage: data.stage,
          changed_by: user?.id,
          duration_seconds: duration,
        });

        supabase.functions.invoke('execute-automation', {
          body: { deal_id: id, trigger_type: 'stage_exit', trigger_stage: currentDeal.stage }
        }).catch(console.error);

        supabase.functions.invoke('execute-automation', {
          body: { deal_id: id, trigger_type: 'stage_enter', trigger_stage: data.stage }
        }).catch(console.error);
      }
    },
    onSuccess: (_, variables) => {
      const { id, ...data } = variables as Partial<Deal> & { id: string };
      updateItemInList(queryClient, ['deals'], id, data, 'deal');
      queryClient.invalidateQueries({ queryKey: ['deal_stage_history'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Negócio atualizado!');
    },
    onError: (error: any) => {
      const message = error?.message || '';
      if (message.includes('Este cliente pertence ao vendedor')) {
        toast.error(message, { duration: 6000 });
      } else {
        toast.error('Erro ao atualizar negócio');
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (dealId: string) => {
      const { error } = await supabase.from('deals').delete().eq('id', dealId);
      if (error) throw error;
    },
    onSuccess: (_, dealId) => {
      removeItemFromList(queryClient, ['deals'], dealId, 'deal');
      toast.success('Negócio excluído com sucesso!');
    },
    onError: (error: any) => {
      toast.error(`Erro ao excluir negócio: ${error.message}`);
    },
  });

  const sendEmailMutation = useMutation({
    mutationFn: async (data: any) => {
      const { data: response, error } = await supabase.functions.invoke('send-email', { body: data });
      if (error) throw error;
      if (response.error) throw new Error(response.error);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email_logs'] });
      toast.success('Email enviado com sucesso!');
    },
    onError: (error: any) => {
      toast.error(`Erro ao enviar email: ${error.message}`);
    },
  });

  // ── Helpers ───────────────────────────────────────────────────────
  const canDeleteDeal = useCallback((deal: Deal) => {
    return isAdmin || deal.owner_id === user?.id;
  }, [isAdmin, user?.id]);

  const getContactInfo = useCallback((contactId: string | null, selectedContactData?: any) => {
    if (!contactId) return null;
    return dealContacts?.find(c => c.id === contactId) || (selectedContactData?.id === contactId ? selectedContactData : null);
  }, [dealContacts]);

  const getContactPhone = useCallback((contactId: string | null, selectedContactData?: any) => {
    const contact = getContactInfo(contactId, selectedContactData);
    return contact?.mobile || contact?.phone || null;
  }, [getContactInfo]);

  const getContactName = useCallback((contactId: string | null, selectedContactData?: any) => {
    const contact = getContactInfo(contactId, selectedContactData);
    return contact ? `${contact.first_name} ${contact.last_name || ''}`.trim() : '';
  }, [getContactInfo]);

  // ── Build filter companies list ───────────────────────────────────
  const buildFilterCompaniesList = useCallback((selectedFilterCompanyData: any) => {
    const map = new Map<string, { id: string; name: string }>();
    if (selectedFilterCompanyData) map.set(selectedFilterCompanyData.id, selectedFilterCompanyData);
    (filterCompaniesRaw || []).forEach((c: any) => map.set(c.id, c));
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [filterCompaniesRaw]);

  // ── Build searchable options ──────────────────────────────────────
  const buildCompanyOptions = useCallback((selectedCompanyData: any): SearchableSelectOption[] => {
    const map = new Map<string, SearchableSelectOption>();
    if (selectedCompanyData) {
      map.set(selectedCompanyData.id, {
        value: selectedCompanyData.id,
        label: selectedCompanyData.name,
        searchTerms: selectedCompanyData.cnpj ? cleanDocument(selectedCompanyData.cnpj) : undefined,
      });
    }
    companiesSearchResult?.forEach((c: any) => {
      if (!map.has(c.id)) {
        map.set(c.id, {
          value: c.id,
          label: c.name,
          searchTerms: c.cnpj ? cleanDocument(c.cnpj) : undefined,
        });
      }
    });
    return Array.from(map.values());
  }, [companiesSearchResult]);

  const buildContactOptions = useCallback((selectedContactData: any): SearchableSelectOption[] => {
    const map = new Map<string, SearchableSelectOption>();
    if (selectedContactData) {
      map.set(selectedContactData.id, {
        value: selectedContactData.id,
        label: `${selectedContactData.first_name} ${selectedContactData.last_name || ''}`.trim(),
        searchTerms: selectedContactData.cpf ? cleanDocument(selectedContactData.cpf) : undefined,
      });
    }
    return Array.from(map.values());
  }, []);

  // ── Filtered deals builder ────────────────────────────────────────
  const buildFilteredDeals = useCallback((
    filterOwner: string,
    filterStage: string,
    filterCompany: string,
    filterDateFrom: string,
    filterDateTo: string,
  ) => {
    return deals?.filter(deal => {
      const companySalesRepId = (deal as any).companies?.sales_rep_id as string | null | undefined;
      const isMyDeal = deal.owner_id === user?.id || deal.created_by === user?.id;
      if (!isMyDeal && !canAccessBySalesRep(companySalesRepId)) return false;

      const dealPipelineId = deal.pipeline_id || defaultPipeline?.id;
      if (currentPipelineId && dealPipelineId !== currentPipelineId) return false;

      if (filterOwner === 'mine' && deal.owner_id !== user?.id) return false;
      if (filterOwner !== 'mine' && filterOwner !== 'all' && deal.owner_id !== filterOwner) return false;
      if (filterStage !== 'all' && deal.stage !== filterStage) return false;
      if (filterCompany !== 'all' && deal.company_id !== filterCompany) return false;

      if (filterDateFrom) {
        const dealDate = new Date(deal.created_at);
        const fromDate = new Date(filterDateFrom);
        fromDate.setHours(0, 0, 0, 0);
        if (dealDate < fromDate) return false;
      }
      if (filterDateTo) {
        const dealDate = new Date(deal.created_at);
        const toDate = new Date(filterDateTo);
        toDate.setHours(23, 59, 59, 999);
        if (dealDate > toDate) return false;
      }

      return true;
    }) || [];
  }, [deals, user?.id, currentPipelineId, defaultPipeline?.id, canAccessBySalesRep]);

  // ── Drag & Drop handler ───────────────────────────────────────────
  const handleDrop = useCallback(async (
    dealId: string,
    targetStage: DealStage,
    callbacks: {
      setMissingDataAlert: (msg: string) => void;
      setPendingLossDeal: (d: { id: string; name: string } | null) => void;
      setLossReasonModalOpen: (v: boolean) => void;
      setSlaModalData: (d: any) => void;
      setSlaModalOpen: (v: boolean) => void;
      setChecklistModalData: (d: any) => void;
      setChecklistModalOpen: (v: boolean) => void;
    },
  ) => {
    const deal = deals?.find(d => d.id === dealId);
    if (!deal) return;
    if (deal.stage === targetStage) return;

    const firstStage = stages[0];
    if (deal.stage === firstStage) {
      if (!deal.company_id && !deal.contact_id) {
        callbacks.setMissingDataAlert('Para avançar da primeira etapa, é necessário preencher a Empresa e o Contato do negócio.');
        return;
      }
      if (!deal.company_id) {
        callbacks.setMissingDataAlert('Para avançar da primeira etapa, é necessário preencher a Empresa do negócio.');
        return;
      }
      if (!deal.contact_id) {
        callbacks.setMissingDataAlert('Para avançar da primeira etapa, é necessário preencher o Contato do negócio.');
        return;
      }
    }

    if (targetStage === 'fechado_perdido') {
      callbacks.setPendingLossDeal({ id: dealId, name: deal.name });
      callbacks.setLossReasonModalOpen(true);
      return;
    }

    const SLA_CRITICAL_DAYS = 7;
    const daysInStage = differenceInDays(new Date(), parseISO(deal.updated_at));

    if (!isAdmin && daysInStage >= SLA_CRITICAL_DAYS) {
      callbacks.setSlaModalData({
        deal: {
          id: deal.id,
          name: deal.name,
          updated_at: deal.updated_at,
          stagnation_reason: (deal as any).stagnation_reason,
        },
        targetStage,
        daysInStage,
      });
      callbacks.setSlaModalOpen(true);
      return;
    }

    const effectivePipelineId = deal.pipeline_id || defaultPipeline?.id || null;

    try {
      const pendingItems = await getPendingChecklistItems(dealId, deal.stage, effectivePipelineId);

      if (pendingItems.length > 0) {
        callbacks.setChecklistModalData({
          deal: { id: deal.id, name: deal.name, stage: deal.stage, pipeline_id: effectivePipelineId },
          targetStage,
          pendingItems,
        });
        callbacks.setChecklistModalOpen(true);
        return;
      }

      updateMutation.mutate({ id: dealId, stage: targetStage });
    } catch (error) {
      console.error('Error checking checklist items:', error);
      updateMutation.mutate({ id: dealId, stage: targetStage });
    }
  }, [deals, stages, isAdmin, defaultPipeline?.id, updateMutation]);

  return {
    // Auth & permissions
    user,
    isAdmin,

    // Pipeline
    pipelines,
    defaultPipeline,
    currentPipelineId,
    stages,
    stageConfig,

    // Deals
    deals,
    isLoading,
    isFetching,
    handleRefresh,

    // Sellers
    sellers,

    // Search state
    companySearch,
    setCompanySearch,
    filterCompanySearch,
    setFilterCompanySearch,
    contactSearch,
    setContactSearch,
    companiesSearchResult,

    // Queries (need to be called in component due to hooks rules)
    getSelectedCompanyQuery,
    getContactsSearch,
    getSelectedContactQuery,
    getFilterCompanySelected,

    // Templates
    templates,

    // Mutations
    createMutation,
    updateMutation,
    deleteMutation,
    sendEmailMutation,

    // Helpers
    canDeleteDeal,
    getContactInfo,
    getContactPhone,
    getContactName,
    buildFilterCompaniesList,
    buildCompanyOptions,
    buildContactOptions,
    buildFilteredDeals,
    handleDrop,

    // Governance
    requiresJustification,
    logIntervention,

    // Legal entities
    legalEntities,
    effectiveLegalEntityId,
  };
}
