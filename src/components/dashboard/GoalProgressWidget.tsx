import { useSalesGoals } from '@/hooks/useSalesGoals';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Target, TrendingUp, Calendar } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';

const periodTypeLabels: Record<string, string> = {
  monthly: 'Mensal',
  quarterly: 'Trimestral',
  yearly: 'Anual',
};

export function GoalProgressWidget() {
  const { goalProgress, progressLoading } = useSalesGoals();

  if (progressLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!goalProgress?.goal) {
    return (
      <Card className="border-dashed">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Meta do Período</CardTitle>
          <Target className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">Nenhuma meta configurada</p>
            <Link to="/settings" className="text-xs text-primary hover:underline mt-1 inline-block">
              Configurar metas →
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { goal, currentValue, currentDeals, valueProgress, dealsProgress, remainingValue, remainingDeals } = goalProgress;
  const daysRemaining = differenceInDays(parseISO(goal.period_end), new Date());

  const getProgressColor = (progress: number) => {
    if (progress >= 100) return 'bg-success';
    if (progress >= 70) return 'bg-primary';
    if (progress >= 40) return 'bg-warning';
    return 'bg-destructive';
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-sm font-medium text-muted-foreground">Meta do Período</CardTitle>
          <CardDescription className="flex items-center gap-1 mt-1">
            <Calendar className="h-3 w-3" />
            {format(parseISO(goal.period_start), 'dd/MM', { locale: ptBR })} - {format(parseISO(goal.period_end), 'dd/MM', { locale: ptBR })}
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{periodTypeLabels[goal.period_type]}</Badge>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Value Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Valor</span>
            <span className="font-medium">{formatCurrency(currentValue)} / {formatCurrency(goal.target_value)}</span>
          </div>
          <Progress value={valueProgress} className="h-2" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{valueProgress.toFixed(0)}% atingido</span>
            <span>Falta: {formatCurrency(remainingValue)}</span>
          </div>
        </div>

        {/* Deals Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Deals</span>
            <span className="font-medium">{currentDeals} / {goal.target_deals}</span>
          </div>
          <Progress value={dealsProgress} className="h-2" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{dealsProgress.toFixed(0)}% atingido</span>
            <span>Falta: {remainingDeals}</span>
          </div>
        </div>

        {/* Days Remaining */}
        <div className="flex items-center justify-between pt-2 border-t text-sm">
          <span className="text-muted-foreground">Dias restantes</span>
          <Badge variant={daysRemaining <= 5 ? 'destructive' : daysRemaining <= 10 ? 'secondary' : 'outline'}>
            {daysRemaining > 0 ? `${daysRemaining} dias` : 'Último dia!'}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
