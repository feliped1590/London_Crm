import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle, History } from 'lucide-react';

interface DraftRestoreDialogProps {
  open: boolean;
  title?: string;
  conflict?: boolean;
  savedAt?: number | null;
  onRestore: () => void;
  onDiscard: () => void;
}

function formatRelative(savedAt: number | null | undefined): string {
  if (!savedAt) return '';
  const diff = Date.now() - savedAt;
  const min = Math.round(diff / 60000);
  if (min < 1) return 'agora há pouco';
  if (min === 1) return 'há 1 minuto';
  if (min < 60) return `há ${min} minutos`;
  const h = Math.round(min / 60);
  if (h === 1) return 'há 1 hora';
  if (h < 24) return `há ${h} horas`;
  const d = Math.round(h / 24);
  if (d === 1) return 'há 1 dia';
  return `há ${d} dias`;
}

export function DraftRestoreDialog({
  open,
  title = 'Você tem um rascunho não salvo',
  conflict = false,
  savedAt,
  onRestore,
  onDiscard,
}: DraftRestoreDialogProps) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {conflict ? (
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            ) : (
              <History className="h-5 w-5 text-primary" />
            )}
            {conflict ? 'Conflito detectado neste rascunho' : title}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            {conflict ? (
              <>
                <span className="block">
                  Este registro foi alterado por outra sessão depois que você salvou o rascunho{' '}
                  {savedAt ? <strong>({formatRelative(savedAt)})</strong> : null}.
                </span>
                <span className="block">
                  Restaurar agora pode sobrescrever as alterações mais recentes. Se preferir, descarte
                  o rascunho e continue a partir da versão atual do banco.
                </span>
              </>
            ) : (
              <span>
                Encontramos um rascunho desta tela salvo{' '}
                {savedAt ? <strong>{formatRelative(savedAt)}</strong> : 'nesta sessão'}. Deseja
                restaurar os dados que você havia preenchido?
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onDiscard}>Descartar rascunho</AlertDialogCancel>
          <AlertDialogAction
            onClick={onRestore}
            className={
              conflict
                ? 'bg-amber-500 text-white hover:bg-amber-500/90'
                : undefined
            }
          >
            {conflict ? 'Restaurar mesmo assim' : 'Restaurar rascunho'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
