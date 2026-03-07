import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePortfolioDelegations, type PortfolioDelegation } from '@/hooks/usePortfolioDelegations';
import { useSalesReps } from '@/hooks/useSalesReps';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Pencil, Trash2, Building2, Users, Briefcase, ShoppingCart, GitBranch, Loader2, UserCheck } from 'lucide-react';

const permissionLabels = [
  { key: 'can_manage_companies', label: 'Empresas', icon: Building2 },
  { key: 'can_manage_contacts', label: 'Contatos', icon: Users },
  { key: 'can_manage_deals', label: 'Deals', icon: Briefcase },
  { key: 'can_manage_orders', label: 'Pedidos', icon: ShoppingCart },
  { key: 'can_manage_pipeline', label: 'Pipeline', icon: GitBranch },
] as const;

interface DelegationFormData {
  manager_user_id: string;
  portfolio_owner_id: string;
  can_manage_companies: boolean;
  can_manage_contacts: boolean;
  can_manage_deals: boolean;
  can_manage_orders: boolean;
  can_manage_pipeline: boolean;
}

const defaultFormData: DelegationFormData = {
  manager_user_id: '',
  portfolio_owner_id: '',
  can_manage_companies: true,
  can_manage_contacts: true,
  can_manage_deals: true,
  can_manage_orders: true,
  can_manage_pipeline: true,
};

