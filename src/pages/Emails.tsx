import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Mail, FileText, Pencil, Trash2, Send, Eye, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { formatDateTime } from '@/lib/formatters';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';

type EmailTemplate = Tables<'email_templates'>;
type EmailLog = Tables<'email_logs'>;

export default function Emails() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('templates');
  const [search, setSearch] = useState('');
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [templateFormData, setTemplateFormData] = useState({
    name: '',
    subject: '',
    body: '',
    is_shared: false,
  });

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
    queryKey: ['email_logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_logs')
        .select('*, contacts(first_name, last_name, email)')
        .order('sent_at', { ascending: false });
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

  const resetTemplateForm = () => {
    setTemplateFormData({ name: '', subject: '', body: '', is_shared: false });
    setEditingTemplate(null);
    setIsTemplateDialogOpen(false);
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

  const filteredTemplates = templates?.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.subject.toLowerCase().includes(search.toLowerCase())
  );

  const filteredLogs = emailLogs?.filter(l =>
    l.subject.toLowerCase().includes(search.toLowerCase()) ||
    l.to_email.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'sent':
        return <Badge className="bg-green-500">Enviado</Badge>;
      case 'opened':
        return <Badge className="bg-blue-500">Aberto</Badge>;
      case 'failed':
        return <Badge variant="destructive">Falhou</Badge>;
      default:
        return <Badge variant="secondary">Pendente</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Emails</h1>
          <p className="text-muted-foreground">Templates e histórico de emails</p>
        </div>
      </div>

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
                        <div className="flex justify-end gap-1">
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
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="history" className="mt-0">
              {logsLoading ? (
                <div className="flex items-center justify-center py-10">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                </div>
              ) : filteredLogs?.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Mail className="h-12 w-12 text-muted-foreground/50" />
                  <h3 className="mt-4 text-lg font-semibold">Nenhum email enviado</h3>
                  <p className="text-muted-foreground">O histórico de emails aparecerá aqui.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Destinatário</TableHead>
                      <TableHead>Assunto</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Enviado em</TableHead>
                      <TableHead>Aberto em</TableHead>
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
                          {log.sent_at ? (
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
