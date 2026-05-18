import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { ArrowRight, Copy } from 'lucide-react';

export interface StructuralFieldChange {
  label: string;
  from: string;
  to: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentSku: string;
  newSku: string;
  currentName: string;
  newName: string;
  changes: StructuralFieldChange[];
  onConfirm: () => void;
  onDuplicate: () => void;
}

export function ConfirmStructuralChangeDialog({
  open,
  onOpenChange,
  currentSku,
  newSku,
  currentName,
  newName,
  changes,
  onConfirm,
  onDuplicate,
}: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Alterações na estrutura do produto</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                As alterações modificam a estrutura técnica do produto e o <strong>SKU será regenerado</strong>.
                Como deseja prosseguir?
              </p>

              <div className="rounded-md border bg-muted/30 p-3 space-y-2 text-sm">
                <div className="flex items-center gap-2 font-mono">
                  <span className="text-muted-foreground line-through">{currentSku || '—'}</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <span className="font-semibold text-foreground">{newSku || '—'}</span>
                </div>
                {currentName !== newName && (
                  <div className="text-xs text-muted-foreground">
                    <div className="line-through">{currentName}</div>
                    <div className="text-foreground">{newName}</div>
                  </div>
                )}
              </div>

              {changes.length > 0 && (
                <div className="text-xs">
                  <div className="font-medium mb-1 text-foreground">Campos alterados:</div>
                  <ul className="space-y-0.5">
                    {changes.map((c) => (
                      <li key={c.label} className="font-mono">
                        <span className="text-muted-foreground">{c.label}:</span>{' '}
                        <span className="line-through text-muted-foreground">{c.from || '—'}</span>{' '}
                        <ArrowRight className="inline h-3 w-3" />{' '}
                        <span className="text-foreground">{c.to || '—'}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col-reverse sm:flex-row sm:justify-between sm:items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              onDuplicate();
            }}
            className="gap-2"
          >
            <Copy className="h-4 w-4" />
            Duplicar item
          </Button>
          <div className="flex flex-col-reverse sm:flex-row gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Não, cancelar
            </Button>
            <Button
              type="button"
              onClick={() => {
                onOpenChange(false);
                onConfirm();
              }}
            >
              Sim, alterar SKU
            </Button>
          </div>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
