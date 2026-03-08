import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Truck, Plus, Pencil, Search, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { useModulePermissions } from '@/hooks/useModulePermissions';

interface Carrier {
  id: string;
  name: string;
  trade_name: string | null;
  cnpj: string | null;
  ie: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  address_number: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  active: boolean;
  tenant_id: string | null;
  created_at: string;
}

const emptyForm = {
  name: '',
  trade_name: '',
  cnpj: '',
  ie: '',
  phone: '',
  email: '',
  address: '',
  address_number: '',
  neighborhood: '',
  city: '',
  state: '',
  zip_code: '',
  active: true,
};

export default function Carriers() {
  const queryClient = useQueryClient();
  const { isAdmin } = useModulePermissions();
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCarrier, setEditingCarrier] = useState<Carrier | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: carriers, isLoading } = useQuery({
    queryKey: ['carriers', showInactive],
    queryFn: async () => {
      let query = supabase
        .from('carriers')
        .select('*')
        .order('name');
      if (!showInactive) {
        query = query.eq('active', true);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as Carrier[];
    },
  });

  const filtered = useMemo(() => {
    if (!carriers) return [];
    if (!search.trim()) return carriers;
    const s = search.toLowerCase();
    return carriers.filter(
      c => c.name.toLowerCase().includes(s) ||
        c.trade_name?.toLowerCase().includes(s) ||
        c.cnpj?.includes(s) ||
        c.city?.toLowerCase().includes(s)
    );
  }, [carriers, search]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        name: form.name,
        trade_name: form.trade_name || null,
        cnpj: form.cnpj || null,
        ie: form.ie || null,
        phone: form.phone || null,
        email: form.email || null,
        address: form.address || null,
        address_number: form.address_number || null,
        neighborhood: form.neighborhood || null,
        city: form.city || null,
        state: form.state || null,
        zip_code: form.zip_code || null,
        active: form.active,
      };

      if (editingCarrier) {
        const { error } = await supabase.from('carriers').update(payload).eq('id', editingCarrier.id);
        if (error) throw error;
      } else {
        // Get tenant
        const { data: tenantData } = await supabase.from('user_tenants').select('tenant_id').limit(1).single();
        payload.tenant_id = tenantData?.tenant_id;
        const { error } = await supabase.from('carriers').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['carriers'] });
      toast.success(editingCarrier ? 'Transportadora atualizada!' : 'Transportadora cadastrada!');
      closeDialog();
    },
    onError: () => toast.error('Erro ao salvar transportadora'),
  });

  const openNew = () => {
    setEditingCarrier(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (carrier: Carrier) => {
    setEditingCarrier(carrier);
    setForm({
      name: carrier.name,
      trade_name: carrier.trade_name || '',
      cnpj: carrier.cnpj || '',
      ie: carrier.ie || '',
      phone: carrier.phone || '',
      email: carrier.email || '',
      address: carrier.address || '',
      address_number: carrier.address_number || '',
      neighborhood: carrier.neighborhood || '',
      city: carrier.city || '',
      state: carrier.state || '',
      zip_code: carrier.zip_code || '',
      active: carrier.active,
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingCarrier(null);
    setForm(emptyForm);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Truck className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Transportadoras</h1>
          <Badge variant="secondary">{filtered.length}</Badge>
        </div>
        {isAdmin && (
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Transportadora
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, CNPJ, cidade..."
                className="pl-10"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={showInactive} onCheckedChange={setShowInactive} id="show-inactive" />
              <Label htmlFor="show-inactive" className="text-sm whitespace-nowrap">Mostrar inativos</Label>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Nome Fantasia</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Cidade / UF</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">Carregando...</TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    Nenhuma transportadora encontrada
                  </TableCell>
                </TableRow>
              ) : filtered.map(carrier => (
                <TableRow key={carrier.id}>
                  <TableCell className="font-medium">{carrier.name}</TableCell>
                  <TableCell>{carrier.trade_name || '-'}</TableCell>
                  <TableCell className="font-mono text-xs">{carrier.cnpj || '-'}</TableCell>
                  <TableCell>{carrier.city && carrier.state ? `${carrier.city} / ${carrier.state}` : '-'}</TableCell>
                  <TableCell>{carrier.phone || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={carrier.active ? 'default' : 'secondary'}>
                      {carrier.active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {isAdmin && (
                      <Button variant="ghost" size="icon" onClick={() => openEdit(carrier)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog Create/Edit */}
      <Dialog open={dialogOpen} onOpenChange={v => { if (!v) closeDialog(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              {editingCarrier ? 'Editar Transportadora' : 'Nova Transportadora'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Razão Social *</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Razão Social" />
            </div>
            <div>
              <Label>Nome Fantasia</Label>
              <Input value={form.trade_name} onChange={e => setForm({ ...form, trade_name: e.target.value })} />
            </div>
            <div>
              <Label>CNPJ</Label>
              <Input value={form.cnpj} onChange={e => setForm({ ...form, cnpj: e.target.value })} />
            </div>
            <div>
              <Label>Inscrição Estadual</Label>
              <Input value={form.ie} onChange={e => setForm({ ...form, ie: e.target.value })} />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Email</Label>
              <Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} type="email" />
            </div>
            <div>
              <Label>Endereço</Label>
              <Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="w-24">
              <Label>Número</Label>
              <Input value={form.address_number} onChange={e => setForm({ ...form, address_number: e.target.value })} />
            </div>
            <div>
              <Label>Bairro</Label>
              <Input value={form.neighborhood} onChange={e => setForm({ ...form, neighborhood: e.target.value })} />
            </div>
            <div>
              <Label>Cidade</Label>
              <Input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
            </div>
            <div>
              <Label>Estado</Label>
              <Input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} maxLength={2} />
            </div>
            <div>
              <Label>CEP</Label>
              <Input value={form.zip_code} onChange={e => setForm({ ...form, zip_code: e.target.value })} />
            </div>
            <div className="col-span-2 flex items-center gap-3 rounded-lg border p-3">
              <Switch checked={form.active} onCheckedChange={v => setForm({ ...form, active: v })} id="carrier-active" />
              <Label htmlFor="carrier-active">Transportadora ativa</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.name || saveMutation.isPending}>
              {saveMutation.isPending ? 'Salvando...' : editingCarrier ? 'Salvar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
