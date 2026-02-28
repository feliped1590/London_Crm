import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Monitor, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ActiveSessionInfo {
  started_at: string;
  device_info: string | null;
  ip_address: string | null;
}

interface ActiveSessionModalProps {
  open: boolean;
  session: ActiveSessionInfo | null;
  isLoading: boolean;
  onCancel: () => void;
  onReplace: () => void;
}

export function ActiveSessionModal({ open, session, isLoading, onCancel, onReplace }: ActiveSessionModalProps) {
  const formattedDate = session?.started_at
    ? format(new Date(session.started_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
    : '';

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5 text-destructive" />
            Sessão ativa detectada
          </DialogTitle>
          <DialogDescription>
            Você já possui uma sessão ativa em outro dispositivo. Apenas uma sessão simultânea é permitida.
          </DialogDescription>
        </DialogHeader>

        {session && (
          <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Logon em:</span>
              <span className="font-medium">{formattedDate}</span>
            </div>
            {session.device_info && (
              <div className="flex items-center gap-2 text-sm">
                <Monitor className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Dispositivo:</span>
                <span className="font-medium">{session.device_info}</span>
              </div>
            )}
            {session.ip_address && (
              <div className="text-sm">
                <span className="text-muted-foreground">IP: </span>
                <span className="font-medium">{session.ip_address}</span>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={onReplace} disabled={isLoading}>
            {isLoading ? 'Encerrando...' : 'Encerrar outra sessão e continuar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
