import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Edit2, Trash2, DollarSign, Percent, Package, Building2, Users, Link2 } from 'lucide-react';
import { usePricingTables, PricingTable, PricingRule } from '@/hooks/usePricingTables';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { EntityAssignmentsTab } from '@/components/pricing/EntityAssignmentsTab';

export default function PricingTables() {
  const { isAdmin } = useModulePermissions();
  const {
    pricingTables,
    pricingRules,
    assignments,
    isLoading,
    createTable,
    updateTable,
    deleteTable,
    createRule,
    updateRule,
    deleteRule,
    getRulesForTable,
    isPending,
  } = usePricingTables();

  const [isTableDialogOpen, setIsTableDialogOpen] = useState(false);
  const [isRuleDialogOpen, setIsRuleDialogOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<PricingTable | null>(null);
  const [editingRule, setEditingRule] = useState<PricingRule | null>(null);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ type: 'table' | 'rule'; id: string } | null>(null);

  const [tableFormData, setTableFormData] = useState({
    name: '',
    description: '',
    is_default: false,
    is_active: true,
    valid_from: '',
    valid_until: '',
  });

  const [ruleFormData, setRuleFormData] = useState({
    product_id: '',
    category: '',
    min_quantity: 0,
    max_quantity: null as number | null,
    discount_percent: 0,
    fixed_price: null as number | null,
    price_per_unit: null as number | null,
    sort_order: 0,
  });

  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('id, name, sku, category').eq('active', true).order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: companies } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      const { data, error } = await supabase.from('companies').select('id, name').order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: contacts } = useQuery({
    queryKey: ['contacts'],
    queryFn: async () => {
      const { data, error } = await supabase.from('contacts').select('id, first_name, last_name').order('first_name');
      if (error) throw error;
      return data;
    },
  });

  const categories = [...new Set(products?.map((p) => p.category).filter(Boolean) || [])];

  const resetTableForm = () => {
    setTableFormData({
      name: '',
      description: '',
      is_default: false,
      is_active: true,
      valid_from: '',
      valid_until: '',
    });
    setEditingTable(null);
    setIsTableDialogOpen(false);
  };

  const resetRuleForm = () => {
    setRuleFormData({
      product_id: '',
      category: '',
      min_quantity: 0,
      max_quantity: null,
      discount_percent: 0,
      fixed_price: null,
      price_per_unit: null,
      sort_order: 0,
    });
    setEditingRule(null);
    setIsRuleDialogOpen(false);
  };

  const handleEditTable = (table: PricingTable) => {
    setEditingTable(table);
    setTableFormData({
      name: table.name,
      description: table.description || '',
      is_default: table.is_default,
      is_active: table.is_active,
      valid_from: table.valid_from || '',
      valid_until: table.valid_until || '',
    });
    setIsTableDialogOpen(true);
  };

  const handleEditRule = (rule: PricingRule) => {
    setEditingRule(rule);
    setRuleFormData({
      product_id: rule.product_id || '',
      category: rule.category || '',
      min_quantity: rule.min_quantity,
      max_quantity: rule.max_quantity,
      discount_percent: rule.discount_percent,
      fixed_price: rule.fixed_price,
      price_per_unit: rule.price_per_unit,
      sort_order: rule.sort_order,
    });
    setIsRuleDialogOpen(true);
  };

  const handleSubmitTable = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTable) {
      updateTable({ id: editingTable.id, ...tableFormData });
    } else {
      createTable(tableFormData);
    }
    resetTableForm();
  };

  const handleSubmitRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTableId) return;

    const data = {
      ...ruleFormData,
      pricing_table_id: selectedTableId,
      product_id: ruleFormData.product_id || null,
      category: ruleFormData.category || null,
    };

    if (editingRule) {
      updateRule({ id: editingRule.id, ...data });
    } else {
      createRule(data);
    }
    resetRuleForm();
  };

  const handleDeleteConfirm = () => {
    if (!itemToDelete) return;
    if (itemToDelete.type === 'table') {
      deleteTable(itemToDelete.id);
    } else {
      deleteRule(itemToDelete.id);
    }
    setDeleteConfirmOpen(false);
    setItemToDelete(null);
  };

  const getAssignmentCount = (tableId: string) => {
    return assignments.filter((a) => a.pricing_table_id === tableId).length;
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <DollarSign className="h-16 w-16 text-muted-foreground/50 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Acesso Restrito</h2>
        <p className="text-muted-foreground">Apenas administradores podem gerenciar tabelas de preços.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tabelas de Preços</h1>
          <p className="text-muted-foreground">Gerencie tabelas de preços e regras de desconto</p>
        </div>
        <Button onClick={() => setIsTableDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Tabela
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-5 bg-muted rounded w-3/4" />
              </CardHeader>
              <CardContent>
                <div className="h-4 bg-muted rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : pricingTables.length === 0 ? (
        <Card className="py-12">
          <CardContent className="flex flex-col items-center text-center">
            <DollarSign className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma tabela de preços</h3>
            <p className="text-muted-foreground mb-4">Crie sua primeira tabela de preços para definir regras de desconto.</p>
            <Button onClick={() => setIsTableDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Criar Tabela
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {pricingTables.map((table) => (
            <Card
              key={table.id}
              className={cn(
                'cursor-pointer transition-all hover:shadow-md',
                selectedTableId === table.id && 'ring-2 ring-primary'
              )}
              onClick={() => setSelectedTableId(table.id)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      {table.name}
                      {table.is_default && <Badge variant="secondary">Padrão</Badge>}
                      {!table.is_active && <Badge variant="outline">Inativa</Badge>}
                    </CardTitle>
                    {table.description && (
                      <CardDescription className="mt-1">{table.description}</CardDescription>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditTable(table);
                      }}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        setItemToDelete({ type: 'table', id: table.id });
                        setDeleteConfirmOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Percent className="h-3.5 w-3.5" />
                    {getRulesForTable(table.id).length} regras
                  </span>
                  <span className="flex items-center gap-1">
                    <Link2 className="h-3.5 w-3.5" />
                    {getAssignmentCount(table.id)} vínculos
                  </span>
                </div>
                {(table.valid_from || table.valid_until) && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Validade: {table.valid_from ? new Date(table.valid_from).toLocaleDateString('pt-BR') : '...'} -{' '}
                    {table.valid_until ? new Date(table.valid_until).toLocaleDateString('pt-BR') : '...'}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Rules & Assignments Section */}
      {selectedTableId && (
        <Card>
          <CardHeader>
            <CardTitle>Configuração da Tabela</CardTitle>
            <CardDescription>
              Gerencie regras de preço e vínculos com clientes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="rules">
              <TabsList className="mb-4">
                <TabsTrigger value="rules" className="gap-2">
                  <Percent className="h-4 w-4" />
                  Regras de Preço
                </TabsTrigger>
                <TabsTrigger value="assignments" className="gap-2">
                  <Link2 className="h-4 w-4" />
                  Vínculos
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="rules">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm text-muted-foreground">
                    Configure descontos e preços especiais para esta tabela
                  </div>
                  <Button onClick={() => setIsRuleDialogOpen(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Nova Regra
                  </Button>
                </div>
                
                {getRulesForTable(selectedTableId).length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Percent className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Nenhuma regra definida para esta tabela.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto/Categoria</TableHead>
                        <TableHead>Faixa de Quantidade</TableHead>
                        <TableHead>Desconto</TableHead>
                        <TableHead>Preço Fixo</TableHead>
                        <TableHead className="w-[100px]">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {getRulesForTable(selectedTableId).map((rule: any) => (
                        <TableRow key={rule.id}>
                          <TableCell>
                            {rule.products?.name || rule.category || <span className="text-muted-foreground">Todos</span>}
                          </TableCell>
                          <TableCell>
                            {rule.min_quantity}
                            {rule.max_quantity ? ` - ${rule.max_quantity}` : '+'}
                          </TableCell>
                          <TableCell>
                            {rule.discount_percent > 0 ? `${rule.discount_percent}%` : '-'}
                          </TableCell>
                          <TableCell>
                            {rule.fixed_price !== null
                              ? formatCurrency(rule.fixed_price)
                              : rule.price_per_unit !== null
                              ? `${formatCurrency(rule.price_per_unit)}/un`
                              : '-'}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleEditRule(rule)}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() => {
                                  setItemToDelete({ type: 'rule', id: rule.id });
                                  setDeleteConfirmOpen(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>
              
              <TabsContent value="assignments">
                <EntityAssignmentsTab 
                  selectedTableId={selectedTableId} 
                  tableName={pricingTables.find(t => t.id === selectedTableId)?.name || ''}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Table Dialog */}
      <Dialog open={isTableDialogOpen} onOpenChange={(open) => !open && resetTableForm()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTable ? 'Editar Tabela de Preços' : 'Nova Tabela de Preços'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitTable} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={tableFormData.name}
                onChange={(e) => setTableFormData({ ...tableFormData, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={tableFormData.description}
                onChange={(e) => setTableFormData({ ...tableFormData, description: e.target.value })}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="valid_from">Válido de</Label>
                <Input
                  id="valid_from"
                  type="date"
                  value={tableFormData.valid_from}
                  onChange={(e) => setTableFormData({ ...tableFormData, valid_from: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="valid_until">Válido até</Label>
                <Input
                  id="valid_until"
                  type="date"
                  value={tableFormData.valid_until}
                  onChange={(e) => setTableFormData({ ...tableFormData, valid_until: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  id="is_active"
                  checked={tableFormData.is_active}
                  onCheckedChange={(checked) => setTableFormData({ ...tableFormData, is_active: checked })}
                />
                <Label htmlFor="is_active">Ativa</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="is_default"
                  checked={tableFormData.is_default}
                  onCheckedChange={(checked) => setTableFormData({ ...tableFormData, is_default: checked })}
                />
                <Label htmlFor="is_default">Tabela padrão</Label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetTableForm}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {editingTable ? 'Atualizar' : 'Criar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Rule Dialog */}
      <Dialog open={isRuleDialogOpen} onOpenChange={(open) => !open && resetRuleForm()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRule ? 'Editar Regra de Preço' : 'Nova Regra de Preço'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitRule} className="space-y-4">
            <Tabs defaultValue="product">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="product">Por Produto</TabsTrigger>
                <TabsTrigger value="category">Por Categoria</TabsTrigger>
              </TabsList>
              <TabsContent value="product" className="space-y-2 mt-4">
                <Label htmlFor="product_id">Produto (opcional)</Label>
                <Select
                  value={ruleFormData.product_id || 'none'}
                  onValueChange={(v) =>
                    setRuleFormData({ ...ruleFormData, product_id: v === 'none' ? '' : v, category: '' })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os produtos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Todos os produtos</SelectItem>
                    {products?.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} ({p.sku})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TabsContent>
              <TabsContent value="category" className="space-y-2 mt-4">
                <Label htmlFor="category">Categoria (opcional)</Label>
                <Select
                  value={ruleFormData.category || 'none'}
                  onValueChange={(v) =>
                    setRuleFormData({ ...ruleFormData, category: v === 'none' ? '' : v, product_id: '' })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas as categorias" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Todas as categorias</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat!}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TabsContent>
            </Tabs>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="min_quantity">Quantidade mínima</Label>
                <Input
                  id="min_quantity"
                  type="number"
                  min="0"
                  value={ruleFormData.min_quantity}
                  onChange={(e) =>
                    setRuleFormData({ ...ruleFormData, min_quantity: parseInt(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_quantity">Quantidade máxima</Label>
                <Input
                  id="max_quantity"
                  type="number"
                  min="0"
                  placeholder="Sem limite"
                  value={ruleFormData.max_quantity ?? ''}
                  onChange={(e) =>
                    setRuleFormData({
                      ...ruleFormData,
                      max_quantity: e.target.value ? parseInt(e.target.value) : null,
                    })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="discount_percent">Desconto (%)</Label>
              <Input
                id="discount_percent"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={ruleFormData.discount_percent}
                onChange={(e) =>
                  setRuleFormData({
                    ...ruleFormData,
                    discount_percent: parseFloat(e.target.value) || 0,
                    fixed_price: null,
                    price_per_unit: null,
                  })
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fixed_price">Preço fixo (R$)</Label>
                <Input
                  id="fixed_price"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Opcional"
                  value={ruleFormData.fixed_price ?? ''}
                  onChange={(e) =>
                    setRuleFormData({
                      ...ruleFormData,
                      fixed_price: e.target.value ? parseFloat(e.target.value) : null,
                      discount_percent: 0,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price_per_unit">Preço por unidade (R$)</Label>
                <Input
                  id="price_per_unit"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Opcional"
                  value={ruleFormData.price_per_unit ?? ''}
                  onChange={(e) =>
                    setRuleFormData({
                      ...ruleFormData,
                      price_per_unit: e.target.value ? parseFloat(e.target.value) : null,
                      discount_percent: 0,
                    })
                  }
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetRuleForm}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {editingRule ? 'Atualizar' : 'Criar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {itemToDelete?.type === 'table'
                ? 'Esta ação excluirá a tabela de preços e todas as suas regras. Os vínculos com clientes também serão removidos.'
                : 'Esta ação excluirá a regra de preço selecionada.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
