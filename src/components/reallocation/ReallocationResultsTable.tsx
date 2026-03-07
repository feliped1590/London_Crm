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
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from '@/components/ui/pagination';
import { Building2, AlertTriangle, Clock, ShoppingCart, Database, Cloud } from 'lucide-react';
import { CompanyForReallocation } from '@/hooks/usePortfolioReallocation';
import { cn } from '@/lib/utils';

interface ReallocationResultsTableProps {
  companies: CompanyForReallocation[];
  selectedCompanies: Set<string>;
  onToggleSelect: (companyId: string) => void;
  onToggleSelectAll: () => void;
  isLoading?: boolean;
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
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

function getPageNumbers(currentPage: number, totalPages: number): (number | 'ellipsis')[] {
  const pages: (number | 'ellipsis')[] = [];
  
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i);
    }
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push('ellipsis');
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push('ellipsis');
    pages.push(totalPages);
  }
  
  return pages;
}

export function ReallocationResultsTable({
  companies,
  selectedCompanies,
  onToggleSelect,
  onToggleSelectAll,
  isLoading,
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange
}: ReallocationResultsTableProps) {
  const pageIds = companies.map(c => c.company_id);
  const allPageSelected = pageIds.length > 0 && pageIds.every(id => selectedCompanies.has(id));
  const somePageSelected = pageIds.some(id => selectedCompanies.has(id)) && !allPageSelected;

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  if (isLoading) {
    return (
      <div className="border rounded-lg p-8 text-center text-muted-foreground">
        <Clock className="h-8 w-8 mx-auto mb-2 animate-spin" />
        <p>Carregando clientes...</p>
      </div>
    );
  }

  if (totalItems === 0) {
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

  const pageNumbers = getPageNumbers(currentPage, totalPages);

  return (
    <div className="space-y-4">
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={allPageSelected}
                  ref={(el) => {
                    if (el) (el as any).indeterminate = somePageSelected;
                  }}
                  onCheckedChange={onToggleSelectAll}
                />
              </TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>UF / Região</TableHead>
              <TableHead>Vendedor</TableHead>
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
              
              const vendedorNome = company.sales_rep_name || 'Sem vendedor';
              
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
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{company.company_name}</p>
                          <Badge 
                            variant={company.source === 'crm' ? 'default' : 'secondary'}
                            className={cn(
                              "text-xs px-1.5 py-0",
                              company.source === 'crm' 
                                ? "bg-blue-500/10 text-blue-600 border-blue-200" 
                                : "bg-orange-500/10 text-orange-600 border-orange-200"
                            )}
                          >
                            {company.source === 'crm' ? (
                              <><Cloud className="h-3 w-3 mr-1" />CRM</>
                            ) : (
                              <><Database className="h-3 w-3 mr-1" />ERP</>
                            )}
                          </Badge>
                        </div>
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
                    <span className="text-sm">{vendedorNome}</span>
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

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Exibindo {startItem}-{endItem} de {totalItems} clientes
          </p>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => currentPage > 1 && onPageChange(currentPage - 1)}
                  className={cn(currentPage === 1 && "pointer-events-none opacity-50")}
                />
              </PaginationItem>
              
              {pageNumbers.map((page, index) => (
                <PaginationItem key={index}>
                  {page === 'ellipsis' ? (
                    <PaginationEllipsis />
                  ) : (
                    <PaginationLink
                      onClick={() => onPageChange(page)}
                      isActive={currentPage === page}
                    >
                      {page}
                    </PaginationLink>
                  )}
                </PaginationItem>
              ))}
              
              <PaginationItem>
                <PaginationNext 
                  onClick={() => currentPage < totalPages && onPageChange(currentPage + 1)}
                  className={cn(currentPage === totalPages && "pointer-events-none opacity-50")}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}
