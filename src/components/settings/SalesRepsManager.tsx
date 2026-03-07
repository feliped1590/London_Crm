import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Pencil, UserPlus, Star, Trash2 } from 'lucide-react';
import { useSalesReps } from '@/hooks/useSalesReps';
import { useLegalEntities } from '@/hooks/useLegalEntities';

export function SalesRepsManager() {
  const {
    salesReps, isLoading,
    allUserSalesReps, tenantId,
    createSalesRep, updateSalesRep,
    linkUserSalesRep, unlinkUserSalesRep, setDefaultSalesRep,
  } = useSalesReps();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', type: 'interno', phone: '', email: '' });

  // Link dialog
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [linkUserId, setLinkUserId] = useState('');
  const [linkRepId, setLinkRepId] = useState('');

  // Fetch users for linking
  const { data: users } = useQuery({
    queryKey: ['profiles_for_sales_rep_link'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .order('full_name');
      if (error) throw error;
      return data || [];
    },
  });

  const handleSave = () => {
    if (!tenantId) return;

    if (editingId) {
      updateSalesRep.mutate({ id: editingId, ...form }, { onSuccess: () => { setIsDialogOpen(false); resetForm(); } });
    } else {
      createSalesRep.mutate({ ...form, tenant_id: tenantId }, { onSuccess: () => { setIsDialogOpen(false); resetForm(); } });
    }
  };

  const resetForm = () => {
    setForm({ name: '', type: 'interno', phone: '', email: '' });
    setEditingId(null);
  };

  const handleEdit = (rep: any) => {
    setEditingId(rep.id);
    setForm({ name: rep.name, type: rep.type || 'interno', phone: rep.phone || '', email: rep.email || '' });
    setIsDialogOpen(true);
  };

  const handleToggleActive = (rep: any) => {
    updateSalesRep.mutate({ id: rep.id, active: !rep.active });
  };

  const handleLink = () => {
    if (!linkUserId || !linkRepId) return;
    linkUserSalesRep.mutate({ user_id: linkUserId, sales_rep_id: linkRepId }, {
      onSuccess: () => { setIsLinkDialogOpen(false); setLinkUserId(''); setLinkRepId(''); },
    });
  };

  return (
    <Tabs defaultValue="reps">
      <TabsList>
        <TabsTrigger value="reps">Vendedores</TabsTrigger>
        <TabsTrigger value="links">Vínculos Usuários</TabsTrigger>
      </TabsList>

      <TabsContent value="reps" className="mt-4 space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold">Vendedores Comerciais</h3>
            <p className="text-sm text-muted-foreground">Gerencie vendedores internos e representantes</p>
          </div>
          <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Vendedor
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : salesReps?.length ? (
              <div className="space-y-2">
                {salesReps.map(rep => (
                  <div key={rep.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                        {rep.name[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium">{rep.name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {rep.email && <span>{rep.email}</span>}
                          {rep.phone && <span>• {rep.phone}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={rep.type === 'representante' ? 'secondary' : 'outline'}>
                        {rep.type === 'representante' ? 'Representante' : 'Interno'}
                      </Badge>
                      <Switch checked={rep.active} onCheckedChange={() => handleToggleActive(rep)} />
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(rep)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum vendedor cadastrado</p>
            )}
          </CardContent>
        </Card>

        {/* Create/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar Vendedor' : 'Novo Vendedor'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nome *</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nome do vendedor" />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="interno">Interno</SelectItem>
                    <SelectItem value="representante">Representante</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="(00) 0000-0000" />
              </div>
              <div>
                <Label>Email</Label>
                <Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="email@exemplo.com" />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleSave} disabled={!form.name || createSalesRep.isPending || updateSalesRep.isPending}>
                  {editingId ? 'Salvar' : 'Criar'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </TabsContent>

      <TabsContent value="links" className="mt-4 space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold">Vínculos Usuário ↔ Vendedor</h3>
            <p className="text-sm text-muted-foreground">Defina quais vendedores cada usuário gerencia</p>
          </div>
          <Button onClick={() => setIsLinkDialogOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Vincular
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6">
            {allUserSalesReps?.length ? (
              <div className="space-y-2">
                {allUserSalesReps.map(link => {
                  const userName = users?.find(u => u.user_id === link.user_id)?.full_name || link.user_id;
                  const repName = (link as any).sales_rep?.name || link.sales_rep_id;
                  return (
                    <div key={link.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <p className="font-medium">{userName}</p>
                        <p className="text-sm text-muted-foreground">→ {repName}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {link.is_default ? (
                          <Badge className="gap-1"><Star className="h-3 w-3" /> Padrão</Badge>
                        ) : (
                          <Button variant="ghost" size="sm" onClick={() => setDefaultSalesRep.mutate({ id: link.id, user_id: link.user_id })}>
                            Definir padrão
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => unlinkUserSalesRep.mutate(link.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum vínculo cadastrado</p>
            )}
          </CardContent>
        </Card>

        {/* Link Dialog */}
        <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Vincular Usuário a Vendedor</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Usuário</Label>
                <Select value={linkUserId} onValueChange={setLinkUserId}>
                  <SelectTrigger><SelectValue placeholder="Selecione o usuário" /></SelectTrigger>
                  <SelectContent>
                    {users?.map(u => (
                      <SelectItem key={u.user_id} value={u.user_id}>{u.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Vendedor</Label>
                <Select value={linkRepId} onValueChange={setLinkRepId}>
                  <SelectTrigger><SelectValue placeholder="Selecione o vendedor" /></SelectTrigger>
                  <SelectContent>
                    {salesReps?.filter(r => r.active).map(r => (
                      <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsLinkDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleLink} disabled={!linkUserId || !linkRepId || linkUserSalesRep.isPending}>
                  Vincular
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </TabsContent>
    </Tabs>
  );
}
