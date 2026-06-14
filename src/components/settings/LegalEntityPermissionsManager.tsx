import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, Building2, Pencil, Power, Star } from 'lucide-react';
import { toast } from 'sonner';
import { formatCNPJ } from '@/lib/cpfCnpjMask';
import { useAuth } from '@/hooks/useAuth';

interface EntityFormData {
  name: string;
  cnpj: string;
  erp_company_code: string;
  trade_name: string;
  order_erp_endpoint: string;
  order_erp_token_secret_name: string;
  order_erp_enabled: boolean;
}

const emptyForm: EntityFormData = {
  name: '', cnpj: '', erp_company_code: '', trade_name: '',
  order_erp_endpoint: '', order_erp_token_secret_name: '', order_erp_enabled: true,
};

export function LegalEntityPermissionsManager() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

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

  // --- Entity CRUD mutations ---
  const saveEntityMutation = useMutation({
    mutationFn: async () => {
      const cnpjDigits = entityForm.cnpj.replace(/\D/g, '');
      if (cnpjDigits.length !== 14) throw new Error('CNPJ deve ter 14 dígitos');

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

  const setDefaultEntityMutation = useMutation({
    mutationFn: async (entityId: string) => {
      // Get tenant_id from the entity
      const entity = allEntitiesFull.find(e => e.id === entityId);
      if (!entity) throw new Error('Entidade não encontrada');

      // Clear is_headquarters from all entities of this tenant
      const { error: clearError } = await supabase
        .from('legal_entities')
        .update({ is_headquarters: false })
        .eq('tenant_id', entity.tenant_id);
      if (clearError) throw clearError;

      // Set the selected entity as headquarters
      const { error } = await supabase
        .from('legal_entities')
        .update({ is_headquarters: true })
        .eq('id', entityId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all_legal_entities_full'] });
      queryClient.invalidateQueries({ queryKey: ['legal_entities'] });
      toast.success('CNPJ padrão definido');
    },
    onError: () => toast.error('Erro ao definir CNPJ padrão'),
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Entidades Jurídicas (CNPJs)
            </CardTitle>
            <CardDescription>
              Cadastre e gerencie os CNPJs da organização. O CNPJ marcado como padrão será pré-selecionado nos formulários.
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
                  <TableHead>Padrão</TableHead>
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
                      {entity.active && (
                        <Switch
                          checked={entity.is_headquarters || false}
                          onCheckedChange={() => setDefaultEntityMutation.mutate(entity.id)}
                          disabled={setDefaultEntityMutation.isPending}
                        />
                      )}
                      {entity.is_headquarters && (
                        <Star className="h-4 w-4 text-yellow-500 inline ml-1" />
                      )}
                    </TableCell>
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
