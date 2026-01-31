import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2, Bell, Mail, Clock, AlertTriangle, FileText, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';

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

const DEFAULT_PREFERENCES: Omit<NotificationPreferences, 'id' | 'user_id'> = {
  task_reminder_email: true,
  task_reminder_hours: 1,
  deal_stagnant_alert: true,
  deal_stagnant_days: 7,
  proposal_expiring_alert: true,
  proposal_expiring_days: 2,
  daily_summary_email: false,
};

export function NotificationPreferencesManager() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState(DEFAULT_PREFERENCES);
  const [hasChanges, setHasChanges] = useState(false);

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
  useEffect(() => {
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
    setHasChanges(false);
  }, [preferences]);

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (preferences) {
        // Update existing
        const { error } = await supabase
          .from('notification_preferences')
          .update(data)
          .eq('id', preferences.id);
        if (error) throw error;
      } else {
        // Create new
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
            Configure quando e como você deseja receber lembretes
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
    </div>
  );
}
