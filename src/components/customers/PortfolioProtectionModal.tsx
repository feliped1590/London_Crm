import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShieldAlert, UserCircle, CalendarClock, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TransferRequestModal } from '@/components/customers/TransferRequestModal';
import type { PortfolioProtectionInfo } from '@/hooks/usePortfolioProtection';

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

  const daysSinceLastActivity = info.lastActivity?.date
    ? Math.floor((Date.now() - new Date(info.lastActivity.date).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <>
      <Dialog open={open && !showTransferModal} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <div className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" />
              <DialogTitle>Cliente de outra carteira</DialogTitle>
            </div>
            <DialogDescription>
              Este cliente pertence a outro vendedor. Você não pode registrar atividades ou notas neste cliente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
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
                      {daysSinceLastActivity !== null && (
                        <Badge variant={daysSinceLastActivity > 30 ? 'destructive' : 'secondary'} className="text-xs">
                          {daysSinceLastActivity} dias atrás
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
