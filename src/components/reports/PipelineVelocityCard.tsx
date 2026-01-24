import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSalesFunnelData } from '@/hooks/useSalesFunnelData';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, Timer, Zap, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export function PipelineVelocityCard() {
  const { funnelData, isLoading } = useSalesFunnelData();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!funnelData) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Timer className="h-5 w-5" />
          Velocidade do Pipeline
        </CardTitle>
        <CardDescription>
          Tempo médio que negócios permanecem em cada etapa
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
            <div className="flex items-center gap-2 text-primary mb-1">
              <Zap className="h-4 w-4" />
              <span className="text-sm font-medium">Ciclo de Vendas</span>
            </div>
            <div className="text-2xl font-bold">
              {funnelData.avgSalesCycleFormatted || 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Tempo médio até fechamento
            </p>
          </div>
          
          <div className="p-4 rounded-lg bg-success/10 border border-success/20">
            <div className="flex items-center gap-2 text-success mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm font-medium">Taxa de Conversão</span>
            </div>
            <div className="text-2xl font-bold">
              {funnelData.overallConversionRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Negócios ganhos vs perdidos
            </p>
          </div>
        </div>

        {/* Time per stage */}
        {funnelData.velocityByStage.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Tempo por Etapa</h4>
            <div className="space-y-2">
              {funnelData.velocityByStage.map((velocity) => (
                <div
                  key={velocity.stage}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{velocity.label}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{velocity.avgDurationFormatted}</div>
                    <div className="text-xs text-muted-foreground">
                      {velocity.dealsCount} transições
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {funnelData.velocityByStage.length === 0 && (
          <div className="text-center py-4 text-muted-foreground text-sm">
            Mova negócios entre etapas para ver métricas de velocidade
          </div>
        )}
      </CardContent>
    </Card>
  );
}
