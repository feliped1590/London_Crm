import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  MessageCircle, 
  Mail, 
  CheckCircle2, 
  ArrowRightLeft, 
  FileText, 
  Phone, 
  Calendar,
  Activity,
  Loader2
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface ActivityTimelineProps {
  entityType: 'deal' | 'contact' | 'company';
  entityId: string;
  className?: string;
}

interface TimelineItem {
  id: string;
  type: string;
  title: string;
  description?: string;
  timestamp: string;
  icon: React.ReactNode;
  color: string;
}

const getActivityIcon = (type: string) => {
  switch (type) {
    case 'email':
    case 'email_sent':
      return { icon: <Mail className="h-4 w-4" />, color: 'bg-blue-500' };
    case 'whatsapp':
    case 'whatsapp_sent':
    case 'whatsapp_received':
      return { icon: <MessageCircle className="h-4 w-4" />, color: 'bg-green-500' };
    case 'call':
    case 'phone':
      return { icon: <Phone className="h-4 w-4" />, color: 'bg-purple-500' };
    case 'task_completed':
    case 'task':
      return { icon: <CheckCircle2 className="h-4 w-4" />, color: 'bg-emerald-500' };
    case 'stage_change':
      return { icon: <ArrowRightLeft className="h-4 w-4" />, color: 'bg-orange-500' };
    case 'proposal':
    case 'proposal_sent':
    case 'proposal_approved':
      return { icon: <FileText className="h-4 w-4" />, color: 'bg-indigo-500' };
    case 'meeting':
      return { icon: <Calendar className="h-4 w-4" />, color: 'bg-pink-500' };
    default:
      return { icon: <Activity className="h-4 w-4" />, color: 'bg-gray-500' };
  }
};

export function ActivityTimeline({ entityType, entityId, className }: ActivityTimelineProps) {
  // Fetch activities from the activities table
  const { data: activities, isLoading: activitiesLoading } = useQuery({
    queryKey: ['activities', entityType, entityId],
    queryFn: async () => {
      let query = supabase
        .from('activities')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (entityType === 'deal') {
        query = query.eq('deal_id', entityId);
      } else if (entityType === 'contact') {
        query = query.eq('contact_id', entityId);
      } else {
        query = query.eq('company_id', entityId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!entityId,
  });

  // Fetch stage history (only for deals)
  const { data: stageHistory, isLoading: stageHistoryLoading } = useQuery({
    queryKey: ['deal_stage_history', entityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deal_stage_history')
        .select('*')
        .eq('deal_id', entityId)
        .order('changed_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: entityType === 'deal' && !!entityId,
  });

  // Fetch completed tasks
  const { data: completedTasks, isLoading: tasksLoading } = useQuery({
    queryKey: ['completed_tasks', entityType, entityId],
    queryFn: async () => {
      let query = supabase
        .from('tasks')
        .select('*')
        .eq('status', 'concluida')
        .order('completed_at', { ascending: false })
        .limit(20);
      
      if (entityType === 'deal') {
        query = query.eq('deal_id', entityId);
      } else if (entityType === 'contact') {
        query = query.eq('contact_id', entityId);
      } else {
        query = query.eq('company_id', entityId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!entityId,
  });

  const isLoading = activitiesLoading || stageHistoryLoading || tasksLoading;

  // Combine and sort all timeline items
  const stageLabels: Record<string, string> = {
    prospeccao: 'Prospecção',
    qualificacao: 'Qualificação',
    proposta: 'Proposta',
    negociacao: 'Negociação',
    fechado_ganho: 'Fechado (Ganho)',
    fechado_perdido: 'Fechado (Perdido)',
  };

  const timelineItems: TimelineItem[] = [
    // Activities
    ...(activities?.map((activity) => {
      const { icon, color } = getActivityIcon(activity.type);
      return {
        id: `activity-${activity.id}`,
        type: activity.type,
        title: activity.subject || activity.type,
        description: activity.content || undefined,
        timestamp: activity.created_at,
        icon,
        color,
      };
    }) || []),
    // Stage changes (for deals)
    ...(stageHistory?.map((history) => {
      const { icon, color } = getActivityIcon('stage_change');
      const fromLabel = history.from_stage ? stageLabels[history.from_stage] || history.from_stage : 'Início';
      const toLabel = stageLabels[history.to_stage] || history.to_stage;
      return {
        id: `stage-${history.id}`,
        type: 'stage_change',
        title: `Etapa alterada`,
        description: `${fromLabel} → ${toLabel}`,
        timestamp: history.changed_at,
        icon,
        color,
      };
    }) || []),
    // Completed tasks
    ...(completedTasks?.map((task) => {
      const { icon, color } = getActivityIcon('task_completed');
      return {
        id: `task-${task.id}`,
        type: 'task_completed',
        title: 'Tarefa concluída',
        description: task.title,
        timestamp: task.completed_at || task.updated_at,
        icon,
        color,
      };
    }) || []),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (timelineItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Activity className="h-12 w-12 text-muted-foreground/50 mb-2" />
        <p className="text-sm text-muted-foreground">Nenhuma atividade registrada</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Interações aparecerão aqui automaticamente
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className={cn("h-[400px]", className)}>
      <div className="relative pl-6 pr-2">
        {/* Timeline line */}
        <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-border" />
        
        <div className="space-y-4">
          {timelineItems.map((item, index) => (
            <div key={item.id} className="relative flex gap-3">
              {/* Icon */}
              <div className={cn(
                "absolute -left-6 flex h-6 w-6 items-center justify-center rounded-full text-white ring-4 ring-background",
                item.color
              )}>
                {item.icon}
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0 pb-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{item.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(item.timestamp), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </span>
                </div>
                {item.description && (
                  <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                    {item.description}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </ScrollArea>
  );
}
