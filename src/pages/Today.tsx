import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Sun, Moon, CloudSun, Calendar } from 'lucide-react';
import { useTodayData } from '@/hooks/useTodayData';
import { useAuth } from '@/hooks/useAuth';
import { TodayTaskList } from '@/components/today/TodayTaskList';
import { StagnantDealsCard } from '@/components/today/StagnantDealsCard';
import { DailySummary } from '@/components/today/DailySummary';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSearchParams } from 'react-router-dom';
import Dashboard from './Dashboard';

function getGreeting(): { text: string; icon: typeof Sun } {
  const hour = new Date().getHours();
  if (hour < 12) return { text: 'Bom dia', icon: Sun };
  if (hour < 18) return { text: 'Boa tarde', icon: CloudSun };
  return { text: 'Boa noite', icon: Moon };
}

export default function Today() {
  const { user } = useAuth();
  const { todayTasks, stagnantDeals, summary, upcomingTasks, isLoading } = useTodayData();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const activeTab = searchParams.get('tab') || 'meu-dia';

  const handleTabChange = (value: string) => {
    if (value === 'meu-dia') {
      searchParams.delete('tab');
    } else {
      searchParams.set('tab', value);
    }
    setSearchParams(searchParams, { replace: true });
  };

  // Fetch user profile to get the full name
  const { data: userProfile } = useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', user?.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });
  
  const today = new Date();
  const greeting = getGreeting();
  const GreetingIcon = greeting.icon;
  
  const userName = userProfile?.full_name || user?.email?.split('@')[0] || 'Usuário';
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
        
        {activeTab === 'meu-dia' && upcomingTasks.tomorrow + upcomingTasks.nextWeek > 0 && (
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

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="meu-dia">Meu Dia</TabsTrigger>
          <TabsTrigger value="visao-geral">Visão Geral</TabsTrigger>
        </TabsList>

        <TabsContent value="meu-dia" className="space-y-6 mt-4">
          {/* Summary Cards */}
          <DailySummary 
            summary={summary} 
            upcomingTasks={upcomingTasks} 
            isLoading={isLoading} 
          />

          {/* Main Content Grid */}
          <div className="grid gap-6 lg:grid-cols-2">
            <TodayTaskList tasks={todayTasks} isLoading={isLoading} />
            <StagnantDealsCard deals={stagnantDeals} isLoading={isLoading} />
          </div>
        </TabsContent>

        <TabsContent value="visao-geral" className="mt-4">
          <Dashboard embedded />
        </TabsContent>
      </Tabs>
    </div>
  );
}
