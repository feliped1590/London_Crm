import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { startOfDay, endOfDay, subDays, format } from 'date-fns';
import { isOpenStage, isWonStage } from '@/lib/stageStatus';

export interface TodayTask {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  due_time: string | null;
  priority: string;
  status: string;
  deal?: { id: string; name: string } | null;
  company?: { id: string; name: string } | null;
  contact?: { id: string; first_name: string; last_name: string | null } | null;
}

export interface StagnantDeal {
  id: string;
  name: string;
  value: number | null;
  stage: string;
  days_stagnant: number;
  last_activity_at: string;
  company?: { id: string; name: string } | null;
  contact?: { id: string; first_name: string; last_name: string | null; mobile: string | null } | null;
}

export interface TodaySummary {
  pipelineValue: number;
  goalProgress: number;
  wonThisMonth: number;
  overdueCount: number;
}

export interface UpcomingTasksCount {
  tomorrow: number;
  nextWeek: number;
}

export function useTodayData() {
  const { user } = useAuth();
  const today = new Date();
  const todayStart = format(startOfDay(today), 'yyyy-MM-dd');
  const todayEnd = format(endOfDay(today), 'yyyy-MM-dd');

  // Tasks for today
  const { data: todayTasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['today-tasks', user?.id, todayStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          id, title, description, due_date, due_time, priority, status,
          deal:deals(id, name),
          company:companies(id, name),
          contact:contacts(id, first_name, last_name)
        `)
        .eq('assigned_to', user?.id)
        .in('status', ['pendente', 'em_andamento'])
        .or(`and(due_date.gte.${todayStart}T00:00:00,due_date.lt.${todayStart}T23:59:59),due_date.is.null`)
        .order('due_time', { ascending: true, nullsFirst: false })
        .order('priority', { ascending: false });

      if (error) throw error;
      return (data || []) as TodayTask[];
    },
    enabled: !!user?.id,
  });

  // Stagnant deals (no activity > 5 days)
  const { data: stagnantDeals = [], isLoading: dealsLoading } = useQuery({
    queryKey: ['stagnant-deals', user?.id],
    queryFn: async () => {
      const fiveDaysAgo = subDays(today, 5);
      
      // Get deals owned by user that are still open
      const { data: deals, error } = await supabase
        .from('deals')
        .select(`
          id, name, value, stage, updated_at, pipeline_stage_id,
          pipeline_stages(stage_status),
          company:companies(id, name),
          contact:contacts(id, first_name, last_name, mobile)
        `)
        .eq('owner_id', user?.id)
        .lt('updated_at', fiveDaysAgo.toISOString())
        .order('updated_at', { ascending: true })
        .limit(30);

      if (error) throw error;

      return (deals || [])
        .filter((deal) => {
          const stageStatus = Array.isArray(deal.pipeline_stages)
            ? deal.pipeline_stages[0]?.stage_status
            : deal.pipeline_stages?.stage_status;
          return isOpenStage(stageStatus, deal.stage);
        })
        .slice(0, 10)
        .map((deal) => ({
          ...deal,
          days_stagnant: Math.floor((today.getTime() - new Date(deal.updated_at).getTime()) / (1000 * 60 * 60 * 24)),
          last_activity_at: deal.updated_at,
        })) as StagnantDeal[];
    },
    enabled: !!user?.id,
  });

  // Summary data
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['today-summary', user?.id],
    queryFn: async () => {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      
      const [
        openDealsResult,
        wonDealsResult,
        overdueTasksResult,
        goalsResult,
      ] = await Promise.all([
        supabase
          .from('deals')
          .select('value, stage, pipeline_stages(stage_status)')
          .eq('owner_id', user?.id),
        supabase
          .from('deals')
          .select('value, stage, closed_at, pipeline_stages(stage_status)')
          .eq('owner_id', user?.id)
          .gte('closed_at', startOfMonth.toISOString()),
        supabase
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .eq('assigned_to', user?.id)
          .in('status', ['pendente', 'em_andamento'])
          .lt('due_date', todayStart),
        supabase
          .from('sales_goals')
          .select('target_value')
          .eq('user_id', user?.id)
          .lte('period_start', todayStart)
          .gte('period_end', todayStart)
          .maybeSingle(),
      ]);

      const openDeals = (openDealsResult.data || []).filter((d) => {
        const stageStatus = Array.isArray(d.pipeline_stages)
          ? d.pipeline_stages[0]?.stage_status
          : d.pipeline_stages?.stage_status;
        return isOpenStage(stageStatus, d.stage);
      });
      const wonDeals = (wonDealsResult.data || []).filter((d) => {
        const stageStatus = Array.isArray(d.pipeline_stages)
          ? d.pipeline_stages[0]?.stage_status
          : d.pipeline_stages?.stage_status;
        return isWonStage(stageStatus, d.stage);
      });
      const overdueCount = overdueTasksResult.count || 0;
      const goals = goalsResult.data;

      const pipelineValue = openDeals.reduce((sum, d) => sum + Number(d.value || 0), 0);
      const wonValue = wonDeals.reduce((sum, d) => sum + Number(d.value || 0), 0);
      const targetValue = goals?.target_value || 0;
      const goalProgress = targetValue > 0 ? Math.round((wonValue / targetValue) * 100) : 0;

      return {
        pipelineValue,
        goalProgress,
        wonThisMonth: wonDeals.length,
        overdueCount,
      } as TodaySummary;
    },
    enabled: !!user?.id,
  });

  // Upcoming tasks count
  const { data: upcomingTasks } = useQuery({
    queryKey: ['upcoming-tasks', user?.id, todayStart],
    queryFn: async () => {
      const tomorrow = subDays(today, -1);
      const nextWeek = subDays(today, -7);

      const [tomorrowResult, nextWeekResult] = await Promise.all([
        supabase
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .eq('assigned_to', user?.id)
          .in('status', ['pendente', 'em_andamento'])
          .eq('due_date', format(tomorrow, 'yyyy-MM-dd')),
        supabase
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .eq('assigned_to', user?.id)
          .in('status', ['pendente', 'em_andamento'])
          .gt('due_date', format(tomorrow, 'yyyy-MM-dd'))
          .lte('due_date', format(nextWeek, 'yyyy-MM-dd')),
      ]);

      return {
        tomorrow: tomorrowResult.count || 0,
        nextWeek: nextWeekResult.count || 0,
      } as UpcomingTasksCount;
    },
    enabled: !!user?.id,
  });

  return {
    todayTasks,
    stagnantDeals,
    summary: summary || { pipelineValue: 0, goalProgress: 0, wonThisMonth: 0, overdueCount: 0 },
    upcomingTasks: upcomingTasks || { tomorrow: 0, nextWeek: 0 },
    isLoading: tasksLoading || dealsLoading || summaryLoading,
  };
}
