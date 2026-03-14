import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Plus, Pencil, Star, Search, Users } from 'lucide-react';
import { useSalesReps } from '@/hooks/useSalesReps';
import { toast } from 'sonner';

export function SalesRepsManager() {
  const {
    salesReps, isLoading,
    allUserSalesReps, tenantId,
    createSalesRep, updateSalesRep,
    linkUserSalesRep, unlinkUserSalesRep, setDefaultSalesRep,
  } = useSalesReps();
  const queryClient = useQueryClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', type: 'interno', phone: '', email: '' });

  // User edit modal state
  const [editingUser, setEditingUser] = useState<{ user_id: string; full_name: string } | null>(null);
  const [selectedReps, setSelectedReps] = useState<Set<string>>(new Set());
  const [defaultRepId, setDefaultRepId] = useState<string | null>(null);
  const [repSearch, setRepSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Fetch users
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

  // Group links by user
  const userGroups = useMemo(() => {
    if (!users) return [];
    const linksByUser = new Map<string, typeof allUserSalesReps>();
    
    // Initialize all users
    users.forEach(u => {
      linksByUser.set(u.user_id, []);
    });
    
    // Add links
    allUserSalesReps?.forEach(link => {
      const existing = linksByUser.get(link.user_id) || [];
      existing.push(link);
      linksByUser.set(link.user_id, existing);
    });

    return Array.from(linksByUser.entries())
      .map(([userId, links]) => ({
        user_id: userId,
        full_name: users.find(u => u.user_id === userId)?.full_name || userId,
        links: links || [],
        repCount: links?.length || 0,
        defaultRep: links?.find(l => l.is_default),
      }))
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [users, allUserSalesReps]);

  const filteredUserGroups = useMemo(() => {
    if (!userSearch.trim()) return userGroups;
    const q = userSearch.toLowerCase();
    return userGroups.filter(g => g.full_name.toLowerCase().includes(q));
  }, [userGroups, userSearch]);

  const handleOpenUserEdit = (group: typeof userGroups[0]) => {
    setEditingUser({ user_id: group.user_id, full_name: group.full_name });
    const linked = new Set(group.links.map(l => l.sales_rep_id));
    setSelectedReps(linked);
    setDefaultRepId(group.defaultRep?.sales_rep_id || null);
    setRepSearch('');
    setIsSaving(false);
  };

  const handleToggleRep = (repId: string, checked: boolean) => {
    const next = new Set(selectedReps);
    if (checked) {
      next.add(repId);
    } else {
      next.delete(repId);
      if (defaultRepId === repId) setDefaultRepId(null);
    }
    setSelectedReps(next);
    // Auto-set default if only one selected
    if (next.size === 1) setDefaultRepId(Array.from(next)[0]);
  };

  const handleSaveUserLinks = async () => {
    if (!editingUser) return;
    if (selectedReps.size > 0 && !defaultRepId) {
      toast.error('Selecione um vendedor padrão entre os vinculados.');
      return;
    }

    setIsSaving(true);
    try {
      const currentLinks = allUserSalesReps?.filter(l => l.user_id === editingUser.user_id) || [];
      const currentRepIds = new Set(currentLinks.map(l => l.sales_rep_id));

      // Remove unlinked
      const toRemove = currentLinks.filter(l => !selectedReps.has(l.sales_rep_id));
      for (const link of toRemove) {
        await supabase.from('user_sales_reps').delete().eq('id', link.id);
      }

      // Add new links
      const toAdd = Array.from(selectedReps).filter(id => !currentRepIds.has(id));
      for (const repId of toAdd) {
        // Check if rep is linked to another user
        const { data: existing } = await supabase
          .from('user_sales_reps')
          .select('id, user_id')
          .eq('sales_rep_id', repId)
          .maybeSingle();
        
        if (existing && existing.user_id !== editingUser.user_id) {
          const otherUser = users?.find(u => u.user_id === existing.user_id)?.full_name || 'outro usuário';
          const repName = salesReps?.find(r => r.id === repId)?.name || repId;
          toast.error(`${repName} já está vinculado a ${otherUser}. Remova o vínculo anterior primeiro.`);
          setIsSaving(false);
          return;
        }

        await supabase.from('user_sales_reps').insert({
          user_id: editingUser.user_id,
          sales_rep_id: repId,
          is_default: repId === defaultRepId,
        });
      }

      // Update default flag on remaining links
      const remainingLinks = currentLinks.filter(l => selectedReps.has(l.sales_rep_id));
      for (const link of remainingLinks) {
        const shouldBeDefault = link.sales_rep_id === defaultRepId;
        if (link.is_default !== shouldBeDefault) {
          await supabase.from('user_sales_reps')
            .update({ is_default: shouldBeDefault })
            .eq('id', link.id);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['all_user_sales_reps'] });
      queryClient.invalidateQueries({ queryKey: ['my_sales_reps'] });
      queryClient.invalidateQueries({ queryKey: ['customers-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
      toast.success('Vínculos atualizados com sucesso!');
      setEditingUser(null);
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao salvar vínculos');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredRepsForModal = useMemo(() => {
    if (!salesReps) return [];
    const active = salesReps.filter(r => r.active);
    if (!repSearch.trim()) return active;
    const q = repSearch.toLowerCase();
    return active.filter(r => r.name.toLowerCase().includes(q));
  }, [salesReps, repSearch]);

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
            <p className="text-sm text-muted-foreground">Clique em um usuário para editar seus vendedores vinculados</p>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar usuário..."
            value={userSearch}
            onChange={e => setUserSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Card>
          <CardContent className="pt-6">
            {filteredUserGroups.length ? (
              <div className="space-y-1">
                {filteredUserGroups.map(group => (
                  <div
                    key={group.user_id}
                    className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleOpenUserEdit(group)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                        {group.full_name[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium">{group.full_name}</p>
                        {group.repCount > 0 ? (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Users className="h-3 w-3" />
                            <span>{group.repCount} vendedor{group.repCount > 1 ? 'es' : ''}</span>
                            {group.defaultRep && (
                              <span className="flex items-center gap-1">
                                • <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                                {(group.defaultRep as any).sales_rep?.name}
                              </span>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">Sem vendedores vinculados</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {group.repCount > 0 && (
                        <Badge variant="secondary">{group.repCount}</Badge>
                      )}
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum usuário encontrado</p>
            )}
          </CardContent>
        </Card>

        {/* Edit User Links Modal */}
        <Dialog open={!!editingUser} onOpenChange={open => { if (!open) setEditingUser(null); }}>
          <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Editar vínculos</DialogTitle>
              <p className="text-sm text-muted-foreground">Usuário: <strong>{editingUser?.full_name}</strong></p>
            </DialogHeader>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar vendedor..."
                value={repSearch}
                onChange={e => setRepSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-1 min-h-0 pr-1">
              {filteredRepsForModal.length ? filteredRepsForModal.map(rep => {
                const isChecked = selectedReps.has(rep.id);
                const isDefault = defaultRepId === rep.id;
                return (
                  <div
                    key={rep.id}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                      isChecked ? 'bg-primary/5 border-primary/30' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={(checked) => handleToggleRep(rep.id, !!checked)}
                      />
                      <div>
                        <p className={`text-sm font-medium ${isChecked ? '' : 'text-muted-foreground'}`}>{rep.name}</p>
                        {rep.email && <p className="text-xs text-muted-foreground">{rep.email}</p>}
                      </div>
                    </div>
                    {isChecked && (
                      <button
                        type="button"
                        onClick={() => setDefaultRepId(rep.id)}
                        className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors ${
                          isDefault
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                            : 'text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        <Star className={`h-3 w-3 ${isDefault ? 'fill-current' : ''}`} />
                        {isDefault ? 'Padrão' : 'Definir padrão'}
                      </button>
                    )}
                  </div>
                );
              }) : (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhum vendedor encontrado</p>
              )}
            </div>

            <div className="flex justify-between items-center pt-3 border-t">
              <p className="text-xs text-muted-foreground">
                {selectedReps.size} vendedor{selectedReps.size !== 1 ? 'es' : ''} selecionado{selectedReps.size !== 1 ? 's' : ''}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEditingUser(null)}>Cancelar</Button>
                <Button onClick={handleSaveUserLinks} disabled={isSaving}>
                  {isSaving ? 'Salvando...' : 'Salvar alterações'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </TabsContent>
    </Tabs>
  );
}
