import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  const [activeTab, setActiveTab] = useState('all');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [prefilledDate, setPrefilledDate] = useState<string | null>(null);
  const [ownerFilter, setOwnerFilter] = useState<string>('mine');
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
  });

  const { data: tasks, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['tasks', user?.id, isAdmin, ownerFilter],
    queryFn: async () => {
      let query = supabase
        .from('tasks')
        .select('*, companies(name), contacts(first_name, last_name), deals(name)')
        .order('due_date', { ascending: true, nullsFirst: false });
      
      if (!isAdmin) {
        // Non-admin users always see only their own tasks
        query = query.eq('assigned_to', user!.id);
      } else if (ownerFilter === 'mine') {
        query = query.eq('assigned_to', user!.id);
      } else if (ownerFilter !== 'all') {
        // Specific seller selected
        query = query.eq('assigned_to', ownerFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    staleTime: 0,
    refetchOnMount: 'always',
    enabled: !!user?.id,
  });

  const handleRefresh = async () => {
    await refetch();
    toast.success('Dados atualizados!');
  };

  const { data: companies } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      const { data, error } = await supabase.from('companies').select('id, name').order('name');
      if (error) throw error;
      return data;
    },
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

  const companyOptions = useMemo(() => 
    (companies || []).map(c => ({ value: c.id, label: c.name })), [companies]
  );

  const contactOptions = useMemo(() => 
    (contacts || []).map(c => ({ value: c.id, label: `${c.first_name} ${c.last_name || ''}`.trim() })), [contacts]
  );

  const dealOptions = useMemo(() => 
    (deals || []).map(d => ({ value: d.id, label: d.name })), [deals]
  );

  const createMutation = useMutation({
    mutationFn: async (data: TablesInsert<'tasks'>) => {
      const { error } = await supabase.from('tasks').insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Tarefa criada com sucesso!');
      resetForm();
    },
    onError: (error: any) => {
      // Check if it's a portfolio governance error (trigger block)
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
      const { error } = await supabase.from('tasks').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Tarefa atualizada!');
      resetForm();
    },
    onError: (error: any) => {
      // Check if it's a portfolio governance error (trigger block)
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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
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
    if (editingTask) {
      updateMutation.mutate({ id: editingTask.id, ...formData });
    } else {
      createMutation.mutate({
        ...formData,
        title: formData.title || '',
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

  const filteredTasks = tasks?.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(search.toLowerCase());
    if (activeTab === 'all') return matchesSearch;
    if (activeTab === 'pending') return matchesSearch && (task.status === 'pendente' || task.status === 'em_andamento');
    if (activeTab === 'completed') return matchesSearch && task.status === 'concluida';
    if (activeTab === 'overdue') {
      const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'concluida';
      return matchesSearch && isOverdue;
    }
    return matchesSearch;
  });

  const pendingCount = tasks?.filter(t => t.status === 'pendente' || t.status === 'em_andamento').length || 0;
  const overdueCount = tasks?.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'concluida').length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Tarefas</h1>
          <p className="text-muted-foreground">Gerencie suas atividades e lembretes</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center border rounded-lg p-1">
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="gap-1"
            >
              <List className="h-4 w-4" />
              Lista
            </Button>
            <Button
              variant={viewMode === 'calendar' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('calendar')}
              className="gap-1"
            >
              <CalendarDays className="h-4 w-4" />
              Calendário
            </Button>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Tarefa
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
                <Select value={ownerFilter} onValueChange={setOwnerFilter}>
                  <SelectTrigger className="w-[220px]">
                    <User className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Responsável" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mine">Minhas tarefas</SelectItem>
                    <SelectItem value="all">Todos</SelectItem>
                    {sellers?.map((s) => (
                      <SelectItem key={s.user_id} value={s.user_id}>{s.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
