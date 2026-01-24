import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSalesFunnelData } from '@/hooks/useSalesFunnelData';
import { formatCurrency } from '@/lib/formatters';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingDown, TrendingUp, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export function SalesFunnelChart() {
  const { funnelData, isLoading } = useSalesFunnelData();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12" style={{ width: `${100 - i * 15}%` }} />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!funnelData || funnelData.stages.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Funil de Vendas</CardTitle>
          <CardDescription>Visualização do pipeline e taxas de conversão</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-48 text-muted-foreground">
            Nenhum negócio encontrado
          </div>
        </CardContent>
      </Card>
    );
  }

  // Get max count for width calculation
  const maxCount = Math.max(...funnelData.stages.map(s => s.count), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Funil de Vendas
          <span className="text-sm font-normal text-muted-foreground">
            ({funnelData.totalDeals} negócios)
          </span>
        </CardTitle>
        <CardDescription>
          Taxa de conversão geral: {funnelData.overallConversionRate.toFixed(1)}%
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {funnelData.stages.map((stage, index) => {
          // Calculate width percentage (minimum 20% for visibility)
          const widthPercent = Math.max(20, (stage.count / maxCount) * 100);
          
          // Determine if this is a bottleneck (conversion rate < 50%)
          const isBottleneck = stage.conversionRate !== null && stage.conversionRate < 50;
          
          return (
            <div key={stage.stage} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{stage.label}</span>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <span>{stage.count} negócios</span>
                  <span className="font-medium">{formatCurrency(stage.value)}</span>
                </div>
              </div>
              
              <div className="relative">
                <div
                  className={cn(
                    "h-10 rounded-md flex items-center justify-between px-3 text-white text-sm font-medium transition-all",
                    stage.stage === 'fechado_ganho' && "bg-stage-ganho",
                    stage.stage === 'prospeccao' && "bg-stage-prospeccao",
                    stage.stage === 'qualificacao' && "bg-stage-qualificacao",
                    stage.stage === 'proposta' && "bg-stage-proposta",
                    stage.stage === 'negociacao' && "bg-stage-negociacao"
                  )}
                  style={{ width: `${widthPercent}%` }}
                >
                  <span>{stage.count}</span>
                  {stage.conversionRate !== null && (
                    <span className="text-xs opacity-90">
                      {stage.conversionRate.toFixed(0)}%
                    </span>
                  )}
                </div>
              </div>

              {/* Conversion indicator between stages */}
              {index < funnelData.stages.length - 1 && funnelData.stages[index + 1].conversionRate !== null && (
                <div className="flex items-center justify-center py-1">
                  <div className={cn(
                    "flex items-center gap-1 text-xs px-2 py-0.5 rounded-full",
                    isBottleneck ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
                  )}>
                    <ArrowRight className="h-3 w-3" />
                    <span>
                      {funnelData.stages[index + 1].conversionRate?.toFixed(0)}% 
                      {isBottleneck && " - Gargalo"}
                    </span>
                    {isBottleneck ? (
                      <TrendingDown className="h-3 w-3" />
                    ) : funnelData.stages[index + 1].conversionRate && funnelData.stages[index + 1].conversionRate! > 70 ? (
                      <TrendingUp className="h-3 w-3 text-success" />
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
