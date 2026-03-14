import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShieldAlert, UserCircle, CalendarClock, ArrowRight, AlertTriangle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TransferRequestModal } from '@/components/customers/TransferRequestModal';
import type { PortfolioProtectionInfo } from '@/hooks/usePortfolioProtection';
import { INACTIVITY_TRANSFER_DAYS } from '@/hooks/usePortfolioProtection';

interface PortfolioProtectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  info: PortfolioProtectionInfo;
}

export function PortfolioProtectionModal({ open, onOpenChange, info }: PortfolioProtectionModalProps) {
  const [showTransferModal, setShowTransferModal] = useState(false);

  const lastActivityLabel = info.lastActivity?.date
    ? format(new Date(info.lastActivity.date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
    : null;

  const hasNoActivity = !info.lastActivity?.date;
  const isInactive = info.isInactive;

  // Determine scenario
  const getScenarioContent = () => {
    if (hasNoActivity) {
      // Scenario 3: No activity history
      return {
        icon: <AlertTriangle className="h-5 w-5" />,
        title: 'Cliente sem histórico de atendimento',
        description: 'Este cliente ainda não possui atendimentos registrados. Você pode solicitar a transferência para sua carteira.',
        badgeLabel: 'Sem atendimento registrado',
        badgeVariant: 'destructive' as const,
      };
    }
    if (isInactive) {
      // Scenario 2: Inactive client (> 60 days)
      return {
        icon: <Clock className="h-5 w-5" />,
        title: 'Cliente inativo na carteira',
        description: `Este cliente está sem atendimento há mais de ${INACTIVITY_TRANSFER_DAYS} dias. Você pode solicitar a transferência da carteira deste cliente.`,
        badgeLabel: 'Cliente inativo na carteira atual',
        badgeVariant: 'destructive' as const,
      };
    }
    // Scenario 1: Active client
    return {
      icon: <ShieldAlert className="h-5 w-5" />,
      title: 'Cliente de outra carteira',
      description: 'Este cliente pertence a outro vendedor. Você não pode registrar atividades ou notas neste cliente.',
      badgeLabel: null,
      badgeVariant: 'secondary' as const,
    };
  };

  const scenario = getScenarioContent();

  return (
    <>
      <Dialog open={open && !showTransferModal} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <div className={`flex items-center gap-2 ${isInactive || hasNoActivity ? 'text-orange-600 dark:text-orange-400' : 'text-destructive'}`}>
              {scenario.icon}
              <DialogTitle>{scenario.title}</DialogTitle>
            </div>
            <DialogDescription>
              {scenario.description}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* Inactivity highlight badge */}
            {scenario.badgeLabel && (
              <div className="p-3 rounded-lg border border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/30">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400 flex-shrink-0" />
                  <span className="text-sm font-medium text-orange-700 dark:text-orange-300">
                    {scenario.badgeLabel}
                  </span>
                </div>
              </div>
            )}

            {/* Client info */}
            <div className="p-3 rounded-lg border bg-muted/30">
              <p className="text-xs text-muted-foreground mb-1">Cliente</p>
              <p className="text-sm font-medium text-foreground">{info.companyName}</p>
            </div>

            {/* Sales rep info */}
            <div className="p-3 rounded-lg border bg-muted/30 flex items-center gap-3">
              <UserCircle className="h-8 w-8 text-primary flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Vendedor responsável</p>
                <p className="text-sm font-semibold text-foreground">
                  {info.ownerSalesRepName || 'Não definido'}
                </p>
              </div>
            </div>

            {/* Last activity */}
            <div className="p-3 rounded-lg border bg-muted/30 flex items-center gap-3">
              <CalendarClock className="h-8 w-8 text-muted-foreground flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Último atendimento</p>
                {lastActivityLabel ? (
                  <div>
                    <p className="text-sm font-medium text-foreground">{lastActivityLabel}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {info.lastActivity?.userName && (
                        <span className="text-xs text-muted-foreground">
                          por {info.lastActivity.userName}
                        </span>
                      )}
                      {info.daysSinceLastActivity !== null && (
                        <Badge
                          variant={info.daysSinceLastActivity > INACTIVITY_TRANSFER_DAYS ? 'destructive' : info.daysSinceLastActivity > 30 ? 'destructive' : 'secondary'}
                          className="text-xs"
                        >
                          {info.daysSinceLastActivity} dias atrás
                        </Badge>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Nenhum atendimento registrado</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            {info.ownerSalesRepId && (
              <Button
                onClick={() => {
                  setShowTransferModal(true);
                }}
              >
                <ArrowRight className="h-4 w-4 mr-2" />
                Solicitar Transferência
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {info.ownerSalesRepId && info.ownerSalesRepName && (
        <TransferRequestModal
          open={showTransferModal}
          onOpenChange={(v) => {
            setShowTransferModal(v);
            if (!v) onOpenChange(false);
          }}
          companyId={info.companyId}
          companyName={info.companyName}
          currentSalesRepId={info.ownerSalesRepId}
          currentSalesRepName={info.ownerSalesRepName}
        />
      )}
    </>
  );
}
