import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, isWithinInterval } from 'date-fns';

export interface SalesGoal {
  id: string;
  user_id: string;
  period_type: 'monthly' | 'quarterly' | 'yearly';
  period_start: string;
  period_end: string;
  target_value: number;
  target_deals: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SalesGoalInsert {
  user_id: string;
  period_type: 'monthly' | 'quarterly' | 'yearly';
  period_start: string;
  period_end: string;
  target_value: number;
  target_deals: number;
}

export interface SalesGoalUpdate extends Partial<SalesGoalInsert> {
  id: string;
}

export interface GoalProgress {
  goal: SalesGoal | null;
  currentValue: number;
  currentDeals: number;
  valueProgress: number;
  dealsProgress: number;
  remainingValue: number;
  remainingDeals: number;
}

export function useSalesGoals(userId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const targetUserId = userId || user?.id;

  // Fetch all goals for a user
  const { data: goals, isLoading, error } = useQuery({
    queryKey: ['sales_goals', targetUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_goals')
        .select('*')
        .eq('user_id', targetUserId)
        .order('period_start', { ascending: false });
      
      if (error) throw error;
      return data as SalesGoal[];
    },
    enabled: !!targetUserId,
  });

  // Get current active goal
  const currentGoal = goals?.find(goal => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    // Compare as strings (YYYY-MM-DD) to avoid timezone issues
    return todayStr >= goal.period_start && todayStr <= goal.period_end;
  });

  // Calculate progress for current goal
  const { data: goalProgress, isLoading: progressLoading } = useQuery({
    queryKey: ['sales_goal_progress', targetUserId, currentGoal?.id],
    queryFn: async () => {
      if (!currentGoal) {
        return {
          goal: null,
          currentValue: 0,
          currentDeals: 0,
          valueProgress: 0,
          dealsProgress: 0,
          remainingValue: 0,
          remainingDeals: 0,
        } as GoalProgress;
      }

      // Fetch won deals within the goal period
      const { data: deals, error } = await supabase
        .from('deals')
        .select('id, value, closed_at')
        .eq('owner_id', targetUserId)
        .eq('stage', 'fechado_ganho')
        .gte('closed_at', currentGoal.period_start)
        .lte('closed_at', currentGoal.period_end);

      if (error) throw error;

      const currentValue = (deals || []).reduce((sum, d) => sum + Number(d.value || 0), 0);
      const currentDeals = deals?.length || 0;

      const valueProgress = currentGoal.target_value > 0 
        ? Math.min(100, (currentValue / currentGoal.target_value) * 100)
        : 0;
      const dealsProgress = currentGoal.target_deals > 0
        ? Math.min(100, (currentDeals / currentGoal.target_deals) * 100)
        : 0;

      return {
        goal: currentGoal,
        currentValue,
        currentDeals,
        valueProgress,
        dealsProgress,
        remainingValue: Math.max(0, currentGoal.target_value - currentValue),
        remainingDeals: Math.max(0, currentGoal.target_deals - currentDeals),
      } as GoalProgress;
    },
    enabled: !!targetUserId,
  });

  const createGoal = useMutation({
    mutationFn: async (data: SalesGoalInsert) => {
      const { data: result, error } = await supabase
        .from('sales_goals')
        .insert({
          ...data,
          created_by: user?.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return result as SalesGoal;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales_goals'] });
      queryClient.invalidateQueries({ queryKey: ['sales_goal_progress'] });
      toast.success('Meta criada com sucesso!');
    },
    onError: (error) => {
      console.error('Error creating goal:', error);
      toast.error('Erro ao criar meta');
    },
  });

  const updateGoal = useMutation({
    mutationFn: async ({ id, ...data }: SalesGoalUpdate) => {
      const { data: result, error } = await supabase
        .from('sales_goals')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return result as SalesGoal;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales_goals'] });
      queryClient.invalidateQueries({ queryKey: ['sales_goal_progress'] });
      toast.success('Meta atualizada!');
    },
    onError: (error) => {
      console.error('Error updating goal:', error);
      toast.error('Erro ao atualizar meta');
    },
  });

  const deleteGoal = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('sales_goals')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales_goals'] });
      queryClient.invalidateQueries({ queryKey: ['sales_goal_progress'] });
      toast.success('Meta excluída!');
    },
    onError: (error) => {
      console.error('Error deleting goal:', error);
      toast.error('Erro ao excluir meta');
    },
  });

  // Helper to create period dates
  const getPeriodDates = (type: 'monthly' | 'quarterly' | 'yearly', date: Date = new Date()) => {
    switch (type) {
      case 'monthly':
        return {
          start: startOfMonth(date).toISOString().split('T')[0],
          end: endOfMonth(date).toISOString().split('T')[0],
        };
      case 'quarterly':
        return {
          start: startOfQuarter(date).toISOString().split('T')[0],
          end: endOfQuarter(date).toISOString().split('T')[0],
        };
      case 'yearly':
        return {
          start: startOfYear(date).toISOString().split('T')[0],
          end: endOfYear(date).toISOString().split('T')[0],
        };
    }
  };

  return {
    goals,
    currentGoal,
    goalProgress,
    isLoading,
    progressLoading,
    error,
    createGoal,
    updateGoal,
    deleteGoal,
    getPeriodDates,
  };
}

// Hook to fetch all users' goals (for admin view)
export function useAllSalesGoals() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: allGoals, isLoading } = useQuery({
    queryKey: ['sales_goals', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_goals')
        .select('*')
        .order('period_start', { ascending: false });
      
      if (error) throw error;
      return data as SalesGoal[];
    },
    enabled: !!user?.id,
  });

  return {
    allGoals,
    isLoading,
  };
}
