import { useState, useEffect } from 'react';
import { ErpCitiesManager } from './ErpCitiesManager';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';

// ─── Generic Mapping Table ──────────────────────────────────────────────

interface ColumnDef {
  field: string;
  label: string;
  type: 'text' | 'number';
  required?: boolean;
  readOnly?: boolean;
}

interface MappingTableProps {
  tableName: string;
  queryKey: string;
  columns: ColumnDef[];
  keyField: string; // field used for duplicate check
  hasActiveToggle?: boolean;
}

function ErpMappingTable({ tableName, queryKey, columns, keyField, hasActiveToggle = true }: MappingTableProps) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<any>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});

  const { data: rows = [], isLoading } = useQuery({
    queryKey: [queryKey],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from(tableName).select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const upsertMutation = useMutation({
    mutationFn: async (record: any) => {
      if (record.id) {
        const { error } = await (supabase as any).from(tableName).update(record).eq('id', record.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from(tableName).insert(record);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      toast.success(editingRow ? 'Mapping atualizado' : 'Mapping criado');
      closeDialog();
    },
    onError: (err: any) => {
      if (err.message?.includes('duplicate') || err.code === '23505') {
        toast.error('Já existe um mapping com essa chave');
      } else {
        toast.error('Erro: ' + (err.message || 'desconhecido'));
      }
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await (supabase as any).from(tableName).update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [queryKey] }),
    onError: (err: any) => toast.error('Erro ao alterar status: ' + err.message),
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingRow(null);
    setFormData({});
  };

  const openCreate = () => {
    setEditingRow(null);
    const initial: Record<string, any> = {};
    columns.forEach(c => { if (!c.readOnly) initial[c.field] = ''; });
    setFormData(initial);
    setDialogOpen(true);
  };

  const openEdit = (row: any) => {
    setEditingRow(row);
    const initial: Record<string, any> = {};
    columns.forEach(c => { initial[c.field] = row[c.field] ?? ''; });
    setFormData(initial);
    setDialogOpen(true);
  };

  const handleSave = () => {
    // Validate required
    for (const col of columns) {
      if (col.required && !col.readOnly && (formData[col.field] === '' || formData[col.field] === undefined)) {
        toast.error(`Campo "${col.label}" é obrigatório`);
        return;
      }
    }

    // Check duplicate
    if (!editingRow) {
      const dup = rows.find((r: any) => String(r[keyField]).toLowerCase() === String(formData[keyField]).toLowerCase());
      if (dup) {
        toast.error(`Já existe um mapping com "${formData[keyField]}"`);
        return;
      }
    }

    const record: any = {};
    columns.forEach(c => {
      if (!c.readOnly) {
        record[c.field] = c.type === 'number' ? Number(formData[c.field]) : formData[c.field];
      }
    });
    if (editingRow) record.id = editingRow.id;
    upsertMutation.mutate(record);
  };

  if (isLoading) {
    return <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate} size="sm" className="gap-1">
          <Plus className="h-4 w-4" /> Novo
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            {columns.map(c => <TableHead key={c.field}>{c.label}</TableHead>)}
            {hasActiveToggle && <TableHead>Ativo</TableHead>}
            <TableHead className="w-[60px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow><TableCell colSpan={columns.length + 2} className="text-center text-muted-foreground py-8">Nenhum mapping cadastrado</TableCell></TableRow>
          ) : rows.map((row: any) => (
            <TableRow key={row.id}>
              {columns.map(c => (
                <TableCell key={c.field}>
                  {c.type === 'number' ? (
                    row[c.field] != null ? <Badge variant="outline">{row[c.field]}</Badge> : <span className="text-muted-foreground">—</span>
                  ) : (
                    row[c.field] || <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
              ))}
              {hasActiveToggle && (
                <TableCell>
                  <Switch
                    checked={row.is_active ?? true}
                    onCheckedChange={(val) => toggleMutation.mutate({ id: row.id, is_active: val })}
                  />
                </TableCell>
              )}
              <TableCell>
                <Button variant="ghost" size="icon" onClick={() => openEdit(row)}>
                  <Pencil className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRow ? 'Editar Mapping' : 'Novo Mapping'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {columns.filter(c => !c.readOnly).map(c => (
              <div key={c.field} className="space-y-1">
                <Label>{c.label} {c.required && <span className="text-destructive">*</span>}</Label>
                <Input
                  type={c.type === 'number' ? 'number' : 'text'}
                  value={formData[c.field] ?? ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, [c.field]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={handleSave} disabled={upsertMutation.isPending}>
              {upsertMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── ERP Users Tab (profiles.erp_user_code) ─────────────────────────────

function ErpUsersTable() {
  const queryClient = useQueryClient();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['erp-users-mapping'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, full_name, erp_user_code').order('full_name');
      if (error) throw error;
      return data || [];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, erp_user_code }: { id: string; erp_user_code: number | null }) => {
      const { error } = await supabase.from('profiles').update({ erp_user_code } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['erp-users-mapping'] });
      toast.success('Código ERP atualizado');
    },
    onError: (err: any) => toast.error('Erro: ' + err.message),
  });

  const [editId, setEditId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  if (isLoading) return <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Usuário</TableHead>
          <TableHead>Código ERP</TableHead>
          <TableHead className="w-[100px]" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((u: any) => (
          <TableRow key={u.id}>
            <TableCell>{u.full_name || '—'}</TableCell>
            <TableCell>
              {editId === u.id ? (
                <Input
                  type="number"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-40"
                  autoFocus
                />
              ) : (
                u.erp_user_code ? <Badge variant="outline">{u.erp_user_code}</Badge> : <Badge variant="destructive">Não configurado</Badge>
              )}
            </TableCell>
            <TableCell>
              {editId === u.id ? (
                <div className="flex gap-1">
                  <Button size="sm" onClick={() => {
                    const val = editValue.trim() ? Number(editValue) : null;
                    updateMutation.mutate({ id: u.id, erp_user_code: val });
                    setEditId(null);
                  }}>Salvar</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>✕</Button>
                </div>
              ) : (
                <Button variant="ghost" size="icon" onClick={() => { setEditId(u.id); setEditValue(u.erp_user_code?.toString() || ''); }}>
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ─── ERP Vendors Tab (sales_reps.erp_vendor_code) ───────────────────────

function ErpVendorsTable() {
  const queryClient = useQueryClient();

  const { data: reps = [], isLoading } = useQuery({
    queryKey: ['erp-vendors-mapping'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('sales_reps').select('id, name, erp_vendor_code').order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, erp_vendor_code }: { id: string; erp_vendor_code: number | null }) => {
      const { error } = await (supabase as any).from('sales_reps').update({ erp_vendor_code }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['erp-vendors-mapping'] });
      toast.success('Código ERP atualizado');
    },
    onError: (err: any) => toast.error('Erro: ' + err.message),
  });

  const [editId, setEditId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  if (isLoading) return <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Vendedor</TableHead>
          <TableHead>Código ERP</TableHead>
          <TableHead className="w-[100px]" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {reps.map((r: any) => (
          <TableRow key={r.id}>
            <TableCell>{r.name || '—'}</TableCell>
            <TableCell>
              {editId === r.id ? (
                <Input type="number" value={editValue} onChange={(e) => setEditValue(e.target.value)} className="w-40" autoFocus />
              ) : (
                r.erp_vendor_code ? <Badge variant="outline">{r.erp_vendor_code}</Badge> : <Badge variant="destructive">Não configurado</Badge>
              )}
            </TableCell>
            <TableCell>
              {editId === r.id ? (
                <div className="flex gap-1">
                  <Button size="sm" onClick={() => {
                    const val = editValue.trim() ? Number(editValue) : null;
                    updateMutation.mutate({ id: r.id, erp_vendor_code: val });
                    setEditId(null);
                  }}>Salvar</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>✕</Button>
                </div>
              ) : (
                <Button variant="ghost" size="icon" onClick={() => { setEditId(r.id); setEditValue(r.erp_vendor_code?.toString() || ''); }}>
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────

export function ErpMappingsManager() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Configurações de Mapeamento ERP</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="order-types">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="order-types">Tipos de Pedido</TabsTrigger>
            <TabsTrigger value="freight">Frete</TabsTrigger>
            <TabsTrigger value="sale-type">Tipo de Venda</TabsTrigger>
            <TabsTrigger value="payment">Forma Pagamento</TabsTrigger>
            <TabsTrigger value="users">Usuários ERP</TabsTrigger>
            <TabsTrigger value="vendors">Vendedores ERP</TabsTrigger>
            <TabsTrigger value="cities">Cidades ERP</TabsTrigger>
          </TabsList>

          <TabsContent value="order-types" className="mt-4">
            <ErpMappingTable
              tableName="order_type_erp_mapping"
              queryKey="erp-order-type-mapping"
              keyField="crm_order_type"
              columns={[
                { field: 'crm_order_type', label: 'Tipo CRM', type: 'text', required: true },
                { field: 'erp_flow_code', label: 'Código Fluxo ERP', type: 'number', required: true },
                { field: 'erp_flow_description', label: 'Descrição', type: 'text' },
              ]}
            />
          </TabsContent>

          <TabsContent value="freight" className="mt-4">
            <ErpMappingTable
              tableName="freight_type_erp_mapping"
              queryKey="erp-freight-mapping"
              keyField="crm_freight_type"
              columns={[
                { field: 'crm_freight_type', label: 'Tipo Frete CRM', type: 'text', required: true },
                { field: 'erp_freight_code', label: 'Código ERP', type: 'text', required: true },
                { field: 'erp_freight_description', label: 'Descrição', type: 'text' },
              ]}
            />
          </TabsContent>

          <TabsContent value="sale-type" className="mt-4">
            <ErpMappingTable
              tableName="sale_type_erp_mapping"
              queryKey="erp-sale-type-mapping"
              keyField="crm_sale_type"
              columns={[
                { field: 'crm_sale_type', label: 'Tipo Venda CRM', type: 'text', required: true },
                { field: 'erp_sale_type_code', label: 'Código ERP', type: 'number', required: true },
                { field: 'erp_sale_type_description', label: 'Descrição', type: 'text' },
              ]}
            />
          </TabsContent>

          <TabsContent value="payment" className="mt-4">
            <ErpMappingTable
              tableName="payment_method_erp_mapping"
              queryKey="erp-payment-mapping"
              keyField="crm_payment_method"
              columns={[
                { field: 'crm_payment_method', label: 'Forma Pagamento CRM', type: 'text', required: true },
                { field: 'erp_payment_code', label: 'Código ERP', type: 'number', required: true },
                { field: 'erp_payment_description', label: 'Descrição', type: 'text' },
              ]}
            />
          </TabsContent>

          <TabsContent value="users" className="mt-4">
            <ErpUsersTable />
          </TabsContent>

          <TabsContent value="vendors" className="mt-4">
            <ErpVendorsTable />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
