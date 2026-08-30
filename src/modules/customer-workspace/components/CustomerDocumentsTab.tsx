import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Pencil, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { AttachmentManager } from '@/components/attachments/AttachmentManager';
import { DOCUMENT_STATUS_LABELS } from '../types';
import { useAuth } from '@/hooks/useAuth';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

type DocumentRow = Tables<'customer_documents'> & {
  document_types?: { name: string } | null;
};

const emptyForm = {
  document_type_id: '',
  status: 'requested',
  due_date: '',
  expires_at: '',
  next_due_date: '',
  notes: '',
  deal_id: '',
  responsible_user_id: '',
};

function timestampsForStatus(status: string, now: string): Pick<TablesUpdate<'customer_documents'>, 'requested_at' | 'received_at' | 'reviewed_at'> {
  if (status === 'requested' || status === 'waiting_customer') return { requested_at: now };
  if (status === 'received') return { received_at: now };
  if (status === 'in_review' || status === 'approved' || status === 'rejected') return { reviewed_at: now };
  return {};
}

export function CustomerDocumentsTab({ companyId, canEdit }: { companyId: string; canEdit: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DocumentRow | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [assigneeSearch, setAssigneeSearch] = useState('');

  const { data: types = [] } = useQuery({
    queryKey: ['document-types'],
    queryFn: async () => {
      const { data, error } = await supabase.from('document_types').select('id, name').eq('is_active', true).order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: deals = [] } = useQuery({
    queryKey: ['customer-document-deals', companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from('deals').select('id, name').eq('company_id', companyId).order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: assignees = [] } = useQuery({
    queryKey: ['workspace-assignees', assigneeSearch],
    enabled: open,
    queryFn: async () => {
      let query = supabase.from('profiles').select('user_id, full_name').order('full_name').limit(40);
      if (assigneeSearch.trim()) query = query.ilike('full_name', `%${assigneeSearch.trim()}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: docs = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['customer-documents', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_documents')
        .select('*, document_types(name)')
        .eq('company_id', companyId)
        .order('due_date', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data || []) as DocumentRow[];
    },
  });

  const assigneeIds = useMemo(
    () => [...new Set(docs.map((d) => d.responsible_user_id).filter(Boolean))] as string[],
    [docs],
  );

  const { data: namedAssignees = [] } = useQuery({
    queryKey: ['customer-document-assignees', assigneeIds],
    enabled: assigneeIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('user_id, full_name').in('user_id', assigneeIds);
      if (error) throw error;
      return data || [];
    },
  });

  const nameByUser = useMemo(
    () => new Map(namedAssignees.map((p) => [p.user_id, p.full_name || 'Usuário'])),
    [namedAssignees],
  );

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        document_type_id: editing.document_type_id,
        status: editing.status,
        due_date: editing.due_date || '',
        expires_at: editing.expires_at || '',
        next_due_date: editing.next_due_date || '',
        notes: editing.notes || '',
        deal_id: editing.deal_id || '',
        responsible_user_id: editing.responsible_user_id || '',
      });
    } else {
      setForm(emptyForm);
    }
  }, [open, editing]);

  const save = useMutation({
    mutationFn: async () => {
      const now = new Date().toISOString();
      const payload: TablesInsert<'customer_documents'> = {
        company_id: companyId,
        document_type_id: form.document_type_id,
        status: form.status as TablesInsert<'customer_documents'>['status'],
        due_date: form.due_date || null,
        expires_at: form.expires_at || null,
        next_due_date: form.next_due_date || null,
        notes: form.notes || null,
        deal_id: form.deal_id || null,
        responsible_user_id: form.responsible_user_id || null,
        created_by: user!.id,
        ...timestampsForStatus(form.status, now),
      };
      if (editing) {
        const { created_by: _createdBy, company_id: _companyId, ...update } = payload;
        const { error } = await supabase.from('customer_documents').update(update).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('customer_documents').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? 'Documento atualizado' : 'Documento registrado');
      setOpen(false);
      setEditing(null);
      qc.invalidateQueries({ queryKey: ['customer-documents', companyId] });
      qc.invalidateQueries({ queryKey: ['customer-workspace-summary', companyId] });
      qc.invalidateQueries({ queryKey: ['customer-workspace-timeline'] });
    },
    onError: (error: { message?: string }) => toast.error(error.message || 'Erro ao salvar documento'),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (doc: DocumentRow) => {
    setEditing(doc);
    setOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Documentos com status, prazo, validade e responsável — não são apenas anexos.</p>
        {canEdit && (
          <Button type="button" size="sm" onClick={openCreate}>
            <Plus className="mr-1 h-4 w-4" />Solicitar documento
          </Button>
        )}
      </div>
      {isLoading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Carregando documentos…</p>
      ) : isError ? (
        <div className="py-10 text-center">
          <p className="text-sm text-destructive">Não foi possível carregar documentos.</p>
          <Button type="button" className="mt-3" size="sm" variant="outline" onClick={() => refetch()}>Tentar novamente</Button>
        </div>
      ) : docs.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhum documento operacional cadastrado para este cliente.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {docs.map((doc) => (
            <Card key={doc.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base">{doc.document_types?.name || 'Documento'}</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant={doc.status === 'expired' ? 'destructive' : 'outline'}>
                    {DOCUMENT_STATUS_LABELS[doc.status] || doc.status}
                  </Badge>
                  {canEdit && (
                    <Button type="button" size="icon" variant="ghost" aria-label="Editar documento" onClick={() => openEdit(doc)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Prazo: {doc.due_date || 'não definido'}
                  {doc.expires_at ? ` · Validade: ${doc.expires_at}` : ''}
                  {doc.responsible_user_id ? ` · Responsável: ${nameByUser.get(doc.responsible_user_id) || 'usuário'}` : ''}
                </p>
                <Button type="button" size="sm" variant="ghost" onClick={() => setSelectedId(selectedId === doc.id ? null : doc.id)}>
                  {selectedId === doc.id ? 'Ocultar arquivo' : 'Arquivo'}
                </Button>
                {selectedId === doc.id && (
                  <AttachmentManager
                    module="documentos"
                    entityType="customer_document"
                    entityId={doc.id}
                    readOnly={!canEdit}
                    title="Arquivo do documento"
                  />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setEditing(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar documento' : 'Solicitar documento'}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <div>
              <Label>Tipo</Label>
              <Select value={form.document_type_id} onValueChange={(v) => setForm({ ...form, document_type_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {types.map((type) => (
                    <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(DOCUMENT_STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Processo (opcional)</Label>
              <Select value={form.deal_id || 'none'} onValueChange={(v) => setForm({ ...form, deal_id: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {deals.map((deal) => (
                    <SelectItem key={deal.id} value={deal.id}>{deal.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Responsável</Label>
              <SearchableSelect
                options={assignees.map((p) => ({ value: p.user_id, label: p.full_name || 'Usuário' }))}
                value={form.responsible_user_id || null}
                onChange={(v) => setForm({ ...form, responsible_user_id: v || '' })}
                placeholder="Responsável interno"
                searchPlaceholder="Buscar pessoa..."
                emptyMessage="Ninguém encontrado"
                onSearchChange={setAssigneeSearch}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="doc-due">Prazo</Label>
                <Input id="doc-due" type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="doc-exp">Validade</Label>
                <Input id="doc-exp" type="date" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} />
              </div>
            </div>
            <div>
              <Label htmlFor="doc-next">Próximo vencimento</Label>
              <Input id="doc-next" type="date" value={form.next_due_date} onChange={(e) => setForm({ ...form, next_due_date: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="doc-notes">Observações</Label>
              <Textarea id="doc-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={!form.document_type_id || save.isPending}>{editing ? 'Atualizar' : 'Salvar'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
