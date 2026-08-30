import type { Tables } from '@/integrations/supabase/types';

type TaskStatus = Tables<'tasks'>['status'];
type TaskPriority = Tables<'tasks'>['priority'];

export const taskStatusConfig: Record<TaskStatus, { label: string }> = {
  pendente: { label: 'Pendente' },
  em_andamento: { label: 'Em andamento' },
  concluida: { label: 'Concluída' },
  cancelada: { label: 'Cancelada' },
};

export const taskPriorityConfig: Record<TaskPriority, { label: string; color: string }> = {
  baixa: { label: 'Baixa', color: 'bg-slate-400' },
  media: { label: 'Média', color: 'bg-blue-400' },
  alta: { label: 'Alta', color: 'bg-orange-400' },
  urgente: { label: 'Urgente', color: 'bg-red-500' },
};
