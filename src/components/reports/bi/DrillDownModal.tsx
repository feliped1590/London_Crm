import { StalledDealData } from '@/hooks/useBIAdvanced';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, Clock } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { Link } from 'react-router-dom';

const STAGE_LABELS: Record<string, string> = {
  prospeccao: 'Prospecção',
  qualificacao: 'Qualificação',
  proposta: 'Proposta',
  negociacao: 'Negociação',
  fechado_ganho: 'Fechado Ganho',
  fechado_perdido: 'Fechado Perdido',
};

interface DrillDownModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  data: StalledDealData[];
}

export function DrillDownModal({ isOpen, onClose, title, data }: DrillDownModalProps) {
  const getSeverityColor = (days: number) => {
    if (days >= 14) return 'destructive';
    if (days >= 7) return 'outline';
    return 'secondary';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {title}
            <Badge variant="outline">{data.length} negócios</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {data.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum negócio encontrado para os critérios selecionados.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Negócio</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Etapa</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Clock className="h-3 w-3" />
                      Dias Parado
                    </div>
                  </TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((deal) => (
                  <TableRow key={deal.deal_id}>
                    <TableCell className="font-medium">{deal.deal_name}</TableCell>
                    <TableCell>{deal.company_name || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {STAGE_LABELS[deal.stage] || deal.stage}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {deal.value ? formatCurrency(deal.value) : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={getSeverityColor(deal.days_stalled)}>
                        {deal.days_stalled} dias
                      </Badge>
                    </TableCell>
                    <TableCell>{deal.owner_name || '-'}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/pipeline?deal=${deal.deal_id}`}>
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
