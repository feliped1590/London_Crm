import { useState } from 'react';
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
import { Plus, DollarSign, Calendar, Building2, User, GripVertical, Mail, Send, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { CustomFieldsRenderer } from '@/components/CustomFieldsRenderer';
import { ProposalsList } from '@/components/proposals/ProposalsList';
import type { Tables, TablesInsert, Json } from '@/integrations/supabase/types';

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

  const { data: deals, isLoading } = useQuery({
    queryKey: ['deals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deals')
        .select('*, companies(name), contacts(first_name, last_name, email)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: companies } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      const { data, error } = await supabase.from('companies').select('id, name').order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: contacts } = useQuery({
    queryKey: ['contacts'],
    queryFn: async () => {
      const { data, error } = await supabase.from('contacts').select('id, first_name, last_name, email').order('first_name');
      if (error) throw error;
      return data;
    },
  });

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
    onError: () => toast.error('Erro ao criar negócio'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Deal> & { id: string }) => {
      const updateData: any = { ...data };
      if (data.stage === 'fechado_ganho' || data.stage === 'fechado_perdido') {
        updateData.closed_at = new Date().toISOString();
      }
      const { error } = await supabase.from('deals').update(updateData).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      toast.success('Negócio atualizado!');
      resetForm();
    },
    onError: () => toast.error('Erro ao atualizar negócio'),
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
    if (editingDeal) {
      updateMutation.mutate({ 
        id: editingDeal.id, 
        ...formData,
        custom_fields: customFieldsData as Json,
      });
    } else {
      createMutation.mutate({
        ...formData,
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

  const handleDrop = (e: React.DragEvent, stage: DealStage) => {
    e.preventDefault();
    const dealId = e.dataTransfer.getData('dealId');
    if (dealId) {
      updateMutation.mutate({ id: dealId, stage });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const getStageDeals = (stage: DealStage) => deals?.filter(d => d.stage === stage) || [];
  const getStageTotal = (stage: DealStage) => getStageDeals(stage).reduce((sum, d) => sum + (d.value || 0), 0);

  return (
    <div className="space-y-6 h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Pipeline de Vendas</h1>
          <p className="text-muted-foreground">Gerencie suas oportunidades de negócio</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Negócio
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>{editingDeal ? 'Editar Negócio' : 'Novo Negócio'}</DialogTitle>
            </DialogHeader>
            
            {editingDeal ? (
              <Tabs defaultValue="dados" className="flex-1 overflow-hidden flex flex-col">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="dados">Dados</TabsTrigger>
                  <TabsTrigger value="propostas" className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Propostas
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
                        <Input
                          id="value"
                          type="number"
                          step="0.01"
                          value={formData.value || 0}
                          onChange={(e) => setFormData({ ...formData, value: parseFloat(e.target.value) || 0 })}
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
                        <Select 
                          value={formData.company_id || 'none'} 
                          onValueChange={(v) => setFormData({ ...formData, company_id: v === 'none' ? null : v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Nenhuma</SelectItem>
                            {companies?.map((c) => (
                              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="contact_id">Contato</Label>
                        <Select 
                          value={formData.contact_id || 'none'} 
                          onValueChange={(v) => setFormData({ ...formData, contact_id: v === 'none' ? null : v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Nenhum</SelectItem>
                            {contacts?.map((c) => (
                              <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
                    <div className="flex justify-between gap-2">
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
                
                <TabsContent value="propostas" className="flex-1 overflow-auto mt-4">
                  <ProposalsList
                    dealId={editingDeal.id}
                    companyId={editingDeal.company_id}
                    contactId={editingDeal.contact_id}
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
                    <Input
                      id="value"
                      type="number"
                      step="0.01"
                      value={formData.value || 0}
                      onChange={(e) => setFormData({ ...formData, value: parseFloat(e.target.value) || 0 })}
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
                    <Select 
                      value={formData.company_id || 'none'} 
                      onValueChange={(v) => setFormData({ ...formData, company_id: v === 'none' ? null : v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhuma</SelectItem>
                        {companies?.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="contact_id">Contato</Label>
                    <Select 
                      value={formData.contact_id || 'none'} 
                      onValueChange={(v) => setFormData({ ...formData, contact_id: v === 'none' ? null : v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {contacts?.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
      ) : (
        <div className="grid grid-cols-6 gap-4 h-[calc(100vh-220px)]">
          {stages.map((stage) => (
            <div
              key={stage}
              className="flex flex-col bg-muted/30 rounded-lg"
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
                            <div className="mt-2 flex items-center gap-1">
                              <Badge variant="secondary" className="text-xs">
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
    </div>
  );
}
