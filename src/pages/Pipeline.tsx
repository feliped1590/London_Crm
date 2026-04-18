import { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Mail, Send, LayoutGrid, List, RefreshCw, AlertTriangle } from 'lucide-react';
import { PipelineFilters } from '@/components/pipeline/PipelineFilters';
import { PipelineSelector } from '@/components/pipeline/PipelineSelector';
import { PipelineListView } from '@/components/pipeline/PipelineListView';
import { LossReasonModal } from '@/components/pipeline/LossReasonModal';
import { KanbanBoard } from '@/components/pipeline/KanbanBoard';
import { DealFormDialog } from '@/components/pipeline/DealFormDialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from 'sonner';
import { formatCNPJ } from '@/lib/cpfCnpjMask';
import { cleanDocument } from '@/lib/cpfCnpjMask';
import { ChecklistValidationModal } from '@/components/pipeline/ChecklistValidationModal';
import { SLAJustificationModal } from '@/components/pipeline/SLAJustificationModal';
import { QuickCreateCompanyModal } from '@/components/pipeline/QuickCreateCompanyModal';
import { QuickCreateContactModal } from '@/components/pipeline/QuickCreateContactModal';
import { AdminInterventionModal } from '@/components/governance/AdminInterventionModal';
import { PortfolioProtectionModal } from '@/components/customers/PortfolioProtectionModal';
import { usePortfolioProtection } from '@/hooks/usePortfolioProtection';
import { usePipelineData, type Deal, type DealStage, type PipelineOwnershipViewMode, type PipelineStageRow } from '@/hooks/usePipelineData';
import type { ChecklistItem } from '@/hooks/useStageChecklists';
import type { TablesInsert, Json } from '@/integrations/supabase/types';
import { format } from 'date-fns';
import type { SearchableSelectOption } from '@/components/ui/searchable-select';

