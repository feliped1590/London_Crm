import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FileText, ExternalLink, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExpiringProposal } from "@/hooks/useBusinessInsights";
import { formatCurrency } from "@/lib/formatters";

interface ExpiringProposalsTableProps {
  proposals: ExpiringProposal[];
}

export function ExpiringProposalsTable({ proposals }: ExpiringProposalsTableProps) {
  const navigate = useNavigate();

  const getSeverityBadge = (severity: "critical" | "warning" | "info") => {
    switch (severity) {
      case "critical":
        return <Badge variant="destructive">Crítico</Badge>;
      case "warning":
        return (
          <Badge variant="outline" className="border-yellow-500 bg-yellow-500/10 text-yellow-700">
            Atenção
          </Badge>
        );
      default:
        return <Badge variant="secondary">Info</Badge>;
    }
  };

  if (proposals.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
        <p>Nenhuma proposta expirando em breve</p>
        <p className="text-sm">Todas as propostas estão com validade OK!</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Proposta</TableHead>
            <TableHead>Empresa</TableHead>
            <TableHead>Contato</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead>Validade</TableHead>
            <TableHead className="text-center">Dias Restantes</TableHead>
            <TableHead className="text-center">Severidade</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {proposals.map((proposal) => (
            <TableRow key={proposal.id}>
              <TableCell className="font-medium">#{proposal.number}</TableCell>
              <TableCell className="text-muted-foreground">
                {proposal.companyName || "-"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {proposal.contactName || "-"}
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(proposal.totalValue)}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {format(proposal.validityDate, "dd/MM/yyyy", { locale: ptBR })}
                </div>
              </TableCell>
              <TableCell className="text-center font-semibold">
                <span
                  className={
                    proposal.daysUntilExpiry <= 3
                      ? "text-destructive"
                      : proposal.daysUntilExpiry <= 7
                      ? "text-yellow-600"
                      : ""
                  }
                >
                  {proposal.daysUntilExpiry} dias
                </span>
              </TableCell>
              <TableCell className="text-center">
                {getSeverityBadge(proposal.severity)}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(`/pipeline?deal=${proposal.dealId}`)}
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Ver Negócio
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
