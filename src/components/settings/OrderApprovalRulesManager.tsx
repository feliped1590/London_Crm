import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Pencil, ArrowRight, Shield, AlertCircle } from 'lucide-react';
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

export function OrderApprovalRulesManager() {
  const queryClient = useQueryClient();
  const [editingRule, setEditingRule] = useState<ApprovalRule | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
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

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      required_role: 'admin',
      requires_justification: false,
      is_active: true,
    });
    setEditingRule(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (rule: ApprovalRule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      description: rule.description || '',
      required_role: rule.required_role,
      requires_justification: rule.requires_justification,
      is_active: rule.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRule) {
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
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Regras de Aprovação de Pedidos
        </CardTitle>
        <CardDescription>
          Configure quais perfis podem realizar cada transição de status nos pedidos
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg mb-4">
          <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">
            As transições de status são pré-definidas. Você pode configurar qual perfil tem permissão para cada transição 
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
              <TableHead className="w-[80px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules?.map((rule) => (
              <TableRow key={rule.id} className={!rule.is_active ? 'opacity-50' : ''}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={orderStatusConfig[rule.from_status]?.color.replace('bg-', 'border-')}>
                      {orderStatusConfig[rule.from_status]?.label}
                    </Badge>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <Badge variant="outline" className={orderStatusConfig[rule.to_status]?.color.replace('bg-', 'border-')}>
                      {orderStatusConfig[rule.to_status]?.label}
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
                    <Badge variant="outline" className="text-amber-600 border-amber-300">
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
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(rule)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Regra de Aprovação</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {editingRule && (
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
                <Label htmlFor="name">Nome da Regra</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Liberar para Produção"
                />
              </div>

              <div>
                <Label htmlFor="description">Descrição (opcional)</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descrição da regra..."
                />
              </div>

              <div>
                <Label htmlFor="required_role">Perfil Necessário</Label>
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

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={updateRuleMutation.isPending}>
                  Salvar
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
