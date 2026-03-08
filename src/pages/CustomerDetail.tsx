import React, { useState, useMemo } from 'react';

import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  ArrowLeft, 
  Building2, 
  User, 
  Save, 
  Plus, 
  Pencil, 
  Trash2, 
  Phone, 
  Mail, 
  Linkedin,
  MessageCircle,
  TrendingUp,
  Clock,
  FileText,
  Users,
  Database,
  AlertCircle,
  CheckCircle,
  CalendarCheck,
  ShieldCheck,
  Shield,
  Package,
  Truck
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import { formatCNPJ, formatCPF, cleanDocument } from '@/lib/cpfCnpjMask';
import { CustomFieldsRenderer } from '@/components/CustomFieldsRenderer';

import { QuickNotes } from '@/components/notes/QuickNotes';
import { DealStageBadges } from '@/components/DealStageBadges';
import { CompanyAuditHistory } from '@/components/customers/CompanyAuditHistory';
import { AdminInterventionModal } from '@/components/governance/AdminInterventionModal';
import { usePortfolioGovernance } from '@/hooks/usePortfolioGovernance';
import { useSalesRepAccess } from '@/hooks/useSalesRepAccess';
import { CreditAnalysisTab } from '@/components/customers/CreditAnalysisTab';
import { CustomerOrdersTab } from '@/components/customers/CustomerOrdersTab';
import type { Json } from '@/integrations/supabase/types';
import { ClassificacaoCascade } from '@/components/classificacao/ClassificacaoCascade';
import { useClassificacao } from '@/hooks/useClassificacao';
import { useSalesReps } from '@/hooks/useSalesReps';

const employeeCounts = [
  '1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'
];

const contactRoles = [
  { value: 'principal', label: 'Principal' },
  { value: 'decisor', label: 'Decisor' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'tecnico', label: 'Técnico' },
  { value: 'usuario', label: 'Usuário' },
];

