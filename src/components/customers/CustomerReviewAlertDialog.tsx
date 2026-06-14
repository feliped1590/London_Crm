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
import { AlertCircle } from 'lucide-react';

interface Props {
  open: boolean;
  customerName: string;
  lastReviewedLabel: string;
  canEdit: boolean;
  onReviewNow: () => void;
  onMarkReviewed: () => void;
  onClose: () => void;
  isMarking?: boolean;
}

export function CustomerReviewAlertDialog({
  open,
  customerName,
  lastReviewedLabel,
  canEdit,
  onReviewNow,
  onMarkReviewed,
  onClose,
  isMarking,
}: Props) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Revisão de cadastro pendente
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                O cadastro de <strong className="text-foreground">{customerName}</strong> precisa ser revisado.
              </p>
              <p>
                Última revisão: <strong className="text-foreground">{lastReviewedLabel}</strong>.
              </p>
              <p>
                A política da empresa exige revisão a cada 90 dias. Este alerta continuará
                aparecendo até que o cadastro seja revisado.
              </p>
              {!canEdit && (
                <p className="text-amber-600">
                  Você não tem permissão para editar este cadastro. Solicite ao vendedor responsável a revisão.
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Fechar</AlertDialogCancel>
          {canEdit && (
            <>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  onMarkReviewed();
                }}
                disabled={isMarking}
                className="bg-secondary text-secondary-foreground hover:bg-secondary/80"
              >
                Marcar como revisado
              </AlertDialogAction>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  onReviewNow();
                }}
              >
                Revisar agora
              </AlertDialogAction>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
