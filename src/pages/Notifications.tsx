import { useMemo, useState } from 'react';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  useNotificationsList,
  useMarkAllNotificationsRead,
  useUnreadNotificationCount,
  type NotificationFilter,
} from '@/hooks/useNotifications';
import { NotificationItem } from '@/components/notifications/NotificationItem';

export default function NotificationsPage() {
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const { data: items = [], isLoading } = useNotificationsList(filter, 100);
  const { data: unread = 0 } = useUnreadNotificationCount();
  const markAll = useMarkAllNotificationsRead();

  const emptyLabel = useMemo(() => {
    switch (filter) {
      case 'unread': return 'Nenhuma notificação não visualizada.';
      case 'read': return 'Nenhuma notificação visualizada.';
      case 'archived': return 'Nenhuma notificação arquivada.';
      default: return 'Você não tem notificações.';
    }
  }, [filter]);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-muted-foreground" />
          <h1 className="font-display text-xl font-semibold tracking-tight">
            Central de notificações
          </h1>
          {unread > 0 && <Badge variant="secondary">{unread} não lidas</Badge>}
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={unread === 0 || markAll.isPending}
          onClick={() => markAll.mutate()}
        >
          <CheckCheck className="mr-2 h-4 w-4" />
          Marcar todas como lidas
        </Button>
      </header>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as NotificationFilter)}>
        <TabsList>
          <TabsTrigger value="all">Todas</TabsTrigger>
          <TabsTrigger value="unread">Não lidas</TabsTrigger>
          <TabsTrigger value="read">Lidas</TabsTrigger>
          <TabsTrigger value="archived">Arquivadas</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className="overflow-hidden p-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Carregando…
          </div>
        ) : items.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            {emptyLabel}
          </div>
        ) : (
          items.map((n) => <NotificationItem key={n.id} notification={n} />)
        )}
      </Card>
    </div>
  );
}
