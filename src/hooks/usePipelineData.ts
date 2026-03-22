import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePipelines } from '@/hooks/usePipelines';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import { useSalesRepAccess } from '@/hooks/useSalesRepAccess';
import { usePortfolioGovernance } from '@/hooks/usePortfolioGovernance';
import { useLegalEntities } from '@/hooks/useLegalEntities';
import { getPendingChecklistItems } from '@/hooks/useStageChecklists';
import { updateItemInList, removeItemFromList } from '@/lib/queryCacheManager';
import { toast } from 'sonner';
import { differenceInDays, parseISO } from 'date-fns';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';
import { logOwnershipWarning } from '@/lib/ownership';

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

export type PipelineOwnershipViewMode = 'historical' | 'commercial';

export function usePipelineData(selectedPipelineId: string | null) {
  const { user } = useAuth();
  const { isAdmin } = useModulePermissions();
  const { canAccessBySalesRep, hasDirectAccess, mySalesRepIds } = useSalesRepAccess();
  const queryClient = useQueryClient();
  const { pipelines, defaultPipeline } = usePipelines();
  const { requiresJustification, logIntervention } = usePortfolioGovernance();
  const { accessibleEntities: legalEntities, effectiveEntityId: effectiveLegalEntityId } = useLegalEntities();

  const currentPipelineId = selectedPipelineId || defaultPipeline?.id || null;

  // ── Pipeline Stages ───────────────────────────────────────────────
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
      const [profilesResult, linksResult] = await Promise.all([
        (supabase as any)
          .from('profiles')
          .select('id, user_id, full_name')
          .order('full_name'),
        (supabase as any)
          .from('user_sales_reps')
          .select('user_id, sales_rep_id'),
      ]);

      if (profilesResult.error) throw profilesResult.error;
      if (linksResult.error) throw linksResult.error;

      const salesRepIdsByUser = new Map<string, string[]>();

      for (const link of (linksResult.data ?? []) as Array<{ user_id: string; sales_rep_id: string }>) {
        if (!link.user_id || !link.sales_rep_id) continue;
        const current = salesRepIdsByUser.get(link.user_id) ?? [];
        current.push(link.sales_rep_id);
        salesRepIdsByUser.set(link.user_id, current);
      }

      return ((profilesResult.data ?? []) as Array<{ id: string; user_id: string; full_name: string | null }>).map(profile => ({
        id: profile.id,
        user_id: profile.user_id,
        full_name: profile.full_name ?? 'Usuário',
        sales_rep_ids: salesRepIdsByUser.get(profile.user_id) ?? [],
      }));
    },
    enabled: isAdmin,
  });

  const salesRepIdsByUserFilter = useMemo(() => {
    const map = new Map<string, Set<string>>();

    for (const seller of sellers ?? []) {
      map.set(seller.user_id, new Set(seller.sales_rep_ids));
    }

    return map;
  }, [sellers]);

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

  const { data: dealParticipants } = useQuery({
    queryKey: ['deal-participants-for-pipeline'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deal_participants')
        .select('deal_id, user_id');
      if (error) throw error;
      return data ?? [];
    },
  });

  const participantUserIdsByDeal = useMemo(() => {
    const map = new Map<string, Set<string>>();

    for (const participant of dealParticipants ?? []) {
      if (!participant.deal_id || !participant.user_id) continue;
      const current = map.get(participant.deal_id) ?? new Set<string>();
      current.add(participant.user_id);
      map.set(participant.deal_id, current);
    }

    return map;
  }, [dealParticipants]);

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

  // ── Filter company search ────────────────────────────────────────
  const [filterCompanySearch, setFilterCompanySearch] = useState('');

  // ── Contact search ────────────────────────────────────────────────
  const [contactSearch, setContactSearch] = useState('');

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
    onSuccess: () => {
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
    const companySalesRepId = (deal as any).companies?.sales_rep_id as string | null | undefined;

    if (isAdmin) return true;
    if (companySalesRepId) {
      const hasAccess = canAccessBySalesRep(companySalesRepId);
      if (!hasAccess && deal.owner_id === user?.id) {
        logOwnershipWarning('Acesso negado por vínculo inconsistente entre usuário e sales_rep', {
          dealId: deal.id,
          companySalesRepId,
          userId: user?.id,
          operationContext: 'usePipelineData:canDeleteDeal',
        });
      }
      return hasAccess;
    }

    // LEGACY: owner_id será removido futuramente. Não usar como fonte de ownership.
    return deal.owner_id === user?.id;
  }, [canAccessBySalesRep, isAdmin, user?.id]);

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

  // ── Filtered deals builder ────────────────────────────────────────
  const buildFilteredDeals = useCallback((
    filterOwner: string,
    ownershipViewMode: PipelineOwnershipViewMode,
    filterStage: string,
    filterCompany: string,
    filterDateFrom: string,
    filterDateTo: string,
  ) => {
    return deals?.filter(deal => {
      const companySalesRepId = (deal as any).companies?.sales_rep_id as string | null | undefined;
      const participantUserIds = participantUserIdsByDeal.get(deal.id);
      const isCurrentUserParticipant = user?.id ? participantUserIds?.has(user.id) ?? false : false;
      const hasHistoricalAccess = deal.owner_id === user?.id || deal.created_by === user?.id || isCurrentUserParticipant;
      const hasPortfolioAccess = companySalesRepId
        ? canAccessBySalesRep(companySalesRepId)
        : hasHistoricalAccess;
      const isCommercialView = ownershipViewMode === 'commercial';
      const hasAccessForCurrentView = isCommercialView ? hasPortfolioAccess : hasHistoricalAccess;

      if (isCommercialView && companySalesRepId && !hasPortfolioAccess && deal.owner_id === user?.id) {
        logOwnershipWarning('Acesso negado por vínculo inconsistente entre usuário e sales_rep', {
          dealId: deal.id,
          companySalesRepId,
          userId: user?.id,
          operationContext: 'usePipelineData:buildFilteredDeals',
        });
      }

      if (!isAdmin && !hasAccessForCurrentView) return false;

      const dealPipelineId = deal.pipeline_id || defaultPipeline?.id;
      if (currentPipelineId && dealPipelineId !== currentPipelineId) return false;

      if (filterOwner === 'mine') {
        const matchesMine = isCommercialView
          ? (companySalesRepId ? hasDirectAccess(companySalesRepId) : false)
          : hasHistoricalAccess;
        if (!matchesMine) return false;
      }
      if (filterOwner !== 'mine' && filterOwner !== 'all') {
        const selectedUserSalesRepIds = salesRepIdsByUserFilter.get(filterOwner);
        const isSelectedUserParticipant = participantUserIds?.has(filterOwner) ?? false;
        const matchesSelectedOwner = isCommercialView
          ? (companySalesRepId ? selectedUserSalesRepIds?.has(companySalesRepId) ?? false : false)
          : deal.created_by === filterOwner || deal.owner_id === filterOwner || isSelectedUserParticipant;
        if (!matchesSelectedOwner) return false;
      }
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
  }, [deals, user?.id, isAdmin, currentPipelineId, defaultPipeline?.id, canAccessBySalesRep, hasDirectAccess, salesRepIdsByUserFilter, participantUserIdsByDeal]);

  // ── Drag & Drop core handler ──────────────────────────────────────
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
          id: deal.id, name: deal.name, updated_at: deal.updated_at,
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
    user, isAdmin,
    pipelines, defaultPipeline, currentPipelineId,
    stages, stageConfig,
    deals, isLoading, isFetching, handleRefresh,
    sellers,
    mySalesRepIds,
    companySearch, setCompanySearch,
    filterCompanySearch, setFilterCompanySearch,
    contactSearch, setContactSearch,
    companiesSearchResult,
    templates,
    createMutation, updateMutation, deleteMutation, sendEmailMutation,
    canDeleteDeal,
    getContactInfo, getContactPhone, getContactName,
    buildFilteredDeals,
    handleDrop,
    requiresJustification, logIntervention,
    legalEntities, effectiveLegalEntityId,
  };
}
