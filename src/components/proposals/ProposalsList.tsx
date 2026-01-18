import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, FileText, Edit, Eye } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { Proposal, proposalStatusConfig } from '@/types/products';
import { ProposalDialog } from './ProposalDialog';

interface ProposalsListProps {
  dealId: string;
  companyId?: string | null;
  contactId?: string | null;
}

export function ProposalsList({ dealId, companyId, contactId }: ProposalsListProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);

  const { data: proposals, isLoading, refetch } = useQuery({
    queryKey: ['proposals', dealId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proposals')
        .select(`
          *,
          company:companies(id, name),
          contact:contacts(id, first_name, last_name)
        `)
        .eq('deal_id', dealId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as unknown as Proposal[];
    },
  });

  const handleNewProposal = () => {
    setSelectedProposal(null);
    setIsDialogOpen(true);
  };

  const handleEditProposal = (proposal: Proposal) => {
    setSelectedProposal(proposal);
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Propostas ({proposals?.length || 0})
        </h3>
        <Button size="sm" onClick={handleNewProposal}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Proposta
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        </div>
      ) : proposals && proposals.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Validade</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {proposals.map((proposal) => (
              <TableRow key={proposal.id}>
                <TableCell className="font-mono font-medium">{proposal.number}</TableCell>
                <TableCell>
                  <Badge className={proposalStatusConfig[proposal.status].color}>
                    {proposalStatusConfig[proposal.status].label}
                  </Badge>
                </TableCell>
                <TableCell>
                  {proposal.validity_date ? formatDate(proposal.validity_date) : '-'}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(proposal.total_value || 0)}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEditProposal(proposal)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="text-center py-8 text-muted-foreground border rounded-lg">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Nenhuma proposta criada</p>
          <Button variant="link" size="sm" onClick={handleNewProposal}>
            Criar primeira proposta
          </Button>
        </div>
      )}

      <ProposalDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        dealId={dealId}
        companyId={companyId}
        contactId={contactId}
        proposal={selectedProposal}
        onSuccess={refetch}
      />
    </div>
  );
}
