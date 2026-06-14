import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useUnreadNotificationCount, useRecentNotifications, useMarkAllNotificationsRead } from '@/hooks/useNotifications';
import { NotificationItem } from './NotificationItem';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { data: unread = 0 } = useUnreadNotificationCount();
  const { data: items = [], isLoading } = useRecentNotifications(8);
  const markAll = useMarkAllNotificationsRead();

  const badge = unread > 99 ? '99+' : String(unread);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Notificações${unread > 0 ? ` (${unread} não lidas)` : ''}`}
          className="relative min-h-[40px] min-w-[40px]"
        >
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <Badge
              variant="destructive"
              className={cn(
                'absolute -right-0.5 -top-0.5 h-4 min-w-[16px] justify-center rounded-full px-1 text-[10px] leading-none',
              )}
            >
              {badge}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[360px] p-0 sm:w-[400px]">
        <div className="flex items-center justify-between border-b border-border-subtle px-3 py-2">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold">Notificações</p>
            {unread > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                {unread} não lidas
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            disabled={unread === 0 || markAll.isPending}
            onClick={() => markAll.mutate()}
          >
            <CheckCheck className="mr-1 h-3.5 w-3.5" />
            Marcar todas
          </Button>
        </div>

        <ScrollArea className="max-h-[440px]">
          {isLoading ? (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">Carregando…</div>
          ) : items.length === 0 ? (
            <div className="px-3 py-10 text-center text-sm text-muted-foreground">
              Você não tem notificações.
            </div>
          ) : (
            items.map((n) => (
              <NotificationItem
                key={n.id}
                notification={n}
                compact
                onAfterAction={() => setOpen(false)}
              />
            ))
          )}
        </ScrollArea>

        <div className="border-t border-border-subtle p-2">
          <Button asChild variant="ghost" size="sm" className="w-full text-xs" onClick={() => setOpen(false)}>
            <Link to="/notifications">Ver todas</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
