import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, Bell, Mail, Clock, AlertTriangle, FileText, Save, Plus, Trash2, Pencil, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface NotificationPreferences {
  id: string;
  user_id: string;
  task_reminder_email: boolean;
  task_reminder_hours: number;
  deal_stagnant_alert: boolean;
  deal_stagnant_days: number;
  proposal_expiring_alert: boolean;
  proposal_expiring_days: number;
  daily_summary_email: boolean;
}

interface CustomNotification {
  id: string;
  name: string;
  trigger_type: 'task_due' | 'deal_stagnant' | 'proposal_expiring' | 'order_status' | 'custom';
  trigger_value: number;
  is_enabled: boolean;
  email_subject: string;
  email_template: string;
}

const TRIGGER_TYPES = [
  { value: 'task_due', label: 'Tarefa vencendo', icon: Clock, description: 'X horas antes do vencimento' },
  { value: 'deal_stagnant', label: 'Negócio parado', icon: AlertTriangle, description: 'X dias sem movimentação' },
  { value: 'proposal_expiring', label: 'Proposta expirando', icon: FileText, description: 'X dias antes de expirar' },
  { value: 'order_status', label: 'Status de pedido', icon: CheckCircle2, description: 'Quando pedido muda de status' },
];

const DEFAULT_PREFERENCES: Omit<NotificationPreferences, 'id' | 'user_id'> = {
  task_reminder_email: true,
  task_reminder_hours: 1,
  deal_stagnant_alert: true,
  deal_stagnant_days: 7,
  proposal_expiring_alert: true,
  proposal_expiring_days: 2,
  daily_summary_email: false,
};

