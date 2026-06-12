import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Search, Users, Pencil, Trash2, Phone, Mail, Linkedin, Building2, RefreshCw, CheckCircle2, Clock, TrendingUp, MessageCircle, DollarSign } from 'lucide-react';
import { DealStageBadges } from '@/components/DealStageBadges';
import { PricingTableBadge } from '@/components/pricing/PricingTableBadge';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { CustomFieldsRenderer } from '@/components/CustomFieldsRenderer';
import { formatCPF, cleanDocument } from '@/lib/cpfCnpjMask';
import type { Tables, TablesInsert, Json } from '@/integrations/supabase/types';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { ServerPagination } from '@/components/ui/server-pagination';

const CONTACT_LIST_COLUMNS = `
  id, first_name, last_name, email, phone, mobile, job_title, department,
  linkedin_url, company_id, notes, cpf, tipo_pessoa, iniflex_id,
  iniflex_synced_at, custom_fields, owner_id, sales_rep_id, created_by,
  created_at, updated_at,
  companies(name),
  deals(id, name, stage, value)
`;

type Contact = Tables<'contacts'>;
type Company = Tables<'companies'>;

export default function Contacts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [formData, setFormData] = useState<Partial<TablesInsert<'contacts'>> & { cpf?: string; tipo_pessoa?: 'PF' | 'PJ' }>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    mobile: '',
    job_title: '',
    department: '',
    linkedin_url: '',
    company_id: null,
    notes: '',
    cpf: '',
    tipo_pessoa: 'PF',
  });
  const [customFieldsData, setCustomFieldsData] = useState<Record<string, unknown>>({});

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, pageSize]);

  const { data: contactsPage, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['contacts', debouncedSearch, page, pageSize],
    queryFn: async () => {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('contacts')
        .select(CONTACT_LIST_COLUMNS, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (debouncedSearch) {
        const term = debouncedSearch.trim();
        const cpfDigits = term.replace(/\D/g, '');
        const ors: string[] = [
          `first_name.ilike.%${term}%`,
          `last_name.ilike.%${term}%`,
          `email.ilike.%${term}%`,
        ];
        if (cpfDigits.length >= 3) ors.push(`cpf.ilike.%${cpfDigits}%`);
        query = query.or(ors.join(','));
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { rows: data ?? [], count: count ?? 0 };
    },
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });

  const contacts = contactsPage?.rows as any[] | undefined;
  const totalContacts = contactsPage?.count ?? 0;

  const handleRefresh = async () => {
    await refetch();
    toast.success('Dados atualizados!');
  };

  const [companySearchTerm, setCompanySearchTerm] = useState('');
  const { data: companies } = useQuery({
    queryKey: ['companies-search-contacts', companySearchTerm],
    queryFn: async () => {
      let query = supabase.from('companies').select('id, name').order('name').limit(50);
      if (companySearchTerm) {
        query = query.or(`name.ilike.%${companySearchTerm}%,fantasia.ilike.%${companySearchTerm}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as Pick<Company, 'id' | 'name'>[];
    },
    staleTime: 5 * 60_000,
  });

  const createMutation = useMutation({
    mutationFn: async (data: TablesInsert<'contacts'>) => {
      const { data: created, error } = await supabase.from('contacts').insert(data).select(CONTACT_LIST_COLUMNS).single();
      if (error) throw error;
      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Contato criado com sucesso!');
      resetForm();
    },
    onError: () => toast.error('Erro ao criar contato'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Contact> & { id: string }) => {
      const { data: updated, error } = await supabase.from('contacts').update(data).eq('id', id).select(CONTACT_LIST_COLUMNS).single();
      if (error) throw error;
      return { id, updated };
    },
    onSuccess: ({ id, updated }) => {
      queryClient.setQueriesData<{ rows: any[]; count: number } | undefined>(
        { queryKey: ['contacts'] },
        (old) => old ? { ...old, rows: old.rows.map((c) => c.id === id ? updated : c) } : old,
      );
      toast.success('Contato atualizado com sucesso!');
      resetForm();
    },
    onError: () => toast.error('Erro ao atualizar contato'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('contacts').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Contato excluído com sucesso!');
    },
    onError: () => toast.error('Erro ao excluir contato'),
  });


  const syncInflexMutation = useMutation({
    mutationFn: async (contactId: string) => {
      const { data, error } = await supabase.functions.invoke('iniflex-sync-contact', {
        body: { contact_id: contactId },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Erro ao sincronizar');
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success(`Sincronizado com Iniflex! ID: ${data.iniflex_id}`);
    },
    onError: (error: any) => toast.error(`Erro ao sincronizar: ${error.message}`),
  });

  const resetForm = () => {
    setFormData({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      mobile: '',
      job_title: '',
      department: '',
      linkedin_url: '',
      company_id: null,
      notes: '',
      cpf: '',
      tipo_pessoa: 'PF',
    });
    setCustomFieldsData({});
    setEditingContact(null);
    setIsDialogOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cpfLimpo = formData.cpf ? cleanDocument(formData.cpf) : null;
    const dataWithCustomFields = {
      ...formData,
      cpf: cpfLimpo,
      custom_fields: customFieldsData as Json,
    };
    if (editingContact) {
      updateMutation.mutate({ id: editingContact.id, ...dataWithCustomFields } as any);
    } else {
      createMutation.mutate({
        ...dataWithCustomFields,
        first_name: formData.first_name || '',
        created_by: user?.id,
        owner_id: user?.id,
      } as any);
    }
  };

  const handleEdit = (contact: Contact) => {
    setEditingContact(contact);
    setFormData({
      first_name: contact.first_name,
      last_name: contact.last_name || '',
      email: contact.email || '',
      phone: contact.phone || '',
      mobile: contact.mobile || '',
      job_title: contact.job_title || '',
      department: contact.department || '',
      linkedin_url: contact.linkedin_url || '',
      company_id: contact.company_id,
      notes: contact.notes || '',
      cpf: (contact as any).cpf ? formatCPF((contact as any).cpf) : '',
      tipo_pessoa: (contact as any).tipo_pessoa || 'PF',
    });
    setCustomFieldsData((contact.custom_fields as Record<string, unknown>) || {});
    setIsDialogOpen(true);
  };

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCPF(e.target.value);
    setFormData({ ...formData, cpf: formatted });
  };

  // Server-side filtered + paginated; alias kept for minimal JSX churn.
  const filteredContacts = contacts;


  const getInitials = (firstName: string, lastName?: string | null) => {
    return `${firstName[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  };

  const getSyncStatus = (contact: any) => {
    if (contact.iniflex_id) {
      return {
        synced: true,
        date: contact.iniflex_synced_at ? new Date(contact.iniflex_synced_at).toLocaleDateString('pt-BR') : null,
      };
    }
    return { synced: false, date: null };
  };

  const handleOpenWhatsApp = (contact: Contact) => {
    const phone = contact.mobile || contact.phone;
    if (!phone) {
      toast.error('Este contato não possui telefone cadastrado');
      return;
    }
    navigate(`/whatsapp?phone=${encodeURIComponent(phone)}&contactId=${contact.id}&contactName=${encodeURIComponent(contact.first_name + (contact.last_name ? ' ' + contact.last_name : ''))}`);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">Contatos</h1>
          <p className="text-sm text-muted-foreground">Gerencie seus contatos e leads</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2 self-start sm:self-auto" size="sm">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Novo Contato</span>
              <span className="sm:hidden">Novo</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingContact ? 'Editar Contato' : 'Novo Contato'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="first_name">Nome *</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="last_name">Sobrenome</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name || ''}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="cpf">CPF</Label>
                  <Input
                    id="cpf"
                    value={formData.cpf || ''}
                    onChange={handleCpfChange}
                    placeholder="000.000.000-00"
                    maxLength={14}
                  />
                </div>
                <div>
                  <Label htmlFor="tipo_pessoa">Tipo de Pessoa</Label>
                  <Select 
                    value={formData.tipo_pessoa || 'PF'} 
                    onValueChange={(v) => setFormData({ ...formData, tipo_pessoa: v as 'PF' | 'PJ' })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PF">Pessoa Física</SelectItem>
                      <SelectItem value="PJ">Pessoa Jurídica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="mobile">Celular</Label>
                  <Input
                    id="mobile"
                    value={formData.mobile || ''}
                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="company_id">Empresa</Label>
                  <SearchableSelect
                    options={(companies || []).map(c => ({ value: c.id, label: c.name }))}
                    value={formData.company_id || null}
                    onChange={(v) => setFormData({ ...formData, company_id: v })}
                    placeholder="Selecione"
                    searchPlaceholder="Buscar empresa..."
                    onSearchChange={setCompanySearchTerm}
                  />
                </div>
                <div>
                  <Label htmlFor="job_title">Cargo</Label>
                  <Input
                    id="job_title"
                    value={formData.job_title || ''}
                    onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="department">Departamento</Label>
                  <Input
                    id="department"
                    value={formData.department || ''}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="linkedin_url">LinkedIn</Label>
                  <Input
                    id="linkedin_url"
                    value={formData.linkedin_url || ''}
                    onChange={(e) => setFormData({ ...formData, linkedin_url: e.target.value })}
                    placeholder="https://linkedin.com/in/..."
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
                <CustomFieldsRenderer
                  entity="contact"
                  values={customFieldsData}
                  onChange={setCustomFieldsData}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingContact ? 'Atualizar' : 'Criar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-border-subtle shadow-[var(--shadow-sm)] overflow-hidden">
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar contatos..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isFetching}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : filteredContacts?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Users className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">Nenhum contato encontrado</h3>
              <p className="text-muted-foreground">Comece adicionando seu primeiro contato.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contato</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-3.5 w-3.5" />
                      Funil
                    </div>
                  </TableHead>
                  <TableHead>
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-3.5 w-3.5" />
                      Tabela Preços
                    </div>
                  </TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Iniflex</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContacts?.map((contact) => {
                  const syncStatus = getSyncStatus(contact);
                  return (
                    <TableRow key={contact.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {getInitials(contact.first_name, contact.last_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{contact.first_name} {contact.last_name}</p>
                            {contact.linkedin_url && (
                              <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
                                <Linkedin className="h-3 w-3" />
                                LinkedIn
                              </a>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {(contact as any).cpf ? (
                          <span className="text-sm font-mono">{formatCPF((contact as any).cpf)}</span>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        {(contact as any).companies?.name ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Building2 className="h-3 w-3 text-muted-foreground" />
                            {(contact as any).companies.name}
                          </div>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        <DealStageBadges deals={(contact as any).deals || []} />
                      </TableCell>
                      <TableCell>
                        <PricingTableBadge entityType="contact" entityId={contact.id} compact />
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {contact.email && (
                            <div className="flex items-center gap-1 text-sm">
                              <Mail className="h-3 w-3 text-muted-foreground" />
                              {contact.email}
                            </div>
                          )}
                          {contact.phone && (
                            <div className="flex items-center gap-1 text-sm">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              {contact.phone}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              {syncStatus.synced ? (
                                <Badge variant="secondary" className="gap-1">
                                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                                  Sincronizado
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="gap-1 text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  Pendente
                                </Badge>
                              )}
                            </TooltipTrigger>
                            <TooltipContent>
                              {syncStatus.synced 
                                ? `Sincronizado em ${syncStatus.date}` 
                                : 'Não sincronizado com Iniflex'}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => handleOpenWhatsApp(contact)}
                                  disabled={!contact.mobile && !contact.phone}
                                  className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                >
                                  <MessageCircle className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>WhatsApp (Em Desenvolvimento)</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => syncInflexMutation.mutate(contact.id)}
                                  disabled={syncInflexMutation.isPending}
                                >
                                  <RefreshCw className={`h-4 w-4 ${syncInflexMutation.isPending ? 'animate-spin' : ''}`} />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Sincronizar com Iniflex</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(contact)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => deleteMutation.mutate(contact.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          <ServerPagination
            page={page}
            pageSize={pageSize}
            total={totalContacts}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            isFetching={isFetching}
          />
        </CardContent>

      </Card>
    </div>
  );
}
