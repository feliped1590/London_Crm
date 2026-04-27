import { useState } from 'react';
import { useBIAdvanced } from '@/hooks/useBIAdvanced';
import { PipelineHealthSection } from './bi/PipelineHealthSection';
import { SellerPerformanceSection } from './bi/SellerPerformanceSection';
import { AnomaliesSection } from './bi/AnomaliesSection';
import { BIFiltersBar } from './bi/BIFiltersBar';
import { DrillDownModal } from './bi/DrillDownModal';
import { StalledDealData } from '@/hooks/useBIAdvanced';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Users, Clock, TrendingDown } from 'lucide-react';

export function BIAdvancedTab() {
  const {
    pipelineHealth,
    sellerPerformance,
    anomalies,
    stalledDeals,
    summary,
    filters,
    setFilters,
    isLoading,
    isError,
    errorMessage,
    sectionErrors,
    partialErrorMessages,
    refetchAll,
  } = useBIAdvanced();

  const [drillDownData, setDrillDownData] = useState<{
    isOpen: boolean;
    title: string;
    data: StalledDealData[];
    type: 'stalled' | 'sla' | 'seller';
    sellerId?: string;
  }>({
    isOpen: false,
    title: '',
    data: [],
    type: 'stalled',
  });

  const handleDrillDown = (type: string, params: Record<string, any>) => {
    if (type === 'stalled' || type === 'sla') {
      setDrillDownData({
        isOpen: true,
        title: type === 'stalled' ? 'Negócios Parados' : 'Violações de SLA',
        data: stalledDeals,
        type: 'stalled',
      });
    } else if (type === 'seller') {
      const sellerDeals = stalledDeals.filter(d => d.owner_id === params.sellerId);
      setDrillDownData({
        isOpen: true,
        title: `Negócios Parados - ${params.sellerName}`,
        data: sellerDeals,
        type: 'seller',
        sellerId: params.sellerId,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <BIFiltersBar filters={filters} onFiltersChange={setFilters} />
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Não foi possível carregar o BI Avançado</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>As métricas do relatório encontraram uma inconsistência ao processar os dados do pipeline.</p>
            {errorMessage && <p className="text-xs opacity-80">Detalhe técnico: {errorMessage}</p>}
            <Button variant="outline" size="sm" onClick={refetchAll}>
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <BIFiltersBar filters={filters} onFiltersChange={setFilters} />

      {partialErrorMessages.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Algumas métricas estão temporariamente indisponíveis</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>O restante do BI continua disponível enquanto reprocessamos os indicadores afetados.</span>
            <Button variant="outline" size="sm" onClick={refetchAll} className="w-fit">
              Atualizar métricas
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${summary.criticalAnomalies > 0 ? 'border-destructive/50 bg-destructive/5' : ''}`}
          onClick={() => handleDrillDown('anomalies', {})}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className={`h-4 w-4 ${summary.criticalAnomalies > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
              Anomalias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{anomalies.length}</div>
            {summary.criticalAnomalies > 0 && (
              <p className="text-xs text-destructive">{summary.criticalAnomalies} críticas</p>
            )}
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${summary.totalSLAViolations > 0 ? 'border-yellow-500/50 bg-yellow-500/5' : ''}`}
          onClick={() => handleDrillDown('sla', {})}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className={`h-4 w-4 ${summary.totalSLAViolations > 0 ? 'text-yellow-600' : 'text-muted-foreground'}`} />
              Violações SLA
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalSLAViolations}</div>
            <p className="text-xs text-muted-foreground">negócios acima do tempo</p>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${summary.totalStalledDeals > 5 ? 'border-orange-500/50 bg-orange-500/5' : ''}`}
          onClick={() => handleDrillDown('stalled', {})}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
              Negócios Parados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalStalledDeals}</div>
            <p className="text-xs text-muted-foreground">há mais de 7 dias</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Conversão Média
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.avgConversionRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">do time</p>
          </CardContent>
        </Card>
      </div>

      {/* Anomalies Section */}
      {sectionErrors.anomalies && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Anomalias temporariamente indisponíveis</AlertTitle>
          <AlertDescription>As demais métricas do BI seguem carregadas normalmente.</AlertDescription>
        </Alert>
      )}

      {!sectionErrors.anomalies && anomalies.length > 0 && (
        <AnomaliesSection anomalies={anomalies} onAction={handleDrillDown} />
      )}

      {/* Pipeline Health */}
      <PipelineHealthSection 
        data={pipelineHealth} 
        onDrillDown={handleDrillDown} 
      />

      {/* Seller Performance */}
      <SellerPerformanceSection 
        data={sellerPerformance} 
        onDrillDown={handleDrillDown}
      />

      {/* Drill Down Modal */}
      <DrillDownModal
        isOpen={drillDownData.isOpen}
        onClose={() => setDrillDownData(prev => ({ ...prev, isOpen: false }))}
        title={drillDownData.title}
        data={drillDownData.data}
      />
    </div>
  );
}
