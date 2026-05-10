import { useEffect, useState, type ReactNode } from 'react';
import { useLegalEntities } from '@/hooks/useLegalEntities';
import { NoLegalEntityScreen } from '@/components/auth/NoLegalEntityScreen';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Building2, Loader2 } from 'lucide-react';

/**
 * Guard global de contexto de entidade jurídica.
 *
 * Regras:
 * - Sem entidades acessíveis -> tela de bloqueio "no_entities".
 * - Com entidades acessíveis mas sem ativa válida:
 *   - se acessíveis === 1, auto-seleciona (única exceção determinística);
 *   - caso contrário, força seleção via modal não-fechável.
 * - Pronto -> renderiza children normalmente.
 */
export function LegalEntityGuard({ children }: { children: ReactNode }) {
  const {
    isLoading,
    blockReason,
    accessibleEntities,
    switchEntity,
    isSwitching,
    activeLegalEntityId,
  } = useLegalEntities();

  const [autoSelected, setAutoSelected] = useState(false);

  // Auto-seleção determinística quando há exatamente 1 entidade acessível.
  useEffect(() => {
    if (
      blockReason === 'no_active' &&
      accessibleEntities.length === 1 &&
      !isSwitching &&
      !autoSelected
    ) {
      setAutoSelected(true);
      switchEntity(accessibleEntities[0].id);
    }
  }, [blockReason, accessibleEntities, isSwitching, autoSelected, switchEntity]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (blockReason === 'no_entities') {
    return <NoLegalEntityScreen reason="no_entities" />;
  }

  if (blockReason === 'no_active') {
    // Auto-seleção em andamento ou múltiplas opções: modal forçado
    if (accessibleEntities.length === 1) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      );
    }
    return (
      <>
        <div className="min-h-screen bg-background" aria-hidden />
        <Dialog open>
          <DialogContent
            className="sm:max-w-md"
            onPointerDownOutside={(e) => e.preventDefault()}
            onEscapeKeyDown={(e) => e.preventDefault()}
            onInteractOutside={(e) => e.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Selecione um CNPJ
              </DialogTitle>
              <DialogDescription>
                Selecione a entidade jurídica que será o contexto operacional do
                sistema. Esta seleção é obrigatória para continuar.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2 py-2">
              {accessibleEntities.map((entity) => (
                <Button
                  key={entity.id}
                  variant="outline"
                  className="justify-start h-auto py-3"
                  disabled={isSwitching}
                  onClick={() => switchEntity(entity.id)}
                >
                  <div className="flex flex-col items-start text-left">
                    <span className="font-medium">{entity.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {entity.cnpj}
                    </span>
                  </div>
                </Button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Sanity guard: contexto pronto exige activeLegalEntityId
  if (!activeLegalEntityId) {
    return <NoLegalEntityScreen reason="no_active" />;
  }

  return <>{children}</>;
}
