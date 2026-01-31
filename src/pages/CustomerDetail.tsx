import { useState } from 'react';
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
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
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
  Users
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { formatCNPJ, formatCPF, cleanDocument } from '@/lib/cpfCnpjMask';
import { CustomFieldsRenderer } from '@/components/CustomFieldsRenderer';
import { ActivityTimeline } from '@/components/timeline/ActivityTimeline';
import { QuickNotes } from '@/components/notes/QuickNotes';
import { DealStageBadges } from '@/components/DealStageBadges';
import type { Json } from '@/integrations/supabase/types';

const industries = [
  'Tecnologia', 'Saúde', 'Finanças', 'Educação', 'Varejo', 
  'Manufatura', 'Serviços', 'Construção', 'Logística', 'Outros'
];

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

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  
  // Company form state
  const [companyForm, setCompanyForm] = useState({
    name: '',
    fantasia: '',
    cnpj: '',
    inscricao_estadual: '',
    phone: '',
    email: '',
    website: '',
    industry: '',
    employee_count: '',
    address: '',
    city: '',
    state: '',
    country: 'Brasil',
    notes: '',
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

  // Fetch company with contacts and deals
  const { data: customer, isLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select(`
          *,
          contacts(*),
          deals(id, name, stage, value, expected_close_date, owner_id)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch proposals for this company
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
    enabled: !!id,
  });

  // Update company mutation
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
    onError: () => toast.error('Erro ao atualizar cliente'),
  });

  // Create/update contact mutation
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
      industry: customer.industry || '',
      employee_count: customer.employee_count || '',
      address: customer.address || '',
      city: customer.city || '',
      state: customer.state || '',
      country: customer.country || 'Brasil',
      notes: customer.notes || '',
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
              <h1 className="text-2xl font-bold text-foreground">{displayName}</h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {customer.cnpj && <span>{formatCNPJ(customer.cnpj)}</span>}
                {customer.industry && <span>• {customer.industry}</span>}
                {customer.city && customer.state && (
                  <span>• {customer.city}/{customer.state}</span>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {isEditing ? (
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
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="dados" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
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
          <TabsTrigger value="timeline" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Timeline
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
              <CardDescription>Dados cadastrais e informações de contato</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="name">Razão Social</Label>
                  <Input
                    id="name"
                    value={companyForm.name}
                    onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                    disabled={!isEditing}
                  />
                </div>
                <div>
                  <Label htmlFor="fantasia">Nome Fantasia</Label>
                  <Input
                    id="fantasia"
                    value={companyForm.fantasia}
                    onChange={(e) => setCompanyForm({ ...companyForm, fantasia: e.target.value })}
                    disabled={!isEditing}
                  />
                </div>
                <div>
                  <Label htmlFor="cnpj">CNPJ</Label>
                  <Input
                    id="cnpj"
                    value={companyForm.cnpj}
                    onChange={(e) => setCompanyForm({ ...companyForm, cnpj: formatCNPJ(e.target.value) })}
                    disabled={!isEditing}
                    maxLength={18}
                  />
                </div>
                <div>
                  <Label htmlFor="inscricao_estadual">Inscrição Estadual</Label>
                  <Input
                    id="inscricao_estadual"
                    value={companyForm.inscricao_estadual}
                    onChange={(e) => setCompanyForm({ ...companyForm, inscricao_estadual: e.target.value })}
                    disabled={!isEditing}
                  />
                </div>
                <div>
                  <Label htmlFor="industry">Setor</Label>
                  <Select 
                    value={companyForm.industry} 
                    onValueChange={(v) => setCompanyForm({ ...companyForm, industry: v })}
                    disabled={!isEditing}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {industries.map((i) => (
                        <SelectItem key={i} value={i}>{i}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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
                <div>
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={companyForm.phone}
                    onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })}
                    disabled={!isEditing}
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={companyForm.email}
                    onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })}
                    disabled={!isEditing}
                  />
                </div>
                <div>
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    value={companyForm.website}
                    onChange={(e) => setCompanyForm({ ...companyForm, website: e.target.value })}
                    disabled={!isEditing}
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="address">Endereço</Label>
                  <Input
                    id="address"
                    value={companyForm.address}
                    onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
                    disabled={!isEditing}
                  />
                </div>
                <div>
                  <Label htmlFor="city">Cidade</Label>
                  <Input
                    id="city"
                    value={companyForm.city}
                    onChange={(e) => setCompanyForm({ ...companyForm, city: e.target.value })}
                    disabled={!isEditing}
                  />
                </div>
                <div>
                  <Label htmlFor="state">Estado</Label>
                  <Input
                    id="state"
                    value={companyForm.state}
                    onChange={(e) => setCompanyForm({ ...companyForm, state: e.target.value })}
                    disabled={!isEditing}
                  />
                </div>
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
                {isEditing && (
                  <CustomFieldsRenderer
                    entity="company"
                    values={customFieldsData}
                    onChange={setCustomFieldsData}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Contatos */}
        <TabsContent value="contatos">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Contatos</CardTitle>
                  <CardDescription>Pessoas de contato vinculadas a este cliente</CardDescription>
                </div>
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
              </div>
            </CardHeader>
            <CardContent>
              {contacts.length === 0 ? (
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
                  <CardDescription>Oportunidades e negociações com este cliente</CardDescription>
                </div>
                <Button size="sm" className="gap-2" onClick={() => navigate(`/pipeline?company=${id}`)}>
                  <Plus className="h-4 w-4" />
                  Novo Negócio
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {deals.length === 0 ? (
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

        {/* Tab: Timeline */}
        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
              <CardDescription>Histórico de atividades e interações</CardDescription>
            </CardHeader>
            <CardContent>
              <ActivityTimeline entityType="company" entityId={id!} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Notas */}
        <TabsContent value="notas">
          <Card>
            <CardHeader>
              <CardTitle>Notas</CardTitle>
              <CardDescription>Anotações e observações sobre este cliente</CardDescription>
            </CardHeader>
            <CardContent>
              <QuickNotes entityType="company" entityId={id!} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
