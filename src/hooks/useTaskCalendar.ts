import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import { toast } from 'sonner';
import { startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';

interface TaskCalendarFilters {
  companyId?: string | null;
  dealId?: string | null;
  assignedTo?: string | null;
  priority?: string | null;
}

export function useTaskCalendar(
  currentDate: Date,
  filters: TaskCalendarFilters = {}
) {
  const { user } = useAuth();
  const { isAdmin } = useModulePermissions();
  const queryClient = useQueryClient();

  // Calculate date range: current month ± 1 month for performance
  const rangeStart = startOfMonth(subMonths(currentDate, 1));
  const rangeEnd = endOfMonth(addMonths(currentDate, 1));

  const { data: tasks, isLoading, refetch } = useQuery({
    queryKey: ['calendar-tasks', rangeStart.toISOString(), rangeEnd.toISOString(), filters, user?.id],
    queryFn: async () => {
      let query = supabase
        .from('tasks')
        .select('*, companies(id, name), contacts(id, first_name, last_name), deals(id, name)')
        .gte('due_date', rangeStart.toISOString())
        .lte('due_date', rangeEnd.toISOString())
        .order('due_date', { ascending: true });

      // Apply permission filter: seller sees only their tasks
      if (!isAdmin && user?.id) {
        query = query.eq('assigned_to', user.id);
      }

      // Apply admin filter for specific seller
      if (isAdmin && filters.assignedTo) {
        query = query.eq('assigned_to', filters.assignedTo);
      }

      // Apply other filters
      if (filters.companyId) {
        query = query.eq('company_id', filters.companyId);
      }
      if (filters.dealId) {
        query = query.eq('deal_id', filters.dealId);
      }
      if (filters.priority) {
        query = query.eq('priority', filters.priority as 'baixa' | 'media' | 'alta' | 'urgente');
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    staleTime: 30000, // 30 seconds cache
  });

  const rescheduleTask = useMutation({
    mutationFn: async ({ taskId, newDate, newTime }: { taskId: string; newDate: string; newTime?: string }) => {
      // Normaliza data civil para meio-dia UTC para evitar shift de fuso
      const dateOnly = newDate.split('T')[0];
      const updateData: Record<string, string | null> = {
        due_date: `${dateOnly}T12:00:00Z`,
      };
      
      if (newTime !== undefined) {
        updateData.due_time = newTime;
      }

      const { error } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', taskId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['today-tasks'] });
      toast.success('Tarefa reagendada com sucesso!');
    },
    onError: () => {
      toast.error('Erro ao reagendar tarefa. Operação revertida.');
    },
  });

  // Fetch sellers list for admin filter
  const { data: sellers } = useQuery({
    queryKey: ['sellers-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .order('full_name');
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
    staleTime: 300000, // 5 minutes cache
  });

  return {
    tasks: tasks || [],
    isLoading,
    refetch,
    rescheduleTask,
    sellers: sellers || [],
    isAdmin,
  };
}
