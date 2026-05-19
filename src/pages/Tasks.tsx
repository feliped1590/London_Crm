import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Search, CheckSquare, Calendar, Clock, Building2, User, Target, RefreshCw, CalendarDays, List } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { formatDate } from '@/lib/formatters';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';
import TaskCalendar from '@/components/tasks/TaskCalendar';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { ServerPagination } from '@/components/ui/server-pagination';

const TASK_LIST_COLUMNS = `
  id, title, description, status, priority, due_date, due_time, completed_at,
  company_id, contact_id, deal_id, assigned_to, owner_id, created_by,
  created_at, updated_at,
  companies(name),
  contacts(first_name, last_name),
  deals(name)
`;

type Task = Tables<'tasks'>;
type TaskStatus = Task['status'];
type TaskPriority = Task['priority'];

const statusConfig: Record<TaskStatus, { label: string; color: string }> = {
  pendente: { label: 'Pendente', color: 'bg-yellow-500' },
  em_andamento: { label: 'Em Andamento', color: 'bg-blue-500' },
  concluida: { label: 'Concluída', color: 'bg-green-500' },
  cancelada: { label: 'Cancelada', color: 'bg-gray-500' },
};

const priorityConfig: Record<TaskPriority, { label: string; color: string }> = {
  baixa: { label: 'Baixa', color: 'bg-slate-400' },
  media: { label: 'Média', color: 'bg-blue-400' },
  alta: { label: 'Alta', color: 'bg-orange-400' },
  urgente: { label: 'Urgente', color: 'bg-red-500' },
};

