import { AnomalyData } from '@/hooks/useBIAdvanced';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, AlertCircle, ArrowRight } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';

interface AnomaliesSectionProps {
  anomalies: AnomalyData[];
  onAction: (type: string, params: Record<string, any>) => void;
}

export function AnomaliesSection({ anomalies, onAction }: AnomaliesSectionProps) {
  const criticalAnomalies = anomalies.filter(a => a.severity === 'critical');
  const warningAnomalies = anomalies.filter(a => a.severity === 'warning');

  return (
    <Card className={criticalAnomalies.length > 0 ? 'border-destructive/50' : 'border-yellow-500/50'}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className={`h-5 w-5 ${criticalAnomalies.length > 0 ? 'text-destructive' : 'text-yellow-600'}`} />
          Anomalias Detectadas
          <Badge variant={criticalAnomalies.length > 0 ? 'destructive' : 'outline'}>
            {anomalies.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {criticalAnomalies.map((anomaly, index) => (
            <div
              key={`critical-${index}`}
              className="flex items-center justify-between p-3 rounded-lg bg-destructive/10 border border-destructive/20"
            >
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                <div>
                  <p className="font-medium">{anomaly.title}</p>
                  <p className="text-sm text-muted-foreground">{anomaly.description}</p>
                  {anomaly.affected_value > 0 && (
                    <p className="text-sm font-medium text-destructive mt-1">
                      Valor em risco: {formatCurrency(anomaly.affected_value)}
                    </p>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => onAction(anomaly.anomaly_type, anomaly.filter_params)}
              >
                {anomaly.action_label}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          ))}

          {warningAnomalies.map((anomaly, index) => (
            <div
              key={`warning-${index}`}
              className="flex items-center justify-between p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div>
                  <p className="font-medium">{anomaly.title}</p>
                  <p className="text-sm text-muted-foreground">{anomaly.description}</p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="border-yellow-500/50 text-yellow-700 hover:bg-yellow-500/10"
                onClick={() => onAction(anomaly.anomaly_type, anomaly.filter_params)}
              >
                {anomaly.action_label}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
