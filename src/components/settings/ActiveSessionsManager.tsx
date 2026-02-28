import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Monitor, Clock, Wifi, LogOut, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

export function ActiveSessionsManager() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: sessions = [], isLoading, refetch } = useQuery({
    queryKey: ['active_sessions_admin'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_active_sessions_admin');
      if (error) throw error;
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
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
  );
}