export default function Tasks() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);
  const [activeTab, setActiveTab] = useState('all');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [prefilledDate, setPrefilledDate] = useState<string | null>(null);
  const [ownerFilter, setOwnerFilter] = useState<string>('mine');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [formData, setFormData] = useState<Partial<TablesInsert<'tasks'>>>({
    title: '',
    description: '',
    status: 'pendente',
    priority: 'media',
    due_date: '',
    due_time: '',
    company_id: null,
    contact_id: null,
    deal_id: null,
  });

  // Check if user is admin
  const { isAdmin } = useModulePermissions();

  // Fetch sellers for admin filter
  const { data: sellers } = useQuery({
    queryKey: ['sellers-for-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id, full_name')
        .order('full_name');
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, activeTab, ownerFilter, pageSize]);

  // Builds the base scoping filter shared by list + counts queries.
  const applyOwnerScope = (q: any) => {
    if (!isAdmin) return q.eq('assigned_to', user!.id);
    if (ownerFilter === 'mine') return q.eq('assigned_to', user!.id);
    if (ownerFilter !== 'all') return q.eq('assigned_to', ownerFilter);
    return q;
  };

  const { data: tasksPage, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['tasks', user?.id, isAdmin, ownerFilter, activeTab, debouncedSearch, page, pageSize],
    queryFn: async () => {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('tasks')
        .select(TASK_LIST_COLUMNS, { count: 'exact' })
        .order('due_date', { ascending: true, nullsFirst: false })
        .range(from, to);

      query = applyOwnerScope(query);

      if (activeTab === 'pending') {
        query = query.in('status', ['pendente', 'em_andamento']);
      } else if (activeTab === 'completed') {
        query = query.eq('status', 'concluida');
      } else if (activeTab === 'overdue') {
        query = query.lt('due_date', new Date().toISOString()).neq('status', 'concluida');
      }

      if (debouncedSearch) {
        query = query.ilike('title', `%${debouncedSearch.trim()}%`);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { rows: (data ?? []) as any[], count: count ?? 0 };
    },
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    enabled: !!user?.id,
  });

  const tasks = tasksPage?.rows;
  const totalTasks = tasksPage?.count ?? 0;

  // Aggregated counts (independent of pagination/tab) for the tab badges.
  const { data: tabCounts } = useQuery({
    queryKey: ['tasks_tab_counts', user?.id, isAdmin, ownerFilter],
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const baseFilter = (q: any) => applyOwnerScope(q);

      const [pending, overdue] = await Promise.all([
        baseFilter(supabase.from('tasks').select('id', { count: 'exact', head: true }))
          .in('status', ['pendente', 'em_andamento']),
        baseFilter(supabase.from('tasks').select('id', { count: 'exact', head: true }))
          .lt('due_date', nowIso)
          .neq('status', 'concluida'),
      ]);

      return {
        pending: pending.count ?? 0,
        overdue: overdue.count ?? 0,
      };
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  const pendingCount = tabCounts?.pending ?? 0;
  const overdueCount = tabCounts?.overdue ?? 0;


  // Auto-open task detail when navigating with ?task=taskId
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('task');
  });

  useEffect(() => {
    if (pendingTaskId && tasks && tasks.length > 0) {
      const task = tasks.find(t => t.id === pendingTaskId);
      if (task) {
        setEditingTask(task);
        setFormData({
          title: task.title,
          description: task.description || '',
          status: task.status,
          priority: task.priority,
          due_date: task.due_date ? task.due_date.split('T')[0] : '',
          due_time: task.due_time || '',
          company_id: task.company_id,
          contact_id: task.contact_id,
          deal_id: task.deal_id,
        });
        setIsDialogOpen(true);
      }
      setPendingTaskId(null);
      // Clean URL
      const newParams = new URLSearchParams(window.location.search);
      newParams.delete('task');
      window.history.replaceState({}, '', `${window.location.pathname}${newParams.toString() ? '?' + newParams.toString() : ''}`);
    }
  }, [pendingTaskId, tasks]);

  const handleRefresh = async () => {
    await refetch();
    toast.success('Dados atualizados!');
  };

  const [companySearch, setCompanySearch] = useState('');
  const { data: companies } = useQuery({
    queryKey: ['task_companies', companySearch],
    queryFn: async () => {
      let query = supabase.from('companies').select('id, name').order('name').limit(50);
      if (companySearch) {
        query = query.ilike('name', `%${companySearch}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Ensure selected company always appears in options
  const { data: selectedCompany } = useQuery({
    queryKey: ['task_company_selected', formData.company_id],
    queryFn: async () => {
      const { data, error } = await supabase.from('companies').select('id, name').eq('id', formData.company_id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!formData.company_id,
  });

  const { data: contacts } = useQuery({
    queryKey: ['contacts', formData.company_id],
    queryFn: async () => {
      let query = supabase.from('contacts').select('id, first_name, last_name, company_id').order('first_name');
      if (formData.company_id) {
        query = query.eq('company_id', formData.company_id);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: deals } = useQuery({
    queryKey: ['deals'],
    queryFn: async () => {
      const { data, error } = await supabase.from('deals').select('id, name').order('name');
      if (error) throw error;
      return data;
    },
  });

  const companyOptions = useMemo(() => {
    const list = (companies || []).map(c => ({ value: c.id, label: c.name }));
    if (selectedCompany && !list.find(o => o.value === selectedCompany.id)) {
      list.unshift({ value: selectedCompany.id, label: selectedCompany.name });
    }
    return list;
  }, [companies, selectedCompany]);

  const contactOptions = useMemo(() => 
    (contacts || []).map(c => ({ value: c.id, label: `${c.first_name} ${c.last_name || ''}`.trim() })), [contacts]
  );

  const dealOptions = useMemo(() => 
    (deals || []).map(d => ({ value: d.id, label: d.name })), [deals]
  );

  const taskListKey = ['tasks', user?.id, isAdmin, ownerFilter];

  const createMutation = useMutation({
    mutationFn: async (data: TablesInsert<'tasks'>) => {
      const { data: created, error } = await supabase.from('tasks').insert(data).select('*, companies(name), contacts(first_name, last_name), deals(name)').single();
      if (error) throw error;
      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks_tab_counts'] });
      queryClient.invalidateQueries({ queryKey: ['today-tasks'] });
      toast.success('Tarefa criada com sucesso!');
      resetForm();
    },
    onError: (error: any) => {
      const message = error?.message || '';
      if (message.includes('Este cliente pertence ao vendedor')) {
        toast.error(message, { duration: 6000 });
      } else {
        toast.error('Erro ao criar tarefa');
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Task> & { id: string }) => {
      const { data: updated, error } = await supabase.from('tasks').update(data).eq('id', id).select('*, companies(name), contacts(first_name, last_name), deals(name)').single();
      if (error) throw error;
      return { id, updated };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks_tab_counts'] });
      queryClient.invalidateQueries({ queryKey: ['today-tasks'] });
      toast.success('Tarefa atualizada!');
      resetForm();
    },
    onError: (error: any) => {
      const message = error?.message || '';
      if (message.includes('Este cliente pertence ao vendedor')) {
        toast.error(message, { duration: 6000 });
      } else {
        toast.error('Erro ao atualizar tarefa');
      }
    },
  });

  const toggleComplete = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { error } = await supabase.from('tasks').update({
        status: completed ? 'concluida' : 'pendente',
        completed_at: completed ? new Date().toISOString() : null,
      }).eq('id', id);
      if (error) throw error;
      return { id, completed };
    },
    onSuccess: ({ id, completed }) => {
      // Optimistic patch across all paged task caches
      queryClient.setQueriesData<{ rows: any[]; count: number } | undefined>(
        { queryKey: ['tasks'] },
        (old) => old ? {
          ...old,
          rows: old.rows.map((t: any) => t.id === id ? {
            ...t,
            status: completed ? 'concluida' : 'pendente',
            completed_at: completed ? new Date().toISOString() : null,
          } : t),
        } : old,
      );
      queryClient.invalidateQueries({ queryKey: ['tasks_tab_counts'] });
      queryClient.invalidateQueries({ queryKey: ['today-tasks'] });
    },
  });

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      status: 'pendente',
      priority: 'media',
      due_date: '',
      due_time: '',
      company_id: null,
      contact_id: null,
      deal_id: null,
    });
    setEditingTask(null);
    setPrefilledDate(null);
    setIsDialogOpen(false);
  };

  // Handle creating task from calendar click
  const handleCreateFromCalendar = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    setPrefilledDate(dateStr);
    setFormData({
      ...formData,
      due_date: dateStr,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const sanitizedData = {
      ...formData,
      due_time: formData.due_time || null,
      due_date: formData.due_date || null,
    };
    if (editingTask) {
      updateMutation.mutate({ id: editingTask.id, ...sanitizedData });
    } else {
      createMutation.mutate({
        ...sanitizedData,
        title: sanitizedData.title || '',
        created_by: user?.id,
        assigned_to: user?.id,
      });
    }
  };

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      description: task.description || '',
      status: task.status,
      priority: task.priority,
      due_date: task.due_date ? task.due_date.split('T')[0] : '',
      due_time: task.due_time || '',
      company_id: task.company_id,
      contact_id: task.contact_id,
      deal_id: task.deal_id,
    });
    setIsDialogOpen(true);
  };

  // Server-side filtered + paginated; alias kept for minimal JSX churn.
  const filteredTasks = tasks;


  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Tarefas</h1>
          <p className="text-sm text-muted-foreground">Gerencie suas atividades e lembretes</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View Mode Toggle */}
          <div className="flex items-center border rounded-lg p-1">
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="gap-1"
            >
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">Lista</span>
            </Button>
            <Button
              variant={viewMode === 'calendar' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('calendar')}
              className="gap-1"
            >
              <CalendarDays className="h-4 w-4" />
              <span className="hidden sm:inline">Calendário</span>
            </Button>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2" size="sm">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Nova Tarefa</span>
              <span className="sm:hidden">Nova</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingTask ? 'Editar Tarefa' : 'Nova Tarefa'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="title">Título *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="priority">Prioridade</Label>
                  <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v as TaskPriority })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(priorityConfig).map(([key, config]) => (
                        <SelectItem key={key} value={key}>{config.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v as TaskStatus })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(statusConfig).map(([key, config]) => (
                        <SelectItem key={key} value={key}>{config.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="due_date">Data de Vencimento</Label>
                  <Input
                    id="due_date"
                    type="date"
                    value={formData.due_date || ''}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="due_time">Horário</Label>
                  <Input
                    id="due_time"
                    type="time"
                    value={formData.due_time || ''}
                    onChange={(e) => setFormData({ ...formData, due_time: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="company_id">Empresa</Label>
                  <SearchableSelect
                    options={companyOptions}
                    value={formData.company_id}
                    onChange={(v) => setFormData({ ...formData, company_id: v, contact_id: null })}
                    placeholder="Selecione a empresa"
                    searchPlaceholder="Buscar empresa..."
                    emptyMessage="Nenhuma empresa encontrada."
                    onSearchChange={setCompanySearch}
                  />
                </div>
                <div>
                  <Label htmlFor="contact_id">Contato</Label>
                  <SearchableSelect
                    options={contactOptions}
                    value={formData.contact_id}
                    onChange={(v) => setFormData({ ...formData, contact_id: v })}
                    placeholder="Selecione o contato"
                    searchPlaceholder="Buscar contato..."
                    emptyMessage="Nenhum contato encontrado."
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="deal_id">Negócio</Label>
                  <SearchableSelect
                    options={dealOptions}
                    value={formData.deal_id}
                    onChange={(v) => setFormData({ ...formData, deal_id: v })}
                    placeholder="Selecione o negócio"
                    searchPlaceholder="Buscar negócio..."
                    emptyMessage="Nenhum negócio encontrado."
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingTask ? 'Atualizar' : 'Criar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Calendar View */}
      {viewMode === 'calendar' ? (
        <TaskCalendar onCreateTask={handleCreateFromCalendar} />
      ) : (
        /* List View */
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar tarefas..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              {isAdmin && (
                <div className="w-[220px]">
                  <SearchableSelect
                    options={[
                      { value: 'mine', label: 'Minhas tarefas' },
                      { value: 'all', label: 'Todos' },
                      ...(sellers || []).map(s => ({ value: s.user_id, label: s.full_name })),
                    ]}
                    value={ownerFilter}
                    onChange={(v) => setOwnerFilter(v || 'mine')}
                    placeholder="Responsável"
                    searchPlaceholder="Buscar vendedor..."
                    allowClear={false}
                  />
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isFetching}
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="all">Todas</TabsTrigger>
                <TabsTrigger value="pending" className="gap-1">
                  Pendentes
                  {pendingCount > 0 && <Badge variant="secondary" className="ml-1">{pendingCount}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="completed">Concluídas</TabsTrigger>
                <TabsTrigger value="overdue" className="gap-1">
                  Atrasadas
                  {overdueCount > 0 && <Badge variant="destructive" className="ml-1">{overdueCount}</Badge>}
                </TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="mt-0">
                {isLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                  </div>
                ) : filteredTasks?.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <CheckSquare className="h-12 w-12 text-muted-foreground/50" />
                    <h3 className="mt-4 text-lg font-semibold">Nenhuma tarefa encontrada</h3>
                    <p className="text-muted-foreground">Comece criando uma nova tarefa.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredTasks?.map((task) => {
                      const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'concluida';
                      return (
                        <div
                          key={task.id}
                          className="flex items-start gap-3 p-4 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => handleEdit(task)}
                        >
                          <Checkbox
                            checked={task.status === 'concluida'}
                            onClick={(e) => e.stopPropagation()}
                            onCheckedChange={(checked) => toggleComplete.mutate({ id: task.id, completed: checked as boolean })}
                            className="mt-1"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className={`font-medium ${task.status === 'concluida' ? 'line-through text-muted-foreground' : ''}`}>
                                {task.title}
                              </p>
                              <Badge className={priorityConfig[task.priority].color + ' text-white'}>
                                {priorityConfig[task.priority].label}
                              </Badge>
                            </div>
                            {task.description && (
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{task.description}</p>
                            )}
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              {task.due_date && (
                                <div className={`flex items-center gap-1 ${isOverdue ? 'text-destructive' : ''}`}>
                                  <Calendar className="h-3 w-3" />
                                  {formatDate(task.due_date)}
                                </div>
                              )}
                              {task.due_time && (
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {task.due_time}
                                </div>
                              )}
                              {(task as any).companies?.name && (
                                <div className="flex items-center gap-1">
                                  <Building2 className="h-3 w-3" />
                                  {(task as any).companies.name}
                                </div>
                              )}
                              {(task as any).contacts && (
                                <div className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {(task as any).contacts.first_name}
                                </div>
                              )}
                              {(task as any).deals?.name && (
                                <div className="flex items-center gap-1">
                                  <Target className="h-3 w-3" />
                                  {(task as any).deals.name}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
