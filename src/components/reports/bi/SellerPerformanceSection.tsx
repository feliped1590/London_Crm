import { SellerPerformanceData } from '@/hooks/useBIAdvanced';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, TrendingUp, TrendingDown, Eye, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';

interface SellerPerformanceSectionProps {
  data: SellerPerformanceData[];
  onDrillDown: (type: string, params: Record<string, any>) => void;
}

export function SellerPerformanceSection({ data, onDrillDown }: SellerPerformanceSectionProps) {
  const avgConversion = data.length > 0
    ? data.reduce((acc, s) => acc + s.conversion_rate, 0) / data.length
    : 0;

  const getConversionTrend = (current: number, previous: number) => {
    if (previous === 0) return null;
    const diff = current - previous;
    if (Math.abs(diff) < 5) return null;
    return diff > 0 ? 'up' : 'down';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Performance por Vendedor
            </CardTitle>
            <CardDescription>
              Conversão, ciclo médio e comparativo com período anterior
            </CardDescription>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{avgConversion.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground">conversão média do time</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vendedor</TableHead>
              <TableHead className="text-center">Criados</TableHead>
              <TableHead className="text-center">Ganhos</TableHead>
              <TableHead className="text-right">Valor Ganho</TableHead>
              <TableHead className="text-center">Conversão</TableHead>
              <TableHead className="text-center">Ciclo Médio</TableHead>
              <TableHead className="text-center">Parados</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((seller) => {
              const trend = getConversionTrend(seller.conversion_rate, seller.prev_conversion_rate);
              const needsAttention = seller.deals_stalled > 3 || seller.conversion_rate < avgConversion * 0.7;

              return (
                <TableRow 
                  key={seller.seller_id}
                  className={needsAttention ? 'bg-yellow-500/5' : ''}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{seller.seller_name}</span>
                      {needsAttention && (
                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <span>{seller.deals_created}</span>
                      {seller.prev_deals_created > 0 && (
                        <span className="text-xs text-muted-foreground">
                          ({seller.prev_deals_created})
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge 
                      variant={seller.deals_won > 0 ? 'default' : 'outline'}
                      className={seller.deals_won > 0 ? 'bg-green-500' : ''}
                    >
                      {seller.deals_won}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium text-green-600">
                    {formatCurrency(seller.total_value_won)}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <span className={seller.conversion_rate < avgConversion * 0.7 ? 'text-destructive font-medium' : ''}>
                        {seller.conversion_rate.toFixed(1)}%
                      </span>
                      {trend === 'up' && <TrendingUp className="h-3 w-3 text-green-500" />}
                      {trend === 'down' && <TrendingDown className="h-3 w-3 text-destructive" />}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={seller.avg_cycle_days > 30 ? 'text-yellow-600' : ''}>
                      {seller.avg_cycle_days.toFixed(0)} dias
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    {seller.deals_stalled > 0 ? (
                      <Badge 
                        variant={seller.deals_stalled > 3 ? 'destructive' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => onDrillDown('seller', { 
                          sellerId: seller.seller_id, 
                          sellerName: seller.seller_name 
                        })}
                      >
                        {seller.deals_stalled}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDrillDown('seller', { 
                        sellerId: seller.seller_id, 
                        sellerName: seller.seller_name 
                      })}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {data.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum dado de performance disponível para o período selecionado.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
