import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Building2, AlertTriangle, Clock, ShoppingCart } from 'lucide-react';
import { CompanyForReallocation } from '@/hooks/usePortfolioReallocation';
import { cn } from '@/lib/utils';

interface ReallocationResultsTableProps {
  companies: CompanyForReallocation[];
  selectedCompanies: Set<string>;
  onToggleSelect: (companyId: string) => void;
  onToggleSelectAll: () => void;
  isLoading?: boolean;
}

function getDaysBadgeVariant(days: number): 'default' | 'secondary' | 'warning' | 'destructive' {
  if (days >= 90) return 'destructive';
  if (days >= 30) return 'warning';
  if (days >= 14) return 'secondary';
  return 'default';
}

function formatDays(days: number): string {
  if (days >= 9999) return 'Nunca';
  if (days === 0) return 'Hoje';
  if (days === 1) return '1 dia';
  return `${days} dias`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}

export function ReallocationResultsTable({
  companies,
  selectedCompanies,
  onToggleSelect,
  onToggleSelectAll,
  isLoading
}: ReallocationResultsTableProps) {
  const allSelected = companies.length > 0 && selectedCompanies.size === companies.length;
  const someSelected = selectedCompanies.size > 0 && selectedCompanies.size < companies.length;

  if (isLoading) {
    return (
      <div className="border rounded-lg p-8 text-center text-muted-foreground">
        <Clock className="h-8 w-8 mx-auto mb-2 animate-spin" />
        <p>Carregando clientes...</p>
      </div>
    );
  }

  if (companies.length === 0) {
    return (
      <div className="border rounded-lg p-8 text-center text-muted-foreground">
        <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>Aplique os filtros acima para buscar clientes</p>
        <p className="text-sm mt-1">
          Defina ao menos um critério: UF, região, vendedor ou período de inatividade
        </p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Checkbox
                checked={allSelected}
                ref={(el) => {
                  if (el) (el as any).indeterminate = someSelected;
                }}
                onCheckedChange={onToggleSelectAll}
              />
            </TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>UF / Região</TableHead>
            <TableHead>Vendedor Atual</TableHead>
            <TableHead className="text-center">Últ. Atendimento</TableHead>
            <TableHead className="text-center">Últ. Venda</TableHead>
            <TableHead className="text-right">Pedidos</TableHead>
            <TableHead className="text-right">Valor Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {companies.map((company) => {
            const isSelected = selectedCompanies.has(company.company_id);
            const interactionVariant = getDaysBadgeVariant(company.days_since_interaction);
            const orderVariant = getDaysBadgeVariant(company.days_since_order);
            
            return (
              <TableRow 
                key={company.company_id}
                className={cn(
                  "cursor-pointer transition-colors",
                  isSelected && "bg-primary/5"
                )}
                onClick={() => onToggleSelect(company.company_id)}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onToggleSelect(company.company_id)}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="font-medium">{company.company_name}</p>
                      {company.cnpj && (
                        <p className="text-xs text-muted-foreground">{company.cnpj}</p>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-0.5">
                    {company.state && (
                      <span className="text-sm">{company.state}</span>
                    )}
                    {company.regiao && (
                      <p className="text-xs text-muted-foreground">{company.regiao}</p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-sm">{company.owner_name}</span>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant={interactionVariant === 'warning' ? 'secondary' : interactionVariant}>
                    {interactionVariant === 'destructive' && (
                      <AlertTriangle className="h-3 w-3 mr-1" />
                    )}
                    {formatDays(company.days_since_interaction)}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant={orderVariant === 'warning' ? 'secondary' : orderVariant}>
                    {orderVariant === 'destructive' && (
                      <ShoppingCart className="h-3 w-3 mr-1" />
                    )}
                    {formatDays(company.days_since_order)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <span className="text-sm">{company.total_orders}</span>
                </TableCell>
                <TableCell className="text-right">
                  <span className="text-sm font-medium">
                    {formatCurrency(company.total_order_value)}
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
