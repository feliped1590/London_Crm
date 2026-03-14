import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft, Building2, User, Save, Pencil,
  TrendingUp, Clock, FileText, Users, Database,
  AlertCircle, CheckCircle, CalendarCheck, ShieldCheck, Package,
} from 'lucide-react';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import { useSalesRepAccess } from '@/hooks/useSalesRepAccess';
import { useSalesReps } from '@/hooks/useSalesReps';
import { useClassificacao } from '@/hooks/useClassificacao';
import { useCustomerDetail } from '@/hooks/useCustomerDetail';
import { CustomerOverviewTab } from '@/components/customer/CustomerOverviewTab';
import { CustomerContactsTab } from '@/components/customer/CustomerContactsTab';
import { CustomerDealsTab } from '@/components/customer/CustomerDealsTab';
import { CustomerActivitiesTab } from '@/components/customer/CustomerActivitiesTab';
import { CompanyAuditHistory } from '@/components/customers/CompanyAuditHistory';
import { CreditAnalysisTab } from '@/components/customers/CreditAnalysisTab';
import { CustomerOrdersTab } from '@/components/customers/CustomerOrdersTab';
import { formatCNPJ, cleanDocument } from '@/lib/cpfCnpjMask';
import type { Json } from '@/integrations/supabase/types';

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useModulePermissions();
  const { hasDirectAccess, needsAdminIntervention, isAdmin: isSalesRepAdmin } = useSalesRepAccess();
  const { getNomeById } = useClassificacao();
  const { salesReps, allUserSalesReps } = useSalesReps();

  const {
    customer, isLoading, sellers, currentOwner, selectValue, profilesMap,
    assignOwnerMutation, updateCompanyMutation, saveContactMutation,
    deleteContactMutation, markAsReviewedMutation,
    isReviewOverdue, formatReviewDate,
  } = useCustomerDetail(id);

  const [isEditing, setIsEditing] = useState(false);

  // Company form state
  const [companyForm, setCompanyForm] = useState({
    name: '', fantasia: '', cnpj: '', inscricao_estadual: '',
    phone: '', email: '', website: '', employee_count: '',
    address: '', city: '', state: '', country: 'Brasil', notes: '',
    setor_id: null as string | null, segmento_id: null as string | null,
    atividade_id: null as string | null, contribuinte_ipi: false,
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
      address: customer.address || '', city: customer.city || '',
      state: customer.state || '', country: customer.country || 'Brasil',
      notes: customer.notes || '',
      setor_id: customer.setor_id || null,
      segmento_id: customer.segmento_id || null,
      atividade_id: customer.atividade_id || null,
      contribuinte_ipi: customer.contribuinte_ipi ?? false,
    });
    setCustomFieldsData((customer.custom_fields as Record<string, unknown>) || {});
  }

  const handleSaveCompany = () => {
    const cnpjLimpo = companyForm.cnpj ? cleanDocument(companyForm.cnpj) : null;
    updateCompanyMutation.mutate(
      { ...companyForm, cnpj: cnpjLimpo, custom_fields: customFieldsData as Json },
      { onSuccess: () => setIsEditing(false) },
    );
  };

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

  // Access control - all can view, only owner/admin can edit
  const customerSalesRepId = customer.source === 'crm' ? (customer as any).sales_rep_id : null;
  const salesRepUserLink = allUserSalesReps?.find(link => link.sales_rep_id === customerSalesRepId);
  const canEdit = isSalesRepAdmin || hasDirectAccess(customerSalesRepId) || !customerSalesRepId;
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
                {isErpCustomer ? (
                  <Badge variant="secondary" className="gap-1"><Database className="h-3 w-3" />ERP</Badge>
                ) : (
                  <Badge variant="outline" className="gap-1"><Building2 className="h-3 w-3" />CRM</Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {customer.cnpj && <span>{formatCNPJ(customer.cnpj)}</span>}
                {(getNomeById.atividade(customer.atividade_id || null) || customer.segmento) && (
                  <span>• {getNomeById.atividade(customer.atividade_id || null) || customer.segmento}</span>
                )}
                {customer.city && customer.state && <span>• {customer.city}/{customer.state}</span>}
                {isErpCustomer && customer.regiao && <span>• {customer.regiao}</span>}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
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
          {!isErpCustomer && (
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
      {isErpCustomer && (
        <div className="flex items-center gap-3 p-4 rounded-lg border border-warning/30 bg-warning/10">
          <AlertCircle className="h-5 w-5 text-warning" />
          <div>
            <p className="text-sm font-medium text-foreground">Cliente sincronizado do ERP</p>
            <p className="text-sm text-muted-foreground">Os dados deste cliente são gerenciados pelo ERP Iniflex e não podem ser editados aqui.</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="dados" className="space-y-4">
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="dados">Dados</TabsTrigger>
          <TabsTrigger value="contatos" className="flex items-center gap-2">
            <Users className="h-4 w-4" />Contatos
            {contacts.length > 0 && <Badge variant="secondary" className="h-5 min-w-5">{contacts.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="negocios" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />Negócios
            {deals.length > 0 && <Badge variant="secondary" className="h-5 min-w-5">{deals.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="pedidos" className="flex items-center gap-2"><Package className="h-4 w-4" />Pedidos</TabsTrigger>
          <TabsTrigger value="credito" className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" />Crédito</TabsTrigger>
          <TabsTrigger value="historico" className="flex items-center gap-2"><Clock className="h-4 w-4" />Histórico</TabsTrigger>
          <TabsTrigger value="notas" className="flex items-center gap-2"><FileText className="h-4 w-4" />Notas</TabsTrigger>
        </TabsList>

        <TabsContent value="dados">
          <CustomerOverviewTab
            customer={customer}
            customerId={id!}
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
          />
        </TabsContent>

        <TabsContent value="negocios">
          <CustomerDealsTab customerId={id!} deals={deals} isErpCustomer={isErpCustomer} />
        </TabsContent>

        <TabsContent value="pedidos">
          <CustomerOrdersTab companyId={id!} source={customer?.source || 'crm'} cnpj={customer?.cnpj || null} />
        </TabsContent>

        <TabsContent value="credito">
          <CreditAnalysisTab companyId={id!} companyName={customer?.fantasia || customer?.name || 'Cliente'} cnpj={customer?.cnpj || null} />
        </TabsContent>

        <TabsContent value="historico">
          <CompanyAuditHistory companyId={id!} isErpCustomer={isErpCustomer} />
        </TabsContent>

        <TabsContent value="notas">
          <CustomerActivitiesTab customerId={id!} isErpCustomer={isErpCustomer} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
