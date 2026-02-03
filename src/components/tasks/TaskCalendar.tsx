import { useState, useCallback, useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { DateSelectArg, EventClickArg, EventContentArg, EventDropArg } from '@fullcalendar/core';
import { parseISO, isBefore, startOfToday, format } from 'date-fns';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Building2, Target, User, Filter, X } from 'lucide-react';
import { useTaskCalendar } from '@/hooks/useTaskCalendar';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import TaskDetailDrawer from './TaskDetailDrawer';
import type { Tables } from '@/integrations/supabase/types';

type Task = Tables<'tasks'> & {
  companies?: { id: string; name: string } | null;
  contacts?: { id: string; first_name: string; last_name: string } | null;
  deals?: { id: string; name: string } | null;
};

interface TaskCalendarProps {
  onCreateTask?: (date: Date) => void;
}

const priorityColors: Record<string, string> = {
  baixa: '#94a3b8',
  media: '#3b82f6',
  alta: '#f97316',
  urgente: '#ef4444',
};

export default function TaskCalendar({ onCreateTask }: TaskCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  
  // Filters state
  const [filters, setFilters] = useState({
    companyId: null as string | null,
    dealId: null as string | null,
    assignedTo: null as string | null,
    priority: null as string | null,
  });

  const { tasks, isLoading, rescheduleTask, sellers, isAdmin } = useTaskCalendar(currentDate, filters);

  // Fetch filter options
  const { data: companies } = useQuery({
    queryKey: ['companies-filter'],
    queryFn: async () => {
      const { data } = await supabase.from('companies').select('id, name').order('name');
      return data || [];
    },
  });

  const { data: deals } = useQuery({
    queryKey: ['deals-filter'],
    queryFn: async () => {
      const { data } = await supabase.from('deals').select('id, name').order('name');
      return data || [];
    },
  });

  // Transform tasks into calendar events
  const events = useMemo(() => {
    return tasks.map((task) => {
      const isOverdue = task.due_date && 
        isBefore(parseISO(task.due_date), startOfToday()) && 
        task.status !== 'concluida';

      const hasDeal = !!task.deal_id;
      
      // Color logic: overdue = red, with deal = purple, else = blue
      let backgroundColor = hasDeal ? '#8b5cf6' : '#3b82f6';
      if (isOverdue) backgroundColor = '#ef4444';
      if (task.status === 'concluida') backgroundColor = '#22c55e';

      // Build start datetime
      let startStr = task.due_date || new Date().toISOString();
      if (task.due_time) {
        const dateOnly = startStr.split('T')[0];
        startStr = `${dateOnly}T${task.due_time}`;
      }

      return {
        id: task.id,
        title: task.title,
        start: startStr,
        allDay: !task.due_time,
        backgroundColor,
        borderColor: backgroundColor,
        extendedProps: {
          task,
          isOverdue,
          hasDeal,
        },
      };
    });
  }, [tasks]);

  // Handle event drop (drag & drop reschedule)
  const handleEventDrop = useCallback((info: EventDropArg) => {
    const { event } = info;
    const task = event.extendedProps.task as Task;
    
    if (!event.start) {
      info.revert();
      return;
    }

    const newDate = event.start.toISOString();
    const newTime = event.allDay ? undefined : format(event.start, 'HH:mm:ss');

    rescheduleTask.mutate(
      { taskId: task.id, newDate, newTime },
      {
        onError: () => {
          info.revert();
        },
      }
    );
  }, [rescheduleTask]);

  // Handle event click
  const handleEventClick = useCallback((info: EventClickArg) => {
    const task = info.event.extendedProps.task as Task;
    setSelectedTask(task);
    setDrawerOpen(true);
  }, []);

  // Handle date select (click on empty area to create)
  const handleDateSelect = useCallback((info: DateSelectArg) => {
    if (onCreateTask) {
      onCreateTask(info.start);
    }
  }, [onCreateTask]);

  // Handle navigation change to update date range
  const handleDatesSet = useCallback((dateInfo: { start: Date }) => {
    setCurrentDate(dateInfo.start);
  }, []);

  // Custom event content renderer
  const renderEventContent = (eventInfo: EventContentArg) => {
    const task = eventInfo.event.extendedProps.task as Task;
    const isOverdue = eventInfo.event.extendedProps.isOverdue;
    const hasDeal = eventInfo.event.extendedProps.hasDeal;

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="w-full px-1 py-0.5 overflow-hidden cursor-pointer">
              <div className="flex items-center gap-1">
                {hasDeal && <Target className="h-3 w-3 flex-shrink-0" />}
                <span className="text-xs font-medium truncate">{eventInfo.event.title}</span>
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <div className="space-y-1">
              <p className="font-semibold">{task.title}</p>
              {task.companies?.name && (
                <div className="flex items-center gap-1 text-xs">
                  <Building2 className="h-3 w-3" />
                  <span>{task.companies.name}</span>
                </div>
              )}
              {task.deals?.name && (
                <div className="flex items-center gap-1 text-xs">
                  <Target className="h-3 w-3" />
                  <span>{task.deals.name}</span>
                </div>
              )}
              {isOverdue && (
                <Badge variant="destructive" className="text-xs">Atrasada</Badge>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const clearFilters = () => {
    setFilters({
      companyId: null,
      dealId: null,
      assignedTo: null,
      priority: null,
    });
  };

  const hasActiveFilters = Object.values(filters).some(v => v !== null);

  return (
    <div className="space-y-4">
      {/* Filter Controls */}
      <Card>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant={showFilters ? "secondary" : "outline"}
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="gap-2"
              >
                <Filter className="h-4 w-4" />
                Filtros
                {hasActiveFilters && (
                  <Badge variant="secondary" className="ml-1">
                    {Object.values(filters).filter(v => v !== null).length}
                  </Badge>
                )}
              </Button>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
                  <X className="h-4 w-4" />
                  Limpar
                </Button>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-primary" />
                <span className="text-muted-foreground">Comum</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#8b5cf6' }} />
                <span className="text-muted-foreground">Com negócio</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-destructive" />
                <span className="text-muted-foreground">Atrasada</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'hsl(var(--success))' }} />
                <span className="text-muted-foreground">Concluída</span>
              </div>
            </div>
          </div>
        </CardHeader>

        {showFilters && (
          <CardContent className="pt-0 pb-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {isAdmin && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Vendedor</Label>
                  <Select
                    value={filters.assignedTo || 'all'}
                    onValueChange={(v) => setFilters({ ...filters, assignedTo: v === 'all' ? null : v })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {sellers.map((s) => (
                        <SelectItem key={s.user_id} value={s.user_id}>
                          {s.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs">Empresa</Label>
                <Select
                  value={filters.companyId || 'all'}
                  onValueChange={(v) => setFilters({ ...filters, companyId: v === 'all' ? null : v })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {companies?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Negócio</Label>
                <Select
                  value={filters.dealId || 'all'}
                  onValueChange={(v) => setFilters({ ...filters, dealId: v === 'all' ? null : v })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {deals?.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Prioridade</Label>
                <Select
                  value={filters.priority || 'all'}
                  onValueChange={(v) => setFilters({ ...filters, priority: v === 'all' ? null : v })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Calendar */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="fc-wrapper">
            <FullCalendar
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay',
              }}
              locale="pt-br"
              buttonText={{
                today: 'Hoje',
                month: 'Mês',
                week: 'Semana',
                day: 'Dia',
              }}
              events={events}
              editable={true}
              selectable={!!onCreateTask}
              selectMirror={true}
              dayMaxEvents={3}
              eventDrop={handleEventDrop}
              eventClick={handleEventClick}
              select={handleDateSelect}
              datesSet={handleDatesSet}
              eventContent={renderEventContent}
              loading={(isLoading) => {}}
              height="auto"
              aspectRatio={1.8}
              eventDisplay="block"
              nowIndicator={true}
              slotMinTime="06:00:00"
              slotMaxTime="22:00:00"
              allDaySlot={true}
              allDayText="Dia todo"
              slotLabelFormat={{
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
              }}
              eventTimeFormat={{
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Task Detail Drawer */}
      <TaskDetailDrawer
        task={selectedTask}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  );
}
