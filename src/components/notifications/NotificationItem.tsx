import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Check, Archive, ExternalLink, CircleAlert, Info, ClipboardCheck, ListTodo, Settings as SettingsIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { NotificationRow } from '@/hooks/useNotifications';
import { useMarkNotificationRead, useArchiveNotification } from '@/hooks/useNotifications';

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  info: Info,
  alert: CircleAlert,
  approval: ClipboardCheck,
  task: ListTodo,
  system: SettingsIcon,
  transfer_request: ClipboardCheck,
};

const TYPE_COLOR: Record<string, string> = {
  info: 'text-sky-500',
  alert: 'text-destructive',
  approval: 'text-amber-500',
  task: 'text-emerald-500',
  system: 'text-muted-foreground',
  transfer_request: 'text-amber-500',
};

interface Props {
  notification: NotificationRow;
  onAfterAction?: () => void;
  compact?: boolean;
}

export function NotificationItem({ notification, onAfterAction, compact }: Props) {
  const navigate = useNavigate();
  const markRead = useMarkNotificationRead();
  const archive = useArchiveNotification();

  const Icon = TYPE_ICON[notification.type] ?? Info;
  const color = TYPE_COLOR[notification.type] ?? 'text-muted-foreground';
  const target = notification.action_url ?? notification.link ?? null;

  const handleOpen = async () => {
    if (!notification.is_read) {
      try {
        await markRead.mutateAsync(notification.id);
      } catch {
        /* noop */
      }
    }
    if (target) navigate(target);
    onAfterAction?.();
  };

  return (
    <div
      className={cn(
        'group flex gap-3 px-3 py-2.5 transition-colors hover:bg-muted/60 cursor-pointer border-b border-border-subtle last:border-b-0',
        !notification.is_read && 'bg-primary/[0.04]',
      )}
      onClick={handleOpen}
    >
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
        <Icon className={cn('h-4 w-4', color)} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className={cn('truncate text-sm', !notification.is_read ? 'font-semibold' : 'font-medium')}>
            {notification.title}
          </p>
          {!notification.is_read && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
        </div>
        <p className={cn('text-xs text-muted-foreground', compact ? 'line-clamp-1' : 'line-clamp-2')}>
          {notification.message}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: ptBR })}
        </p>
      </div>

      {!compact && (
        <div className="flex flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {!notification.is_read && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              title="Marcar como lida"
              onClick={(e) => {
                e.stopPropagation();
                markRead.mutate(notification.id);
              }}
            >
              <Check className="h-3.5 w-3.5" />
            </Button>
          )}
          {target && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              title="Abrir origem"
              onClick={(e) => {
                e.stopPropagation();
                handleOpen();
              }}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          )}
          {notification.status !== 'archived' && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              title="Arquivar"
              onClick={(e) => {
                e.stopPropagation();
                archive.mutate(notification.id);
              }}
            >
              <Archive className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
