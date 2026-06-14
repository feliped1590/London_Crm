import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, FileText, Edit, FileDown, Trash2 } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { useQuickQuotesByDeal, useQuickQuoteMutations, openQuickQuotePdf, QuickQuote, QuickQuoteStatus } from '@/hooks/useQuickQuotes';
import { QuickQuoteDialog } from './QuickQuoteDialog';

interface Props {
  dealId: string;
  defaultLegalEntityId: string | null;
  defaultCompanyId?: string | null;
}

const STATUS_LABEL: Record<QuickQuoteStatus, string> = {
  draft: 'Rascunho', sent: 'Enviado', approved: 'Aprovado',
  rejected: 'Reprovado', expired: 'Expirado', converted: 'Convertido',
};
const STATUS_VARIANT: Record<QuickQuoteStatus, 'secondary' | 'default' | 'outline' | 'destructive'> = {
  draft: 'outline', sent: 'secondary', approved: 'default',
  rejected: 'destructive', expired: 'outline', converted: 'default',
};

export function QuickQuoteList({ dealId, defaultLegalEntityId, defaultCompanyId }: Props) {
  const { data: quotes = [], isLoading } = useQuickQuotesByDeal(dealId);
  const { remove } = useQuickQuoteMutations(dealId);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<QuickQuote | null>(null);

  const onNew = () => { setEditing(null); setOpen(true); };
  const onEdit = (q: QuickQuote) => { setEditing(q); setOpen(true); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Orçamentos Livres ({quotes.length})
        </h3>
        <Button size="sm" onClick={onNew} disabled={!defaultLegalEntityId}>
          <Plus className="h-4 w-4 mr-2" /> Novo Orçamento
        </Button>
      </div>

      {!defaultLegalEntityId && (
        <p className="text-sm text-muted-foreground">
          Selecione um CNPJ de atendimento no negócio para criar orçamentos.
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : quotes.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum orçamento criado ainda.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Validade</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quotes.map((q) => (
              <TableRow key={q.id}>
                <TableCell className="font-mono">{q.number || '-'}</TableCell>
                <TableCell>{q.client_name}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[q.status]}>{STATUS_LABEL[q.status]}</Badge>
                </TableCell>
                <TableCell>{q.validity_date ? formatDate(q.validity_date) : '-'}</TableCell>
                <TableCell className="text-right">{formatCurrency(q.total_value)}</TableCell>
                <TableCell>{formatDate(q.created_at)}</TableCell>
                <TableCell className="text-right space-x-1">
                  <Button size="icon" variant="ghost" onClick={() => onEdit(q)} title="Editar">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon" variant="ghost"
                    title="Gerar PDF"
                    onClick={() => openQuickQuotePdf(q.id, { markSent: q.status === 'draft' })}
                  >
                    <FileDown className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon" variant="ghost"
                    title="Excluir"
                    onClick={() => {
                      if (confirm(`Excluir orçamento ${q.number}?`)) remove.mutate(q.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <QuickQuoteDialog
        open={open}
        onOpenChange={setOpen}
        dealId={dealId}
        defaultLegalEntityId={defaultLegalEntityId}
        defaultCompanyId={defaultCompanyId}
        editing={editing}
      />
    </div>
  );
}