export default function Pipeline() {
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();

  // Pipeline selection
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);

  // Data hook
  const pipeline = usePipelineData(selectedPipelineId);
  const {
    user, isAdmin, isSalesPipeline,
    currentPipelineId, stages, stageRows, stageConfig, defaultPipeline,
    deals, isLoading, isFetching, handleRefresh,
    sellers,
    companiesSearchResult,
    setCompanySearch, setFilterCompanySearch, setContactSearch,
    templates,
    createMutation, updateMutation, deleteMutation, sendEmailMutation,
    canDeleteDeal,
    getContactInfo, getContactPhone, getContactName,
    buildFilteredDeals,
    resolveDealStageId,
    handleDrop: handleDropCore,
    requiresJustification, logIntervention,
    legalEntities, effectiveLegalEntityId,
  } = pipeline;

  // ── UI State ──────────────────────────────────────────────────────
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [formData, setFormData] = useState<Partial<TablesInsert<'deals'>>>({
    name: '', value: 0, stage: 'prospeccao', probability: 10,
    expected_close_date: '', company_id: null, contact_id: null, notes: '',
  });
  const [customFieldsData, setCustomFieldsData] = useState<Record<string, unknown>>({});

  // View & filters
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [ownershipViewMode, setOwnershipViewMode] = useState<PipelineOwnershipViewMode>('historical');
  const [filterOwner, setFilterOwner] = useState('mine');
  const [filterStage, setFilterStage] = useState('all');
  const [filterCompany, setFilterCompany] = useState('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // Email dialog
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [emailTargetDeal, setEmailTargetDeal] = useState<Deal | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [emailData, setEmailData] = useState({ subject: '', body: '' });

  // Modals
  const [lossReasonModalOpen, setLossReasonModalOpen] = useState(false);
  const [pendingLossDeal, setPendingLossDeal] = useState<{ id: string; name: string } | null>(null);
  const [checklistModalOpen, setChecklistModalOpen] = useState(false);
  const [checklistModalData, setChecklistModalData] = useState<{
    deal: { id: string; name: string; stage: DealStage; pipeline_id?: string | null };
    targetStage: DealStage;
    pendingItems: ChecklistItem[];
  } | null>(null);
  const [slaModalOpen, setSlaModalOpen] = useState(false);
  const [slaModalData, setSlaModalData] = useState<{
    deal: { id: string; name: string; updated_at: string; stagnation_reason?: string | null };
    targetStage: DealStage;
    daysInStage: number;
  } | null>(null);
  const [quickCreateCompanyOpen, setQuickCreateCompanyOpen] = useState(false);
  const [quickCreateContactOpen, setQuickCreateContactOpen] = useState(false);
  const [missingDataAlert, setMissingDataAlert] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [dealToDelete, setDealToDelete] = useState<Deal | null>(null);
  const [interventionModalOpen, setInterventionModalOpen] = useState(false);
  const [interventionData, setInterventionData] = useState<{
    clientName: string; clientOwnerName: string; actionDescription: string;
    pendingAction: { type: 'CREATE_DEAL' | 'UPDATE_DEAL' | 'MOVE_STAGE'; data: Record<string, unknown> };
    clientId: string; clientOwnerId: string;
  } | null>(null);

  // Portfolio protection for deals
  const {
    protectionInfo,
    showProtectionModal,
    setShowProtectionModal,
    checkAccess: checkPortfolioAccess,
  } = usePortfolioProtection(formData.company_id || undefined);

  // ── Queries that depend on form state (must be at component level) ──
  const { data: selectedCompanyData } = useQuery({
    queryKey: ['company-selected', formData.company_id],
    queryFn: async () => {
      if (!formData.company_id) return null;
      const { data, error } = await supabase.from('companies').select('id, name, cnpj').eq('id', formData.company_id).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!formData.company_id,
  });

  const [contactSearch] = useState('');
  const { data: contactsSearchResult } = useQuery({
    queryKey: ['contacts-search', contactSearch, formData.company_id],
    queryFn: async () => {
      let query = supabase.from('contacts').select('id, first_name, last_name, email, phone, mobile, cpf, company_id').order('first_name').limit(50);
      if (formData.company_id) query = query.eq('company_id', formData.company_id);
      if (contactSearch) query = query.or(`first_name.ilike.%${contactSearch}%,last_name.ilike.%${contactSearch}%,cpf.ilike.%${contactSearch}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: selectedContactData } = useQuery({
    queryKey: ['contact-selected', formData.contact_id],
    queryFn: async () => {
      if (!formData.contact_id) return null;
      const { data, error } = await supabase.from('contacts').select('id, first_name, last_name, email, phone, mobile, cpf, company_id').eq('id', formData.contact_id).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!formData.contact_id,
  });

  const { data: selectedFilterCompanyData } = useQuery({
    queryKey: ['company-filter-selected', filterCompany],
    queryFn: async () => {
      if (!filterCompany || filterCompany === 'all') return null;
      const { data, error } = await supabase.from('companies').select('id, name').eq('id', filterCompany).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!filterCompany && filterCompany !== 'all',
  });

  const { data: filterCompaniesRaw } = useQuery({
    queryKey: ['companies-filter-search', pipeline.filterCompanySearch],
    queryFn: async () => {
      let query = supabase.from('companies').select('id, name').order('name').limit(50);
      if (pipeline.filterCompanySearch) {
        query = query.or(`name.ilike.%${pipeline.filterCompanySearch}%,fantasia.ilike.%${pipeline.filterCompanySearch}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // ── Derived data ──────────────────────────────────────────────────
  const filterCompaniesResult = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    if (selectedFilterCompanyData) map.set(selectedFilterCompanyData.id, selectedFilterCompanyData);
    (filterCompaniesRaw || []).forEach(c => map.set(c.id, c));
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [filterCompaniesRaw, selectedFilterCompanyData]);

  const companyOptions: SearchableSelectOption[] = useMemo(() => {
    const map = new Map<string, SearchableSelectOption>();
    if (selectedCompanyData) {
      map.set(selectedCompanyData.id, {
        value: selectedCompanyData.id,
        label: selectedCompanyData.name,
        searchTerms: selectedCompanyData.cnpj ? cleanDocument(selectedCompanyData.cnpj) : undefined,
      });
    }
    companiesSearchResult?.forEach((c: { id: string; name: string; cnpj?: string | null }) => {
      if (!map.has(c.id)) {
        map.set(c.id, { value: c.id, label: c.name, searchTerms: c.cnpj ? cleanDocument(c.cnpj) : undefined });
      }
    });
    return Array.from(map.values());
  }, [companiesSearchResult, selectedCompanyData]);

  const contactOptions: SearchableSelectOption[] = useMemo(() => {
    const map = new Map<string, SearchableSelectOption>();
    if (selectedContactData) {
      map.set(selectedContactData.id, {
        value: selectedContactData.id,
        label: `${selectedContactData.first_name} ${selectedContactData.last_name || ''}`.trim(),
        searchTerms: selectedContactData.cpf ? cleanDocument(selectedContactData.cpf) : undefined,
      });
    }
    contactsSearchResult?.forEach((c: { id: string; first_name: string; last_name?: string | null; cpf?: string | null }) => {
      if (!map.has(c.id)) {
        map.set(c.id, {
          value: c.id,
          label: `${c.first_name} ${c.last_name || ''}`.trim(),
          searchTerms: c.cpf ? cleanDocument(c.cpf) : undefined,
        });
      }
    });
    return Array.from(map.values());
  }, [contactsSearchResult, selectedContactData]);

  const filteredDeals = useMemo(
    () => buildFilteredDeals(filterOwner, ownershipViewMode, filterStage, filterCompany, filterDateFrom, filterDateTo),
    [buildFilteredDeals, filterOwner, ownershipViewMode, filterStage, filterCompany, filterDateFrom, filterDateTo],
  );

  const hasActiveFilters = ownershipViewMode !== 'historical' || filterOwner !== 'mine' || filterStage !== 'all' || filterCompany !== 'all' || filterDateFrom !== '' || filterDateTo !== '';
  const paginationResetKey = `${ownershipViewMode}-${filterOwner}-${filterStage}-${filterCompany}-${filterDateFrom}-${filterDateTo}-${currentPipelineId}`;

  // ── Auto-open deal from URL params ────────────────────────────────
  useEffect(() => {
    const newDealCompanyId = searchParams.get('newDeal');
    if (newDealCompanyId && !isDialogOpen) {
      setEditingDeal(null);
      const firstStageRow = stageRows[0];
      setFormData({
        name: '', value: 0,
        stage: (firstStageRow?.stage ?? firstStageRow?.id ?? stages[0] ?? 'prospeccao') as DealStage,
        pipeline_stage_id: firstStageRow?.id ?? null,
        probability: 10,
        expected_close_date: '', company_id: newDealCompanyId, contact_id: null, notes: '',
        pipeline_id: currentPipelineId, legal_entity_id: effectiveLegalEntityId,
      } as Partial<TablesInsert<'deals'>>);
      setCustomFieldsData({});
      setIsDialogOpen(true);
      searchParams.delete('newDeal');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, currentPipelineId, stages, stageRows]);

  const [pendingDealId, setPendingDealId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('deal');
  });

  useEffect(() => {
    if (pendingDealId && deals && deals.length > 0) {
      const deal = deals.find(d => d.id === pendingDealId);
      if (deal) {
        handleEdit(deal as Deal);
      }
      setPendingDealId(null);
      const newParams = new URLSearchParams(window.location.search);
      newParams.delete('deal');
      window.history.replaceState({}, '', `${window.location.pathname}${newParams.toString() ? '?' + newParams.toString() : ''}`);
    }
  }, [pendingDealId, deals]);

  // ── Handlers ──────────────────────────────────────────────────────
  const resetForm = useCallback(() => {
    const firstStageRow = stageRows[0];
    setFormData({
      name: '', value: 0,
      stage: (firstStageRow?.stage ?? firstStageRow?.id ?? stages[0] ?? 'prospeccao') as DealStage,
      pipeline_stage_id: firstStageRow?.id ?? null,
      probability: 10,
      expected_close_date: '', company_id: null, contact_id: null, notes: '',
      legal_entity_id: effectiveLegalEntityId,
    } as Partial<TablesInsert<'deals'>>);
    setCustomFieldsData({});
    setEditingDeal(null);
    setIsDialogOpen(false);
  }, [stages, stageRows, effectiveLegalEntityId]);

  const handleEdit = useCallback((deal: Deal) => {
    setEditingDeal(deal);
    // Resolve pipeline_stage_id from current data (may be null on legacy/orphaned deals)
    const resolvedStageRow = (deal as any).pipeline_stage_id
      ? stageRows.find(s => s.id === (deal as any).pipeline_stage_id)
      : stageRows.find(s => s.stage === deal.stage) || stageRows.find(s => s.id === deal.stage);
    setFormData({
      name: deal.name, value: deal.value || 0, stage: deal.stage,
      pipeline_stage_id: resolvedStageRow?.id ?? (deal as any).pipeline_stage_id ?? null,
      probability: deal.probability || 10, expected_close_date: deal.expected_close_date || '',
      company_id: deal.company_id, contact_id: deal.contact_id, notes: deal.notes || '',
      legal_entity_id: deal.legal_entity_id || effectiveLegalEntityId,
    } as Partial<TablesInsert<'deals'>>);
    setCustomFieldsData(
      typeof deal.custom_fields === 'object' && deal.custom_fields !== null
        ? (deal.custom_fields as Record<string, unknown>) : {}
    );
    setIsDialogOpen(true);
  }, [effectiveLegalEntityId, stageRows]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Check portfolio protection before submitting
    if (!checkPortfolioAccess()) return;
    const cleanedFormData = { ...formData, expected_close_date: formData.expected_close_date || null };

    if (formData.company_id) {
      const ownership = await requiresJustification(formData.company_id);
      if (ownership) {
        setInterventionData({
          clientName: ownership.clientName || 'Cliente',
          clientOwnerName: ownership.ownerName || 'Outro vendedor',
          actionDescription: editingDeal ? 'Você está prestes a editar um negócio' : 'Você está prestes a criar um negócio',
          pendingAction: { type: editingDeal ? 'UPDATE_DEAL' : 'CREATE_DEAL', data: cleanedFormData },
          clientId: formData.company_id,
          clientOwnerId: ownership.ownerId || '',
        });
        setInterventionModalOpen(true);
        return;
      }
    }

    executeSubmit(cleanedFormData);
  };

  const executeSubmit = (cleanedFormData: Record<string, unknown>) => {
    if (editingDeal) {
      updateMutation.mutate({ id: editingDeal.id, ...cleanedFormData, custom_fields: customFieldsData as Json });
    } else {
      createMutation.mutate({
        ...cleanedFormData, name: formData.name || '',
        created_by: user?.id, owner_id: user?.id,
        pipeline_id: currentPipelineId,
        legal_entity_id: (cleanedFormData.legal_entity_id as string) || effectiveLegalEntityId || '',
        custom_fields: customFieldsData as Json,
      });
    }
    resetForm();
  };

  const handleInterventionConfirm = async (justification: string) => {
    if (!interventionData) return;
    try {
      await logIntervention({
        actionType: interventionData.pendingAction.type,
        entityType: 'deal',
        entityId: editingDeal?.id || interventionData.clientId || crypto.randomUUID(),
        entityName: formData.name || 'Novo negócio',
        clientId: interventionData.clientId,
        clientName: interventionData.clientName,
        clientOwnerId: interventionData.clientOwnerId,
        clientOwnerName: interventionData.clientOwnerName,
        justification,
        details: { formData: interventionData.pendingAction.data, isNewEntity: !editingDeal },
      });
      executeSubmit(interventionData.pendingAction.data);
      setInterventionModalOpen(false);
      setInterventionData(null);
    } catch (error) {
      console.error('Failed to log intervention:', error);
      toast.error('Erro ao registrar intervenção');
    }
  };

  const handleDeleteDeal = (deal: Deal) => {
    setDealToDelete(deal);
    setDeleteConfirmOpen(true);
  };

  const handleOpenEmailDialog = (deal: Deal) => {
    setEmailTargetDeal(deal);
    setIsEmailDialogOpen(true);
  };

  const resetEmailForm = () => {
    setEmailData({ subject: '', body: '' });
    setSelectedTemplateId(null);
    setEmailTargetDeal(null);
    setIsEmailDialogOpen(false);
  };

  const handleTemplateSelect = (templateId: string) => {
    if (templateId === 'none') { setSelectedTemplateId(null); return; }
    setSelectedTemplateId(templateId);
    const template = templates?.find((t: { id: string; subject: string; body: string }) => t.id === templateId);
    if (template) setEmailData({ subject: template.subject, body: template.body });
  };

  const handleSendEmail = () => {
    if (!emailTargetDeal || !emailData.subject || !emailData.body) { toast.error('Preencha todos os campos'); return; }
    const contact = emailTargetDeal.contact_id ? contactsSearchResult?.find(c => c.id === emailTargetDeal.contact_id) : null;
    if (!contact?.email) { toast.error('Contato não possui email'); return; }
    sendEmailMutation.mutate({
      to_email: contact.email, subject: emailData.subject, body: emailData.body,
      contact_id: emailTargetDeal.contact_id, deal_id: emailTargetDeal.id, template_id: selectedTemplateId,
    });
    resetEmailForm();
  };

  const handleDragStart = (e: React.DragEvent, dealId: string) => {
    e.dataTransfer.setData('dealId', dealId);
  };

  const handleDrop = (e: React.DragEvent, stage: PipelineStageRow) => {
    e.preventDefault();
    const dealId = e.dataTransfer.getData('dealId');
    if (!dealId) return;
    handleDropCore(dealId, stage, {
      setMissingDataAlert,
      setPendingLossDeal,
      setLossReasonModalOpen,
      setSlaModalData,
      setSlaModalOpen,
      setChecklistModalData,
      setChecklistModalOpen,
    });
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };

  const handleLossReasonConfirm = (reason: string, notes: string) => {
    if (pendingLossDeal) {
      updateMutation.mutate({
        id: pendingLossDeal.id,
        stage: 'fechado_perdido' as DealStage,
        lost_reason: reason, notes: notes || undefined,
      });
      setPendingLossDeal(null);
      setLossReasonModalOpen(false);
    }
  };

  // Wrap contact helpers to pass selectedContactData
  const wrappedGetContactPhone = (contactId: string | null) => getContactPhone(contactId, selectedContactData);
  const wrappedGetContactName = (contactId: string | null) => getContactName(contactId, selectedContactData);
  const wrappedGetContactInfo = (contactId: string | null) => getContactInfo(contactId, selectedContactData);

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 sm:space-y-6 h-full px-2 sm:px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Pipeline de Vendas</h1>
          <p className="text-sm text-muted-foreground">Gerencie suas oportunidades de negócio</p>
        </div>
        <div className="flex items-center gap-3">
          <PipelineSelector value={selectedPipelineId} onChange={setSelectedPipelineId} />
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isFetching} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Atualizar</span>
          </Button>
          <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as 'kanban' | 'list')} className="bg-muted rounded-lg p-1">
            <ToggleGroupItem value="kanban" aria-label="Visualização Kanban" className="gap-1.5 px-3">
              <LayoutGrid className="h-4 w-4" /><span className="hidden sm:inline">Kanban</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="Visualização Lista" className="gap-1.5 px-3">
              <List className="h-4 w-4" /><span className="hidden sm:inline">Lista</span>
            </ToggleGroupItem>
          </ToggleGroup>

          <DealFormDialog
            isOpen={isDialogOpen}
            onOpenChange={setIsDialogOpen}
            editingDeal={editingDeal}
            formData={formData}
            setFormData={setFormData}
            customFieldsData={customFieldsData}
            setCustomFieldsData={setCustomFieldsData}
            stages={stages}
            stageRows={stageRows}
            stageConfig={stageConfig}
            companyOptions={companyOptions}
            contactOptions={contactOptions}
            legalEntities={legalEntities}
            effectiveLegalEntityId={effectiveLegalEntityId}
            onCompanySearchChange={setCompanySearch}
            onContactSearchChange={setContactSearch}
            onSubmit={handleSubmit}
            onReset={resetForm}
            onDeleteDeal={handleDeleteDeal}
            onOpenEmailDialog={handleOpenEmailDialog}
            onQuickCreateCompany={() => setQuickCreateCompanyOpen(true)}
            onQuickCreateContact={() => setQuickCreateContactOpen(true)}
            canDeleteDeal={canDeleteDeal}
            isMutating={createMutation.isPending || updateMutation.isPending}
            getContactPhone={wrappedGetContactPhone}
            getContactName={wrappedGetContactName}
            getContactInfo={wrappedGetContactInfo}
          />
        </div>
      </div>

      {/* Filters */}
      <PipelineFilters
        ownershipViewMode={ownershipViewMode}
        setOwnershipViewMode={setOwnershipViewMode}
        filterOwner={filterOwner} setFilterOwner={setFilterOwner}
        filterStage={filterStage} setFilterStage={setFilterStage}
        filterCompany={filterCompany} setFilterCompany={setFilterCompany}
        filterDateFrom={filterDateFrom} setFilterDateFrom={setFilterDateFrom}
        filterDateTo={filterDateTo} setFilterDateTo={setFilterDateTo}
        companies={filterCompaniesResult}
        hasActiveFilters={hasActiveFilters}
        isAdmin={isAdmin}
        sellers={sellers}
        onCompanySearchChange={setFilterCompanySearch}
      />

      {/* Email Dialog */}
      <Dialog open={isEmailDialogOpen} onOpenChange={(open) => { setIsEmailDialogOpen(open); if (!open) resetEmailForm(); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />Enviar Email
            </DialogTitle>
          </DialogHeader>
          {emailTargetDeal && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Destinatário:</p>
                <p className="font-medium">{(emailTargetDeal as any).contacts?.first_name} {(emailTargetDeal as any).contacts?.last_name}</p>
                <p className="text-sm text-muted-foreground">{(emailTargetDeal as any).contacts?.email}</p>
              </div>
              <div>
                <Label>Template (opcional)</Label>
                <Select value={selectedTemplateId || 'none'} onValueChange={handleTemplateSelect}>
                  <SelectTrigger><SelectValue placeholder="Selecione um template" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum template</SelectItem>
                    {templates?.map((t: any) => (<SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Assunto *</Label>
                <Input value={emailData.subject} onChange={(e) => setEmailData({ ...emailData, subject: e.target.value })} placeholder="Assunto do email" />
              </div>
              <div>
                <Label>Corpo do Email *</Label>
                <Textarea value={emailData.body} onChange={(e) => setEmailData({ ...emailData, body: e.target.value })} rows={8} placeholder="Use {{nome}}, {{empresa}}, {{cargo}} para variáveis" />
                <p className="text-xs text-muted-foreground mt-1">Variáveis: {"{{nome}}"}, {"{{sobrenome}}"}, {"{{empresa}}"}, {"{{cargo}}"}</p>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={resetEmailForm}>Cancelar</Button>
                <Button onClick={handleSendEmail} disabled={sendEmailMutation.isPending} className="gap-2">
                  {sendEmailMutation.isPending ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Send className="h-4 w-4" />}
                  Enviar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Main Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : viewMode === 'list' ? (
        <div className="h-[calc(100vh-280px)] overflow-auto">
          <PipelineListView deals={filteredDeals} onEdit={handleEdit} onSendEmail={handleOpenEmailDialog} />
        </div>
      ) : (
        <KanbanBoard
          stageRows={stageRows}
          stageConfig={stageConfig}
          filteredDeals={filteredDeals}
          isMobile={isMobile}
          isSalesPipeline={isSalesPipeline}
          stagePermissions={pipeline.stagePermissions}
          resolveDealStageId={resolveDealStageId}
          onDragStart={handleDragStart}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onEdit={handleEdit}
          onEmailDialog={handleOpenEmailDialog}
          paginationResetKey={paginationResetKey}
        />
      )}

      {/* Modals */}
      <LossReasonModal
        open={lossReasonModalOpen}
        onOpenChange={(open) => { setLossReasonModalOpen(open); if (!open) setPendingLossDeal(null); }}
        dealName={pendingLossDeal?.name || ''}
        onConfirm={handleLossReasonConfirm}
        isLoading={updateMutation.isPending}
      />

      <ChecklistValidationModal
        open={checklistModalOpen}
        onOpenChange={(open) => { setChecklistModalOpen(open); if (!open) setChecklistModalData(null); }}
        deal={checklistModalData?.deal || null}
        targetStage={checklistModalData?.targetStage || 'prospeccao'}
        pendingItems={checklistModalData?.pendingItems || []}
        onConfirm={() => {
          if (checklistModalData) {
            updateMutation.mutate({ id: checklistModalData.deal.id, stage: checklistModalData.targetStage });
          }
        }}
      />

      <SLAJustificationModal
        open={slaModalOpen}
        onOpenChange={(open) => { setSlaModalOpen(open); if (!open) setSlaModalData(null); }}
        dealName={slaModalData?.deal.name || ''}
        daysInStage={slaModalData?.daysInStage || 0}
        onConfirm={async (reason) => {
          if (slaModalData) {
            const now = new Date();
            const formattedDate = format(now, 'dd/MM/yyyy HH:mm');
            const userName = user?.email?.split('@')[0] || 'Usuário';
            const newEntry = `[${formattedDate} - ${userName}]: ${reason}`;
            const existingReason = slaModalData.deal.stagnation_reason || '';
            const updatedReason = existingReason ? `${existingReason}\n${newEntry}` : newEntry;
            updateMutation.mutate({
              id: slaModalData.deal.id, stage: slaModalData.targetStage,
              stagnation_reason: updatedReason,
            } as any);
            setSlaModalOpen(false);
            setSlaModalData(null);
          }
        }}
        isLoading={updateMutation.isPending}
      />

      <QuickCreateCompanyModal
        open={quickCreateCompanyOpen}
        onOpenChange={setQuickCreateCompanyOpen}
        onCreated={(companyId) => setFormData({ ...formData, company_id: companyId })}
      />

      <QuickCreateContactModal
        open={quickCreateContactOpen}
        onOpenChange={setQuickCreateContactOpen}
        companyId={formData.company_id}
        onCreated={(contactId) => setFormData({ ...formData, contact_id: contactId })}
      />

      <AdminInterventionModal
        open={interventionModalOpen}
        onOpenChange={(open) => { setInterventionModalOpen(open); if (!open) setInterventionData(null); }}
        clientName={interventionData?.clientName || ''}
        clientOwnerName={interventionData?.clientOwnerName || ''}
        actionDescription={interventionData?.actionDescription || ''}
        onConfirm={handleInterventionConfirm}
        onCancel={() => setInterventionData(null)}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      <AlertDialog open={!!missingDataAlert} onOpenChange={(open) => !open && setMissingDataAlert(null)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader className="flex flex-col items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-7 w-7 text-destructive" />
            </div>
            <AlertDialogTitle className="text-center text-lg">Cadastro Incompleto</AlertDialogTitle>
            <AlertDialogDescription className="text-center text-base">{missingDataAlert}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center">
            <AlertDialogAction onClick={() => setMissingDataAlert(null)}>Entendi</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Negócio</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o negócio <strong>"{dealToDelete?.name}"</strong>? Esta ação não pode ser desfeita. Todas as propostas, histórico e atividades vinculadas serão mantidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { dealToDelete && deleteMutation.mutate(dealToDelete.id); setDeleteConfirmOpen(false); setDealToDelete(null); resetForm(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PortfolioProtectionModal
        open={showProtectionModal}
        onOpenChange={setShowProtectionModal}
        info={protectionInfo}
      />
    </div>
  );
}
