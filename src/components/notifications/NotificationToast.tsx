import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Bell } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUnreadNotificationCount } from '@/hooks/useNotifications';

/**
 * Mostra um toast discreto (canto inferior direito) UMA ÚNICA VEZ por sessão
 * quando o usuário possuir notificações não visualizadas. Não invasivo.
 */
export function NotificationToast() {
  const { user } = useAuth();
  const { data: unread } = useUnreadNotificationCount();
  const navigate = useNavigate();
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    if (!user?.id) return;
    if (unread === undefined || unread === null) return;
    if (unread <= 0) return;

    const sessionId = localStorage.getItem('app_session_id');
    if (!sessionId) return;

    const key = `notif_toast_checked_${sessionId}`;
    if (sessionStorage.getItem(key)) {
      firedRef.current = true;
      return;
    }
    sessionStorage.setItem(key, '1');
    firedRef.current = true;

    // Delay leve para não competir com o TaskAlertModal
    const t = setTimeout(() => {
      toast(`Você possui ${unread} notifica${unread === 1 ? 'ção não visualizada' : 'ções não visualizadas'}.`, {
        description: 'Abra a central de notificações para visualizá-las.',
        icon: <Bell className="h-4 w-4" />,
        position: 'bottom-right',
        duration: 8000,
        action: {
          label: 'Abrir',
          onClick: () => navigate('/notifications'),
        },
      });
    }, 1500);

    return () => clearTimeout(t);
  }, [user?.id, unread, navigate]);

  return null;
}
