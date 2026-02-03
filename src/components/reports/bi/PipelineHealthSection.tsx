import { PipelineHealthData } from '@/hooks/useBIAdvanced';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Activity, Clock, AlertCircle, TrendingUp } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';

const STAGE_LABELS: Record<string, string> = {
  prospeccao: 'Prospecção',
  qualificacao: 'Qualificação',
  proposta: 'Proposta',
  negociacao: 'Negociação',
  fechado_ganho: 'Fechado Ganho',
  fechado_perdido: 'Fechado Perdido',
};

interface PipelineHealthSectionProps {
  data: PipelineHealthData[];
  onDrillDown: (type: string, params: Record<string, any>) => void;
}

export function PipelineHealthSection({ data, onDrillDown }: PipelineHealthSectionProps) {
  const activeStages = data.filter(
    (s) => s.stage !== 'fechado_ganho' && s.stage !== 'fechado_perdido'
  );

  const totalDeals = activeStages.reduce((acc, s) => acc + s.total_deals, 0);
  const totalValue = activeStages.reduce((acc, s) => acc + s.total_value, 0);
  const totalSLAViolations = activeStages.reduce((acc, s) => acc + s.deals_over_sla, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Saúde do Pipeline
            </CardTitle>
            <CardDescription>
              Tempo médio, SLA e taxa de avanço por etapa
            </CardDescription>
          </div>
          <div className="flex gap-4 text-right">
            <div>
              <p className="text-2xl font-bold">{totalDeals}</p>
              <p className="text-xs text-muted-foreground">negócios ativos</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{formatCurrency(totalValue)}</p>
              <p className="text-xs text-muted-foreground">valor total</p>
            </div>
            {totalSLAViolations > 0 && (
              <div 
                className="cursor-pointer hover:opacity-80"
                onClick={() => onDrillDown('sla', {})}
              >
                <p className="text-2xl font-bold text-destructive">{totalSLAViolations}</p>
                <p className="text-xs text-destructive">violações SLA</p>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Etapa</TableHead>
              <TableHead className="text-center">Negócios</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <Clock className="h-3 w-3" />
                  Tempo Médio
                </div>
              </TableHead>
              <TableHead className="text-center">SLA</TableHead>
              <TableHead className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  Taxa Avanço
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activeStages.map((stage) => (
              <TableRow 
                key={stage.stage}
                className={stage.deals_over_sla > 0 ? 'bg-destructive/5' : ''}
              >
                <TableCell>
                  <span className="font-medium">
                    {STAGE_LABELS[stage.stage] || stage.stage}
                  </span>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline">{stage.total_deals}</Badge>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(stage.total_value)}
                </TableCell>
                <TableCell className="text-center">
                  <span className={stage.avg_days_in_stage > 7 ? 'text-yellow-600 font-medium' : ''}>
                    {stage.avg_days_in_stage.toFixed(1)} dias
                  </span>
                </TableCell>
                <TableCell className="text-center">
                  {stage.deals_over_sla > 0 ? (
                    <Badge 
                      variant="destructive" 
                      className="cursor-pointer"
                      onClick={() => onDrillDown('sla', { stage: stage.stage })}
                    >
                      <AlertCircle className="h-3 w-3 mr-1" />
                      {stage.deals_over_sla}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                      OK
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Progress value={stage.advancement_rate} className="h-2 w-16" />
                    <span className="text-sm">{stage.advancement_rate.toFixed(0)}%</span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
