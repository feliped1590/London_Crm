import { Calendar, Link, Unlink, RefreshCw, Pause, Play, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function GoogleCalendarSettings() {
  const {
    isConfigured,
    isConnected,
    isSyncEnabled,
    lastSyncAt,
    connect,
    disconnect,
    toggleSync,
    triggerSync,
    isConnecting,
    isDisconnecting,
    isSyncing,
    isLoading,
  } = useGoogleCalendar();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Google Calendar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-10 bg-muted rounded w-1/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Integration not configured - show setup instructions
  if (!isConfigured) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Google Calendar
            <Badge variant="outline" className="ml-2">Não configurado</Badge>
          </CardTitle>
          <CardDescription>
            Sincronize suas tarefas com o Google Calendar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 border border-dashed">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="space-y-2">
                <p className="text-sm font-medium">Integração não configurada</p>
                <p className="text-sm text-muted-foreground">
                  Para ativar a sincronização com o Google Calendar, é necessário configurar as credenciais OAuth do Google.
                </p>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p className="font-medium">Credenciais necessárias:</p>
                  <ul className="list-disc list-inside ml-2 space-y-1">
                    <li>GOOGLE_CLIENT_ID</li>
                    <li>GOOGLE_CLIENT_SECRET</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
          
          <div className="text-xs text-muted-foreground">
            <p>Quando configurado, você poderá:</p>
            <ul className="list-disc list-inside mt-1 space-y-0.5">
              <li>Sincronizar tarefas com horário para o Google Calendar</li>
              <li>Importar eventos do Google Calendar como tarefas</li>
              <li>Manter ambos os calendários atualizados automaticamente</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Not connected - show connect button
  if (!isConnected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Google Calendar
          </CardTitle>
          <CardDescription>
            Conecte sua conta do Google para sincronizar tarefas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Ao conectar, suas tarefas com horário definido serão sincronizadas automaticamente com o Google Calendar.
          </p>
          
          <Button 
            onClick={() => connect()}
            disabled={isConnecting}
            className="gap-2"
          >
            <Link className="h-4 w-4" />
            {isConnecting ? 'Conectando...' : 'Conectar Google Calendar'}
          </Button>
          
          <div className="text-xs text-muted-foreground">
            <p>Apenas tarefas com horário definido serão sincronizadas.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Connected - show status and controls
  return (
    <Card>
      <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Google Calendar
            <Badge variant="default" className="ml-2">Conectado</Badge>
        </CardTitle>
        <CardDescription>
          Sua conta está conectada e sincronizando
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Sync Status */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium">Status da sincronização</p>
            <div className="flex items-center gap-2">
              {isSyncEnabled ? (
                <Badge variant="secondary" className="gap-1">
                  <Play className="h-3 w-3" />
                  Ativa
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1">
                  <Pause className="h-3 w-3" />
                  Pausada
                </Badge>
              )}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => toggleSync(!isSyncEnabled)}
            className="gap-2"
          >
            {isSyncEnabled ? (
              <>
                <Pause className="h-4 w-4" />
                Pausar
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Ativar
              </>
            )}
          </Button>
        </div>

        <Separator />

        {/* Last Sync */}
        <div className="space-y-1">
          <p className="text-sm font-medium">Última sincronização</p>
          <p className="text-sm text-muted-foreground">
            {lastSyncAt 
              ? format(new Date(lastSyncAt), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })
              : 'Nunca sincronizado'
            }
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => triggerSync()}
            disabled={isSyncing || !isSyncEnabled}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Sincronizando...' : 'Sincronizar agora'}
          </Button>
        </div>

        <Separator />

        {/* Disconnect */}
        <div className="pt-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => disconnect()}
            disabled={isDisconnecting}
            className="gap-2"
          >
            <Unlink className="h-4 w-4" />
            {isDisconnecting ? 'Desconectando...' : 'Desconectar Google Calendar'}
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            Desconectar não remove tarefas já criadas, apenas para a sincronização.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