export function CustomNotificationsManager() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState(DEFAULT_PREFERENCES);
  const [hasChanges, setHasChanges] = useState(false);

  // Custom notifications state (local for now - would be stored in DB in production)
  const [customNotifications, setCustomNotifications] = useState<CustomNotification[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingNotification, setEditingNotification] = useState<CustomNotification | null>(null);
  const [notificationFormData, setNotificationFormData] = useState({
    name: '',
    trigger_type: 'task_due' as CustomNotification['trigger_type'],
    trigger_value: 1,
    email_subject: '',
    email_template: '',
    is_enabled: true,
  });

  const { data: preferences, isLoading } = useQuery({
    queryKey: ['notification_preferences', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();
      
      if (error) throw error;
      return data as NotificationPreferences | null;
    },
    enabled: !!user?.id,
  });

  // Sync form data with fetched preferences
  useState(() => {
    if (preferences) {
      setFormData({
        task_reminder_email: preferences.task_reminder_email,
        task_reminder_hours: preferences.task_reminder_hours,
        deal_stagnant_alert: preferences.deal_stagnant_alert,
        deal_stagnant_days: preferences.deal_stagnant_days,
        proposal_expiring_alert: preferences.proposal_expiring_alert,
        proposal_expiring_days: preferences.proposal_expiring_days,
        daily_summary_email: preferences.daily_summary_email,
      });
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (preferences) {
        const { error } = await supabase
          .from('notification_preferences')
          .update(data)
          .eq('id', preferences.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('notification_preferences')
          .insert({
            ...data,
            user_id: user?.id,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification_preferences', user?.id] });
      toast.success('Preferências salvas');
      setHasChanges(false);
    },
    onError: () => {
      toast.error('Erro ao salvar preferências');
    },
  });

  const updateField = <K extends keyof typeof formData>(key: K, value: typeof formData[K]) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    saveMutation.mutate(formData);
  };

  const resetNotificationForm = () => {
    setNotificationFormData({
      name: '',
      trigger_type: 'task_due',
      trigger_value: 1,
      email_subject: '',
      email_template: '',
      is_enabled: true,
    });
    setEditingNotification(null);
    setIsDialogOpen(false);
  };

  const handleCreateNotification = (e: React.FormEvent) => {
    e.preventDefault();
    const newNotification: CustomNotification = {
      id: crypto.randomUUID(),
      ...notificationFormData,
    };
    
    if (editingNotification) {
      setCustomNotifications(prev => 
        prev.map(n => n.id === editingNotification.id ? { ...newNotification, id: editingNotification.id } : n)
      );
      toast.success('Notificação atualizada!');
    } else {
      setCustomNotifications(prev => [...prev, newNotification]);
      toast.success('Notificação criada!');
    }
    resetNotificationForm();
  };

  const handleEditNotification = (notification: CustomNotification) => {
    setEditingNotification(notification);
    setNotificationFormData({
      name: notification.name,
      trigger_type: notification.trigger_type,
      trigger_value: notification.trigger_value,
      email_subject: notification.email_subject,
      email_template: notification.email_template,
      is_enabled: notification.is_enabled,
    });
    setIsDialogOpen(true);
  };

  const handleDeleteNotification = (id: string) => {
    setCustomNotifications(prev => prev.filter(n => n.id !== id));
    toast.success('Notificação removida!');
  };

  const handleToggleNotification = (id: string) => {
    setCustomNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, is_enabled: !n.is_enabled } : n)
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Notificações por Email</h3>
          <p className="text-sm text-muted-foreground">
            Configure notificações padrão e crie alertas personalizados
          </p>
        </div>
        <Button 
          onClick={handleSave} 
          disabled={!hasChanges || saveMutation.isPending}
          className="gap-2"
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Salvar
        </Button>
      </div>

      {/* Standard Notifications */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Task Reminders */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Lembretes de Tarefas</CardTitle>
            </div>
            <CardDescription>
              Receba um email antes das suas tarefas vencerem
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="task_reminder_email" className="cursor-pointer">
                Ativar lembretes
              </Label>
              <Switch
                id="task_reminder_email"
                checked={formData.task_reminder_email}
                onCheckedChange={(checked) => updateField('task_reminder_email', checked)}
              />
            </div>
            {formData.task_reminder_email && (
              <div className="space-y-2">
                <Label>Lembrar com antecedência de</Label>
                <Select
                  value={String(formData.task_reminder_hours)}
                  onValueChange={(v) => updateField('task_reminder_hours', parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 hora</SelectItem>
                    <SelectItem value="2">2 horas</SelectItem>
                    <SelectItem value="4">4 horas</SelectItem>
                    <SelectItem value="24">1 dia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Deal Stagnant Alerts */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <CardTitle className="text-base">Negócios Parados</CardTitle>
            </div>
            <CardDescription>
              Alerta quando um negócio fica muito tempo na mesma etapa
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="deal_stagnant_alert" className="cursor-pointer">
                Ativar alertas
              </Label>
              <Switch
                id="deal_stagnant_alert"
                checked={formData.deal_stagnant_alert}
                onCheckedChange={(checked) => updateField('deal_stagnant_alert', checked)}
              />
            </div>
            {formData.deal_stagnant_alert && (
              <div className="space-y-2">
                <Label>Alertar após</Label>
                <Select
                  value={String(formData.deal_stagnant_days)}
                  onValueChange={(v) => updateField('deal_stagnant_days', parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 dias</SelectItem>
                    <SelectItem value="5">5 dias</SelectItem>
                    <SelectItem value="7">7 dias</SelectItem>
                    <SelectItem value="14">14 dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Proposal Expiring Alerts */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Propostas Expirando</CardTitle>
            </div>
            <CardDescription>
              Alerta quando uma proposta está próxima do vencimento
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="proposal_expiring_alert" className="cursor-pointer">
                Ativar alertas
              </Label>
              <Switch
                id="proposal_expiring_alert"
                checked={formData.proposal_expiring_alert}
                onCheckedChange={(checked) => updateField('proposal_expiring_alert', checked)}
              />
            </div>
            {formData.proposal_expiring_alert && (
              <div className="space-y-2">
                <Label>Alertar com antecedência de</Label>
                <Select
                  value={String(formData.proposal_expiring_days)}
                  onValueChange={(v) => updateField('proposal_expiring_days', parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 dia</SelectItem>
                    <SelectItem value="2">2 dias</SelectItem>
                    <SelectItem value="3">3 dias</SelectItem>
                    <SelectItem value="5">5 dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Daily Summary */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Resumo Diário</CardTitle>
            </div>
            <CardDescription>
              Receba um resumo das suas atividades do dia pela manhã
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="daily_summary_email" className="cursor-pointer">
                Ativar resumo diário
              </Label>
              <Switch
                id="daily_summary_email"
                checked={formData.daily_summary_email}
                onCheckedChange={(checked) => updateField('daily_summary_email', checked)}
              />
            </div>
            {formData.daily_summary_email && (
              <p className="text-xs text-muted-foreground">
                Você receberá um email às 7h com suas tarefas do dia, 
                negócios que precisam de atenção e propostas pendentes.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Custom Notifications Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notificações Personalizadas
              </CardTitle>
              <CardDescription>
                Crie alertas customizados para cenários específicos
              </CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetNotificationForm(); }}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Nova Notificação
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingNotification ? 'Editar Notificação' : 'Nova Notificação'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateNotification} className="space-y-4">
                  <div>
                    <Label htmlFor="notif-name">Nome da Notificação *</Label>
                    <Input
                      id="notif-name"
                      value={notificationFormData.name}
                      onChange={(e) => setNotificationFormData({ ...notificationFormData, name: e.target.value })}
                      placeholder="Ex: Alerta urgente de tarefa"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="trigger-type">Tipo de Gatilho *</Label>
                    <Select
                      value={notificationFormData.trigger_type}
                      onValueChange={(v) => setNotificationFormData({ ...notificationFormData, trigger_type: v as CustomNotification['trigger_type'] })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TRIGGER_TYPES.map((trigger) => (
                          <SelectItem key={trigger.value} value={trigger.value}>
                            <div className="flex items-center gap-2">
                              <trigger.icon className="h-4 w-4" />
                              {trigger.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      {TRIGGER_TYPES.find(t => t.value === notificationFormData.trigger_type)?.description}
                    </p>
                  </div>

                  {notificationFormData.trigger_type !== 'order_status' && (
                    <div>
                      <Label htmlFor="trigger-value">
                        {notificationFormData.trigger_type === 'task_due' ? 'Horas antes' : 'Dias'}
                      </Label>
                      <Input
                        id="trigger-value"
                        type="number"
                        min={1}
                        value={notificationFormData.trigger_value}
                        onChange={(e) => setNotificationFormData({ ...notificationFormData, trigger_value: parseInt(e.target.value) || 1 })}
                      />
                    </div>
                  )}

                  <div>
                    <Label htmlFor="email-subject">Assunto do Email</Label>
                    <Input
                      id="email-subject"
                      value={notificationFormData.email_subject}
                      onChange={(e) => setNotificationFormData({ ...notificationFormData, email_subject: e.target.value })}
                      placeholder="Ex: [CRM] Tarefa urgente vencendo"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      id="notif-enabled"
                      checked={notificationFormData.is_enabled}
                      onCheckedChange={(checked) => setNotificationFormData({ ...notificationFormData, is_enabled: checked })}
                    />
                    <Label htmlFor="notif-enabled" className="font-normal">Notificação ativa</Label>
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={resetNotificationForm}>
                      Cancelar
                    </Button>
                    <Button type="submit">
                      {editingNotification ? 'Atualizar' : 'Criar'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {customNotifications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bell className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>Nenhuma notificação personalizada criada</p>
              <p className="text-sm">Clique em "Nova Notificação" para criar</p>
            </div>
          ) : (
            <div className="space-y-2">
              {customNotifications.map((notification) => {
                const TriggerIcon = TRIGGER_TYPES.find(t => t.value === notification.trigger_type)?.icon || Bell;
                return (
                  <div
                    key={notification.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${!notification.is_enabled ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <TriggerIcon className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{notification.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {TRIGGER_TYPES.find(t => t.value === notification.trigger_type)?.label}
                          {notification.trigger_type !== 'order_status' && ` - ${notification.trigger_value} ${notification.trigger_type === 'task_due' ? 'horas' : 'dias'}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={notification.is_enabled}
                        onCheckedChange={() => handleToggleNotification(notification.id)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEditNotification(notification)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteNotification(notification.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