interface Contact {
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

// Interface unificada para cliente (CRM ou ERP)
interface UnifiedCustomer {
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
  contact_name?: string | null;
  source: 'crm' | 'erp';
  contacts?: Contact[];
  deals?: any[];
}

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin } = useModulePermissions();
  const { logIntervention } = usePortfolioGovernance();
  const { canAccessBySalesRep, needsAdminIntervention, isAdmin: isSalesRepAdmin } = useSalesRepAccess();
  const { getNomeById, setores } = useClassificacao();
  const { salesReps, allUserSalesReps } = useSalesReps();
  const queryClient = useQueryClient();

  // Fetch profiles to resolve user names for sales rep owners
  const { data: profilesMap } = useQuery({
    queryKey: ['profiles_map_for_access'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('user_id, full_name');
      const map: Record<string, string> = {};
      (data || []).forEach((p: any) => { map[p.user_id] = p.full_name || 'Usuário'; });
      return map;
    },
  });
  const [isEditing, setIsEditing] = useState(false);
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  
  // State for owner change intervention modal
  const [showOwnerInterventionModal, setShowOwnerInterventionModal] = useState(false);
  const [pendingOwnerChange, setPendingOwnerChange] = useState<string | null>(null);
  
  // State for admin access intervention modal  
  const [showAccessInterventionModal, setShowAccessInterventionModal] = useState(false);
  const [adminAccessGranted, setAdminAccessGranted] = useState(false);
  
  // Company form state
  const [companyForm, setCompanyForm] = useState({
    name: '',
    fantasia: '',
    cnpj: '',
    inscricao_estadual: '',
    phone: '',
    email: '',
    website: '',
    employee_count: '',
    address: '',
    city: '',
    state: '',
    country: 'Brasil',
    notes: '',
    setor_id: null as string | null,
    segmento_id: null as string | null,
    atividade_id: null as string | null,
    contribuinte_ipi: false,
  });
  const [customFieldsData, setCustomFieldsData] = useState<Record<string, unknown>>({});

  // Contact form state
  const [contactForm, setContactForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    mobile: '',
    job_title: '',
    department: '',
    linkedin_url: '',
    cpf: '',
    notes: '',
  });
  const [contactCustomFields, setContactCustomFields] = useState<Record<string, unknown>>({});

  // Fetch customer with dual-source fallback (CRM → ERP)
  const { data: customer, isLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: async (): Promise<UnifiedCustomer | null> => {
      if (!id) return null;

      // 1. Tentar buscar em companies (CRM)
      const { data: crmData, error: crmError } = await supabase
        .from('companies')
        .select(`
          *,
          contacts(*),
          deals(id, name, stage, value, expected_close_date, owner_id)
        `)
        .eq('id', id)
        .maybeSingle();

      if (crmData) {
        return {
          ...crmData,
          source: 'crm' as const,
        };
      }

      // 2. Se não encontrar, buscar em crm_clients (ERP)
      const { data: erpData, error: erpError } = await supabase
        .from('crm_clients')
        .select(`
          *,
          crm_client_addresses(*)
        `)
        .eq('id', id)
        .maybeSingle();

      if (erpError) throw erpError;

      if (erpData) {
        // Transformar dados do ERP para formato unificado
        const addresses = erpData.crm_client_addresses || [];
        const localAddress = addresses.find((a: any) => a.tipo === 'LOCAL') || addresses[0];

        // Montar endereço completo
        let fullAddress = '';
        if (localAddress) {
          const parts = [
            localAddress.endereco,
            localAddress.numero,
            localAddress.bairro
          ].filter(Boolean);
          fullAddress = parts.join(', ');
          if (localAddress.complemento) {
            fullAddress += ` - ${localAddress.complemento}`;
          }
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

  // Fetch proposals for this company (only for CRM customers)
  const { data: proposals } = useQuery({
    queryKey: ['customer-proposals', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proposals')
        .select('*, deals(name)')
        .eq('company_id', id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!id && customer?.source === 'crm',
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

  // Get current owner - CRM usa user_id, ERP usa profile.id
  const currentOwner = React.useMemo(() => {
    if (!customer?.owner_id || !sellers) return null;
    
    if (customer.source === 'erp') {
      // crm_clients armazena profile.id
      return sellers.find(s => s.id === customer.owner_id);
    } else {
      // companies armazena user_id (auth.users)
      return sellers.find(s => s.user_id === customer.owner_id);
    }
  }, [customer?.owner_id, customer?.source, sellers]);

  // Determinar o valor atual para o Select baseado no tipo de cliente
  const selectValue = React.useMemo(() => {
    if (!customer?.owner_id) return 'none';
    
    if (customer.source === 'erp') {
      return customer.owner_id; // crm_clients usa profile.id
    } else {
      // companies usa user_id, precisamos encontrar o profile.id correspondente
      const seller = sellers?.find(s => s.user_id === customer.owner_id);
      return seller?.id || 'none';
    }
  }, [customer?.owner_id, customer?.source, sellers]);

  // Assign owner mutation
  const assignOwnerMutation = useMutation({
    mutationFn: async (profileId: string | null) => {
      const isErp = customer?.source === 'erp';
      const tableName = isErp ? 'crm_clients' : 'companies';
      
      // Para companies: usar user_id (referencia auth.users)
      // Para crm_clients: usar profile.id
      let ownerIdToSave: string | null = null;
      if (profileId && profileId !== 'none') {
        const seller = sellers?.find(s => s.id === profileId);
        ownerIdToSave = isErp ? profileId : (seller?.user_id || null);
      }
      
      const { error } = await supabase
        .from(tableName)
        .update({ owner_id: ownerIdToSave })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer', id] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Vendedor responsável atualizado!');
    },
    onError: () => toast.error('Erro ao atualizar vendedor'),
  });

  // Update company mutation (only for CRM customers)
  const updateCompanyMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase
        .from('companies')
        .update(data)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer', id] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Cliente atualizado com sucesso!');
      setIsEditing(false);
    },
    onError: (error: any) => {
      // Check if it's a portfolio governance error (trigger block)
      const message = error?.message || '';
      if (message.includes('Este cliente pertence ao vendedor')) {
        toast.error(message, { duration: 6000 });
      } else {
        toast.error('Erro ao atualizar cliente');
      }
    },
  });

  // Create/update contact mutation (only for CRM customers)
  const saveContactMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingContact) {
        const { error } = await supabase
          .from('contacts')
          .update(data)
          .eq('id', editingContact.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('contacts')
          .insert({ ...data, company_id: id, created_by: user?.id, owner_id: user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer', id] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success(editingContact ? 'Contato atualizado!' : 'Contato adicionado!');
      resetContactForm();
    },
    onError: () => toast.error('Erro ao salvar contato'),
  });

  // Delete contact mutation
  const deleteContactMutation = useMutation({
    mutationFn: async (contactId: string) => {
      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', contactId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer', id] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Contato removido!');
    },
    onError: () => toast.error('Erro ao remover contato'),
  });

  // Mark as reviewed mutation
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

  // Helper to check if review is overdue (more than 6 months)
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
      year: 'numeric'
    });
  };

  const resetContactForm = () => {
    setContactForm({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      mobile: '',
      job_title: '',
      department: '',
      linkedin_url: '',
      cpf: '',
      notes: '',
    });
    setContactCustomFields({});
    setEditingContact(null);
    setIsContactDialogOpen(false);
  };

  const handleEditContact = (contact: Contact) => {
    setEditingContact(contact);
    setContactForm({
      first_name: contact.first_name,
      last_name: contact.last_name || '',
      email: contact.email || '',
      phone: contact.phone || '',
      mobile: contact.mobile || '',
      job_title: contact.job_title || '',
      department: contact.department || '',
      linkedin_url: contact.linkedin_url || '',
      cpf: contact.cpf ? formatCPF(contact.cpf) : '',
      notes: contact.notes || '',
    });
    setContactCustomFields((contact.custom_fields as Record<string, unknown>) || {});
    setIsContactDialogOpen(true);
  };

  const handleSaveCompany = () => {
    const cnpjLimpo = companyForm.cnpj ? cleanDocument(companyForm.cnpj) : null;
    updateCompanyMutation.mutate({
      ...companyForm,
      cnpj: cnpjLimpo,
      custom_fields: customFieldsData as Json,
    });
  };

  const handleSaveContact = (e: React.FormEvent) => {
    e.preventDefault();
    const cpfLimpo = contactForm.cpf ? cleanDocument(contactForm.cpf) : null;
    saveContactMutation.mutate({
      ...contactForm,
      cpf: cpfLimpo,
      custom_fields: contactCustomFields as Json,
    });
  };

  const handleOpenWhatsApp = (phone: string | null, contactName: string) => {
    if (!phone) {
      toast.error('Este contato não possui telefone');
      return;
    }
    navigate(`/whatsapp?phone=${encodeURIComponent(phone)}&contactName=${encodeURIComponent(contactName)}`);
  };

  // Initialize company form when data loads
  if (customer && !isEditing && companyForm.name !== customer.name) {
    setCompanyForm({
      name: customer.name || '',
      fantasia: customer.fantasia || '',
      cnpj: customer.cnpj ? formatCNPJ(customer.cnpj) : '',
      inscricao_estadual: customer.inscricao_estadual || '',
      phone: customer.phone || '',
      email: customer.email || '',
      website: customer.website || '',
      employee_count: customer.employee_count || '',
      address: customer.address || '',
      city: customer.city || '',
      state: customer.state || '',
      country: customer.country || 'Brasil',
      notes: customer.notes || '',
      setor_id: customer.setor_id || null,
      segmento_id: customer.segmento_id || null,
      atividade_id: customer.atividade_id || null,
      contribuinte_ipi: customer.contribuinte_ipi ?? false,
    });
    setCustomFieldsData((customer.custom_fields as Record<string, unknown>) || {});
  }

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
        <Button className="mt-4" onClick={() => navigate('/customers')}>
          Voltar para Clientes
        </Button>
      </div>
    );
  }

  // Access control: check if user can access this customer by sales_rep_id
  const customerSalesRepId = customer.source === 'crm' ? (customer as any).sales_rep_id : null;
  const customerSalesRep = salesReps?.find(sr => sr.id === customerSalesRepId);
  const salesRepUserLink = allUserSalesReps?.find(link => link.sales_rep_id === customerSalesRepId);
  const salesRepOwnerName = salesRepUserLink ? (profilesMap?.[salesRepUserLink.user_id] || 'Usuário') : null;
  const hasAccess = canAccessBySalesRep(customerSalesRepId);
  const requiresIntervention = needsAdminIntervention(customerSalesRepId);
  
  // Admin intervention is no longer required to VIEW customer details.
  // Intervention modal will be triggered only on specific actions (create/move deal, create/edit order).

  // Non-admin without access: block entirely
  if (!hasAccess && !isSalesRepAdmin) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/customers')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-xl font-semibold">Acesso Restrito</h2>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center space-y-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <h3 className="text-lg font-semibold">Você não tem permissão para acessar este cliente</h3>
            <p className="text-muted-foreground max-w-md">
              Este cliente pertence a um vendedor comercial que não está vinculado à sua conta.
            </p>
            <Button variant="outline" onClick={() => navigate('/customers')}>
              Voltar para Clientes
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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
          <Button variant="ghost" size="icon" onClick={() => navigate('/customers')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
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
                  <Badge variant="secondary" className="gap-1">
                    <Database className="h-3 w-3" />
                    ERP
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1">
                    <Building2 className="h-3 w-3" />
                    CRM
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {customer.cnpj && <span>{formatCNPJ(customer.cnpj)}</span>}
                {(getNomeById.atividade(customer.atividade_id || null) || customer.segmento) && (
                  <span>• {getNomeById.atividade(customer.atividade_id || null) || customer.segmento}</span>
                )}
                {customer.city && customer.state && (
                  <span>• {customer.city}/{customer.state}</span>
                )}
                {isErpCustomer && customer.regiao && (
                  <span>• {customer.regiao}</span>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Review status badge */}
          {!isErpCustomer && (
            <div className="flex items-center gap-2">
              {isReviewOverdue(customer.last_reviewed_at) ? (
                <Badge variant="destructive" className="gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Revisão pendente
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 border-green-500/50 text-green-700 bg-green-500/10">
                  <CheckCircle className="h-3 w-3" />
                  Revisado em {formatReviewDate(customer.last_reviewed_at)}
                </Badge>
              )}
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => markAsReviewedMutation.mutate()}
                disabled={markAsReviewedMutation.isPending}
                title="Marcar cadastro como revisado"
              >
                <CalendarCheck className="h-4 w-4" />
              </Button>
            </div>
          )}
          
          {!isErpCustomer && (
            isEditing ? (
              <>
                <Button variant="outline" onClick={() => setIsEditing(false)}>Cancelar</Button>
                <Button onClick={handleSaveCompany} disabled={updateCompanyMutation.isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                <Pencil className="h-4 w-4 mr-2" />
                Editar
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
            <p className="text-sm font-medium text-foreground">
              Cliente sincronizado do ERP
            </p>
            <p className="text-sm text-muted-foreground">
              Os dados deste cliente são gerenciados pelo ERP Iniflex e não podem ser editados aqui.
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="dados" className="space-y-4">
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="dados">Dados</TabsTrigger>
          <TabsTrigger value="contatos" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Contatos
            {contacts.length > 0 && (
              <Badge variant="secondary" className="h-5 min-w-5">{contacts.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="negocios" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Negócios
            {deals.length > 0 && (
              <Badge variant="secondary" className="h-5 min-w-5">{deals.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="pedidos" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Pedidos
          </TabsTrigger>
          <TabsTrigger value="credito" className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            Crédito
          </TabsTrigger>
          <TabsTrigger value="historico" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Histórico
          </TabsTrigger>
          <TabsTrigger value="notas" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Notas
          </TabsTrigger>
        </TabsList>

        {/* Tab: Dados */}
        <TabsContent value="dados">
          <Card>
            <CardHeader>
              <CardTitle>Informações do Cliente</CardTitle>
              <CardDescription>
                {isErpCustomer 
                  ? 'Dados sincronizados do ERP Iniflex (somente leitura)' 
                  : 'Dados cadastrais e informações de contato'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="name">Razão Social</Label>
                  <Input
                    id="name"
                    value={companyForm.name}
                    onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                    disabled={!isEditing || isErpCustomer}
                  />
                </div>
                <div>
                  <Label htmlFor="fantasia">Nome Fantasia</Label>
                  <Input
                    id="fantasia"
                    value={companyForm.fantasia}
                    onChange={(e) => setCompanyForm({ ...companyForm, fantasia: e.target.value })}
                    disabled={!isEditing || isErpCustomer}
                  />
                </div>
                <div>
                  <Label htmlFor="cnpj">CNPJ/CPF</Label>
                  <Input
                    id="cnpj"
                    value={companyForm.cnpj}
                    onChange={(e) => setCompanyForm({ ...companyForm, cnpj: formatCNPJ(e.target.value) })}
                    disabled={!isEditing || isErpCustomer}
                    maxLength={18}
                  />
                </div>
                <div>
                  <Label htmlFor="inscricao_estadual">Inscrição Estadual</Label>
                  <Input
                    id="inscricao_estadual"
                    value={companyForm.inscricao_estadual}
                    onChange={(e) => setCompanyForm({ ...companyForm, inscricao_estadual: e.target.value })}
                    disabled={!isEditing || isErpCustomer}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label htmlFor="contribuinte_ipi" className="text-sm font-medium">Contribuinte de IPI</Label>
                    <p className="text-xs text-muted-foreground">Define se o cliente é contribuinte do IPI</p>
                  </div>
                  <Switch
                    id="contribuinte_ipi"
                    checked={companyForm.contribuinte_ipi}
                    onCheckedChange={(checked) => setCompanyForm({ ...companyForm, contribuinte_ipi: checked })}
                    disabled={!isEditing || isErpCustomer}
                  />
                </div>
                <div className="col-span-2">
                  {isErpCustomer ? (
                    <>
                      <Label>Segmento (ERP)</Label>
                      <Input value={customer.segmento || ''} disabled />
                    </>
                  ) : (
                    <ClassificacaoCascade
                      setorId={companyForm.setor_id}
                      segmentoId={companyForm.segmento_id}
                      atividadeId={companyForm.atividade_id}
                      onSetorChange={(v) => {
                        const setorNome = v ? setores.find(s => s.id === v)?.nome : null;
                        const isIndustria = setorNome?.toLowerCase() === 'indústria';
                        setCompanyForm(prev => ({ ...prev, setor_id: v, segmento_id: null, atividade_id: null, contribuinte_ipi: isIndustria ? true : prev.contribuinte_ipi }));
                      }}
                      onSegmentoChange={(v) => setCompanyForm(prev => ({ ...prev, segmento_id: v, atividade_id: null }))}
                      onAtividadeChange={(v) => setCompanyForm(prev => ({ ...prev, atividade_id: v }))}
                      disabled={!isEditing}
                    />
                  )}
                </div>
                {!isErpCustomer && (
                  <div>
                    <Label htmlFor="employee_count">Funcionários</Label>
                    <Select 
                      value={companyForm.employee_count} 
                      onValueChange={(v) => setCompanyForm({ ...companyForm, employee_count: v })}
                      disabled={!isEditing}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {employeeCounts.map((e) => (
                          <SelectItem key={e} value={e}>{e}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {isErpCustomer && customer.regiao && (
                  <div>
                    <Label>Região</Label>
                    <Input value={customer.regiao} disabled />
                  </div>
                )}
                {isErpCustomer && customer.tipo_pessoa && (
                  <div>
                    <Label>Tipo de Pessoa</Label>
                    <Input value={customer.tipo_pessoa === 'J' ? 'Jurídica' : 'Física'} disabled />
                  </div>
                )}
                <div>
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={companyForm.phone}
                    onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })}
                    disabled={!isEditing || isErpCustomer}
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={companyForm.email}
                    onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })}
                    disabled={!isEditing || isErpCustomer}
                  />
                </div>
                {!isErpCustomer && (
                  <div>
                    <Label htmlFor="website">Website</Label>
                    <Input
                      id="website"
                      value={companyForm.website}
                      onChange={(e) => setCompanyForm({ ...companyForm, website: e.target.value })}
                      disabled={!isEditing}
                    />
                  </div>
                )}
                <div className="col-span-2">
                  <Label htmlFor="address">Endereço</Label>
                  <Input
                    id="address"
                    value={companyForm.address}
                    onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
                    disabled={!isEditing || isErpCustomer}
                  />
                </div>
                <div>
                  <Label htmlFor="city">Cidade</Label>
                  <Input
                    id="city"
                    value={companyForm.city}
                    onChange={(e) => setCompanyForm({ ...companyForm, city: e.target.value })}
                    disabled={!isEditing || isErpCustomer}
                  />
                </div>
                <div>
                  <Label htmlFor="state">Estado</Label>
                  <Input
                    id="state"
                    value={companyForm.state}
                    onChange={(e) => setCompanyForm({ ...companyForm, state: e.target.value })}
                    disabled={!isEditing || isErpCustomer}
                  />
                </div>
                {!isErpCustomer && (
                  <div className="col-span-2">
                    <Label htmlFor="notes">Observações</Label>
                    <Textarea
                      id="notes"
                      value={companyForm.notes}
                      onChange={(e) => setCompanyForm({ ...companyForm, notes: e.target.value })}
                      disabled={!isEditing}
                      rows={3}
                    />
                  </div>
                )}
                {isEditing && !isErpCustomer && (
                  <CustomFieldsRenderer
                    entity="company"
                    values={customFieldsData}
                    onChange={setCustomFieldsData}
                  />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Sales Rep info */}
          {(() => {
            const salesRepId = (customer as any)?.sales_rep_id;
            const salesRep = salesRepId ? salesReps?.find(r => r.id === salesRepId) : null;
            return (
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="h-5 w-5" />
                    Vendedor Comercial
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {salesRep ? (
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                        {salesRep.name[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium">{salesRep.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {salesRep.type === 'representante' ? 'Representante' : 'Interno'}
                          {salesRep.phone && ` • ${salesRep.phone}`}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhum vendedor comercial vinculado</p>
                  )}
                  {isAdmin && isEditing && (
                    <div className="mt-3">
                      <Select
                        value={salesRepId || ''}
                        onValueChange={async (v) => {
                          const { error } = await supabase
                            .from('companies')
                            .update({ sales_rep_id: v || null })
                            .eq('id', id);
                          if (error) { toast.error('Erro ao atualizar'); return; }
                          queryClient.invalidateQueries({ queryKey: ['customer', id] });
                          toast.success('Vendedor comercial atualizado!');
                        }}
                      >
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {salesReps?.filter(r => r.active).map(r => (
                            <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })()}

          {/* Default Carrier */}
          {!isErpCustomer && (
            <DefaultCarrierCard 
              companyId={id!} 
              defaultCarrierId={(customer as any)?.default_carrier_id}
              defaultFreightType={(customer as any)?.default_freight_type}
              isEditing={isEditing} 
            />
          )}

          {/* Admin: Assign user */}
          {isAdmin && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Usuário
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="w-[300px]">
                    <SearchableSelect
                      options={(sellers || []).map(s => ({ value: s.id, label: s.full_name }))}
                      value={selectValue === 'none' ? null : selectValue}
                      onChange={(v) => {
                        const newProfileId = v || null;
                        if (currentOwner && currentOwner.user_id !== user?.id) {
                          setPendingOwnerChange(newProfileId);
                          setShowOwnerInterventionModal(true);
                        } else {
                          assignOwnerMutation.mutate(newProfileId);
                        }
                      }}
                      placeholder="Selecione um usuário"
                      searchPlaceholder="Buscar usuário..."
                      disabled={assignOwnerMutation.isPending}
                    />
                  </div>
                  {currentOwner && (
                    <span className="text-sm text-muted-foreground">
                      Atual: <span className="font-medium">{currentOwner.full_name}</span>
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Modal de justificativa para alteração de usuário */}
          <AdminInterventionModal
            open={showOwnerInterventionModal}
            onOpenChange={(open) => {
              setShowOwnerInterventionModal(open);
              if (!open) setPendingOwnerChange(null);
            }}
            clientName={customer?.fantasia || customer?.name || 'Cliente'}
            clientOwnerName={currentOwner?.full_name || 'Vendedor atual'}
            actionDescription={`alterar o vendedor responsável de "${currentOwner?.full_name || 'atual'}" para "${
              pendingOwnerChange 
                ? sellers?.find(s => s.id === pendingOwnerChange)?.full_name || 'Nenhum' 
                : 'Nenhum'
            }"`}
            onConfirm={async (justification) => {
              try {
                // Registrar intervenção administrativa
                await logIntervention({
                  actionType: 'CHANGE_OWNER',
                  entityType: 'company',
                  entityId: id || '',
                  entityName: customer?.name,
                  clientId: id,
                  clientName: customer?.name,
                  clientOwnerId: currentOwner?.user_id,
                  clientOwnerName: currentOwner?.full_name,
                  justification,
                  details: {
                    previousOwnerId: currentOwner?.user_id,
                    previousOwnerName: currentOwner?.full_name,
                    newOwnerId: pendingOwnerChange ? sellers?.find(s => s.id === pendingOwnerChange)?.user_id : null,
                    newOwnerName: pendingOwnerChange ? sellers?.find(s => s.id === pendingOwnerChange)?.full_name : null,
                    source: customer?.source,
                  }
                });
                
                // Executar a alteração
                await assignOwnerMutation.mutateAsync(pendingOwnerChange);
                setShowOwnerInterventionModal(false);
                setPendingOwnerChange(null);
              } catch (error) {
                toast.error('Erro ao registrar intervenção');
              }
            }}
            isLoading={assignOwnerMutation.isPending}
          />
        </TabsContent>

        {/* Tab: Contatos */}
        <TabsContent value="contatos">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Contatos</CardTitle>
                  <CardDescription>
                    {isErpCustomer 
                      ? 'Contatos não disponíveis para clientes sincronizados do ERP' 
                      : 'Pessoas de contato vinculadas a este cliente'
                    }
                  </CardDescription>
                </div>
                {!isErpCustomer && (
                  <Dialog open={isContactDialogOpen} onOpenChange={(open) => { 
                    setIsContactDialogOpen(open); 
                    if (!open) resetContactForm(); 
                  }}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="gap-2">
                        <Plus className="h-4 w-4" />
                        Novo Contato
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle>{editingContact ? 'Editar Contato' : 'Novo Contato'}</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleSaveContact} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="contact_first_name">Nome *</Label>
                            <Input
                              id="contact_first_name"
                              value={contactForm.first_name}
                              onChange={(e) => setContactForm({ ...contactForm, first_name: e.target.value })}
                              required
                            />
                          </div>
                          <div>
                            <Label htmlFor="contact_last_name">Sobrenome</Label>
                            <Input
                              id="contact_last_name"
                              value={contactForm.last_name}
                              onChange={(e) => setContactForm({ ...contactForm, last_name: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label htmlFor="contact_cpf">CPF</Label>
                            <Input
                              id="contact_cpf"
                              value={contactForm.cpf}
                              onChange={(e) => setContactForm({ ...contactForm, cpf: formatCPF(e.target.value) })}
                              maxLength={14}
                            />
                          </div>
                          <div>
                            <Label htmlFor="contact_job_title">Cargo</Label>
                            <Input
                              id="contact_job_title"
                              value={contactForm.job_title}
                              onChange={(e) => setContactForm({ ...contactForm, job_title: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label htmlFor="contact_email">Email</Label>
                            <Input
                              id="contact_email"
                              type="email"
                              value={contactForm.email}
                              onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label htmlFor="contact_mobile">Celular</Label>
                            <Input
                              id="contact_mobile"
                              value={contactForm.mobile}
                              onChange={(e) => setContactForm({ ...contactForm, mobile: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label htmlFor="contact_phone">Telefone</Label>
                            <Input
                              id="contact_phone"
                              value={contactForm.phone}
                              onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label htmlFor="contact_department">Departamento</Label>
                            <Input
                              id="contact_department"
                              value={contactForm.department}
                              onChange={(e) => setContactForm({ ...contactForm, department: e.target.value })}
                            />
                          </div>
                          <div className="col-span-2">
                            <Label htmlFor="contact_linkedin">LinkedIn</Label>
                            <Input
                              id="contact_linkedin"
                              value={contactForm.linkedin_url}
                              onChange={(e) => setContactForm({ ...contactForm, linkedin_url: e.target.value })}
                              placeholder="https://linkedin.com/in/..."
                            />
                          </div>
                          <div className="col-span-2">
                            <Label htmlFor="contact_notes">Observações</Label>
                            <Textarea
                              id="contact_notes"
                              value={contactForm.notes}
                              onChange={(e) => setContactForm({ ...contactForm, notes: e.target.value })}
                              rows={2}
                            />
                          </div>
                          <CustomFieldsRenderer
                            entity="contact"
                            values={contactCustomFields}
                            onChange={setContactCustomFields}
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button type="button" variant="outline" onClick={resetContactForm}>
                            Cancelar
                          </Button>
                          <Button type="submit" disabled={saveContactMutation.isPending}>
                            {editingContact ? 'Atualizar' : 'Adicionar'}
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isErpCustomer ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Database className="h-12 w-12 text-muted-foreground/50" />
                  <h3 className="mt-4 text-lg font-semibold">Contatos não disponíveis</h3>
                  <p className="text-muted-foreground max-w-md">
                    Os contatos de clientes sincronizados do ERP são gerenciados diretamente no sistema de origem.
                  </p>
                </div>
              ) : contacts.length === 0 && customer.contact_name ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
                    <div className="flex items-center gap-4">
                      <Avatar>
                        <AvatarFallback>
                          {customer.contact_name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{customer.contact_name}</p>
                          <Badge variant="outline" className="text-xs">Importado</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Contato importado do arquivo. Clique em "+ Novo Contato" para cadastrar com mais detalhes.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : contacts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Users className="h-12 w-12 text-muted-foreground/50" />
                  <h3 className="mt-4 text-lg font-semibold">Nenhum contato</h3>
                  <p className="text-muted-foreground">Adicione o primeiro contato deste cliente.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {contacts.map((contact: Contact, index: number) => (
                    <div 
                      key={contact.id} 
                      className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-4">
                        <Avatar>
                          <AvatarFallback>
                            {contact.first_name[0]}{contact.last_name?.[0] || ''}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">
                              {contact.first_name} {contact.last_name}
                            </p>
                            {index === 0 && (
                              <Badge variant="default" className="text-xs">Principal</Badge>
                            )}
                          </div>
                          {contact.job_title && (
                            <p className="text-sm text-muted-foreground">{contact.job_title}</p>
                          )}
                          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                            {contact.email && (
                              <span className="flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {contact.email}
                              </span>
                            )}
                            {contact.mobile && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {contact.mobile}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenWhatsApp(contact.mobile, `${contact.first_name} ${contact.last_name || ''}`)}
                          disabled={!contact.mobile}
                          title="WhatsApp"
                        >
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                        {contact.linkedin_url && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => window.open(contact.linkedin_url!, '_blank')}
                            title="LinkedIn"
                          >
                            <Linkedin className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditContact(contact)}
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm('Remover este contato?')) {
                              deleteContactMutation.mutate(contact.id);
                            }
                          }}
                          title="Remover"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Negócios */}
        <TabsContent value="negocios">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Negócios</CardTitle>
                  <CardDescription>
                    {isErpCustomer 
                      ? 'Para criar negócios com este cliente, primeiro importe-o para o CRM' 
                      : 'Oportunidades e negociações com este cliente'
                    }
                  </CardDescription>
                </div>
                {!isErpCustomer && (
                  <Button size="sm" className="gap-2" onClick={() => navigate(`/pipeline?newDeal=${id}`)}>
                    <Plus className="h-4 w-4" />
                    Novo Negócio
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isErpCustomer ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Database className="h-12 w-12 text-muted-foreground/50" />
                  <h3 className="mt-4 text-lg font-semibold">Negócios não disponíveis</h3>
                  <p className="text-muted-foreground max-w-md">
                    Este cliente é sincronizado do ERP. Para criar negócios, primeiro importe-o para o CRM na tela de Integrações.
                  </p>
                </div>
              ) : deals.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <TrendingUp className="h-12 w-12 text-muted-foreground/50" />
                  <h3 className="mt-4 text-lg font-semibold">Nenhum negócio</h3>
                  <p className="text-muted-foreground">Crie o primeiro negócio com este cliente.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Negócio</TableHead>
                      <TableHead>Etapa</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Previsão</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deals.map((deal: any) => (
                      <TableRow 
                        key={deal.id} 
                        className="cursor-pointer"
                        onClick={() => navigate(`/pipeline?deal=${deal.id}`)}
                      >
                        <TableCell className="font-medium">{deal.name}</TableCell>
                        <TableCell>
                          <DealStageBadges deals={[deal]} />
                        </TableCell>
                        <TableCell>
                          {deal.value 
                            ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(deal.value)
                            : '-'
                          }
                        </TableCell>
                        <TableCell>
                          {deal.expected_close_date 
                            ? new Date(deal.expected_close_date).toLocaleDateString('pt-BR')
                            : '-'
                          }
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

        </TabsContent>

        {/* Tab: Pedidos */}
        <TabsContent value="pedidos">
          <CustomerOrdersTab 
            companyId={id!}
            source={customer?.source || 'crm'}
            cnpj={customer?.cnpj || null}
          />
        </TabsContent>

        {/* Tab: Crédito */}
        <TabsContent value="credito">
          <CreditAnalysisTab 
            companyId={id!} 
            companyName={customer?.fantasia || customer?.name || 'Cliente'}
            cnpj={customer?.cnpj || null}
          />
        </TabsContent>


        {/* Tab: Histórico (Auditoria) */}
        <TabsContent value="historico">
          <CompanyAuditHistory companyId={id!} isErpCustomer={isErpCustomer} />
        </TabsContent>

        {/* Tab: Notas */}
        <TabsContent value="notas">
          <Card>
            <CardHeader>
              <CardTitle>Notas</CardTitle>
              <CardDescription>
                {isErpCustomer 
                  ? 'Notas não disponíveis para clientes do ERP' 
                  : 'Anotações e observações sobre este cliente'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isErpCustomer ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground/50" />
                  <h3 className="mt-4 text-lg font-semibold">Notas não disponíveis</h3>
                  <p className="text-muted-foreground max-w-md">
                    As notas não estão disponíveis para clientes sincronizados do ERP.
                  </p>
                </div>
              ) : (
                <QuickNotes entityType="company" entityId={id!} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Subcomponent: Default Carrier & Freight
function DefaultCarrierCard({ companyId, defaultCarrierId, defaultFreightType, isEditing }: { companyId: string; defaultCarrierId?: string | null; defaultFreightType?: string | null; isEditing: boolean }) {
  const queryClient = useQueryClient();
  const [carrierSearch, setCarrierSearch] = useState('');

  const { data: carriers } = useQuery({
    queryKey: ['carriers-for-default', carrierSearch],
    queryFn: async () => {
      let query = supabase.from('carriers').select('id, name, trade_name').eq('active', true).order('name').limit(50);
      if (carrierSearch) query = query.ilike('name', `%${carrierSearch}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Ensure current carrier is in the list
  const { data: currentCarrier } = useQuery({
    queryKey: ['carrier-current', defaultCarrierId],
    queryFn: async () => {
      if (!defaultCarrierId) return null;
      const { data, error } = await supabase.from('carriers').select('id, name, trade_name').eq('id', defaultCarrierId).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!defaultCarrierId,
  });

  const carrierOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; trade_name: string | null }>();
    if (currentCarrier) map.set(currentCarrier.id, currentCarrier);
    (carriers || []).forEach(c => map.set(c.id, c));
    return Array.from(map.values()).map(c => ({ value: c.id, label: c.trade_name ? `${c.trade_name} (${c.name})` : c.name }));
  }, [carriers, currentCarrier]);

  const updateCarrierMutation = useMutation({
    mutationFn: async (carrierId: string | null) => {
      const { error } = await supabase.from('companies').update({ default_carrier_id: carrierId }).eq('id', companyId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer', companyId] });
      toast.success('Transportadora padrão atualizada!');
    },
    onError: () => toast.error('Erro ao atualizar transportadora padrão'),
  });

  const updateFreightMutation = useMutation({
    mutationFn: async (freightType: string | null) => {
      const { error } = await supabase.from('companies').update({ default_freight_type: freightType } as any).eq('id', companyId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer', companyId] });
      toast.success('Tipo de frete padrão atualizado!');
    },
    onError: () => toast.error('Erro ao atualizar tipo de frete padrão'),
  });

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Truck className="h-5 w-5" />
          Logística Padrão
        </CardTitle>
        <CardDescription>
          Transportadora e frete pré-selecionados em novas propostas e pedidos
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Transportadora</Label>
            <SearchableSelect
              options={carrierOptions}
              value={defaultCarrierId || null}
              onChange={(v) => updateCarrierMutation.mutate(v || null)}
              placeholder="Selecione uma transportadora"
              searchPlaceholder="Buscar transportadora..."
              disabled={!isEditing}
              onSearchChange={setCarrierSearch}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Tipo de Frete</Label>
            <Select value={defaultFreightType || ''} onValueChange={(v) => updateFreightMutation.mutate(v || null)} disabled={!isEditing}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo de frete padrão" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CIF">CIF — Frete por conta do vendedor</SelectItem>
                <SelectItem value="FOB">FOB — Frete por conta do cliente</SelectItem>
                <SelectItem value="REDESPACHO">Redespacho</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