export function PortfolioDelegationManager() {
  const { user } = useAuth();
  const { allDelegations, isLoadingAll, createDelegation, updateDelegation, deleteDelegation } = usePortfolioDelegations();
  const { salesReps, allUserSalesReps } = useSalesReps();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDelegation, setEditingDelegation] = useState<PortfolioDelegation | null>(null);
  const [formData, setFormData] = useState<DelegationFormData>(defaultFormData);

  // Fetch profiles for the form
  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles_for_delegation'],
    queryFn: async () => {
      const { data: profs, error } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .order('full_name');
      if (error) throw error;

      const { data: roles } = await supabase.from('user_roles').select('user_id, role');
      const devIds = new Set(roles?.filter(r => r.role === 'desenvolvedor').map(r => r.user_id) || []);

      return (profs || []).filter(p => !devIds.has(p.user_id));
    },
  });

  const { data: activeTenantId } = useQuery({
    queryKey: ['active_tenant_for_delegation', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('profiles')
        .select('active_tenant_id')
        .eq('user_id', user.id)
        .single();
      return data?.active_tenant_id || null;
    },
    enabled: !!user?.id,
  });

  // Criar mapa user_id → sales_rep name para exibição
  const userToSalesRepName = (() => {
    const map: Record<string, string> = {};
    allUserSalesReps?.forEach(link => {
      const rep = salesReps?.find(sr => sr.id === link.sales_rep_id);
      if (rep && link.is_default) {
        map[link.user_id] = rep.name;
      }
    });
    // Fallback: primeiro vínculo
    allUserSalesReps?.forEach(link => {
      if (!map[link.user_id]) {
        const rep = salesReps?.find(sr => sr.id === link.sales_rep_id);
        if (rep) map[link.user_id] = rep.name;
      }
    });
    return map;
  })();

  // Função para obter nome de exibição (vendedor comercial ou perfil)
  const getDisplayName = (userId: string, fallbackName: string) => {
    return userToSalesRepName[userId] || fallbackName;
  };

  const handleOpenCreate = () => {
    setEditingDelegation(null);
    setFormData(defaultFormData);
    setDialogOpen(true);
  };

  const handleOpenEdit = (delegation: PortfolioDelegation) => {
    setEditingDelegation(delegation);
    setFormData({
      manager_user_id: delegation.manager_user_id,
      portfolio_owner_id: delegation.portfolio_owner_id,
      can_manage_companies: delegation.can_manage_companies,
      can_manage_contacts: delegation.can_manage_contacts,
      can_manage_deals: delegation.can_manage_deals,
      can_manage_orders: delegation.can_manage_orders,
      can_manage_pipeline: delegation.can_manage_pipeline,
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenantId) return;

    if (formData.manager_user_id === formData.portfolio_owner_id) return;

    if (editingDelegation) {
      updateDelegation.mutate({
        id: editingDelegation.id,
        can_manage_companies: formData.can_manage_companies,
        can_manage_contacts: formData.can_manage_contacts,
        can_manage_deals: formData.can_manage_deals,
        can_manage_orders: formData.can_manage_orders,
        can_manage_pipeline: formData.can_manage_pipeline,
      }, { onSuccess: () => setDialogOpen(false) });
    } else {
      createDelegation.mutate({
        tenant_id: activeTenantId,
        ...formData,
      }, { onSuccess: () => setDialogOpen(false) });
    }
  };

  const handleToggleActive = (delegation: PortfolioDelegation) => {
    updateDelegation.mutate({
      id: delegation.id,
      active: !delegation.active,
    });
  };

  const availableOwners = profiles.filter(p => p.user_id !== formData.manager_user_id);
  const availableManagers = profiles.filter(p => p.user_id !== formData.portfolio_owner_id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Delegações de Carteira</h2>
          <p className="text-sm text-muted-foreground">
            Permita que um vendedor gerencie a carteira de outro sem alterar a propriedade dos registros.
          </p>
        </div>
        <Button onClick={handleOpenCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Delegação
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoadingAll ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : allDelegations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <UserCheck className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhuma delegação cadastrada</p>
              <p className="text-xs mt-1">Crie uma delegação para permitir que um vendedor opere na carteira de outro.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Gestor</TableHead>
                  <TableHead>Dono da Carteira</TableHead>
                  <TableHead>Permissões</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allDelegations.map(delegation => (
                  <TableRow key={delegation.id}>
                    <TableCell className="font-medium">
                      {getDisplayName(delegation.manager_user_id, delegation.manager_name || '')}
                    </TableCell>
                    <TableCell>
                      {getDisplayName(delegation.portfolio_owner_id, delegation.owner_name || '')}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {permissionLabels.map(({ key, label }) => {
                          const enabled = delegation[key as keyof PortfolioDelegation] as boolean;
                          return (
                            <Badge
                              key={key}
                              variant={enabled ? 'default' : 'outline'}
                              className={`text-xs ${!enabled ? 'opacity-40' : ''}`}
                            >
                              {label}
                            </Badge>
                          );
                        })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={delegation.active ? 'default' : 'secondary'}>
                        {delegation.active ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleToggleActive(delegation)}
                          title={delegation.active ? 'Desativar' : 'Ativar'}
                        >
                          <Switch
                            checked={delegation.active}
                            className="pointer-events-none scale-75"
                          />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleOpenEdit(delegation)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir delegação?</AlertDialogTitle>
                              <AlertDialogDescription>
                                <strong>{getDisplayName(delegation.manager_user_id, delegation.manager_name || '')}</strong> perderá acesso à carteira de <strong>{getDisplayName(delegation.portfolio_owner_id, delegation.owner_name || '')}</strong>.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteDelegation.mutate(delegation.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Excluir
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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingDelegation ? 'Editar Delegação' : 'Nova Delegação'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!editingDelegation && (
              <>
                <div>
                  <Label>Gestor (quem vai gerir)</Label>
                  <Select
                    value={formData.manager_user_id}
                    onValueChange={(v) => setFormData({ ...formData, manager_user_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o gestor" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableManagers.map(p => (
                        <SelectItem key={p.user_id} value={p.user_id}>
                          {getDisplayName(p.user_id, p.full_name || '')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Dono da Carteira (vendedor)</Label>
                  <Select
                    value={formData.portfolio_owner_id}
                    onValueChange={(v) => setFormData({ ...formData, portfolio_owner_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o dono da carteira" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableOwners.map(p => (
                        <SelectItem key={p.user_id} value={p.user_id}>
                          {getDisplayName(p.user_id, p.full_name || '')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {editingDelegation && (
              <p className="text-sm text-muted-foreground">
                <strong>{getDisplayName(editingDelegation.manager_user_id, editingDelegation.manager_name || '')}</strong> gerencia a carteira de <strong>{getDisplayName(editingDelegation.portfolio_owner_id, editingDelegation.owner_name || '')}</strong>
              </p>
            )}

            <div className="space-y-3 pt-2 border-t">
              <Label>Permissões</Label>
              {permissionLabels.map(({ key, label, icon: Icon }) => (
                <div key={key} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Gerir {label}</span>
                  </div>
                  <Switch
                    checked={formData[key as keyof DelegationFormData] as boolean}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, [key]: checked })
                    }
                  />
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={
                  createDelegation.isPending ||
                  updateDelegation.isPending ||
                  (!editingDelegation && (!formData.manager_user_id || !formData.portfolio_owner_id))
                }
              >
                {createDelegation.isPending || updateDelegation.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
