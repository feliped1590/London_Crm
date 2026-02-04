import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Pencil, ArrowRight, Shield, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { orderStatusConfig } from '@/types/products';

type OrderStatus = 'pendente' | 'em_producao' | 'produzido' | 'faturado' | 'entregue' | 'cancelado';

interface ApprovalRule {
  id: string;
  name: string;
  description: string | null;
  from_status: OrderStatus;
  to_status: OrderStatus;
  required_role: string;
  requires_justification: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

const ROLE_OPTIONS = [
  { value: 'vendedor', label: 'Vendedor' },
  { value: 'admin', label: 'Administrador' },
  { value: 'atendente', label: 'Atendente' },
];

const STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'em_producao', label: 'Em Produção' },
  { value: 'produzido', label: 'Produzido' },
  { value: 'faturado', label: 'Faturado' },
  { value: 'entregue', label: 'Entregue' },
  { value: 'cancelado', label: 'Cancelado' },
];

export function OrderApprovalRulesManager() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editingRule, setEditingRule] = useState<ApprovalRule | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    from_status: 'pendente' as OrderStatus,
    to_status: 'em_producao' as OrderStatus,
    required_role: 'admin',
    requires_justification: false,
    is_active: true,
  });

  const { data: rules, isLoading } = useQuery({
    queryKey: ['order_approval_rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('order_approval_rules')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data as ApprovalRule[];
    },
  });

  const createRuleMutation = useMutation({
    mutationFn: async (data: Omit<ApprovalRule, 'id' | 'created_at' | 'sort_order'>) => {
      const maxSortOrder = rules?.reduce((max, r) => Math.max(max, r.sort_order), 0) || 0;
      const { error } = await supabase
        .from('order_approval_rules')
        .insert({
          ...data,
          sort_order: maxSortOrder + 1,
          created_by: user?.id,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order_approval_rules'] });
      toast.success('Regra criada com sucesso!');
      resetForm();
    },
    onError: () => toast.error('Erro ao criar regra'),
  });

  const updateRuleMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<ApprovalRule> & { id: string }) => {
      const { error } = await supabase
        .from('order_approval_rules')
        .update(data)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order_approval_rules'] });
      toast.success('Regra atualizada!');
      resetForm();
    },
    onError: () => toast.error('Erro ao atualizar regra'),
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('order_approval_rules')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order_approval_rules'] });
      toast.success('Regra excluída!');
    },
    onError: () => toast.error('Erro ao excluir regra'),
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      from_status: 'pendente',
      to_status: 'em_producao',
      required_role: 'admin',
      requires_justification: false,
      is_active: true,
    });
    setEditingRule(null);
    setIsCreating(false);
    setIsDialogOpen(false);
  };

  const handleEdit = (rule: ApprovalRule) => {
    setEditingRule(rule);
    setIsCreating(false);
    setFormData({
      name: rule.name,
      description: rule.description || '',
      from_status: rule.from_status,
      to_status: rule.to_status,
      required_role: rule.required_role,
      requires_justification: rule.requires_justification,
      is_active: rule.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingRule(null);
    setIsCreating(true);
    setFormData({
      name: '',
      description: '',
      from_status: 'pendente',
      to_status: 'em_producao',
      required_role: 'admin',
      requires_justification: false,
      is_active: true,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreating) {
      createRuleMutation.mutate({
        name: formData.name,
        description: formData.description || null,
        from_status: formData.from_status,
        to_status: formData.to_status,
        required_role: formData.required_role,
        requires_justification: formData.requires_justification,
        is_active: formData.is_active,
      });
    } else if (editingRule) {
      updateRuleMutation.mutate({ id: editingRule.id, ...formData });
    }
  };

  const toggleRuleActive = (rule: ApprovalRule) => {
    updateRuleMutation.mutate({
      id: rule.id,
      is_active: !rule.is_active,
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Carregando regras...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Regras de Aprovação de Pedidos
            </CardTitle>
            <CardDescription>
              Configure quais perfis podem realizar cada transição de status nos pedidos
            </CardDescription>
          </div>
          <Button className="gap-2" onClick={handleCreate}>
            <Plus className="h-4 w-4" />
            Nova Regra
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg mb-4">
          <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">
            Configure qual perfil tem permissão para cada transição de status
            e se é necessário justificativa para executá-la.
          </p>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Transição</TableHead>
              <TableHead>Perfil Necessário</TableHead>
              <TableHead>Justificativa</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules?.map((rule) => (
              <TableRow key={rule.id} className={!rule.is_active ? 'opacity-50' : ''}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {orderStatusConfig[rule.from_status]?.label || rule.from_status}
                    </Badge>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <Badge variant="outline">
                      {orderStatusConfig[rule.to_status]?.label || rule.to_status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{rule.name}</p>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {ROLE_OPTIONS.find(r => r.value === rule.required_role)?.label || rule.required_role}
                  </Badge>
                </TableCell>
                <TableCell>
                  {rule.requires_justification ? (
                    <Badge variant="outline" className="border-amber-500/50 text-amber-600 dark:text-amber-400">
                      Obrigatória
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">Opcional</span>
                  )}
                </TableCell>
                <TableCell>
                  <Switch
                    checked={rule.is_active}
                    onCheckedChange={() => toggleRuleActive(rule)}
                    aria-label="Ativar/desativar regra"
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleEdit(rule)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir regra?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteRuleMutation.mutate(rule.id)}
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

        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{isCreating ? 'Nova Regra de Aprovação' : 'Editar Regra de Aprovação'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="rule-name">Nome da Regra *</Label>
                <Input
                  id="rule-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Liberar para Produção"
                  required
                />
              </div>

              <div>
                <Label htmlFor="rule-description">Descrição (opcional)</Label>
                <Input
                  id="rule-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descrição da regra..."
                />
              </div>

              {isCreating && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="from-status">De Status *</Label>
                    <Select
                      value={formData.from_status}
                      onValueChange={(v) => setFormData({ ...formData, from_status: v as OrderStatus })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="to-status">Para Status *</Label>
                    <Select
                      value={formData.to_status}
                      onValueChange={(v) => setFormData({ ...formData, to_status: v as OrderStatus })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {!isCreating && editingRule && (
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <Badge variant="outline">
                    {orderStatusConfig[editingRule.from_status]?.label}
                  </Badge>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <Badge variant="outline">
                    {orderStatusConfig[editingRule.to_status]?.label}
                  </Badge>
                </div>
              )}

              <div>
                <Label htmlFor="required_role">Perfil Necessário *</Label>
                <Select
                  value={formData.required_role}
                  onValueChange={(v) => setFormData({ ...formData, required_role: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="requires_justification"
                  checked={formData.requires_justification}
                  onCheckedChange={(checked) => setFormData({ ...formData, requires_justification: checked })}
                />
                <Label htmlFor="requires_justification">Exigir justificativa</Label>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label htmlFor="is_active">Regra ativa</Label>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createRuleMutation.isPending || updateRuleMutation.isPending}>
                  {isCreating ? 'Criar' : 'Salvar'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
