import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Package, Edit, Trash2, Filter, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/lib/formatters';
import { usePricingTables } from '@/hooks/usePricingTables';
import {
  Product,
  categoryOptions,
  unitMeasureOptions,
  materialOptions,
  colorOptions,
} from '@/types/products';

export default function Products() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { getTableForProduct, calculatePrice, pricingTables, pricingRules } = usePricingTables();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterActive, setFilterActive] = useState<string>('active');

  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    description: '',
    category: '',
    unit_measure: 'un',
    unit_price: 0,
    material: '',
    color: '',
    width: 0,
    length: 0,
    thickness: 0,
    active: true,
  });

  const { data: products, isLoading } = useQuery({
    queryKey: ['products', filterCategory, filterActive],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select('*')
        .order('name')
        .limit(500);

      if (filterCategory !== 'all') {
        query = query.eq('category', filterCategory);
      }

      if (filterActive === 'active') {
        query = query.eq('active', true);
      } else if (filterActive === 'inactive') {
        query = query.eq('active', false);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Product[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<Product>) => {
      const { error } = await supabase.from('products').insert({
        sku: data.sku!,
        name: data.name!,
        description: data.description,
        category: data.category,
        unit_measure: data.unit_measure,
        unit_price: data.unit_price,
        material: data.material,
        color: data.color,
        width: data.width,
        length: data.length,
        thickness: data.thickness,
        active: data.active,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Produto criado com sucesso!');
      resetForm();
    },
    onError: (error: any) => {
      if (error.message?.includes('duplicate key')) {
        toast.error('SKU já existe. Use um código diferente.');
      } else {
        toast.error('Erro ao criar produto');
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Product> & { id: string }) => {
      const { error } = await supabase.from('products').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Produto atualizado!');
      resetForm();
    },
    onError: (error: any) => {
      if (error.message?.includes('duplicate key')) {
        toast.error('SKU já existe. Use um código diferente.');
      } else {
        toast.error('Erro ao atualizar produto');
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Produto excluído!');
    },
    onError: () => toast.error('Erro ao excluir produto'),
  });

  const resetForm = () => {
    setFormData({
      sku: '',
      name: '',
      description: '',
      category: '',
      unit_measure: 'un',
      unit_price: 0,
      material: '',
      color: '',
      width: 0,
      length: 0,
      thickness: 0,
      active: true,
    });
    setEditingProduct(null);
    setIsDialogOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.sku || !formData.name) {
      toast.error('SKU e Nome são obrigatórios');
      return;
    }

    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, ...formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      sku: product.sku,
      name: product.name,
      description: product.description || '',
      category: product.category || '',
      unit_measure: product.unit_measure || 'un',
      unit_price: product.unit_price || 0,
      material: product.material || '',
      color: product.color || '',
      width: product.width || 0,
      length: product.length || 0,
      thickness: product.thickness || 0,
      active: product.active ?? true,
    });
    setIsDialogOpen(true);
  };

  // Helper to get pricing info for a product
  const getProductPricingInfo = (product: Product) => {
    const table = getTableForProduct(product.id);
    if (!table) return null;
    
    const { finalPrice, rule } = calculatePrice(
      table.id,
      product.id,
      product.category,
      1,
      product.unit_price || 0
    );
    
    return {
      table,
      finalPrice,
      rule,
      hasDiscount: finalPrice < (product.unit_price || 0),
    };
  };

  const filteredProducts = products?.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Produtos</h1>
          <p className="text-muted-foreground">Catálogo de itens de embalagem</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Produto
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingProduct ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="sku">Código SKU *</Label>
                  <Input
                    id="sku"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                    placeholder="Ex: BOB-001"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="name">Nome do Produto *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Bobina PEBD Transparente"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                    placeholder="Descrição técnica do produto"
                  />
                </div>
                <div>
                  <Label htmlFor="category">Categoria</Label>
                  <Select
                    value={formData.category || 'none'}
                    onValueChange={(v) => setFormData({ ...formData, category: v === 'none' ? '' : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {categoryOptions.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="material">Material</Label>
                  <Select
                    value={formData.material || 'none'}
                    onValueChange={(v) => setFormData({ ...formData, material: v === 'none' ? '' : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {materialOptions.map((m) => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="color">Cor</Label>
                  <Select
                    value={formData.color || 'none'}
                    onValueChange={(v) => setFormData({ ...formData, color: v === 'none' ? '' : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {colorOptions.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="unit_measure">Unidade de Medida</Label>
                  <Select
                    value={formData.unit_measure}
                    onValueChange={(v) => setFormData({ ...formData, unit_measure: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {unitMeasureOptions.map((u) => (
                        <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="unit_price">Preço Unitário (R$)</Label>
                  <Input
                    id="unit_price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.unit_price}
                    onChange={(e) => setFormData({ ...formData, unit_price: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label htmlFor="width">Largura (mm)</Label>
                  <Input
                    id="width"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.width || ''}
                    onChange={(e) => setFormData({ ...formData, width: parseFloat(e.target.value) || 0 })}
                    placeholder="Em milímetros"
                  />
                </div>
                <div>
                  <Label htmlFor="length">Comprimento (mm)</Label>
                  <Input
                    id="length"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.length || ''}
                    onChange={(e) => setFormData({ ...formData, length: parseFloat(e.target.value) || 0 })}
                    placeholder="Em milímetros"
                  />
                </div>
                <div>
                  <Label htmlFor="thickness">Espessura (micras)</Label>
                  <Input
                    id="thickness"
                    type="number"
                    step="0.001"
                    min="0"
                    value={formData.thickness || ''}
                    onChange={(e) => setFormData({ ...formData, thickness: parseFloat(e.target.value) || 0 })}
                    placeholder="Em micras"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="active"
                    checked={formData.active}
                    onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                  />
                  <Label htmlFor="active">Produto Ativo</Label>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingProduct ? 'Atualizar' : 'Criar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por SKU ou nome..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Categorias</SelectItem>
                {categoryOptions.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterActive} onValueChange={setFilterActive}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="inactive">Inativos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredProducts && filteredProducts.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead>Medidas (LxCxE)</TableHead>
                  <TableHead>Preço Base</TableHead>
                  <TableHead>Tabela de Preços</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product) => {
                  const pricingInfo = getProductPricingInfo(product);
                  return (
                    <TableRow key={product.id}>
                      <TableCell className="font-mono font-medium">{product.sku}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          {product.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        {product.category && (
                          <Badge variant="secondary">
                            {categoryOptions.find((c) => c.value === product.category)?.label || product.category}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {product.material && (
                          <span className="text-sm text-muted-foreground">
                            {materialOptions.find((m) => m.value === product.material)?.label || product.material}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {(product.width || product.length || product.thickness) ? (
                          <span className="text-sm font-mono">
                            {product.width || '-'} x {product.length || '-'} x {product.thickness || '-'}
                          </span>
                        ) : '-'}
                      </TableCell>
                      <TableCell>{formatCurrency(product.unit_price || 0)}</TableCell>
                      <TableCell>
                        {pricingInfo ? (
                          <div className="flex flex-col gap-1">
                            <Badge variant="outline" className="text-xs gap-1 w-fit">
                              <DollarSign className="h-3 w-3" />
                              {pricingInfo.table.name}
                            </Badge>
                            {pricingInfo.hasDiscount && (
                              <span className="text-xs text-emerald-600 dark:text-emerald-400">
                                → {formatCurrency(pricingInfo.finalPrice)}
                                {pricingInfo.rule?.discount_percent && pricingInfo.rule.discount_percent > 0 && (
                                  <span className="ml-1">(-{pricingInfo.rule.discount_percent}%)</span>
                                )}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={product.active ? 'default' : 'outline'}>
                          {product.active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(product)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm('Tem certeza que deseja excluir este produto?')) {
                                deleteMutation.mutate(product.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <Package className="h-12 w-12 mb-4" />
              <p>Nenhum produto encontrado</p>
              <Button variant="link" onClick={() => setIsDialogOpen(true)}>
                Criar primeiro produto
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
