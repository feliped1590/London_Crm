import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Building2, Calendar, ClipboardList } from "lucide-react";
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
import { InactiveCustomer } from "@/hooks/useBusinessInsights";
import { formatCurrency } from "@/lib/formatters";

interface InactiveCustomersTableProps {
  customers: InactiveCustomer[];
  onCreateTask?: (customerId: string, customerName: string) => void;
}

export function InactiveCustomersTable({
  customers,
  onCreateTask,
}: InactiveCustomersTableProps) {
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

  if (customers.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Building2 className="mx-auto h-12 w-12 mb-4 opacity-50" />
        <p>Nenhum cliente inativo encontrado</p>
        <p className="text-sm">Todos os clientes estão comprando regularmente!</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Empresa</TableHead>
            <TableHead>Último Pedido</TableHead>
            <TableHead className="text-center">Dias Sem Compra</TableHead>
            <TableHead className="text-right">Total Histórico</TableHead>
            <TableHead className="text-center">Pedidos</TableHead>
            <TableHead className="text-center">Severidade</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {customers.map((customer) => (
            <TableRow key={customer.id}>
              <TableCell className="font-medium">
                <button
                  onClick={() => navigate(`/companies?id=${customer.id}`)}
                  className="hover:underline text-left"
                >
                  {customer.name}
                </button>
              </TableCell>
              <TableCell>
                {customer.lastOrderDate ? (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {format(customer.lastOrderDate, "dd/MM/yyyy", { locale: ptBR })}
                  </div>
                ) : (
                  "-"
                )}
              </TableCell>
              <TableCell className="text-center font-semibold">
                {customer.daysSinceLastOrder} dias
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(customer.totalValue)}
              </TableCell>
              <TableCell className="text-center">{customer.totalOrders}</TableCell>
              <TableCell className="text-center">
                {getSeverityBadge(customer.severity)}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onCreateTask?.(customer.id, customer.name)}
                >
                  <ClipboardList className="h-4 w-4 mr-1" />
                  Follow-up
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
