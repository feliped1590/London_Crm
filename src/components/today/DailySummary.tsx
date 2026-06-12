import { TrendingUp, Target, Trophy, AlertCircle, Calendar } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { TodaySummary, UpcomingTasksCount } from '@/hooks/useTodayData';
import { formatCurrency } from '@/lib/formatters';

interface DailySummaryProps {
  summary: TodaySummary;
  upcomingTasks: UpcomingTasksCount;
  isLoading: boolean;
}

export function DailySummary({ summary, upcomingTasks, isLoading }: DailySummaryProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="h-16 bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const items = [
    {
      icon: TrendingUp,
      label: 'Pipeline',
      value: formatCurrency(summary.pipelineValue),
      color: 'text-blue-500',
      bgColor: 'bg-blue-50 dark:bg-blue-950',
    },
    {
      icon: Target,
      label: 'Meta',
      value: `${summary.goalProgress}%`,
      color: summary.goalProgress >= 100 ? 'text-green-500' : 'text-primary',
      bgColor: summary.goalProgress >= 100 ? 'bg-green-50 dark:bg-green-950' : 'bg-primary/10',
      progress: summary.goalProgress,
    },
    {
      icon: Trophy,
      label: 'Fechados',
      value: summary.wonThisMonth.toString(),
      subtitle: 'este mês',
      color: 'text-green-500',
      bgColor: 'bg-green-50 dark:bg-green-950',
    },
    {
      icon: summary.overdueCount > 0 ? AlertCircle : Calendar,
      label: summary.overdueCount > 0 ? 'Atrasados' : 'Próximas',
      value: summary.overdueCount > 0 ? summary.overdueCount.toString() : `${upcomingTasks.tomorrow}`,
      subtitle: summary.overdueCount > 0 ? 'tarefas' : 'amanhã',
      color: summary.overdueCount > 0 ? 'text-destructive' : 'text-muted-foreground',
      bgColor: summary.overdueCount > 0 ? 'bg-destructive/10' : 'bg-muted',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {items.map((item, index) => (
        <Card
          key={index}
          className="group relative overflow-hidden border-border-subtle bg-card hover:shadow-[var(--shadow-md)] hover:-translate-y-0.5 transition-all duration-200"
        >
          <div className={cn("absolute inset-x-0 top-0 h-0.5", item.color.replace('text-', 'bg-'))} />
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className={cn("p-2 rounded-lg ring-1 ring-border-subtle", item.bgColor)}>
                <item.icon className={cn("h-5 w-5", item.color)} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{item.label}</p>
                <p className="text-xl font-display font-semibold tabular-nums text-foreground mt-0.5">{item.value}</p>
                {item.subtitle && (
                  <p className="text-xs text-muted-foreground">{item.subtitle}</p>
                )}
                {item.progress !== undefined && (
                  <Progress value={Math.min(item.progress, 100)} className="h-1.5 mt-2" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
