import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Mail, ArrowUpDown, Building2, User } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/formatters';
import type { Tables } from '@/integrations/supabase/types';

type Deal = Tables<'deals'> & {
  companies?: { name: string } | null;
  contacts?: { first_name: string; last_name: string | null; email: string | null } | null;
};

type DealStage = Tables<'deals'>['stage'];

const stageConfig: Record<DealStage, { label: string; color: string }> = {
  prospeccao: { label: 'Prospecção', color: 'bg-slate-500' },
  qualificacao: { label: 'Qualificação', color: 'bg-blue-500' },
  proposta: { label: 'Proposta', color: 'bg-yellow-500' },
  negociacao: { label: 'Negociação', color: 'bg-orange-500' },
  fechado_ganho: { label: 'Fechado (Ganho)', color: 'bg-green-500' },
  fechado_perdido: { label: 'Fechado (Perdido)', color: 'bg-red-500' },
};

type SortField = 'name' | 'value' | 'stage' | 'probability' | 'expected_close_date';
type SortOrder = 'asc' | 'desc';

interface PipelineListViewProps {
  deals: Deal[];
  onEdit: (deal: Deal) => void;
  onSendEmail: (deal: Deal) => void;
}

export function PipelineListView({ deals, onEdit, onSendEmail }: PipelineListViewProps) {
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const sortedDeals = [...deals].sort((a, b) => {
    let comparison = 0;
    
    switch (sortField) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'value':
        comparison = (a.value || 0) - (b.value || 0);
        break;
      case 'stage':
        comparison = a.stage.localeCompare(b.stage);
        break;
      case 'probability':
        comparison = (a.probability || 0) - (b.probability || 0);
        break;
      case 'expected_close_date':
        const dateA = a.expected_close_date ? new Date(a.expected_close_date).getTime() : 0;
        const dateB = b.expected_close_date ? new Date(b.expected_close_date).getTime() : 0;
        comparison = dateA - dateB;
        break;
    }
    
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8 data-[state=open]:bg-accent"
      onClick={() => handleSort(field)}
    >
      {children}
      <ArrowUpDown className="ml-2 h-4 w-4" />
    </Button>
  );

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[250px]">
              <SortableHeader field="name">Nome</SortableHeader>
            </TableHead>
            <TableHead>Empresa</TableHead>
            <TableHead>Contato</TableHead>
            <TableHead className="text-right">
              <SortableHeader field="value">Valor</SortableHeader>
            </TableHead>
            <TableHead>
              <SortableHeader field="stage">Etapa</SortableHeader>
            </TableHead>
            <TableHead className="text-center">
              <SortableHeader field="probability">Prob.</SortableHeader>
            </TableHead>
            <TableHead>
              <SortableHeader field="expected_close_date">Previsão</SortableHeader>
            </TableHead>
            <TableHead className="w-[80px]">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedDeals.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                Nenhum negócio encontrado
              </TableCell>
            </TableRow>
          ) : (
            sortedDeals.map((deal) => (
              <TableRow 
                key={deal.id} 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onEdit(deal)}
              >
                <TableCell className="font-medium">{deal.name}</TableCell>
                <TableCell>
                  {deal.companies?.name ? (
                    <div className="flex items-center gap-1.5 text-sm">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{deal.companies.name}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  {deal.contacts ? (
                    <div className="flex items-center gap-1.5 text-sm">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{deal.contacts.first_name} {deal.contacts.last_name}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-right font-semibold text-primary">
                  {formatCurrency(deal.value || 0)}
                </TableCell>
                <TableCell>
                  {(() => {
                    const cfg = deal.stage ? stageConfig[deal.stage as DealStage] : null;
                    if (!cfg) {
                      return <span className="text-muted-foreground text-sm">-</span>;
                    }
                    return (
                      <Badge variant="secondary" className="gap-1.5">
                        <div className={`h-2 w-2 rounded-full ${cfg.color}`} />
                        {cfg.label}
                      </Badge>
                    );
                  })()}
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline">{deal.probability}%</Badge>
                </TableCell>
                <TableCell>
                  {deal.expected_close_date ? formatDate(deal.expected_close_date) : '-'}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {deal.contacts?.email && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSendEmail(deal);
                        }}
                      >
                        <Mail className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
