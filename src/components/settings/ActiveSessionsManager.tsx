import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Monitor, Clock, Wifi, LogOut, RefreshCw, Settings2, Save } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

export function ActiveSessionsManager() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Check if developer
  const { data: isDeveloper } = useQuery({
    queryKey: ['is_developer_sessions', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'desenvolvedor' as any });
      return data as boolean;
    },
    enabled: !!user?.id,
  });

  // Get idle timeout config
  const { data: idleTimeout, isLoading: timeoutLoading } = useQuery({
    queryKey: ['session_idle_timeout'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_session_idle_timeout_minutes');
      if (error) throw error;
      return (data as number) || 60;
    },
  });

  const [timeoutValue, setTimeoutValue] = useState<string>('');

  // Sync timeout value when data loads
  const displayTimeout = timeoutValue || String(idleTimeout || 60);

  const { data: sessions = [], isLoading, refetch } = useQuery({
    queryKey: ['active_sessions_admin'],
    queryFn: async () => {
      console.log('[ActiveSessions] Fetching sessions, user:', user?.id, user?.email);
      const { data, error } = await supabase.rpc('get_active_sessions_admin');
      console.log('[ActiveSessions] Result:', { data, error });
      if (error) {
        console.error('[ActiveSessions] Error:', error.message, error.details, error.hint);
        throw error;
      }
      return (data || []) as any[];
    },
  });

  const killMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase.rpc('admin_kill_session', { p_session_id: sessionId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active_sessions_admin'] });
      toast.success('Sessão encerrada com sucesso');
    },
    onError: () => toast.error('Erro ao encerrar sessão'),
  });

  const updateTimeoutMutation = useMutation({
    mutationFn: async (minutes: number) => {
      const { error } = await supabase
        .from('system_settings' as any)
        .upsert({
          key: 'session_config',
          value: { session_idle_timeout_minutes: minutes },
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session_idle_timeout'] });
      toast.success('Timeout de inatividade atualizado');
    },
    onError: () => toast.error('Erro ao atualizar configuração'),
  });

  const handleSaveTimeout = () => {
    const minutes = parseInt(displayTimeout, 10);
    if (isNaN(minutes) || minutes < 5 || minutes > 1440) {
      toast.error('Valor deve ser entre 5 e 1440 minutos');
      return;
    }
    updateTimeoutMutation.mutate(minutes);
  };

  return (
    <div className="space-y-6">
      {/* Session Config - Developer only */}
      {isDeveloper && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Settings2 className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-lg font-semibold">Configuração de Sessão</h3>
          </div>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-end gap-4">
                <div className="flex-1 max-w-xs">
                  <Label htmlFor="idle-timeout">Timeout de Inatividade (minutos)</Label>
                  <Input
                    id="idle-timeout"
                    type="number"
                    min={5}
                    max={1440}
                    value={displayTimeout}
                    onChange={(e) => setTimeoutValue(e.target.value)}
                    placeholder="60"
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Sessões inativas por mais de {displayTimeout} min serão encerradas automaticamente. (5–1440 min)
                  </p>
                </div>
                <Button
                  onClick={handleSaveTimeout}
                  disabled={updateTimeoutMutation.isPending || timeoutLoading}
                  className="gap-2"
                >
                  <Save className="h-4 w-4" />
                  {updateTimeoutMutation.isPending ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Active Sessions */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">Sessões Ativas</h3>
            <p className="text-sm text-muted-foreground">
              Gerencie sessões de usuários conectados ao sistema
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhuma sessão ativa no momento
              </p>
            ) : (
              <div className="space-y-3">
                {sessions.map((s: any) => {
                  const isOwnSession = s.user_id === user?.id;
                  return (
                    <div
                      key={s.session_id}
                      className="flex items-center justify-between p-4 rounded-lg border"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                          {(s.user_name || 'U')[0]?.toUpperCase()}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{s.user_name || 'Usuário'}</span>
                            {isOwnSession && (
                              <Badge variant="outline" className="text-xs">Você</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{s.user_email}</p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Logon: {format(new Date(s.started_at), "dd/MM HH:mm", { locale: ptBR })}
                            </span>
                            <span className="flex items-center gap-1">
                              <Wifi className="h-3 w-3" />
                              Atividade: {format(new Date(s.last_activity_at), "HH:mm", { locale: ptBR })}
                            </span>
                            {s.device_info && (
                              <span className="flex items-center gap-1">
                                <Monitor className="h-3 w-3" />
                                {s.device_info}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <Button
                        variant="destructive"
                        size="sm"
                        className="gap-2"
                        disabled={killMutation.isPending}
                        onClick={() => killMutation.mutate(s.session_id)}
                      >
                        <LogOut className="h-4 w-4" />
                        Derrubar
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
