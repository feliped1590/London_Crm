import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft, Building2, User, Save, Pencil, Wand2,
  TrendingUp, Clock, FileText, Users, Database,
  AlertCircle, CheckCircle, CalendarCheck, ShieldCheck, Package, ArrowLeftRight, X, Paperclip, FileSignature,
  MessageSquare, PanelRightClose, PanelRightOpen, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { FollowupsTab } from '@/components/followups/FollowupsTab';
import { CustomerTimeline360Panel } from '@/components/customer/CustomerTimeline360Panel';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import {
  CustomerWorkspaceOverview,
  CustomerTasksTab,
  CustomerDocumentsTab,
  CustomerContractsTab,
} from '@/modules/customer-workspace';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import { useSalesRepAccess } from '@/hooks/useSalesRepAccess';
import { useEffectiveCustomerAccess } from '@/hooks/useEffectiveCustomerAccess';
import { useSalesReps } from '@/hooks/useSalesReps';
import { useClassificacao } from '@/hooks/useClassificacao';
import { useCustomerDetail } from '@/hooks/useCustomerDetail';
import { CustomerOverviewTab } from '@/components/customer/CustomerOverviewTab';
import { CustomerContactsTab } from '@/components/customer/CustomerContactsTab';
import { CustomerDealsTab } from '@/components/customer/CustomerDealsTab';
import { CustomerActivitiesTab } from '@/components/customer/CustomerActivitiesTab';
import { CustomerProductsTab } from '@/components/customer/CustomerProductsTab';
import { CompanyAuditHistory } from '@/components/customers/CompanyAuditHistory';
import { CreditAnalysisTab } from '@/components/customers/CreditAnalysisTab';
import { CompanySyncBadge, CompanySyncButton } from '@/components/customers/CompanySyncStatus';
import { CustomerOrdersTab } from '@/components/customers/CustomerOrdersTab';
import { AttachmentManager } from '@/components/attachments/AttachmentManager';
import { formatCNPJ, cleanDocument } from '@/lib/cpfCnpjMask';
import type { Json } from '@/integrations/supabase/types';
import { TransferRequestModal } from '@/components/customers/TransferRequestModal';
import { CustomerReviewAlertDialog } from '@/components/customers/CustomerReviewAlertDialog';
import { toast } from 'sonner';
import { useRecentInteractions } from '@/hooks/useRecentInteractions';
import { useFormDraft } from '@/workspace/useFormDraft';
import { DraftRestoreDialog } from '@/workspace/DraftRestoreDialog';
import { ERP_ENABLED } from '@/config/features';

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin, isDeveloper, isVendedor } = useModulePermissions();
  const { hasDirectAccess, needsAdminIntervention, isAdmin: isSalesRepAdmin } = useSalesRepAccess();
  const { getNomeById } = useClassificacao();
  const { salesReps, allUserSalesReps } = useSalesReps();

  const {
    customer, isLoading, sameGroupCompanies, sameGroupCompaniesLoading, groupDealMetrics, groupDealMetricsLoading, sellers, currentOwner, selectValue, profilesMap,
    assignOwnerMutation, updateCompanyMutation, saveContactMutation,
    deleteContactMutation, markAsReviewedMutation,
    isReviewOverdue, formatReviewDate,
  } = useCustomerDetail(id);

  const [isEditing, setIsEditing] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [showReviewAlert, setShowReviewAlert] = useState(false);
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'dados');
  const openTaskId = searchParams.get('task');
  const [isTimelineOpen, setIsTimelineOpen] = useState(true);
  const [isTimelineSheetOpen, setIsTimelineSheetOpen] = useState(false);
  const tabsScrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollTabsLeft, setCanScrollTabsLeft] = useState(false);
  const [canScrollTabsRight, setCanScrollTabsRight] = useState(false);
  const queryClient = useQueryClient();

  const updateTabsScrollState = () => {
    const element = tabsScrollerRef.current;
    if (!element) return;
    setCanScrollTabsLeft(element.scrollLeft > 2);
    setCanScrollTabsRight(element.scrollLeft + element.clientWidth < element.scrollWidth - 2);
  };

  const scrollTabs = (direction: -1 | 1) => {
    const element = tabsScrollerRef.current;
    if (!element) return;
    element.scrollBy({ left: direction * Math.max(240, element.clientWidth * 0.7), behavior: 'smooth' });
  };

  useEffect(() => {
    const element = tabsScrollerRef.current;
    if (!element) return;
    updateTabsScrollState();
    const observer = new ResizeObserver(updateTabsScrollState);
    observer.observe(element);
    element.addEventListener('scroll', updateTabsScrollState, { passive: true });
    return () => {
      observer.disconnect();
      element.removeEventListener('scroll', updateTabsScrollState);
    };
  }, [isTimelineOpen]);

  useEffect(() => {
    const element = tabsScrollerRef.current;
    const active = element?.querySelector<HTMLElement>('[role="tab"][data-state="active"]');
    if (element && active) {
      const left = active.offsetLeft;
      const right = left + active.offsetWidth;
      if (left < element.scrollLeft) element.scrollTo({ left, behavior: 'smooth' });
      else if (right > element.scrollLeft + element.clientWidth) element.scrollTo({ left: right - element.clientWidth, behavior: 'smooth' });
    }
    window.setTimeout(updateTabsScrollState, 250);
  }, [activeTab, isTimelineOpen]);
  const { recordInteraction: recordCustomerInteraction } = useRecentInteractions('company');

  useEffect(() => {
    if (customer?.source === 'crm' && isReviewOverdue(customer.last_reviewed_at)) {
      setShowReviewAlert(true);
    } else {
      setShowReviewAlert(false);
    }
  }, [customer?.id, customer?.source, customer?.last_reviewed_at]);

  useEffect(() => {
    if (customer?.id && customer.source === 'crm') {
      recordCustomerInteraction({
        entityId: customer.id,
        tenantId: (customer as { tenant_id?: string | null }).tenant_id,
        interactionType: 'view',
      });
    }
  }, [customer?.id, customer?.source]);

  const handleEnrichCompany = async () => {
    if (!customer?.cnpj) {
      toast.error('Cliente não possui CNPJ cadastrado');
      return;
    }
    setIsEnriching(true);
    try {
      const { data, error } = await supabase.functions.invoke('enrich-company-single', {
        body: { company_id: id },
      });
      if (error) throw error;
      if (data?.success) {
        if (data.fields_updated?.length > 0) {
          toast.success(`${data.message}\nCampos: ${data.fields_updated.join(', ')}`, { duration: 6000 });
          queryClient.invalidateQueries({ queryKey: ['customer', id] });
        } else {
          toast.info(data.message);
        }
      } else {
        toast.error(data?.error || 'Erro ao enriquecer dados');
      }
    } catch (err: any) {
      toast.error('Erro: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setIsEnriching(false);
    }
  };

  // Check for pending transfer request
  const { data: pendingTransfer } = useQuery({
    queryKey: ['pending_transfer', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('customer_transfer_requests' as any)
        .select('id, status, created_at')
        .eq('company_id', id!)
        .eq('status', 'pending')
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!id,
  });

  const transferQueryClient = useQueryClient();
  const cancelTransferMutation = useMutation({
    mutationFn: async () => {
      if (!pendingTransfer) return;
      const { error } = await supabase
        .from('customer_transfer_requests' as any)
        .update({ status: 'cancelled' })
        .eq('id', (pendingTransfer as any).id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Solicitação cancelada');
      transferQueryClient.invalidateQueries({ queryKey: ['pending_transfer', id] });
      transferQueryClient.invalidateQueries({ queryKey: ['transfer_requests'] });
    },
    onError: () => toast.error('Erro ao cancelar solicitação'),
  });

  // Company form state
  const [companyForm, setCompanyForm] = useState({
    name: '', fantasia: '', cnpj: '', inscricao_estadual: '',
    phone: '', email: '', website: '', employee_count: '',
    address: '', address_number: '', neighborhood: '', zip_code: '',
    city: '', state: '', country: 'Brasil', notes: '',
    setor_id: null as string | null, segmento_id: null as string | null,
    atividade_id: null as string | null, contribuinte_ipi: false,
    erp_code: '',
  });
  const [customFieldsData, setCustomFieldsData] = useState<Record<string, unknown>>({});

  // Initialize company form when data loads
  if (customer && !isEditing && companyForm.name !== customer.name) {
    setCompanyForm({
      name: customer.name || '', fantasia: customer.fantasia || '',
      cnpj: customer.cnpj ? formatCNPJ(customer.cnpj) : '',
      inscricao_estadual: customer.inscricao_estadual || '',
      phone: customer.phone || '', email: customer.email || '',
      website: customer.website || '', employee_count: customer.employee_count || '',
      address: customer.address || '',
      address_number: (customer as any).address_number || '',
      neighborhood: (customer as any).neighborhood || '',
      zip_code: (customer as any).zip_code || '',
      city: customer.city || '',
      state: customer.state || '', country: customer.country || 'Brasil',
      notes: customer.notes || '',
      setor_id: customer.setor_id || null,
      segmento_id: customer.segmento_id || null,
      atividade_id: customer.atividade_id || null,
      contribuinte_ipi: customer.contribuinte_ipi ?? false,
      erp_code: customer.erp_code || '',
    });
    setCustomFieldsData((customer.custom_fields as Record<string, unknown>) || {});
  }

  const handleSaveCompany = () => {
    // Validações de campos obrigatórios para ERP
    if (!companyForm.name?.trim()) {
      toast.error('Razão Social é obrigatória');
      return;
    }
    if (!companyForm.fantasia?.trim()) {
      toast.error('Nome Fantasia é obrigatório');
      return;
    }
    if (!companyForm.cnpj?.trim()) {
      toast.error('CNPJ/CPF é obrigatório');
      return;
    }
    if (!companyForm.inscricao_estadual?.trim()) {
      toast.error('Inscrição Estadual é obrigatória');
      return;
    }
    if (!companyForm.phone?.trim()) {
      toast.error('Telefone é obrigatório');
      return;
    }
    if (!companyForm.email?.trim()) {
      toast.error('Email é obrigatório');
      return;
    }
    if (!companyForm.address?.trim()) {
      toast.error('Endereço (logradouro) é obrigatório');
      return;
    }
    if (!companyForm.address_number?.trim()) {
      toast.error('Número do endereço é obrigatório');
      return;
    }
    if (!companyForm.neighborhood?.trim()) {
      toast.error('Bairro é obrigatório');
      return;
    }
    if (!companyForm.zip_code?.trim()) {
      toast.error('CEP é obrigatório');
      return;
    }
    if (!companyForm.city?.trim()) {
      toast.error('Cidade é obrigatória');
      return;
    }
    if (!companyForm.state?.trim()) {
      toast.error('Estado (UF) é obrigatório');
      return;
    }

    const cnpjLimpo = companyForm.cnpj ? cleanDocument(companyForm.cnpj) : null;
    updateCompanyMutation.mutate(
      { ...companyForm, cnpj: cnpjLimpo, custom_fields: customFieldsData as Json },
      {
        onSuccess: () => {
          setIsEditing(false);
          customerDetailDraft.clear();
          if (customer?.id) {
            recordCustomerInteraction({
              entityId: customer.id,
              tenantId: (customer as { tenant_id?: string | null }).tenant_id,
              interactionType: 'update',
            });
          }
        },
      },
    );
  };

  // -------- Workspace v1: rascunho persistido (Editar Cliente) --------
  const isErpForDraft = customer?.source === 'erp';
  type CustomerDetailDraftData = {
    companyForm: typeof companyForm;
    customFieldsData: Record<string, unknown>;
  };
  const customerDetailDraftData = useMemo<CustomerDetailDraftData>(() => ({
    companyForm,
    customFieldsData,
  }), [companyForm, customFieldsData]);
  const customerDetailDraft = useFormDraft<CustomerDetailDraftData>({
    context: id ? `customers:${id}` : null,
    enabled: !!id && isEditing && !isErpForDraft,
    baseline: (customer as any)?.updated_at ? { updatedAt: (customer as any).updated_at } : null,
    title: customer?.fantasia || customer?.name || 'Cliente',
    buildSnapshot: () => customerDetailDraftData,
    applyDraft: (data) => {
      try {
        if (data?.companyForm) setCompanyForm(data.companyForm);
        if (data?.customFieldsData) setCustomFieldsData(data.customFieldsData);
        setIsEditing(true);
      } catch (err) {
        console.warn('[CustomerDetail] applyDraft falhou', err);
      }
    },
  });
  const customerDetailDraftJson = JSON.stringify(customerDetailDraftData);
  const prevCustomerDetailDraftJsonRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isEditing) { prevCustomerDetailDraftJsonRef.current = null; return; }
    if (!customerDetailDraft.decided) return;
    if (prevCustomerDetailDraftJsonRef.current === null) {
      prevCustomerDetailDraftJsonRef.current = customerDetailDraftJson;
      return;
    }
    if (prevCustomerDetailDraftJsonRef.current !== customerDetailDraftJson) {
      prevCustomerDetailDraftJsonRef.current = customerDetailDraftJson;
      customerDetailDraft.markDirty();
    }
  }, [isEditing, customerDetailDraftJson, customerDetailDraft.decided, customerDetailDraft]);

  // Access control - resolve before early returns to satisfy Rules of Hooks
  const customerSalesRepId = customer && customer.source === 'crm' ? (customer as any).sales_rep_id : null;
  const effectiveAccess = useEffectiveCustomerAccess(customerSalesRepId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <h2 className="text-xl font-semibold">Cliente não encontrado</h2>
        <Button className="mt-4" onClick={() => navigate('/customers')}>Voltar para Clientes</Button>
      </div>
    );
  }

  const salesRepUserLink = allUserSalesReps?.find(link => link.sales_rep_id === customerSalesRepId);
  const canEdit = effectiveAccess.canEditCompany;
  const isOtherSellerCustomer = !canEdit && !!customerSalesRepId;

  // Find owner name from sales reps
  const ownerSalesRep = salesReps?.find(sr => sr.id === customerSalesRepId);

  const isErpCustomer = customer.source === 'erp';
  const contacts = customer.contacts || [];
  const deals = customer.deals || [];
  const displayName = customer.fantasia || customer.name;
  const isPJ = !!customer.cnpj;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/customers')}><ArrowLeft className="h-5 w-5" /></Button>
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="bg-primary/10 text-primary">
                {isPJ ? <Building2 className="h-6 w-6" /> : <User className="h-6 w-6" />}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-foreground">{displayName}</h1>
                {ERP_ENABLED && isErpCustomer ? (
                  <Badge variant="secondary" className="gap-1"><Database className="h-3 w-3" />ERP</Badge>
                ) : (
                  <Badge variant="outline" className="gap-1"><Building2 className="h-3 w-3" />CRM</Badge>
                )}
                <Badge variant="outline" className="gap-1">Workspace 360°</Badge>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {customer.cnpj && <span>{formatCNPJ(customer.cnpj)}</span>}
                {customer.segmento && (
                  <span>• {customer.segmento}</span>
                )}
                {customer.city && customer.state && <span>• {customer.city}/{customer.state}</span>}
                {isErpCustomer && customer.regiao && <span>• {customer.regiao}</span>}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={isTimelineOpen ? 'secondary' : 'outline'}
            size="sm"
            className="gap-2"
            onClick={() => {
              if (window.matchMedia('(min-width: 1024px)').matches) setIsTimelineOpen((open) => !open);
              else setIsTimelineSheetOpen(true);
            }}
            aria-expanded={isTimelineOpen || isTimelineSheetOpen}
            aria-controls="customer-timeline-360"
            aria-label="Abrir Timeline 360°"
            title="Timeline 360°"
          >
            {isTimelineOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
            <span className="hidden xl:inline">Timeline 360°</span>
          </Button>
          {ERP_ENABLED && !isErpCustomer && (isAdmin || isDeveloper || isVendedor) && (
            <div className="flex items-center gap-1">
              <CompanySyncBadge companyId={id!} erpCode={customer.erp_code} />
              <CompanySyncButton
                companyId={id!}
                erpCode={customer.erp_code}
                onSyncTriggered={() => {
                  queryClient.invalidateQueries({ queryKey: ['customer', id] });
                }}
              />
            </div>
          )}
          {!isErpCustomer && (
            <div className="flex items-center gap-2">
              {isReviewOverdue(customer.last_reviewed_at) ? (
                <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />Revisão pendente</Badge>
              ) : (
                <Badge variant="outline" className="gap-1 border-green-500/50 text-green-700 bg-green-500/10">
                  <CheckCircle className="h-3 w-3" />Revisado em {formatReviewDate(customer.last_reviewed_at)}
                </Badge>
              )}
              <Button variant="ghost" size="sm" onClick={() => markAsReviewedMutation.mutate()} disabled={markAsReviewedMutation.isPending} title="Marcar cadastro como revisado">
                <CalendarCheck className="h-4 w-4" />
              </Button>
            </div>
          )}
          {!isErpCustomer && canEdit && isPJ && !isEditing && (
            <Button variant="outline" size="sm" className="gap-2" onClick={handleEnrichCompany} disabled={isEnriching}>
              <Wand2 className={cn("h-4 w-4", isEnriching && "animate-spin")} />
              {isEnriching ? 'Enriquecendo...' : 'Enriquecer dados'}
            </Button>
          )}
          {!isErpCustomer && canEdit && (
            isEditing ? (
              <>
                <Button variant="outline" onClick={() => setIsEditing(false)}>Cancelar</Button>
                <Button onClick={handleSaveCompany} disabled={updateCompanyMutation.isPending}>
                  <Save className="h-4 w-4 mr-2" />Salvar
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                <Pencil className="h-4 w-4 mr-2" />Editar
              </Button>
            )
          )}
        </div>
      </div>

      {/* ERP Read-only Notice */}
      {ERP_ENABLED && isErpCustomer && (
        <div className="flex items-center gap-3 p-4 rounded-lg border border-warning/30 bg-warning/10">
          <AlertCircle className="h-5 w-5 text-warning" />
          <div>
            <p className="text-sm font-medium text-foreground">Cliente sincronizado do ERP</p>
            <p className="text-sm text-muted-foreground">Os dados deste cliente são gerenciados pelo ERP Iniflex e não podem ser editados aqui.</p>
          </div>
        </div>
      )}

      {/* Other seller's customer notice */}
      {isOtherSellerCustomer && (
        <div className="flex items-center justify-between gap-3 p-4 rounded-lg border border-amber-500/30 bg-amber-500/10">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-amber-600" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Cliente de outro vendedor{ownerSalesRep ? `: ${ownerSalesRep.name}` : ''}
              </p>
              <p className="text-sm text-muted-foreground">Você pode visualizar os dados, mas apenas o vendedor responsável pode editá-los.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {pendingTransfer ? (
              <>
                <Badge variant="outline" className="gap-1 border-amber-500/50 text-amber-700 bg-amber-500/10">
                  <Clock className="h-3 w-3" />
                  Transferência pendente
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 text-destructive"
                  onClick={() => cancelTransferMutation.mutate()}
                  disabled={cancelTransferMutation.isPending}
                >
                  <X className="h-3 w-3" />
                  Cancelar
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => setIsTransferModalOpen(true)}
              >
                <ArrowLeftRight className="h-4 w-4" />
                Solicitar Transferência
              </Button>
            )}
          </div>
        </div>
      )}

      <div className={cn('grid items-start gap-4', isTimelineOpen && 'lg:grid-cols-[minmax(0,1fr)_minmax(360px,34%)]')}>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="min-w-0 space-y-4">
        <div className="flex min-w-0 items-stretch border-b bg-muted/60">
        {canScrollTabsLeft && <Button type="button" variant="ghost" size="icon" className="h-10 w-9 shrink-0 rounded-none border-r bg-background/80" aria-label="Ver menus anteriores" title="Ver menus anteriores" onClick={() => scrollTabs(-1)}><ChevronLeft className="h-4 w-4" /></Button>}
        <div ref={tabsScrollerRef} className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <TabsList className="h-10 w-max min-w-full justify-start rounded-none bg-muted/60 p-1 [&>button]:shrink-0">
          <TabsTrigger value="dados">Cadastro</TabsTrigger>
          <TabsTrigger value="contatos" className="flex items-center gap-2">
            <Users className="h-4 w-4" />Contatos
            {contacts.length > 0 && <Badge variant="secondary" className="h-5 min-w-5">{contacts.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="visao-360">Visão 360</TabsTrigger>
          <TabsTrigger value="tarefas" className="flex items-center gap-2">
            <CalendarCheck className="h-4 w-4" />Tarefas e agenda
          </TabsTrigger>
          <TabsTrigger value="negocios" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />Processos
            {deals.length > 0 && <Badge variant="secondary" className="h-5 min-w-5">{deals.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="documentos" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />Documentos
          </TabsTrigger>
          {ERP_ENABLED && (
            <TabsTrigger value="itens" className="flex items-center gap-2">
              <Package className="h-4 w-4" />Itens vinculados
            </TabsTrigger>
          )}
          {ERP_ENABLED && (
            <TabsTrigger value="pedidos" className="flex items-center gap-2"><Package className="h-4 w-4" />Pedidos</TabsTrigger>
          )}
          <TabsTrigger value="credito" className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" />Crédito</TabsTrigger>
          <TabsTrigger value="anexos" className="flex items-center gap-2"><Paperclip className="h-4 w-4" />Anexos</TabsTrigger>
          <TabsTrigger value="contratos" className="flex items-center gap-2"><FileSignature className="h-4 w-4" />Contratos</TabsTrigger>
          <TabsTrigger value="followups" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />Interações
          </TabsTrigger>
          <TabsTrigger value="historico" className="flex items-center gap-2"><Clock className="h-4 w-4" />Histórico</TabsTrigger>
          <TabsTrigger value="notas" className="flex items-center gap-2"><FileText className="h-4 w-4" />Notas</TabsTrigger>
        </TabsList>
        </div>
        {canScrollTabsRight && <Button type="button" variant="ghost" size="icon" className="h-10 w-9 shrink-0 rounded-none border-l bg-background/80" aria-label="Ver próximos menus" title="Ver próximos menus" onClick={() => scrollTabs(1)}><ChevronRight className="h-4 w-4" /></Button>}
        </div>

        <TabsContent value="dados">
          <CustomerOverviewTab
            customer={customer}
            customerId={id!}
            sameGroupCompanies={sameGroupCompanies}
            sameGroupCompaniesLoading={sameGroupCompaniesLoading}
            groupDealMetrics={groupDealMetrics}
            groupDealMetricsLoading={groupDealMetricsLoading}
            isEditing={isEditing}
            companyForm={companyForm}
            setCompanyForm={setCompanyForm}
            customFieldsData={customFieldsData}
            setCustomFieldsData={setCustomFieldsData}
            sellers={sellers}
            currentOwner={currentOwner}
            selectValue={selectValue}
            assignOwnerMutation={assignOwnerMutation}
            updateCompanyMutation={updateCompanyMutation}
          />
        </TabsContent>

        <TabsContent value="contatos">
          <CustomerContactsTab
            customer={customer}
            contacts={contacts}
            saveContactMutation={saveContactMutation}
            deleteContactMutation={deleteContactMutation}
            canManageContacts={!isErpCustomer && effectiveAccess.canManageContacts}
          />
        </TabsContent>

        <TabsContent value="visao-360">
          <CustomerWorkspaceOverview companyId={id!} onOpenTab={setActiveTab} />
        </TabsContent>

        <TabsContent value="tarefas">
          <CustomerTasksTab companyId={id!} canEdit={canEdit} openTaskId={openTaskId} />
        </TabsContent>

        <TabsContent value="negocios">
          <CustomerDealsTab customerId={id!} deals={deals} isErpCustomer={isErpCustomer} canManageDeals={effectiveAccess.canManageDeals} />
        </TabsContent>

        <TabsContent value="documentos">
          <CustomerDocumentsTab companyId={id!} canEdit={canEdit} />
        </TabsContent>

        {ERP_ENABLED && (
        <TabsContent value="itens">
          <CustomerProductsTab companyId={id!} canEdit={!isErpCustomer && canEdit} />
        </TabsContent>
        )}

        {ERP_ENABLED && (
        <TabsContent value="pedidos">
          <CustomerOrdersTab companyId={id!} source={customer?.source || 'crm'} cnpj={customer?.cnpj || null} canManageOrders={effectiveAccess.canManageOrders} />
        </TabsContent>
        )}

        <TabsContent value="credito">
          <CreditAnalysisTab companyId={id!} companyName={customer?.fantasia || customer?.name || 'Cliente'} cnpj={customer?.cnpj || null} />
        </TabsContent>

        <TabsContent value="anexos">
          <AttachmentManager module="crm" entityType="company" entityId={id!} title="Anexos do cliente" />
        </TabsContent>

        <TabsContent value="contratos">
          <CustomerContractsTab companyId={id!} canEdit={canEdit} />
        </TabsContent>

        <TabsContent value="followups">
          <FollowupsTab companyId={id!} allowDealPicker />
        </TabsContent>

        <TabsContent value="historico">
          <CompanyAuditHistory companyId={id!} isErpCustomer={isErpCustomer} />
        </TabsContent>

        <TabsContent value="notas">
          <CustomerActivitiesTab customerId={id!} isErpCustomer={isErpCustomer} />
        </TabsContent>
      </Tabs>

      {isTimelineOpen && (
        <div id="customer-timeline-360" className="hidden min-w-0 lg:block">
          <CustomerTimeline360Panel customerId={id!} onOpenSource={setActiveTab} />
        </div>
      )}
      </div>

      <Sheet open={isTimelineSheetOpen} onOpenChange={setIsTimelineSheetOpen}>
        <SheetContent side="right" className="w-[min(94vw,420px)] p-0 lg:hidden [&>aside>header]:pr-12 [&>button]:right-3 [&>button]:top-3 [&>button]:z-10 [&>button]:rounded-md [&>button]:bg-background [&>button]:p-2">
          <SheetTitle className="sr-only">Timeline 360° do cliente</SheetTitle>
          <CustomerTimeline360Panel customerId={id!} className="h-full min-h-0 border-0" onOpenSource={(tab) => { setActiveTab(tab); setIsTimelineSheetOpen(false); }} />
        </SheetContent>
      </Sheet>

      {/* Transfer Request Modal */}
      {isOtherSellerCustomer && customerSalesRepId && ownerSalesRep && (
        <TransferRequestModal
          open={isTransferModalOpen}
          onOpenChange={setIsTransferModalOpen}
          companyId={id!}
          companyName={displayName}
          currentSalesRepId={customerSalesRepId}
          currentSalesRepName={ownerSalesRep.name}
        />
      )}

      {/* Review Alert Dialog (90 days policy) */}
      {customer.source === 'crm' && (
        <CustomerReviewAlertDialog
          open={showReviewAlert}
          customerName={displayName}
          lastReviewedLabel={formatReviewDate(customer.last_reviewed_at)}
          canEdit={canEdit}
          isMarking={markAsReviewedMutation.isPending}
          onClose={() => setShowReviewAlert(false)}
          onReviewNow={() => {
            setShowReviewAlert(false);
            setIsEditing(true);
          }}
          onMarkReviewed={() => {
            markAsReviewedMutation.mutate(undefined, {
              onSuccess: () => setShowReviewAlert(false),
            });
          }}
        />
      )}

      <DraftRestoreDialog
        open={customerDetailDraft.restorePending}
        conflict={customerDetailDraft.restoreConflict}
        savedAt={customerDetailDraft.draftSavedAt}
        title={`Você tem um rascunho de ${displayName}`}
        onRestore={customerDetailDraft.acceptRestore}
        onDiscard={customerDetailDraft.discardRestore}
      />
    </div>
  );
}
