import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, Trash2, Building2, ShieldCheck, Pencil, Power } from 'lucide-react';
import { toast } from 'sonner';
import { useLegalEntities } from '@/hooks/useLegalEntities';
import { formatCNPJ } from '@/lib/cpfCnpjMask';
import { useAuth } from '@/hooks/useAuth';

interface UserWithLinks {
  user_id: string;
  full_name: string;
  links: Array<{
    id: string;
    legal_entity_id: string;
    role: string;
    entity_name: string;
    entity_cnpj: string;
  }>;
}

interface EntityFormData {
  name: string;
  cnpj: string;
  erp_company_code: string;
  trade_name: string;
}

const emptyForm: EntityFormData = { name: '', cnpj: '', erp_company_code: '', trade_name: '' };

export function LegalEntityPermissionsManager() {
  const queryClient = useQueryClient();
  const { allEntities } = useLegalEntities();
  const { user } = useAuth();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedEntityId, setSelectedEntityId] = useState('');
  const [selectedRole, setSelectedRole] = useState('member');

  // Entity CRUD state
  const [isEntityDialogOpen, setIsEntityDialogOpen] = useState(false);
  const [editingEntityId, setEditingEntityId] = useState<string | null>(null);
  const [entityForm, setEntityForm] = useState<EntityFormData>(emptyForm);

  // Fetch all entities including inactive
  const { data: allEntitiesFull = [] } = useQuery({
    queryKey: ['all_legal_entities_full'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('legal_entities')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch all profiles in tenant
  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles_for_legal_entities'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .order('full_name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch all user_legal_entities links
  const { data: allLinks = [] } = useQuery({
    queryKey: ['all_user_legal_entities'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_legal_entities')
        .select('*');
      if (error) throw error;
      return data;
    },
  });

  // Build user-centric view
  const usersWithLinks: UserWithLinks[] = profiles.map((p) => {
    const links = allLinks
      .filter((l) => l.user_id === p.user_id)
      .map((l) => {
        const entity = allEntities.find((e) => e.id === l.legal_entity_id);
        return {
          id: l.id,
          legal_entity_id: l.legal_entity_id,
          role: l.role || 'member',
          entity_name: entity?.name || '—',
          entity_cnpj: entity?.cnpj || '',
        };
      });
    return {
      user_id: p.user_id,
      full_name: p.full_name || 'Sem nome',
      links,
    };
  });

  const addLinkMutation = useMutation({
    mutationFn: async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('active_tenant_id')
        .eq('user_id', selectedUserId)
        .single();
      
      const { error } = await supabase.from('user_legal_entities').insert([{
        user_id: selectedUserId,
        legal_entity_id: selectedEntityId,
        role: selectedRole,
        tenant_id: profile?.active_tenant_id || '',
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all_user_legal_entities'] });
      queryClient.invalidateQueries({ queryKey: ['user_legal_entities'] });
      toast.success('Vínculo criado');
      setIsAddOpen(false);
      setSelectedUserId('');
      setSelectedEntityId('');
      setSelectedRole('member');
    },
    onError: (e: Error) => toast.error(e.message || 'Erro ao criar vínculo'),
  });

  const removeLinkMutation = useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await supabase
        .from('user_legal_entities')
        .delete()
        .eq('id', linkId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all_user_legal_entities'] });
      queryClient.invalidateQueries({ queryKey: ['user_legal_entities'] });
      toast.success('Vínculo removido');
    },
    onError: () => toast.error('Erro ao remover vínculo'),
  });

  // --- Entity CRUD mutations ---
  const saveEntityMutation = useMutation({
    mutationFn: async () => {
      const cnpjDigits = entityForm.cnpj.replace(/\D/g, '');
      if (cnpjDigits.length !== 14) throw new Error('CNPJ deve ter 14 dígitos');

      // Get tenant_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('active_tenant_id')
        .eq('user_id', user?.id || '')
        .single();
      const tenantId = profile?.active_tenant_id;
      if (!tenantId) throw new Error('Tenant não encontrado');

      if (editingEntityId) {
        const { error } = await supabase
          .from('legal_entities')
          .update({
            name: entityForm.name,
            cnpj: cnpjDigits,
            erp_company_code: entityForm.erp_company_code || null,
            trade_name: entityForm.trade_name || null,
          })
          .eq('id', editingEntityId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('legal_entities')
          .insert({
            name: entityForm.name,
            cnpj: cnpjDigits,
            erp_company_code: entityForm.erp_company_code || null,
            trade_name: entityForm.trade_name || null,
            tenant_id: tenantId,
          });
        if (error) {
          if (error.message?.includes('duplicate') || error.code === '23505') {
            throw new Error('Já existe uma entidade com este CNPJ');
          }
          throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all_legal_entities_full'] });
      queryClient.invalidateQueries({ queryKey: ['legal_entities'] });
      queryClient.invalidateQueries({ queryKey: ['user_legal_entities'] });
      toast.success(editingEntityId ? 'Entidade atualizada' : 'Entidade criada');
      setIsEntityDialogOpen(false);
      setEditingEntityId(null);
      setEntityForm(emptyForm);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleEntityActiveMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from('legal_entities')
        .update({ active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all_legal_entities_full'] });
      queryClient.invalidateQueries({ queryKey: ['legal_entities'] });
      toast.success('Status atualizado');
    },
    onError: () => toast.error('Erro ao atualizar status'),
  });

  const openEditEntity = (entity: typeof allEntitiesFull[0]) => {
    setEditingEntityId(entity.id);
    setEntityForm({
      name: entity.name,
      cnpj: formatCNPJ(entity.cnpj),
      erp_company_code: entity.erp_company_code || '',
      trade_name: entity.trade_name || '',
    });
    setIsEntityDialogOpen(true);
  };

  const openNewEntity = () => {
    setEditingEntityId(null);
    setEntityForm(emptyForm);
    setIsEntityDialogOpen(true);
  };

  const roleLabels: Record<string, string> = {
    admin: 'Admin',
    member: 'Membro',
    viewer: 'Visualizador',
  };

  return (
    <div className="space-y-6">
      {/* Card 1: Cadastro de Entidades Jurídicas */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Entidades Jurídicas (CNPJs)
            </CardTitle>
            <CardDescription>
              Cadastre e gerencie os CNPJs da organização.
            </CardDescription>
          </div>
          <Button className="gap-2" onClick={openNewEntity}>
            <Plus className="h-4 w-4" />
            Nova Empresa
          </Button>
        </CardHeader>
        <CardContent>
          {allEntitiesFull.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nenhuma entidade jurídica cadastrada.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Razão Social</TableHead>
                  <TableHead>Nome Fantasia</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Código ERP</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[120px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allEntitiesFull.map((entity) => (
                  <TableRow key={entity.id} className={!entity.active ? 'opacity-50' : ''}>
                    <TableCell className="font-medium">{entity.name}</TableCell>
                    <TableCell>{entity.trade_name || '—'}</TableCell>
                    <TableCell className="font-mono text-sm">{formatCNPJ(entity.cnpj)}</TableCell>
                    <TableCell>{entity.erp_company_code || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={entity.active ? 'default' : 'secondary'}>
                        {entity.active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditEntity(entity)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Power className={`h-4 w-4 ${entity.active ? 'text-destructive' : 'text-green-600'}`} />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                {entity.active ? 'Desativar' : 'Reativar'} entidade?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                {entity.active
                                  ? `A entidade "${entity.name}" será desativada. Registros existentes serão preservados.`
                                  : `A entidade "${entity.name}" será reativada e voltará a aparecer nos seletores.`}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => toggleEntityActiveMutation.mutate({ id: entity.id, active: !entity.active })}
                              >
                                {entity.active ? 'Desativar' : 'Reativar'}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Card 2: Permissões por CNPJ */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Permissões por CNPJ
            </CardTitle>
            <CardDescription>
              Gerencie quais usuários têm acesso a cada CNPJ. Usuários sem vínculos têm acesso total.
            </CardDescription>
          </div>
          <Button className="gap-2" onClick={() => setIsAddOpen(true)}>
            <Plus className="h-4 w-4" />
            Vincular CNPJ
          </Button>
        </CardHeader>
        <CardContent>
          {allEntities.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nenhum CNPJ cadastrado. Cadastre entidades jurídicas para gerenciar permissões.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>CNPJs Vinculados</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usersWithLinks.map((u) => (
                  <TableRow key={u.user_id}>
                    <TableCell className="font-medium">{u.full_name}</TableCell>
                    <TableCell>
                      {u.links.length === 0 ? (
                        <Badge variant="secondary" className="gap-1">
                          <ShieldCheck className="h-3 w-3" />
                          Acesso total
                        </Badge>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {u.links.map((link) => (
                            <div key={link.id} className="flex items-center gap-1">
                              <Badge variant="outline" className="text-xs">
                                {link.entity_name} ({roleLabels[link.role] || link.role})
                              </Badge>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-5 w-5">
                                    <Trash2 className="h-3 w-3 text-destructive" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Remover vínculo?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      O usuário {u.full_name} perderá acesso restrito ao CNPJ {link.entity_name}.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => removeLinkMutation.mutate(link.id)}>
                                      Remover
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedUserId(u.user_id);
                          setIsAddOpen(true);
                        }}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Link Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vincular Usuário a CNPJ</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Usuário</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o usuário" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.user_id} value={p.user_id}>
                      {p.full_name || 'Sem nome'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>CNPJ</Label>
              <Select value={selectedEntityId} onValueChange={setSelectedEntityId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o CNPJ" />
                </SelectTrigger>
                <SelectContent>
                  {allEntities.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name} — {formatCNPJ(e.cnpj)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Papel</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="member">Membro</SelectItem>
                  <SelectItem value="viewer">Visualizador</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => addLinkMutation.mutate()}
              disabled={!selectedUserId || !selectedEntityId || addLinkMutation.isPending}
            >
              Vincular
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Entity Create/Edit Dialog */}
      <Dialog open={isEntityDialogOpen} onOpenChange={setIsEntityDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingEntityId ? 'Editar Entidade' : 'Nova Entidade Jurídica'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Razão Social *</Label>
              <Input
                value={entityForm.name}
                onChange={(e) => setEntityForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Razão social da empresa"
              />
            </div>
            <div>
              <Label>Nome Fantasia</Label>
              <Input
                value={entityForm.trade_name}
                onChange={(e) => setEntityForm(prev => ({ ...prev, trade_name: e.target.value }))}
                placeholder="Nome fantasia (opcional)"
              />
            </div>
            <div>
              <Label>CNPJ *</Label>
              <Input
                value={entityForm.cnpj}
                onChange={(e) => setEntityForm(prev => ({ ...prev, cnpj: formatCNPJ(e.target.value) }))}
                placeholder="00.000.000/0000-00"
                maxLength={18}
              />
            </div>
            <div>
              <Label>Código ERP</Label>
              <Input
                value={entityForm.erp_company_code}
                onChange={(e) => setEntityForm(prev => ({ ...prev, erp_company_code: e.target.value }))}
                placeholder="Código da empresa no ERP (opcional)"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEntityDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => saveEntityMutation.mutate()}
              disabled={!entityForm.name || !entityForm.cnpj || saveEntityMutation.isPending}
            >
              {editingEntityId ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
