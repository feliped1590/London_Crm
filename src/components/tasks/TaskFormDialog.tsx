import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { toCivilDateUTC, fromCivilDateUTC } from '@/lib/civilDate';
import { WAITING_ON_LABELS } from '@/modules/customer-workspace';
import { taskPriorityConfig, taskStatusConfig } from '@/components/tasks/taskDisplay';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';

export type TaskListRow = Tables<'tasks'> & {
  companies?: { id: string; name: string } | null;
  contacts?: { id: string; first_name: string; last_name: string | null } | null;
  deals?: { id: string; name: string } | null;
};

type TaskStatus = Tables<'tasks'>['status'];
type TaskPriority = Tables<'tasks'>['priority'];

type FormState = Partial<TablesInsert<'tasks'>> & {
  waiting_on?: 'internal' | 'customer' | 'third_party' | null;
  assigned_to?: string | null;
};

export function TaskFormDialog({
  open,
  onOpenChange,
  task,
  lockedCompanyId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: TaskListRow | null;
  lockedCompanyId?: string;
  onSaved?: () => void;
}) {
  const { user } = useAuth();
  const [companySearch, setCompanySearch] = useState('');
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [form, setForm] = useState<FormState>({
    title: '',
    description: '',
    status: 'pendente',
    priority: 'media',
    due_date: '',
    due_time: '',
    company_id: lockedCompanyId || null,
    contact_id: null,
    deal_id: null,
    waiting_on: 'internal',
    assigned_to: null,
  });

  useEffect(() => {
    if (!open) return;
    if (task) {
      setForm({
        title: task.title,
        description: task.description || '',
        status: task.status,
        priority: task.priority,
        due_date: fromCivilDateUTC(task.due_date),
        due_time: task.due_time || '',
        company_id: lockedCompanyId || task.company_id,
        contact_id: task.contact_id,
        deal_id: task.deal_id,
        waiting_on: task.waiting_on || 'internal',
        assigned_to: task.assigned_to,
      });
    } else {
      setForm({
        title: '',
        description: '',
        status: 'pendente',
        priority: 'media',
        due_date: '',
        due_time: '',
        company_id: lockedCompanyId || null,
        contact_id: null,
        deal_id: null,
        waiting_on: 'internal',
        assigned_to: user?.id || null,
      });
    }
  }, [open, task, lockedCompanyId, user?.id]);

  const companyId = form.company_id || lockedCompanyId || null;

  const { data: companies } = useQuery({
    queryKey: ['task_companies', companySearch],
    enabled: !lockedCompanyId && open,
    queryFn: async () => {
      let query = supabase.from('companies').select('id, name').order('name').limit(50);
      if (companySearch) query = query.ilike('name', `%${companySearch}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: contacts } = useQuery({
    queryKey: ['task-form-contacts', companyId],
    enabled: open && Boolean(companyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, first_name, last_name')
        .eq('company_id', companyId!)
        .order('first_name');
      if (error) throw error;
      return data;
    },
  });

  const { data: assignees } = useQuery({
    queryKey: ['task-form-assignees', assigneeSearch],
    enabled: open,
    queryFn: async () => {
      let query = supabase.from('profiles').select('user_id, full_name').order('full_name').limit(40);
      if (assigneeSearch.trim()) query = query.ilike('full_name', `%${assigneeSearch.trim()}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: deals } = useQuery({
    queryKey: ['task-form-deals', companyId],
    enabled: open && Boolean(companyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deals')
        .select('id, name')
        .eq('company_id', companyId!)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload: TablesInsert<'tasks'> = {
        title: form.title || '',
        description: form.description || null,
        status: form.status || 'pendente',
        priority: form.priority || 'media',
        due_date: toCivilDateUTC(form.due_date),
        due_time: form.due_time || null,
        company_id: companyId,
        contact_id: form.contact_id || null,
        deal_id: form.deal_id || null,
        waiting_on: form.waiting_on || 'internal',
        assigned_to: form.assigned_to || user?.id || null,
      };
      if (task) {
        const { error } = await supabase.from('tasks').update(payload).eq('id', task.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('tasks').insert({
          ...payload,
          created_by: user?.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(task ? 'Tarefa atualizada' : 'Tarefa criada');
      onSaved?.();
      onOpenChange(false);
    },
    onError: (error: { message?: string }) => {
      toast.error(error?.message?.includes('Este cliente pertence') ? error.message : 'Erro ao salvar tarefa');
    },
  });

  const companyOptions = useMemo(
    () => (companies || []).map((c) => ({ value: c.id, label: c.name })),
    [companies],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{task ? 'Editar tarefa' : 'Nova tarefa'}</DialogTitle>
        </DialogHeader>
        <form
          className="grid grid-cols-2 gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="col-span-2">
            <Label htmlFor="task-title">Título</Label>
            <Input id="task-title" required value={form.title || ''} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="col-span-2">
            <Label htmlFor="task-desc">Descrição</Label>
            <Textarea id="task-desc" rows={3} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <Label>Prioridade</Label>
            <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as TaskPriority })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(taskPriorityConfig).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as TaskStatus })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(taskStatusConfig).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="task-due">Data</Label>
            <Input id="task-due" type="date" value={form.due_date || ''} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="task-time">Horário</Label>
            <Input id="task-time" type="time" value={form.due_time || ''} onChange={(e) => setForm({ ...form, due_time: e.target.value })} />
          </div>
          <div>
            <Label>Aguardando</Label>
            <Select value={form.waiting_on || 'internal'} onValueChange={(v) => setForm({ ...form, waiting_on: v as FormState['waiting_on'] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(WAITING_ON_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!lockedCompanyId && (
            <div>
              <Label>Cliente</Label>
              <SearchableSelect
                options={companyOptions}
                value={form.company_id}
                onChange={(v) => setForm({ ...form, company_id: v, contact_id: null, deal_id: null })}
                placeholder="Cliente"
                searchPlaceholder="Buscar cliente..."
                emptyMessage="Nenhum cliente"
                onSearchChange={setCompanySearch}
              />
            </div>
          )}
          <div>
            <Label>Contato</Label>
            <SearchableSelect
              options={(contacts || []).map((c) => ({ value: c.id, label: `${c.first_name} ${c.last_name || ''}`.trim() }))}
              value={form.contact_id}
              onChange={(v) => setForm({ ...form, contact_id: v })}
              placeholder="Contato"
              searchPlaceholder="Buscar contato..."
              emptyMessage="Nenhum contato"
            />
          </div>
          <div className="col-span-2">
            <Label>Responsável</Label>
            <SearchableSelect
              options={(assignees || []).map((p) => ({ value: p.user_id, label: p.full_name || 'Usuário' }))}
              value={form.assigned_to || null}
              onChange={(v) => setForm({ ...form, assigned_to: v })}
              placeholder="Responsável"
              searchPlaceholder="Buscar pessoa..."
              emptyMessage="Ninguém encontrado"
              onSearchChange={setAssigneeSearch}
            />
          </div>
          <div className={lockedCompanyId ? 'col-span-2' : undefined}>
            <Label>Processo</Label>
            <SearchableSelect
              options={(deals || []).map((d) => ({ value: d.id, label: d.name }))}
              value={form.deal_id}
              onChange={(v) => setForm({ ...form, deal_id: v })}
              placeholder="Processo"
              searchPlaceholder="Buscar processo..."
              emptyMessage="Nenhum processo"
            />
          </div>
          <div className="col-span-2 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={save.isPending}>{task ? 'Atualizar' : 'Criar'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
