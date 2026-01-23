import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TrendingDown, Calendar, ExternalLink } from "lucide-react";
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
import { StagnantDeal } from "@/hooks/useBusinessInsights";
import { formatCurrency } from "@/lib/formatters";

interface StagnantDealsTableProps {
  deals: StagnantDeal[];
}

const stageLabels: Record<string, string> = {
  prospeccao: "Prospecção",
  qualificacao: "Qualificação",
  proposta: "Proposta",
  negociacao: "Negociação",
  fechamento: "Fechamento",
};

export function StagnantDealsTable({ deals }: StagnantDealsTableProps) {
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

  if (deals.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <TrendingDown className="mx-auto h-12 w-12 mb-4 opacity-50" />
        <p>Nenhum negócio estagnado encontrado</p>
        <p className="text-sm">Todos os negócios estão progredindo!</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Negócio</TableHead>
            <TableHead>Empresa</TableHead>
            <TableHead>Etapa</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead>Última Atualização</TableHead>
            <TableHead className="text-center">Dias Parado</TableHead>
            <TableHead>Responsável</TableHead>
            <TableHead className="text-center">Severidade</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {deals.map((deal) => (
            <TableRow key={deal.id}>
              <TableCell className="font-medium">{deal.name}</TableCell>
              <TableCell className="text-muted-foreground">
                {deal.companyName || "-"}
              </TableCell>
              <TableCell>
                <Badge variant="outline">
                  {stageLabels[deal.stage] || deal.stage}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(deal.value)}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {format(deal.lastUpdate, "dd/MM/yyyy", { locale: ptBR })}
                </div>
              </TableCell>
              <TableCell className="text-center font-semibold">
                {deal.daysSinceUpdate} dias
              </TableCell>
              <TableCell className="text-muted-foreground">
                {deal.ownerName || "-"}
              </TableCell>
              <TableCell className="text-center">
                {getSeverityBadge(deal.severity)}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(`/pipeline?deal=${deal.id}`)}
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Ver Pipeline
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
