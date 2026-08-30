import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Pencil, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
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
import { CONTRACT_STATUS_LABELS, SERVICE_STATUS_LABELS } from '../types';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';

const emptyContract = {
  title: '',
  contract_number: '',
  status: 'active',
  starts_on: '',
  ends_on: '',
  next_renewal_on: '',
  notes: '',
  responsible_user_id: '',
};

const emptyService = {
  title: '',
  service_type: 'consultoria',
  status: 'active',
  starts_on: '',
  due_on: '',
  notes: '',
  contract_id: '',
  deal_id: '',
  responsible_user_id: '',
};

export function CustomerContractsTab({ companyId, canEdit }: { companyId: string; canEdit: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [contractOpen, setContractOpen] = useState(false);
  const [serviceOpen, setServiceOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<Tables<'client_contracts'> | null>(null);
  const [editingService, setEditingService] = useState<Tables<'service_engagements'> | null>(null);
  const [contractForm, setContractForm] = useState(emptyContract);
  const [serviceForm, setServiceForm] = useState(emptyService);
  const [assigneeSearch, setAssigneeSearch] = useState('');

  const { data: contracts = [] } = useQuery({
    queryKey: ['client-contracts', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_contracts')
        .select('*')
        .eq('company_id', companyId)
        .order('ends_on', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data || []) as Tables<'client_contracts'>[];
    },
  });

  const { data: services = [] } = useQuery({
    queryKey: ['service-engagements', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_engagements')
        .select('*')
        .eq('company_id', companyId)
        .order('due_on', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data || []) as Tables<'service_engagements'>[];
    },
  });

  const { data: deals = [] } = useQuery({
    queryKey: ['customer-service-deals', companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from('deals').select('id, name').eq('company_id', companyId).order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: assignees = [] } = useQuery({
    queryKey: ['workspace-assignees', assigneeSearch],
    enabled: contractOpen || serviceOpen,
    queryFn: async () => {
      let query = supabase.from('profiles').select('user_id, full_name').order('full_name').limit(40);
      if (assigneeSearch.trim()) query = query.ilike('full_name', `%${assigneeSearch.trim()}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    if (!contractOpen) return;
    if (editingContract) {
      setContractForm({
        title: editingContract.title,
        contract_number: editingContract.contract_number || '',
        status: editingContract.status,
        starts_on: editingContract.starts_on || '',
        ends_on: editingContract.ends_on || '',
        next_renewal_on: editingContract.next_renewal_on || '',
        notes: editingContract.notes || '',
        responsible_user_id: editingContract.responsible_user_id || '',
      });
    } else {
      setContractForm(emptyContract);
    }
  }, [contractOpen, editingContract]);

  useEffect(() => {
    if (!serviceOpen) return;
    if (editingService) {
      setServiceForm({
        title: editingService.title,
        service_type: editingService.service_type,
        status: editingService.status,
        starts_on: editingService.starts_on || '',
        due_on: editingService.due_on || '',
        notes: editingService.notes || '',
        contract_id: editingService.contract_id || '',
        deal_id: editingService.deal_id || '',
        responsible_user_id: editingService.responsible_user_id || '',
      });
    } else {
      setServiceForm(emptyService);
    }
  }, [serviceOpen, editingService]);

  const saveContract = useMutation({
    mutationFn: async () => {
      const payload: TablesInsert<'client_contracts'> = {
        company_id: companyId,
        title: contractForm.title,
        contract_number: contractForm.contract_number || null,
        status: contractForm.status as TablesInsert<'client_contracts'>['status'],
        starts_on: contractForm.starts_on || null,
        ends_on: contractForm.ends_on || null,
        next_renewal_on: contractForm.next_renewal_on || null,
        notes: contractForm.notes || null,
        responsible_user_id: contractForm.responsible_user_id || null,
        created_by: user!.id,
      };
      if (editingContract) {
        const { created_by: _c, company_id: _co, ...update } = payload;
        const { error } = await supabase.from('client_contracts').update(update).eq('id', editingContract.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('client_contracts').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingContract ? 'Contrato atualizado' : 'Contrato registrado');
      setContractOpen(false);
      setEditingContract(null);
      qc.invalidateQueries({ queryKey: ['client-contracts', companyId] });
      qc.invalidateQueries({ queryKey: ['customer-workspace-summary', companyId] });
      qc.invalidateQueries({ queryKey: ['customer-workspace-timeline'] });
    },
    onError: (error: { message?: string }) => toast.error(error.message || 'Erro ao salvar contrato'),
  });

  const saveService = useMutation({
    mutationFn: async () => {
      const payload: TablesInsert<'service_engagements'> = {
        company_id: companyId,
        title: serviceForm.title,
        service_type: serviceForm.service_type,
        status: serviceForm.status as TablesInsert<'service_engagements'>['status'],
        starts_on: serviceForm.starts_on || null,
        due_on: serviceForm.due_on || null,
        notes: serviceForm.notes || null,
        contract_id: serviceForm.contract_id || null,
        deal_id: serviceForm.deal_id || null,
        responsible_user_id: serviceForm.responsible_user_id || null,
        created_by: user!.id,
        completed_on: serviceForm.status === 'completed' ? new Date().toISOString().slice(0, 10) : null,
      };
      if (editingService) {
        const { created_by: _c, company_id: _co, ...update } = payload;
        const { error } = await supabase.from('service_engagements').update(update).eq('id', editingService.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('service_engagements').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingService ? 'Serviço atualizado' : 'Consultoria registrada');
      setServiceOpen(false);
      setEditingService(null);
      qc.invalidateQueries({ queryKey: ['service-engagements', companyId] });
      qc.invalidateQueries({ queryKey: ['customer-workspace-summary', companyId] });
      qc.invalidateQueries({ queryKey: ['customer-workspace-timeline'] });
    },
    onError: (error: { message?: string }) => toast.error(error.message || 'Erro ao salvar serviço'),
  });

  const assigneeOptions = assignees.map((p) => ({ value: p.user_id, label: p.full_name || 'Usuário' }));

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Contratos</h3>
          {canEdit && (
            <Button type="button" size="sm" onClick={() => { setEditingContract(null); setContractOpen(true); }}>
              <Plus className="mr-1 h-4 w-4" />Novo contrato
            </Button>
          )}
        </div>
        {contracts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum contrato estruturado. Anexos avulsos não substituem este registro.</p>
        ) : contracts.map((item) => (
          <Card key={item.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base">{item.title}</CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{CONTRACT_STATUS_LABELS[item.status] || item.status}</Badge>
                {canEdit && (
                  <Button type="button" size="icon" variant="ghost" aria-label="Editar contrato" onClick={() => { setEditingContract(item); setContractOpen(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>{item.contract_number || 'Sem número'} · {item.starts_on || '—'} a {item.ends_on || '—'}</p>
              {item.next_renewal_on && <p>Renovação: {item.next_renewal_on}</p>}
              <AttachmentManager module="contratos" entityType="contract" entityId={item.id} readOnly={!canEdit} title="Arquivos do contrato" />
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Consultorias e serviços</h3>
          {canEdit && (
            <Button type="button" size="sm" onClick={() => { setEditingService(null); setServiceOpen(true); }}>
              <Plus className="mr-1 h-4 w-4" />Novo serviço
            </Button>
          )}
        </div>
        {services.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum serviço em execução. Use o funil para o fluxo e este registro para a entrega.</p>
        ) : services.map((item) => (
          <Card key={item.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base">{item.title}</CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{SERVICE_STATUS_LABELS[item.status] || item.status}</Badge>
                {canEdit && (
                  <Button type="button" size="icon" variant="ghost" aria-label="Editar serviço" onClick={() => { setEditingService(item); setServiceOpen(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {item.service_type} · Prazo {item.due_on || 'não definido'}
            </CardContent>
          </Card>
        ))}
      </section>

      <Dialog open={contractOpen} onOpenChange={(next) => { setContractOpen(next); if (!next) setEditingContract(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingContract ? 'Editar contrato' : 'Novo contrato'}</DialogTitle></DialogHeader>
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); saveContract.mutate(); }}>
            <div><Label>Título</Label><Input required value={contractForm.title} onChange={(e) => setContractForm({ ...contractForm, title: e.target.value })} /></div>
            <div><Label>Número</Label><Input value={contractForm.contract_number} onChange={(e) => setContractForm({ ...contractForm, contract_number: e.target.value })} /></div>
            <div>
              <Label>Status</Label>
              <Select value={contractForm.status} onValueChange={(v) => setContractForm({ ...contractForm, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CONTRACT_STATUS_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Responsável</Label>
              <SearchableSelect
                options={assigneeOptions}
                value={contractForm.responsible_user_id || null}
                onChange={(v) => setContractForm({ ...contractForm, responsible_user_id: v || '' })}
                placeholder="Responsável"
                searchPlaceholder="Buscar pessoa..."
                emptyMessage="Ninguém encontrado"
                onSearchChange={setAssigneeSearch}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Início</Label><Input type="date" value={contractForm.starts_on} onChange={(e) => setContractForm({ ...contractForm, starts_on: e.target.value })} /></div>
              <div><Label>Fim</Label><Input type="date" value={contractForm.ends_on} onChange={(e) => setContractForm({ ...contractForm, ends_on: e.target.value })} /></div>
            </div>
            <div><Label>Renovação</Label><Input type="date" value={contractForm.next_renewal_on} onChange={(e) => setContractForm({ ...contractForm, next_renewal_on: e.target.value })} /></div>
            <div><Label>Observações</Label><Textarea value={contractForm.notes} onChange={(e) => setContractForm({ ...contractForm, notes: e.target.value })} /></div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setContractOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saveContract.isPending}>{editingContract ? 'Atualizar' : 'Salvar'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={serviceOpen} onOpenChange={(next) => { setServiceOpen(next); if (!next) setEditingService(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingService ? 'Editar serviço' : 'Novo serviço'}</DialogTitle></DialogHeader>
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); saveService.mutate(); }}>
            <div><Label>Título</Label><Input required value={serviceForm.title} onChange={(e) => setServiceForm({ ...serviceForm, title: e.target.value })} /></div>
            <div><Label>Tipo</Label><Input value={serviceForm.service_type} onChange={(e) => setServiceForm({ ...serviceForm, service_type: e.target.value })} /></div>
            <div>
              <Label>Status</Label>
              <Select value={serviceForm.status} onValueChange={(v) => setServiceForm({ ...serviceForm, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(SERVICE_STATUS_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Contrato (opcional)</Label>
              <Select value={serviceForm.contract_id || 'none'} onValueChange={(v) => setServiceForm({ ...serviceForm, contract_id: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {contracts.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Processo (opcional)</Label>
              <Select value={serviceForm.deal_id || 'none'} onValueChange={(v) => setServiceForm({ ...serviceForm, deal_id: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {deals.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Responsável</Label>
              <SearchableSelect
                options={assigneeOptions}
                value={serviceForm.responsible_user_id || null}
                onChange={(v) => setServiceForm({ ...serviceForm, responsible_user_id: v || '' })}
                placeholder="Responsável"
                searchPlaceholder="Buscar pessoa..."
                emptyMessage="Ninguém encontrado"
                onSearchChange={setAssigneeSearch}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Início</Label><Input type="date" value={serviceForm.starts_on} onChange={(e) => setServiceForm({ ...serviceForm, starts_on: e.target.value })} /></div>
              <div><Label>Prazo</Label><Input type="date" value={serviceForm.due_on} onChange={(e) => setServiceForm({ ...serviceForm, due_on: e.target.value })} /></div>
            </div>
            <div><Label>Observações</Label><Textarea value={serviceForm.notes} onChange={(e) => setServiceForm({ ...serviceForm, notes: e.target.value })} /></div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setServiceOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saveService.isPending}>{editingService ? 'Atualizar' : 'Salvar'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
