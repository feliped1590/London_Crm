import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Sun, Moon, CloudSun } from 'lucide-react';
import { useTodayData } from '@/hooks/useTodayData';
import { useAuth } from '@/hooks/useAuth';
import { TodayTaskList } from '@/components/today/TodayTaskList';
import { StagnantDealsCard } from '@/components/today/StagnantDealsCard';
import { DailySummary } from '@/components/today/DailySummary';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar } from 'lucide-react';

function getGreeting(): { text: string; icon: typeof Sun } {
  const hour = new Date().getHours();
  if (hour < 12) return { text: 'Bom dia', icon: Sun };
  if (hour < 18) return { text: 'Boa tarde', icon: CloudSun };
  return { text: 'Boa noite', icon: Moon };
}

export default function Today() {
  const { user } = useAuth();
  const { todayTasks, stagnantDeals, summary, upcomingTasks, isLoading } = useTodayData();
  
  const today = new Date();
  const greeting = getGreeting();
  const GreetingIcon = greeting.icon;
  
  // Get user's first name from email
  const userName = user?.email?.split('@')[0] || 'Usuário';
  const formattedName = userName.charAt(0).toUpperCase() + userName.slice(1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <GreetingIcon className="h-7 w-7 text-yellow-500" />
            {greeting.text}, {formattedName}! 👋
          </h1>
          <p className="text-muted-foreground flex items-center gap-2 mt-1">
            <Calendar className="h-4 w-4" />
            {format(today, "EEEE, d 'de' MMMM", { locale: ptBR })}
          </p>
        </div>
        
        {upcomingTasks.tomorrow + upcomingTasks.nextWeek > 0 && (
          <Card className="border-dashed">
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Amanhã:</span>
                  <Badge variant="secondary">{upcomingTasks.tomorrow} tarefas</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Próxima semana:</span>
                  <Badge variant="outline">{upcomingTasks.nextWeek} tarefas</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Summary Cards */}
      <DailySummary 
        summary={summary} 
        upcomingTasks={upcomingTasks} 
        isLoading={isLoading} 
      />

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Today's Tasks */}
        <TodayTaskList tasks={todayTasks} isLoading={isLoading} />

        {/* Stagnant Deals */}
        <StagnantDealsCard deals={stagnantDeals} isLoading={isLoading} />
      </div>
    </div>
  );
}
