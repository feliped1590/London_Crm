import { useState } from 'react';
import { UnderDevelopmentBanner } from '@/components/UnderDevelopmentBanner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Search, Mail, FileText, Pencil, Trash2, Send, Eye, Clock, Users, User, X, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { formatDateTime } from '@/lib/formatters';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';

type EmailTemplate = Tables<'email_templates'>;
type EmailLog = Tables<'email_logs'> & { scheduled_for?: string | null };
type Contact = Tables<'contacts'>;

export default function Emails() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Template states
  const [activeTab, setActiveTab] = useState('compose');
  const [search, setSearch] = useState('');
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [templateFormData, setTemplateFormData] = useState({
    name: '',
    subject: '',
    body: '',
    is_shared: false,
  });

  // Compose states
  const [composeMode, setComposeMode] = useState<'single' | 'bulk'>('single');
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [composeData, setComposeData] = useState({
    to_email: '',
    subject: '',
    body: '',
    scheduledFor: null as string | null,
  });
  const [isScheduled, setIsScheduled] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [historyFilter, setHistoryFilter] = useState<'all' | 'sent' | 'scheduled'>('all');

  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ['email_templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as EmailTemplate[];
    },
  });

  const { data: emailLogs, isLoading: logsLoading } = useQuery({
    queryKey: ['email_logs', user?.id],
    queryFn: async () => {
      // Users only see their own sent emails
      const { data, error } = await supabase
        .from('email_logs')
        .select('*, contacts(first_name, last_name, email)')
        .eq('sent_by', user?.id)
        .order('sent_at', { ascending: false });
      if (error) throw error;
      return data as EmailLog[];
    },
    enabled: !!user?.id,
  });

  const { data: contacts } = useQuery({
    queryKey: ['contacts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('*, companies(name)')
        .order('first_name');
      if (error) throw error;
      return data;
    },
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (data: TablesInsert<'email_templates'>) => {
      const { error } = await supabase.from('email_templates').insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email_templates'] });
      toast.success('Template criado com sucesso!');
      resetTemplateForm();
    },
    onError: () => toast.error('Erro ao criar template'),
  });

  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<EmailTemplate> & { id: string }) => {
      const { error } = await supabase.from('email_templates').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email_templates'] });
      toast.success('Template atualizado!');
      resetTemplateForm();
    },
    onError: () => toast.error('Erro ao atualizar template'),
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('email_templates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email_templates'] });
      toast.success('Template excluído!');
    },
    onError: () => toast.error('Erro ao excluir template'),
  });

  const sendEmailMutation = useMutation({
    mutationFn: async (data: any) => {
      const endpoint = composeMode === 'single' ? 'send-email' : 'send-bulk-email';
      const { data: response, error } = await supabase.functions.invoke(endpoint, {
        body: data,
      });
      if (error) throw error;
      if (response.error) throw new Error(response.error);
      return response;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['email_logs'] });
      if (composeMode === 'single') {
        if (data.status === 'scheduled') {
          toast.success('Email agendado com sucesso!');
        } else {
          toast.success('Email enviado com sucesso!');
        }
      } else {
        const msg = data.scheduled > 0 
          ? `${data.scheduled} emails agendados` 
          : `${data.sent} emails enviados, ${data.failed} falhas, ${data.no_email} sem email`;
        toast.success(msg);
      }
      resetComposeForm();
    },
    onError: (error: any) => {
      toast.error(`Erro ao enviar: ${error.message}`);
    },
  });

  const deleteScheduledEmailMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('email_logs')
        .delete()
        .eq('id', id)
        .eq('status', 'scheduled');
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email_logs'] });
      toast.success('Email agendado excluído!');
    },
    onError: () => toast.error('Erro ao excluir email agendado'),
  });

  const resetTemplateForm = () => {
    setTemplateFormData({ name: '', subject: '', body: '', is_shared: false });
    setEditingTemplate(null);
    setIsTemplateDialogOpen(false);
  };

  const resetComposeForm = () => {
    setComposeData({ to_email: '', subject: '', body: '', scheduledFor: null });
    setSelectedContacts([]);
    setSelectedTemplateId(null);
    setIsScheduled(false);
    setComposeMode('single');
  };

  const handleTemplateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTemplate) {
      updateTemplateMutation.mutate({ id: editingTemplate.id, ...templateFormData });
    } else {
      createTemplateMutation.mutate({
        ...templateFormData,
        created_by: user?.id,
      });
    }
  };

  const handleEditTemplate = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setTemplateFormData({
      name: template.name,
      subject: template.subject,
      body: template.body,
      is_shared: template.is_shared || false,
    });
    setIsTemplateDialogOpen(true);
  };

  const handleTemplateSelect = (templateId: string) => {
    if (templateId === 'none') {
      setSelectedTemplateId(null);
      return;
    }
    setSelectedTemplateId(templateId);
    const template = templates?.find(t => t.id === templateId);
    if (template) {
      setComposeData(prev => ({
        ...prev,
        subject: template.subject,
        body: template.body,
      }));
    }
  };

  const handleContactToggle = (contactId: string) => {
    setSelectedContacts(prev =>
      prev.includes(contactId)
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    );
  };

  const handleSendEmail = () => {
    if (composeMode === 'single') {
      if (!composeData.to_email || !composeData.subject || !composeData.body) {
        toast.error('Preencha todos os campos obrigatórios');
        return;
      }
      
      const selectedContact = contacts?.find(c => c.email === composeData.to_email);
      
      sendEmailMutation.mutate({
        to_email: composeData.to_email,
        subject: composeData.subject,
        body: composeData.body,
        contact_id: selectedContact?.id,
        template_id: selectedTemplateId,
        scheduled_for: isScheduled && composeData.scheduledFor 
          ? new Date(composeData.scheduledFor).toISOString() 
          : null,
      });
    } else {
      if (selectedContacts.length === 0) {
        toast.error('Selecione pelo menos um contato');
        return;
      }
      if (!composeData.subject || !composeData.body) {
        toast.error('Preencha assunto e corpo do email');
        return;
      }
      
      sendEmailMutation.mutate({
        contact_ids: selectedContacts,
        subject: composeData.subject,
        body: composeData.body,
        template_id: selectedTemplateId,
        scheduled_for: isScheduled && composeData.scheduledFor 
          ? new Date(composeData.scheduledFor).toISOString() 
          : null,
      });
    }
  };

  const handleUseTemplate = (template: EmailTemplate) => {
    setSelectedTemplateId(template.id);
    setComposeData(prev => ({
      ...prev,
      subject: template.subject,
      body: template.body,
    }));
    setActiveTab('compose');
  };

  const filteredTemplates = templates?.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.subject.toLowerCase().includes(search.toLowerCase())
  );

  const filteredLogs = emailLogs?.filter(l => {
    const matchesSearch = l.subject.toLowerCase().includes(search.toLowerCase()) ||
      l.to_email.toLowerCase().includes(search.toLowerCase());
    
    if (historyFilter === 'scheduled') {
      return matchesSearch && l.status === 'scheduled';
    }
    if (historyFilter === 'sent') {
      return matchesSearch && l.status !== 'scheduled';
    }
    return matchesSearch;
  });

  const filteredContacts = contacts?.filter(c => {
    if (!contactSearch) return true;
    const searchLower = contactSearch.toLowerCase();
    return (
      c.first_name?.toLowerCase().includes(searchLower) ||
      c.last_name?.toLowerCase().includes(searchLower) ||
      c.email?.toLowerCase().includes(searchLower) ||
      (c as any).companies?.name?.toLowerCase().includes(searchLower)
    );
  });

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'sent':
        return <Badge className="bg-green-500">Enviado</Badge>;
      case 'opened':
        return <Badge className="bg-blue-500">Aberto</Badge>;
      case 'failed':
        return <Badge variant="destructive">Falhou</Badge>;
      case 'scheduled':
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> Agendado</Badge>;
      default:
        return <Badge variant="secondary">Pendente</Badge>;
    }
  };

  const contactsWithEmail = filteredContacts?.filter(c => c.email);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Emails</h1>
          <p className="text-muted-foreground">Envie, agende e gerencie seus emails</p>
        </div>
      </div>

      <UnderDevelopmentBanner 
        title="Módulo de Emails em Desenvolvimento"
        description="Este módulo está sendo aprimorado para oferecer uma experiência completa de envio e gestão de emails. Algumas funcionalidades podem estar indisponíveis ou apresentar comportamento inesperado."
      />

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="flex items-center justify-between mb-4">
              <TabsList>
                <TabsTrigger value="compose" className="gap-2">
                  <Send className="h-4 w-4" />
                  Compor
                </TabsTrigger>
                <TabsTrigger value="templates" className="gap-2">
                  <FileText className="h-4 w-4" />
                  Templates
                </TabsTrigger>
                <TabsTrigger value="history" className="gap-2">
                  <Mail className="h-4 w-4" />
                  Histórico
                </TabsTrigger>
              </TabsList>
              
              {activeTab === 'templates' && (
                <Dialog open={isTemplateDialogOpen} onOpenChange={(open) => { setIsTemplateDialogOpen(open); if (!open) resetTemplateForm(); }}>
                  <DialogTrigger asChild>
                    <Button className="gap-2">
                      <Plus className="h-4 w-4" />
                      Novo Template
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>{editingTemplate ? 'Editar Template' : 'Novo Template'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleTemplateSubmit} className="space-y-4">
                      <div>
                        <Label htmlFor="name">Nome do Template *</Label>
                        <Input
                          id="name"
                          value={templateFormData.name}
                          onChange={(e) => setTemplateFormData({ ...templateFormData, name: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="subject">Assunto *</Label>
                        <Input
                          id="subject"
                          value={templateFormData.subject}
                          onChange={(e) => setTemplateFormData({ ...templateFormData, subject: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="body">Corpo do Email *</Label>
                        <Textarea
                          id="body"
                          value={templateFormData.body}
                          onChange={(e) => setTemplateFormData({ ...templateFormData, body: e.target.value })}
                          rows={10}
                          placeholder="Use {{nome}}, {{empresa}}, {{cargo}} para variáveis dinâmicas"
                          required
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Variáveis disponíveis: {"{{nome}}"}, {"{{sobrenome}}"}, {"{{empresa}}"}, {"{{cargo}}"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="is_shared"
                          checked={templateFormData.is_shared}
                          onChange={(e) => setTemplateFormData({ ...templateFormData, is_shared: e.target.checked })}
                          className="rounded border-gray-300"
                        />
                        <Label htmlFor="is_shared" className="font-normal">Compartilhar com a equipe</Label>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={resetTemplateForm}>
                          Cancelar
                        </Button>
                        <Button type="submit" disabled={createTemplateMutation.isPending || updateTemplateMutation.isPending}>
                          {editingTemplate ? 'Atualizar' : 'Criar'}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            {/* Compose Tab */}
            <TabsContent value="compose" className="mt-0">
              <div className="grid gap-6 lg:grid-cols-3">
                {/* Left: Contact Selection (for bulk) */}
                <div className={composeMode === 'bulk' ? 'lg:col-span-1' : 'hidden'}>
                  <div className="border rounded-lg p-4 h-full">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold">Destinatários</h3>
                      <Badge variant="secondary">{selectedContacts.length} selecionados</Badge>
                    </div>
                    <div className="relative mb-3">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Buscar contatos..."
                        value={contactSearch}
                        onChange={(e) => setContactSearch(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-2">
                        {contactsWithEmail?.map((contact) => (
                          <div
                            key={contact.id}
                            className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                              selectedContacts.includes(contact.id) 
                                ? 'bg-primary/10 border border-primary/20' 
                                : 'hover:bg-muted'
                            }`}
                            onClick={() => handleContactToggle(contact.id)}
                          >
                            <Checkbox 
                              checked={selectedContacts.includes(contact.id)}
                              onCheckedChange={() => handleContactToggle(contact.id)}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">
                                {contact.first_name} {contact.last_name}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">{contact.email}</p>
                              {(contact as any).companies?.name && (
                                <p className="text-xs text-muted-foreground truncate">
                                  {(contact as any).companies.name}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                        {contactsWithEmail?.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            Nenhum contato com email encontrado
                          </p>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                </div>

                {/* Right: Compose Form */}
                <div className={composeMode === 'bulk' ? 'lg:col-span-2' : 'lg:col-span-3'}>
                  <div className="space-y-4">
                    {/* Mode Toggle */}
                    <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
                      <span className="text-sm font-medium">Modo:</span>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant={composeMode === 'single' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => { setComposeMode('single'); setSelectedContacts([]); }}
                          className="gap-2"
                        >
                          <User className="h-4 w-4" />
                          Individual
                        </Button>
                        <Button
                          type="button"
                          variant={composeMode === 'bulk' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setComposeMode('bulk')}
                          className="gap-2"
                        >
                          <Users className="h-4 w-4" />
                          Em Massa
                        </Button>
                      </div>
                    </div>

                    {/* Single mode: email input */}
                    {composeMode === 'single' && (
                      <div>
                        <Label>Destinatário *</Label>
                        <Select 
                          value={composeData.to_email || 'none'} 
                          onValueChange={(v) => setComposeData({ ...composeData, to_email: v === 'none' ? '' : v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um contato ou digite email" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Selecione...</SelectItem>
                            {contactsWithEmail?.map((c) => (
                              <SelectItem key={c.id} value={c.email || ''}>
                                {c.first_name} {c.last_name} ({c.email})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          className="mt-2"
                          type="email"
                          placeholder="Ou digite o email diretamente"
                          value={composeData.to_email}
                          onChange={(e) => setComposeData({ ...composeData, to_email: e.target.value })}
                        />
                      </div>
                    )}

                    {/* Bulk mode: show selected contacts */}
                    {composeMode === 'bulk' && selectedContacts.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {selectedContacts.map((contactId) => {
                          const contact = contacts?.find(c => c.id === contactId);
                          return (
                            <Badge key={contactId} variant="secondary" className="gap-1">
                              {contact?.first_name} {contact?.last_name}
                              <X 
                                className="h-3 w-3 cursor-pointer" 
                                onClick={() => handleContactToggle(contactId)} 
                              />
                            </Badge>
                          );
                        })}
                      </div>
                    )}

                    {/* Template Selection */}
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

                    {/* Subject */}
                    <div>
                      <Label>Assunto *</Label>
                      <Input
                        value={composeData.subject}
                        onChange={(e) => setComposeData({ ...composeData, subject: e.target.value })}
                        placeholder="Assunto do email"
                      />
                    </div>

                    {/* Body */}
                    <div>
                      <Label>Corpo do Email *</Label>
                      <Textarea
                        value={composeData.body}
                        onChange={(e) => setComposeData({ ...composeData, body: e.target.value })}
                        rows={10}
                        placeholder="Digite o corpo do email... Use {{nome}}, {{empresa}}, {{cargo}} para variáveis"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Variáveis disponíveis: {"{{nome}}"}, {"{{sobrenome}}"}, {"{{empresa}}"}, {"{{cargo}}"}, {"{{email}}"}, {"{{telefone}}"}
                      </p>
                    </div>

                    {/* Scheduling */}
                    <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="schedule"
                          checked={isScheduled}
                          onCheckedChange={(checked) => {
                            setIsScheduled(!!checked);
                            if (!checked) {
                              setComposeData(prev => ({ ...prev, scheduledFor: null }));
                            }
                          }}
                        />
                        <Label htmlFor="schedule" className="font-normal cursor-pointer">
                          <Clock className="h-4 w-4 inline mr-1" />
                          Agendar envio
                        </Label>
                      </div>
                      {isScheduled && (
                        <Input
                          type="datetime-local"
                          value={composeData.scheduledFor || ''}
                          onChange={(e) => setComposeData({ ...composeData, scheduledFor: e.target.value })}
                          min={new Date().toISOString().slice(0, 16)}
                          className="w-auto"
                        />
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={resetComposeForm}>
                        Limpar
                      </Button>
                      <Button 
                        onClick={handleSendEmail}
                        disabled={sendEmailMutation.isPending}
                        className="gap-2"
                      >
                        {sendEmailMutation.isPending ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : isScheduled ? (
                          <Calendar className="h-4 w-4" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                        {isScheduled ? 'Agendar' : 'Enviar'}
                        {composeMode === 'bulk' && selectedContacts.length > 0 && ` (${selectedContacts.length})`}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Templates Tab */}
            <TabsContent value="templates" className="mt-0">
              {templatesLoading ? (
                <div className="flex items-center justify-center py-10">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                </div>
              ) : filteredTemplates?.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground/50" />
                  <h3 className="mt-4 text-lg font-semibold">Nenhum template encontrado</h3>
                  <p className="text-muted-foreground">Crie seu primeiro template de email.</p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredTemplates?.map((template) => (
                    <Card key={template.id} className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <CardTitle className="text-base">{template.name}</CardTitle>
                            <p className="text-sm text-muted-foreground">{template.subject}</p>
                          </div>
                          {template.is_shared && (
                            <Badge variant="secondary">Compartilhado</Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                          {template.body}
                        </p>
                        <div className="flex justify-between">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleUseTemplate(template)}
                            className="gap-1"
                          >
                            <Send className="h-3 w-3" />
                            Usar
                          </Button>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleEditTemplate(template)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => deleteTemplateMutation.mutate(template.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="history" className="mt-0">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-sm text-muted-foreground">Filtrar:</span>
                <Button
                  variant={historyFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setHistoryFilter('all')}
                >
                  Todos
                </Button>
                <Button
                  variant={historyFilter === 'sent' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setHistoryFilter('sent')}
                >
                  Enviados
                </Button>
                <Button
                  variant={historyFilter === 'scheduled' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setHistoryFilter('scheduled')}
                  className="gap-1"
                >
                  <Clock className="h-3 w-3" />
                  Agendados
                </Button>
              </div>
              
              {logsLoading ? (
                <div className="flex items-center justify-center py-10">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                </div>
              ) : filteredLogs?.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Mail className="h-12 w-12 text-muted-foreground/50" />
                  <h3 className="mt-4 text-lg font-semibold">Nenhum email encontrado</h3>
                  <p className="text-muted-foreground">O histórico de emails aparecerá aqui.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Destinatário</TableHead>
                      <TableHead>Assunto</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Aberto em</TableHead>
                      <TableHead className="w-[60px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs?.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <div>
                            {(log as any).contacts && (
                              <p className="font-medium">
                                {(log as any).contacts.first_name} {(log as any).contacts.last_name}
                              </p>
                            )}
                            <p className="text-sm text-muted-foreground">{log.to_email}</p>
                          </div>
                        </TableCell>
                        <TableCell>{log.subject}</TableCell>
                        <TableCell>{getStatusBadge(log.status)}</TableCell>
                        <TableCell>
                          {log.status === 'scheduled' && log.scheduled_for ? (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {formatDateTime(log.scheduled_for)}
                            </div>
                          ) : log.sent_at ? (
                            <div className="flex items-center gap-1 text-sm">
                              <Send className="h-3 w-3" />
                              {formatDateTime(log.sent_at)}
                            </div>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          {log.opened_at ? (
                            <div className="flex items-center gap-1 text-sm text-green-600">
                              <Eye className="h-3 w-3" />
                              {formatDateTime(log.opened_at)}
                            </div>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          {log.status === 'scheduled' && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir email agendado?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta ação não pode ser desfeita. O email para {log.to_email} não será enviado.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteScheduledEmailMutation.mutate(log.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Excluir
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
