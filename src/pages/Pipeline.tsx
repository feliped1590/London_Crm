import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Plus, DollarSign, Calendar, Building2, User, GripVertical, Mail, Send, FileText, History, MessageCircle, LayoutGrid, List, Users, RefreshCw, StickyNote, Activity, Zap } from 'lucide-react';
import { PipelineFilters } from '@/components/pipeline/PipelineFilters';
import { PipelineSelector } from '@/components/pipeline/PipelineSelector';
import { DaysInStageBadge } from '@/components/pipeline/DaysInStageBadge';
import { usePipelines } from '@/hooks/usePipelines';
import { PipelineListView } from '@/components/pipeline/PipelineListView';
import { LossReasonModal } from '@/components/pipeline/LossReasonModal';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { CustomFieldsRenderer } from '@/components/CustomFieldsRenderer';
import { ProposalsList } from '@/components/proposals/ProposalsList';
import { DealHistoryTab } from '@/components/pipeline/DealHistoryTab';
import { DealParticipants } from '@/components/pipeline/DealParticipants';
import { DealWhatsAppChat } from '@/components/pipeline/DealWhatsAppChat';
import { ActivityTimeline } from '@/components/timeline/ActivityTimeline';
import { QuickNotes } from '@/components/notes/QuickNotes';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import { UnderDevelopmentBanner } from '@/components/UnderDevelopmentBanner';
import { ChecklistValidationModal } from '@/components/pipeline/ChecklistValidationModal';
import { SLAJustificationModal } from '@/components/pipeline/SLAJustificationModal';
import { DealQuickActions } from '@/components/pipeline/DealQuickActions';
import { getPendingChecklistItems, type ChecklistItem } from '@/hooks/useStageChecklists';
import { SearchableSelect, type SearchableSelectOption } from '@/components/ui/searchable-select';
import { CurrencyInput } from '@/components/ui/currency-input';
import { QuickCreateCompanyModal } from '@/components/pipeline/QuickCreateCompanyModal';
import { QuickCreateContactModal } from '@/components/pipeline/QuickCreateContactModal';
import type { Tables, TablesInsert, Json } from '@/integrations/supabase/types';
import { differenceInDays, parseISO, format } from 'date-fns';
import { formatCNPJ, formatCPF, cleanDocument } from '@/lib/cpfCnpjMask';

type Deal = Tables<'deals'>;
type DealStage = Tables<'deals'>['stage'];

const stageConfig: Record<DealStage, { label: string; color: string }> = {
  prospeccao: { label: 'Prospecção', color: 'bg-slate-500' },
  qualificacao: { label: 'Qualificação', color: 'bg-blue-500' },
  proposta: { label: 'Proposta', color: 'bg-yellow-500' },
  negociacao: { label: 'Negociação', color: 'bg-orange-500' },
  fechado_ganho: { label: 'Fechado (Ganho)', color: 'bg-green-500' },
  fechado_perdido: { label: 'Fechado (Perdido)', color: 'bg-red-500' },
};

const stages: DealStage[] = ['prospeccao', 'qualificacao', 'proposta', 'negociacao', 'fechado_ganho', 'fechado_perdido'];

export default function Pipeline() {
  const { user } = useAuth();
  const { isAdmin } = useModulePermissions();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [formData, setFormData] = useState<Partial<TablesInsert<'deals'>>>({
    name: '',
    value: 0,
    stage: 'prospeccao',
    probability: 10,
    expected_close_date: '',
    company_id: null,
    contact_id: null,
    notes: '',
  });
  const [customFieldsData, setCustomFieldsData] = useState<Record<string, unknown>>({});

  // Email dialog states
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [emailTargetDeal, setEmailTargetDeal] = useState<Deal | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [emailData, setEmailData] = useState({
    subject: '',
    body: '',
  });

  // View mode and filters
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [filterOwner, setFilterOwner] = useState('all');
  const [filterStage, setFilterStage] = useState('all');
  const [filterCompany, setFilterCompany] = useState('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);

  // Pipelines hook
  const { pipelines, defaultPipeline } = usePipelines();

  // Loss reason modal state
  const [lossReasonModalOpen, setLossReasonModalOpen] = useState(false);
  const [pendingLossDeal, setPendingLossDeal] = useState<{ id: string; name: string } | null>(null);

  // Checklist validation modal state
  const [checklistModalOpen, setChecklistModalOpen] = useState(false);
  const [checklistModalData, setChecklistModalData] = useState<{
    deal: { id: string; name: string; stage: DealStage; pipeline_id?: string | null };
    targetStage: DealStage;
    pendingItems: ChecklistItem[];
  } | null>(null);

  // SLA justification modal state
  const [slaModalOpen, setSlaModalOpen] = useState(false);
  const [slaModalData, setSlaModalData] = useState<{
    deal: { id: string; name: string; updated_at: string; stagnation_reason?: string | null };
    targetStage: DealStage;
    daysInStage: number;
  } | null>(null);

  // Quick create modals state
  const [quickCreateCompanyOpen, setQuickCreateCompanyOpen] = useState(false);
  const [quickCreateContactOpen, setQuickCreateContactOpen] = useState(false);

  const { data: deals, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['deals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deals')
        .select('*, companies(name), contacts(first_name, last_name, email)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const handleRefresh = async () => {
    await refetch();
    toast.success('Dados atualizados!');
  };

  const { data: companies } = useQuery({
    queryKey: ['companies-with-cnpj'],
    queryFn: async () => {
      const { data, error } = await supabase.from('companies').select('id, name, cnpj').order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: contacts } = useQuery({
    queryKey: ['contacts-with-cpf'],
    queryFn: async () => {
      const { data, error } = await supabase.from('contacts').select('id, first_name, last_name, email, phone, mobile, cpf').order('first_name');
      if (error) throw error;
      return data;
    },
  });

  // Searchable options for companies
  const companyOptions: SearchableSelectOption[] = useMemo(() => {
    return companies?.map(c => ({
      value: c.id,
      label: c.name,
      searchTerms: c.cnpj ? cleanDocument(c.cnpj) : undefined,
    })) || [];
  }, [companies]);

  // Searchable options for contacts
  const contactOptions: SearchableSelectOption[] = useMemo(() => {
    return contacts?.map(c => ({
      value: c.id,
      label: `${c.first_name} ${c.last_name || ''}`.trim(),
      searchTerms: c.cpf ? cleanDocument(c.cpf) : undefined,
    })) || [];
  }, [contacts]);

  // Helper functions to get contact info
  const getContactInfo = (contactId: string | null) => {
    if (!contactId) return null;
    return contacts?.find(c => c.id === contactId);
  };

  const getContactPhone = (contactId: string | null) => {
    const contact = getContactInfo(contactId);
    return contact?.mobile || contact?.phone || null;
  };

  const getContactName = (contactId: string | null) => {
    const contact = getContactInfo(contactId);
    return contact ? `${contact.first_name} ${contact.last_name || ''}`.trim() : '';
  };

  const { data: templates } = useQuery({
    queryKey: ['email_templates'],
    queryFn: async () => {
      const { data, error } = await supabase.from('email_templates').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: TablesInsert<'deals'>) => {
      const { error } = await supabase.from('deals').insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      toast.success('Negócio criado com sucesso!');
      resetForm();
    },
    onError: (error: any) => {
      // Check if it's a portfolio governance error (trigger block)
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
      // Get current deal to check if stage changed
      const currentDeal = deals?.find(d => d.id === id);
      const stageChanged = currentDeal && data.stage && currentDeal.stage !== data.stage;
      
      const updateData: any = { ...data };
      if (data.stage === 'fechado_ganho' || data.stage === 'fechado_perdido') {
        updateData.closed_at = new Date().toISOString();
      }
      const { error } = await supabase.from('deals').update(updateData).eq('id', id);
      if (error) throw error;

      // If stage changed, record history and execute automations
      if (stageChanged && currentDeal && data.stage) {
        // Calculate duration in previous stage
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

        // Record stage history
        await supabase.from('deal_stage_history').insert({
          deal_id: id,
          from_stage: currentDeal.stage,
          to_stage: data.stage,
          changed_by: user?.id,
          duration_seconds: duration,
        });

        // Execute automations for stage exit (fire and forget)
        supabase.functions.invoke('execute-automation', {
          body: { 
            deal_id: id, 
            trigger_type: 'stage_exit', 
            trigger_stage: currentDeal.stage 
          }
        }).catch(console.error);

        // Execute automations for stage enter (fire and forget)
        supabase.functions.invoke('execute-automation', {
          body: { 
            deal_id: id, 
            trigger_type: 'stage_enter', 
            trigger_stage: data.stage 
          }
        }).catch(console.error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['deal_stage_history'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Negócio atualizado!');
      resetForm();
    },
    onError: (error: any) => {
      // Check if it's a portfolio governance error (trigger block)
      const message = error?.message || '';
      if (message.includes('Este cliente pertence ao vendedor')) {
        toast.error(message, { duration: 6000 });
      } else {
        toast.error('Erro ao atualizar negócio');
      }
    },
  });

  const sendEmailMutation = useMutation({
    mutationFn: async (data: any) => {
      const { data: response, error } = await supabase.functions.invoke('send-email', {
        body: data,
      });
      if (error) throw error;
      if (response.error) throw new Error(response.error);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email_logs'] });
      toast.success('Email enviado com sucesso!');
      resetEmailForm();
    },
    onError: (error: any) => {
      toast.error(`Erro ao enviar email: ${error.message}`);
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      value: 0,
      stage: 'prospeccao',
      probability: 10,
      expected_close_date: '',
      company_id: null,
      contact_id: null,
      notes: '',
    });
    setCustomFieldsData({});
    setEditingDeal(null);
    setIsDialogOpen(false);
  };

  const resetEmailForm = () => {
    setEmailData({ subject: '', body: '' });
    setSelectedTemplateId(null);
    setEmailTargetDeal(null);
    setIsEmailDialogOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Clean up empty date strings
    const cleanedFormData = {
      ...formData,
      expected_close_date: formData.expected_close_date || null,
    };
    
    if (editingDeal) {
      updateMutation.mutate({ 
        id: editingDeal.id, 
        ...cleanedFormData,
        custom_fields: customFieldsData as Json,
      });
    } else {
      createMutation.mutate({
        ...cleanedFormData,
        name: formData.name || '',
        created_by: user?.id,
        owner_id: user?.id,
        custom_fields: customFieldsData as Json,
      });
    }
  };

  const handleEdit = (deal: Deal) => {
    setEditingDeal(deal);
    setFormData({
      name: deal.name,
      value: deal.value || 0,
      stage: deal.stage,
      probability: deal.probability || 10,
      expected_close_date: deal.expected_close_date || '',
      company_id: deal.company_id,
      contact_id: deal.contact_id,
      notes: deal.notes || '',
    });
    setCustomFieldsData(
      typeof deal.custom_fields === 'object' && deal.custom_fields !== null
        ? (deal.custom_fields as Record<string, unknown>)
        : {}
    );
    setIsDialogOpen(true);
  };

  const handleOpenEmailDialog = (deal: Deal) => {
    setEmailTargetDeal(deal);
    setIsEmailDialogOpen(true);
  };

  const handleTemplateSelect = (templateId: string) => {
    if (templateId === 'none') {
      setSelectedTemplateId(null);
      return;
    }
    setSelectedTemplateId(templateId);
    const template = templates?.find(t => t.id === templateId);
    if (template) {
      setEmailData({
        subject: template.subject,
        body: template.body,
      });
    }
  };

  const handleSendEmail = () => {
    if (!emailTargetDeal || !emailData.subject || !emailData.body) {
      toast.error('Preencha todos os campos');
      return;
    }

    const contact = (emailTargetDeal as any).contacts;
    if (!contact?.email) {
      toast.error('Contato não possui email');
      return;
    }

    sendEmailMutation.mutate({
      to_email: contact.email,
      subject: emailData.subject,
      body: emailData.body,
      contact_id: emailTargetDeal.contact_id,
      deal_id: emailTargetDeal.id,
      template_id: selectedTemplateId,
    });
  };

  const handleDragStart = (e: React.DragEvent, dealId: string) => {
    e.dataTransfer.setData('dealId', dealId);
  };

  const handleDrop = async (e: React.DragEvent, stage: DealStage) => {
    e.preventDefault();
    const dealId = e.dataTransfer.getData('dealId');
    if (!dealId) return;
    
    const deal = deals?.find(d => d.id === dealId);
    if (!deal) return;
    
    // Skip checklist validation if moving to the same stage
    if (deal.stage === stage) return;
    
    // If dropping to fechado_perdido, show loss reason modal
    if (stage === 'fechado_perdido') {
      setPendingLossDeal({ id: dealId, name: deal.name });
      setLossReasonModalOpen(true);
      return;
    }

    // Check SLA breach - only for non-admin users
    const SLA_CRITICAL_DAYS = 7;
    const daysInStage = differenceInDays(new Date(), parseISO(deal.updated_at));
    
    // Admin bypass: admins can move without justification
    if (!isAdmin && daysInStage >= SLA_CRITICAL_DAYS) {
      setSlaModalData({
        deal: { 
          id: deal.id, 
          name: deal.name, 
          updated_at: deal.updated_at,
          stagnation_reason: (deal as any).stagnation_reason,
        },
        targetStage: stage,
        daysInStage,
      });
      setSlaModalOpen(true);
      return;
    }
    
    // Check for pending checklist items before allowing stage change
    // Use the deal's pipeline_id, or fall back to default pipeline
    const effectivePipelineId = deal.pipeline_id || defaultPipeline?.id || null;
    
    try {
      const pendingItems = await getPendingChecklistItems(dealId, deal.stage, effectivePipelineId);
      
      if (pendingItems.length > 0) {
        // Open checklist validation modal
        setChecklistModalData({
          deal: { id: deal.id, name: deal.name, stage: deal.stage, pipeline_id: effectivePipelineId },
          targetStage: stage,
          pendingItems,
        });
        setChecklistModalOpen(true);
        return;
      }
      
      // No pending items, proceed with stage change
      updateMutation.mutate({ id: dealId, stage });
    } catch (error) {
      console.error('Error checking checklist items:', error);
      // If there's an error checking, allow the change anyway
      updateMutation.mutate({ id: dealId, stage });
    }
  };

  // Handle loss reason confirmation
  const handleLossReasonConfirm = (reason: string, notes: string) => {
    if (pendingLossDeal) {
      updateMutation.mutate({
        id: pendingLossDeal.id,
        stage: 'fechado_perdido' as DealStage,
        lost_reason: reason,
        notes: notes || undefined,
      });
      setPendingLossDeal(null);
      setLossReasonModalOpen(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // Filtered deals
  const hasActiveFilters = filterOwner !== 'all' || filterStage !== 'all' || filterCompany !== 'all' || filterDateFrom !== '' || filterDateTo !== '';
  
  // Get current pipeline ID (selected or default)
  const currentPipelineId = selectedPipelineId || defaultPipeline?.id || null;
  
  const filteredDeals = useMemo(() => {
    return deals?.filter(deal => {
      // Filter by pipeline - deals sem pipeline_id são considerados do pipeline padrão
      const dealPipelineId = deal.pipeline_id || defaultPipeline?.id;
      if (currentPipelineId && dealPipelineId !== currentPipelineId) return false;
      
      // Filter by owner
      if (filterOwner === 'mine' && deal.owner_id !== user?.id) return false;
      
      // Filter by stage
      if (filterStage !== 'all' && deal.stage !== filterStage) return false;
      
      // Filter by company
      if (filterCompany !== 'all' && deal.company_id !== filterCompany) return false;
      
      // Filter by date range (created_at BETWEEN)
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
  }, [deals, filterOwner, filterStage, filterCompany, filterDateFrom, filterDateTo, user?.id, currentPipelineId, defaultPipeline?.id]);

  const getStageDeals = (stage: DealStage) => filteredDeals.filter(d => d.stage === stage);
  const getStageTotal = (stage: DealStage) => getStageDeals(stage).reduce((sum, d) => sum + (d.value || 0), 0);

  return (
    <div className="space-y-4 sm:space-y-6 h-full px-2 sm:px-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Pipeline de Vendas</h1>
          <p className="text-sm text-muted-foreground">Gerencie suas oportunidades de negócio</p>
        </div>
        <div className="flex items-center gap-3">
          <PipelineSelector
            value={selectedPipelineId}
            onChange={setSelectedPipelineId}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isFetching}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Atualizar</span>
          </Button>
          <ToggleGroup 
            type="single" 
            value={viewMode} 
            onValueChange={(value) => value && setViewMode(value as 'kanban' | 'list')}
            className="bg-muted rounded-lg p-1"
          >
            <ToggleGroupItem value="kanban" aria-label="Visualização Kanban" className="gap-1.5 px-3">
              <LayoutGrid className="h-4 w-4" />
              <span className="hidden sm:inline">Kanban</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="Visualização Lista" className="gap-1.5 px-3">
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">Lista</span>
            </ToggleGroupItem>
          </ToggleGroup>
          
          <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Novo Negócio
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-5xl max-h-[95vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>{editingDeal ? `Detalhes: ${editingDeal.name}` : 'Novo Negócio'}</DialogTitle>
            </DialogHeader>
            
            {editingDeal ? (
              <Tabs defaultValue="dados" className="flex-1 overflow-hidden flex flex-col">
                {/* Sprint 4: 7 tabs - Dados, Timeline, Notas, Propostas, Equipe, Histórico, WhatsApp */}
                <TabsList className="grid w-full grid-cols-7">
                  <TabsTrigger value="dados">Dados</TabsTrigger>
                  <TabsTrigger value="atividades" className="flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    <span className="hidden sm:inline">Timeline</span>
                  </TabsTrigger>
                  <TabsTrigger value="notas" className="flex items-center gap-2">
                    <StickyNote className="h-4 w-4" />
                    <span className="hidden sm:inline">Notas</span>
                  </TabsTrigger>
                  <TabsTrigger value="propostas" className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <span className="hidden sm:inline">Propostas</span>
                  </TabsTrigger>
                  <TabsTrigger value="participantes" className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span className="hidden sm:inline">Equipe</span>
                  </TabsTrigger>
                  <TabsTrigger value="historico" className="flex items-center gap-2">
                    <History className="h-4 w-4" />
                    <span className="hidden sm:inline">Histórico</span>
                  </TabsTrigger>
                  <TabsTrigger value="whatsapp" className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4" />
                    <span className="hidden sm:inline">WhatsApp</span>
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="dados" className="flex-1 overflow-auto mt-4">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <Label htmlFor="name">Nome do Negócio *</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="value">Valor (R$)</Label>
                        <CurrencyInput
                          id="value"
                          value={formData.value || 0}
                          onChange={(val) => setFormData({ ...formData, value: val })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="stage">Etapa</Label>
                        <Select value={formData.stage} onValueChange={(v) => setFormData({ ...formData, stage: v as DealStage })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {stages.map((s) => (
                              <SelectItem key={s} value={s}>{stageConfig[s].label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="probability">Probabilidade (%)</Label>
                        <Input
                          id="probability"
                          type="number"
                          min="0"
                          max="100"
                          value={formData.probability || 0}
                          onChange={(e) => setFormData({ ...formData, probability: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="expected_close_date">Previsão de Fechamento</Label>
                        <Input
                          id="expected_close_date"
                          type="date"
                          value={formData.expected_close_date || ''}
                          onChange={(e) => setFormData({ ...formData, expected_close_date: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="company_id">Empresa</Label>
                        <SearchableSelect
                          options={companyOptions}
                          value={formData.company_id}
                          onChange={(v) => setFormData({ ...formData, company_id: v })}
                          placeholder="Buscar empresa..."
                          searchPlaceholder="Nome ou CNPJ..."
                          emptyMessage="Nenhuma empresa encontrada."
                          onCreateNew={() => setQuickCreateCompanyOpen(true)}
                          createNewLabel="Criar nova empresa"
                        />
                      </div>
                      <div>
                        <Label htmlFor="contact_id">Contato</Label>
                        <SearchableSelect
                          options={contactOptions}
                          value={formData.contact_id}
                          onChange={(v) => setFormData({ ...formData, contact_id: v })}
                          placeholder="Buscar contato..."
                          searchPlaceholder="Nome ou CPF..."
                          emptyMessage="Nenhum contato encontrado."
                          onCreateNew={() => setQuickCreateContactOpen(true)}
                          createNewLabel="Criar novo contato"
                        />
                      </div>
                      <div className="col-span-2">
                        <Label htmlFor="notes">Observações</Label>
                        <Textarea
                          id="notes"
                          value={formData.notes || ''}
                          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                          rows={3}
                        />
                      </div>
                      <div className="col-span-2">
                        <CustomFieldsRenderer
                          entity="deal"
                          values={customFieldsData}
                          onChange={setCustomFieldsData}
                        />
                      </div>
                    </div>
                    {/* Quick Actions */}
                    <div className="pt-4 border-t">
                      <Label className="flex items-center gap-2 mb-3">
                        <Zap className="h-4 w-4" />
                        Ações Rápidas
                      </Label>
                      <DealQuickActions 
                        deal={editingDeal as any} 
                        onWhatsAppClick={() => {
                          // Switch to WhatsApp tab
                          const tabsTrigger = document.querySelector('[data-state="inactive"][value="whatsapp"]');
                          if (tabsTrigger instanceof HTMLElement) {
                            tabsTrigger.click();
                          }
                        }}
                      />
                    </div>
                    
                    <div className="flex justify-between gap-2 pt-4">
                      <div>
                        {(editingDeal as any).contacts?.email && (
                          <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => handleOpenEmailDialog(editingDeal)}
                            className="gap-2"
                          >
                            <Mail className="h-4 w-4" />
                            Enviar Email
                          </Button>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" onClick={resetForm}>
                          Cancelar
                        </Button>
                        <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                          Atualizar
                        </Button>
                      </div>
                    </div>
                  </form>
                </TabsContent>
                
                <TabsContent value="atividades" className="flex-1 overflow-auto mt-4">
                  <ActivityTimeline
                    entityType="deal"
                    entityId={editingDeal.id}
                  />
                </TabsContent>
                
                <TabsContent value="notas" className="flex-1 overflow-auto mt-4">
                  <QuickNotes
                    entityType="deal"
                    entityId={editingDeal.id}
                  />
                </TabsContent>
                
                <TabsContent value="propostas" className="flex-1 overflow-auto mt-4">
                  <ProposalsList
                    dealId={editingDeal.id}
                    companyId={editingDeal.company_id}
                    contactId={editingDeal.contact_id}
                  />
                </TabsContent>
                
                <TabsContent value="participantes" className="flex-1 overflow-auto mt-4">
                  <DealParticipants
                    dealId={editingDeal.id}
                    ownerId={editingDeal.owner_id}
                    createdBy={editingDeal.created_by}
                  />
                </TabsContent>
                
                <TabsContent value="historico" className="flex-1 overflow-auto mt-4">
                  <DealHistoryTab dealId={editingDeal.id} />
                </TabsContent>
                
                <TabsContent value="whatsapp" className="flex-1 overflow-hidden mt-4 flex flex-col gap-4">
                  <UnderDevelopmentBanner 
                    compact
                    title="Em Desenvolvimento"
                  />
                  <DealWhatsAppChat
                    contactId={editingDeal.contact_id}
                    contactPhone={getContactPhone(editingDeal.contact_id)}
                    contactName={getContactName(editingDeal.contact_id)}
                  />
                </TabsContent>
              </Tabs>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label htmlFor="name">Nome do Negócio *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="value">Valor (R$)</Label>
                    <CurrencyInput
                      id="value"
                      value={formData.value || 0}
                      onChange={(value) => setFormData({ ...formData, value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="stage">Etapa</Label>
                    <Select value={formData.stage} onValueChange={(v) => setFormData({ ...formData, stage: v as DealStage })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {stages.map((s) => (
                          <SelectItem key={s} value={s}>{stageConfig[s].label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="probability">Probabilidade (%)</Label>
                    <Input
                      id="probability"
                      type="number"
                      min="0"
                      max="100"
                      value={formData.probability || 0}
                      onChange={(e) => setFormData({ ...formData, probability: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="expected_close_date">Previsão de Fechamento</Label>
                    <Input
                      id="expected_close_date"
                      type="date"
                      value={formData.expected_close_date || ''}
                      onChange={(e) => setFormData({ ...formData, expected_close_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="company_id">Empresa</Label>
                    <SearchableSelect
                      options={companyOptions}
                      value={formData.company_id || ''}
                      onChange={(v) => setFormData({ ...formData, company_id: v || null })}
                      placeholder="Buscar empresa..."
                      searchPlaceholder="Nome ou CNPJ..."
                      emptyMessage="Nenhuma empresa encontrada."
                      onCreateNew={() => setQuickCreateCompanyOpen(true)}
                      createNewLabel="Criar nova empresa"
                    />
                  </div>
                  <div>
                    <Label htmlFor="contact_id">Contato</Label>
                    <SearchableSelect
                      options={contactOptions}
                      value={formData.contact_id || ''}
                      onChange={(v) => setFormData({ ...formData, contact_id: v || null })}
                      placeholder="Buscar contato..."
                      searchPlaceholder="Nome ou CPF..."
                      emptyMessage="Nenhum contato encontrado."
                      onCreateNew={() => setQuickCreateContactOpen(true)}
                      createNewLabel="Criar novo contato"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="notes">Observações</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes || ''}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={3}
                    />
                  </div>
                  <div className="col-span-2">
                    <CustomFieldsRenderer
                      entity="deal"
                      values={customFieldsData}
                      onChange={setCustomFieldsData}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                    Criar
                  </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Filters Bar */}
      <PipelineFilters
        filterOwner={filterOwner}
        setFilterOwner={setFilterOwner}
        filterStage={filterStage}
        setFilterStage={setFilterStage}
        filterCompany={filterCompany}
        setFilterCompany={setFilterCompany}
        filterDateFrom={filterDateFrom}
        setFilterDateFrom={setFilterDateFrom}
        filterDateTo={filterDateTo}
        setFilterDateTo={setFilterDateTo}
        companies={companies}
        hasActiveFilters={hasActiveFilters}
      />

      {/* Email Dialog */}
      <Dialog open={isEmailDialogOpen} onOpenChange={(open) => { setIsEmailDialogOpen(open); if (!open) resetEmailForm(); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Enviar Email
            </DialogTitle>
          </DialogHeader>
          {emailTargetDeal && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Destinatário:</p>
                <p className="font-medium">
                  {(emailTargetDeal as any).contacts?.first_name} {(emailTargetDeal as any).contacts?.last_name}
                </p>
                <p className="text-sm text-muted-foreground">{(emailTargetDeal as any).contacts?.email}</p>
              </div>

              <div>
                <Label>Template (opcional)</Label>
                <Select value={selectedTemplateId || 'none'} onValueChange={handleTemplateSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um template" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum template</SelectItem>
                    {templates?.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Assunto *</Label>
                <Input
                  value={emailData.subject}
                  onChange={(e) => setEmailData({ ...emailData, subject: e.target.value })}
                  placeholder="Assunto do email"
                />
              </div>

              <div>
                <Label>Corpo do Email *</Label>
                <Textarea
                  value={emailData.body}
                  onChange={(e) => setEmailData({ ...emailData, body: e.target.value })}
                  rows={8}
                  placeholder="Use {{nome}}, {{empresa}}, {{cargo}} para variáveis"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Variáveis: {"{{nome}}"}, {"{{sobrenome}}"}, {"{{empresa}}"}, {"{{cargo}}"}
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={resetEmailForm}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleSendEmail}
                  disabled={sendEmailMutation.isPending}
                  className="gap-2"
                >
                  {sendEmailMutation.isPending ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Enviar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : viewMode === 'list' ? (
        <div className="h-[calc(100vh-280px)] overflow-auto">
          <PipelineListView
            deals={filteredDeals}
            onEdit={handleEdit}
            onSendEmail={handleOpenEmailDialog}
          />
        </div>
      ) : (
        <div
          className={cn(
            "h-[calc(100vh-280px)] sm:h-[calc(100vh-300px)]",
            // Default: horizontal scroll (works great for tablet/notebook small)
            "flex gap-3 overflow-x-auto pb-4 -mx-2 px-2",
            // Keep snap only on mobile for nicer swiping
            isMobile && "snap-x snap-mandatory",
            // XL+: switch to full Kanban grid (no horizontal scroll)
            "xl:grid xl:grid-cols-6 xl:gap-4 xl:overflow-x-visible xl:pb-0 xl:mx-0 xl:px-0"
          )}
        >
          {stages.map((stage) => (
            <div
              key={stage}
              className={cn(
                "flex flex-col bg-muted/30 rounded-lg min-w-[280px] shrink-0",
                isMobile && "snap-center",
                "xl:min-w-0 xl:shrink"
              )}
              onDrop={(e) => handleDrop(e, stage)}
              onDragOver={handleDragOver}
            >
              <div className="p-3 border-b bg-muted/50 rounded-t-lg">
                <div className="flex items-center gap-2 mb-1">
                  <div className={`h-3 w-3 rounded-full ${stageConfig[stage].color}`} />
                  <h3 className="font-semibold text-sm">{stageConfig[stage].label}</h3>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{getStageDeals(stage).length} negócios</span>
                  <span>{formatCurrency(getStageTotal(stage))}</span>
                </div>
              </div>
              <ScrollArea className="flex-1 p-2">
                <div className="space-y-2">
                  {getStageDeals(stage).map((deal) => (
                    <Card
                      key={deal.id}
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      draggable
                      onDragStart={(e) => handleDragStart(e, deal.id)}
                      onClick={() => handleEdit(deal)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start gap-2">
                          <GripVertical className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5 cursor-grab" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{deal.name}</p>
                            <div className="flex items-center gap-1 mt-1 text-primary font-semibold text-sm">
                              <DollarSign className="h-3 w-3" />
                              {formatCurrency(deal.value || 0)}
                            </div>
                            <div className="mt-2 space-y-1">
                              {(deal as any).companies?.name && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Building2 className="h-3 w-3" />
                                  <span className="truncate">{(deal as any).companies.name}</span>
                                </div>
                              )}
                              {(deal as any).contacts && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <User className="h-3 w-3" />
                                  <span className="truncate">{(deal as any).contacts.first_name} {(deal as any).contacts.last_name}</span>
                                </div>
                              )}
                              {deal.expected_close_date && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Calendar className="h-3 w-3" />
                                  <span>{formatDate(deal.expected_close_date)}</span>
                                </div>
                              )}
                            </div>
                            <div className="mt-2 flex items-center gap-1 flex-wrap">
                              <DaysInStageBadge stageEnteredAt={deal.updated_at} />
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                {deal.probability}% prob.
                              </Badge>
                              {(deal as any).contacts?.email && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenEmailDialog(deal);
                                  }}
                                >
                                  <Mail className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </div>
          ))}
        </div>
      )}

      {/* Loss Reason Modal */}
      <LossReasonModal
        open={lossReasonModalOpen}
        onOpenChange={(open) => {
          setLossReasonModalOpen(open);
          if (!open) setPendingLossDeal(null);
        }}
        dealName={pendingLossDeal?.name || ''}
        onConfirm={handleLossReasonConfirm}
        isLoading={updateMutation.isPending}
      />

      {/* Checklist Validation Modal */}
      <ChecklistValidationModal
        open={checklistModalOpen}
        onOpenChange={(open) => {
          setChecklistModalOpen(open);
          if (!open) setChecklistModalData(null);
        }}
        deal={checklistModalData?.deal || null}
        targetStage={checklistModalData?.targetStage || 'prospeccao'}
        pendingItems={checklistModalData?.pendingItems || []}
        onConfirm={() => {
          if (checklistModalData) {
            updateMutation.mutate({ 
              id: checklistModalData.deal.id, 
              stage: checklistModalData.targetStage 
            });
          }
        }}
      />

      {/* SLA Justification Modal */}
      <SLAJustificationModal
        open={slaModalOpen}
        onOpenChange={(open) => {
          setSlaModalOpen(open);
          if (!open) setSlaModalData(null);
        }}
        dealName={slaModalData?.deal.name || ''}
        daysInStage={slaModalData?.daysInStage || 0}
        onConfirm={async (reason) => {
          if (slaModalData) {
            // Append-only: format with date and preserve previous reasons
            const now = new Date();
            const formattedDate = format(now, 'dd/MM/yyyy HH:mm');
            const userName = user?.email?.split('@')[0] || 'Usuário';
            const newEntry = `[${formattedDate} - ${userName}]: ${reason}`;
            
            const existingReason = slaModalData.deal.stagnation_reason || '';
            const updatedReason = existingReason 
              ? `${existingReason}\n${newEntry}`
              : newEntry;
            
            // Update the deal with the stagnation reason
            updateMutation.mutate({ 
              id: slaModalData.deal.id, 
              stage: slaModalData.targetStage,
              stagnation_reason: updatedReason,
            } as any);
            
            setSlaModalOpen(false);
            setSlaModalData(null);
          }
        }}
        isLoading={updateMutation.isPending}
      />

      {/* Quick Create Company Modal */}
      <QuickCreateCompanyModal
        open={quickCreateCompanyOpen}
        onOpenChange={setQuickCreateCompanyOpen}
        onCreated={(companyId) => {
          setFormData({ ...formData, company_id: companyId });
        }}
      />

      {/* Quick Create Contact Modal */}
      <QuickCreateContactModal
        open={quickCreateContactOpen}
        onOpenChange={setQuickCreateContactOpen}
        companyId={formData.company_id}
        onCreated={(contactId) => {
          setFormData({ ...formData, contact_id: contactId });
        }}
      />
    </div>
  );
}
