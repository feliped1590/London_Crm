import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Search, Package, Edit, Trash2, Filter, DollarSign, RefreshCw, ArrowUpDown, ArrowUp, ArrowDown, FileText, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/lib/formatters';
import { usePricingTables } from '@/hooks/usePricingTables';
import { NCMSelector } from '@/components/products/NCMSelector';
import { FiscalSuggestionsCard } from '@/components/products/FiscalSuggestionsCard';
import { NCMCode, NCMSemanticValidation, TipoProdutoFiscal } from '@/types/fiscal';
import { Product, calcularFatorMilheiro } from '@/types/products';
import { useProductLookups } from '@/hooks/useProductLookups';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import ProductLookupManager from '@/components/products/ProductLookupManager';

type SortField = 'sku' | 'name' | 'category' | 'unit_price';
type SortDirection = 'asc' | 'desc';

export default function Products() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { getTableForProduct, calculatePrice, pricingTables, pricingRules } = usePricingTables();
  const { categories, materials, colors, unitMeasures } = useProductLookups();
  const { isAdmin } = useModulePermissions();
  const [pageTab, setPageTab] = useState('catalogo');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterActive, setFilterActive] = useState<string>('active');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    description: '',
    category: '',
    unit_measure: 'un',
    unit_price: 0,
    fator_kg: 0,
    fator_milheiro: 0,
    material: '',
    color: '',
    width: 0,
    length: 0,
    thickness: 0,
    active: true,
    // Campos NCM e Fiscais
    ncm_code: '',
    ncm_id: '' as string | undefined,
    cst_icms: '',
    csosn: '',
    aliquota_icms: undefined as number | undefined,
    tem_icms_st: false,
    aliquota_ipi: undefined as number | undefined,
    cst_pis_cofins: '',
    aliquota_pis: undefined as number | undefined,
    aliquota_cofins: undefined as number | undefined,
    tipo_produto_fiscal: undefined as TipoProdutoFiscal | undefined,
  });

  const [ncmValidation, setNcmValidation] = useState<NCMSemanticValidation | null>(null);
  const [formTab, setFormTab] = useState('geral');

  // Recalcula o fator milheiro quando os valores mudam
  const recalcularFatorMilheiro = (data: typeof formData) => {
    if (data.fator_kg && data.width && data.length && data.thickness) {
      return calcularFatorMilheiro(data.fator_kg, data.width, data.length, data.thickness);
    }
    return 0;
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead 
      className="cursor-pointer select-none hover:bg-muted/50 transition-colors"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field ? (
          sortDirection === 'asc' ? (
            <ArrowUp className="h-3.5 w-3.5 text-primary" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5 text-primary" />
          )
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
        )}
      </div>
    </TableHead>
  );

  const { data: products, isLoading, refetch, isFetching } = useQuery({
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
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const handleRefresh = async () => {
    await refetch();
    toast.success('Dados atualizados!');
  };

  const createMutation = useMutation({
    mutationFn: async (data: Partial<Product>) => {
      const fatorMilheiro = calcularFatorMilheiro(
        data.fator_kg || 0,
        data.width || 0,
        data.length || 0,
        data.thickness || 0
      );
      const { error } = await supabase.from('products').insert({
        sku: data.sku!,
        name: data.name!,
        description: data.description,
        category: data.category,
        unit_measure: data.unit_measure,
        unit_price: data.unit_price,
        fator_kg: data.fator_kg,
        fator_milheiro: fatorMilheiro,
        material: data.material,
        color: data.color,
        width: data.width,
        length: data.length,
        thickness: data.thickness,
        active: data.active,
        // Campos NCM e Fiscais
        ncm_code: data.ncm_code || null,
        ncm_id: data.ncm_id || null,
        cst_icms: data.cst_icms || null,
        csosn: data.csosn || null,
        aliquota_icms: data.aliquota_icms || null,
        tem_icms_st: data.tem_icms_st || false,
        aliquota_ipi: data.aliquota_ipi || null,
        cst_pis_cofins: data.cst_pis_cofins || null,
        aliquota_pis: data.aliquota_pis || null,
        aliquota_cofins: data.aliquota_cofins || null,
        tipo_produto_fiscal: data.tipo_produto_fiscal || null,
        ncm_validated_at: data.ncm_code ? new Date().toISOString() : null,
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
      const fatorMilheiro = calcularFatorMilheiro(
        data.fator_kg || 0,
        data.width || 0,
        data.length || 0,
        data.thickness || 0
      );
      const { error } = await supabase.from('products').update({
        ...data,
        fator_milheiro: fatorMilheiro,
      }).eq('id', id);
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
      fator_kg: 0,
      fator_milheiro: 0,
      material: '',
      color: '',
      width: 0,
      length: 0,
      thickness: 0,
      active: true,
      ncm_code: '',
      ncm_id: undefined,
      cst_icms: '',
      csosn: '',
      aliquota_icms: undefined,
      tem_icms_st: false,
      aliquota_ipi: undefined,
      cst_pis_cofins: '',
      aliquota_pis: undefined,
      aliquota_cofins: undefined,
      tipo_produto_fiscal: undefined,
    });
    setEditingProduct(null);
    setIsDialogOpen(false);
    setNcmValidation(null);
    setFormTab('geral');
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
      fator_kg: product.fator_kg || 0,
      fator_milheiro: product.fator_milheiro || 0,
      material: product.material || '',
      color: product.color || '',
      width: product.width || 0,
      length: product.length || 0,
      thickness: product.thickness || 0,
      active: product.active ?? true,
      ncm_code: product.ncm_code || '',
      ncm_id: product.ncm_id,
      cst_icms: product.cst_icms || '',
      csosn: product.csosn || '',
      aliquota_icms: product.aliquota_icms,
      tem_icms_st: product.tem_icms_st || false,
      aliquota_ipi: product.aliquota_ipi,
      cst_pis_cofins: product.cst_pis_cofins || '',
      aliquota_pis: product.aliquota_pis,
      aliquota_cofins: product.aliquota_cofins,
      tipo_produto_fiscal: product.tipo_produto_fiscal,
    });
    setIsDialogOpen(true);
    setFormTab('geral');
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

  const filteredProducts = products
    ?.filter((p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase())
    )
    ?.sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';
      
      switch (sortField) {
        case 'sku':
          aVal = a.sku.toLowerCase();
          bVal = b.sku.toLowerCase();
          break;
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'category':
          aVal = (a.category || '').toLowerCase();
          bVal = (b.category || '').toLowerCase();
          break;
        case 'unit_price':
          aVal = a.unit_price || 0;
          bVal = b.unit_price || 0;
          break;
      }
      
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Produtos</h1>
          <p className="text-muted-foreground">Catálogo de itens de embalagem</p>
        </div>
      </div>

      <Tabs value={pageTab} onValueChange={setPageTab}>
        <TabsList>
          <TabsTrigger value="catalogo" className="gap-2">
            <Package className="h-4 w-4" />
            Catálogo
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="cadastro-basico" className="gap-2">
              <Settings2 className="h-4 w-4" />
              Cadastro Básico
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="cadastro-basico">
          {isAdmin && <ProductLookupManager />}
        </TabsContent>

        <TabsContent value="catalogo">
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isFetching}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Novo Produto
              </Button>
            </DialogTrigger>
          </div>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingProduct ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Tabs value={formTab} onValueChange={setFormTab}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="geral" className="gap-2">
                    <Package className="h-4 w-4" />
                    Geral
                  </TabsTrigger>
                  <TabsTrigger value="fiscal" className="gap-2">
                    <FileText className="h-4 w-4" />
                    Fiscal / NCM
                    {formData.ncm_code && (
                      <Badge variant="secondary" className="ml-1 text-xs">
                        {formData.ncm_code}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="geral" className="space-y-4 mt-4">
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
                          {categories.items.map((c) => (
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
                          {materials.items.map((m) => (
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
                          {colors.items.map((c) => (
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
                          {unitMeasures.items.map((u) => (
                            <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Seção de Precificação */}
                    <div className="col-span-2 pt-2">
                      <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Precificação
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="unit_price">Preço Unitário (R$)</Label>
                          <CurrencyInput
                            id="unit_price"
                            value={formData.unit_price}
                            onChange={(val) => setFormData({ ...formData, unit_price: val })}
                          />
                        </div>
                        <div>
                          <Label htmlFor="fator_kg">Valor do Fator KG (R$/kg)</Label>
                          <CurrencyInput
                            id="fator_kg"
                            value={formData.fator_kg || null}
                            onChange={(val) => {
                              const newData = { ...formData, fator_kg: val };
                              newData.fator_milheiro = recalcularFatorMilheiro(newData);
                              setFormData(newData);
                            }}
                            placeholder="Valor por KG"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Seção de Dimensões */}
                    <div className="col-span-2 pt-2">
                      <h3 className="text-sm font-medium text-muted-foreground mb-3">Dimensões</h3>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label htmlFor="width">Largura (mm)</Label>
                          <Input
                            id="width"
                            type="number"
                            step="0.01"
                            min="0"
                            value={formData.width || ''}
                            onChange={(e) => {
                              const newWidth = parseFloat(e.target.value) || 0;
                              const newData = { ...formData, width: newWidth };
                              newData.fator_milheiro = recalcularFatorMilheiro(newData);
                              setFormData(newData);
                            }}
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
                            onChange={(e) => {
                              const newLength = parseFloat(e.target.value) || 0;
                              const newData = { ...formData, length: newLength };
                              newData.fator_milheiro = recalcularFatorMilheiro(newData);
                              setFormData(newData);
                            }}
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
                            onChange={(e) => {
                              const newThickness = parseFloat(e.target.value) || 0;
                              const newData = { ...formData, thickness: newThickness };
                              newData.fator_milheiro = recalcularFatorMilheiro(newData);
                              setFormData(newData);
                            }}
                            placeholder="Em micras"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Fator Milheiro calculado */}
                    {formData.fator_kg > 0 && formData.width > 0 && formData.length > 0 && formData.thickness > 0 && (
                      <div className="col-span-2 p-3 bg-muted/50 rounded-lg border">
                        <div className="flex items-center justify-between">
                          <div>
                            <Label className="text-muted-foreground">Fator Milheiro (calculado)</Label>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              = Fator KG × Largura × Comprimento × Espessura / 1.000.000
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="text-2xl font-bold text-primary">
                              {formData.fator_milheiro.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                            <p className="text-xs text-muted-foreground">por milheiro</p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <Switch
                        id="active"
                        checked={formData.active}
                        onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                      />
                      <Label htmlFor="active">Produto Ativo</Label>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="fiscal" className="space-y-4 mt-4">
                  {/* NCM Selector */}
                  <NCMSelector
                    value={formData.ncm_code}
                    onChange={(ncmCode, ncm) => {
                      setFormData({ 
                        ...formData, 
                        ncm_code: ncmCode,
                        ncm_id: ncm?.id,
                        // Se tem IPI oficial, sugerir
                        aliquota_ipi: ncm?.aliquota_ipi_oficial ?? formData.aliquota_ipi,
                      });
                    }}
                    productDescription={`${formData.name} ${formData.description || ''} ${formData.material || ''}`}
                    onValidationChange={setNcmValidation}
                  />

                  {/* Dados Fiscais */}
                  <FiscalSuggestionsCard
                    data={{
                      cst_icms: formData.cst_icms,
                      csosn: formData.csosn,
                      aliquota_icms: formData.aliquota_icms,
                      tem_icms_st: formData.tem_icms_st,
                      aliquota_ipi: formData.aliquota_ipi,
                      cst_pis_cofins: formData.cst_pis_cofins,
                      aliquota_pis: formData.aliquota_pis,
                      aliquota_cofins: formData.aliquota_cofins,
                      tipo_produto_fiscal: formData.tipo_produto_fiscal,
                    }}
                    onChange={(field, value) => {
                      setFormData({ ...formData, [field]: value });
                    }}
                    ncmCode={formData.ncm_code}
                    isSuggestion={!!ncmValidation}
                  />
                </TabsContent>
              </Tabs>

              <div className="flex justify-end gap-2 pt-4 border-t">
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
                {categories.items.map((c) => (
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
            <div className="table-responsive">
              <Table className="min-w-[900px]">
                <TableHeader>
                  <TableRow>
                    <SortableHeader field="sku">SKU</SortableHeader>
                    <SortableHeader field="name">Nome</SortableHeader>
                    <TableHead>NCM</TableHead>
                    <SortableHeader field="category">Categoria</SortableHeader>
                    <TableHead>Material</TableHead>
                    <SortableHeader field="unit_price">Preço Base</SortableHeader>
                    <TableHead>Tabela de Preços</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sync ERP</TableHead>
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
                        {product.ncm_code ? (
                          <Badge variant="outline" className="font-mono text-xs">
                            {product.ncm_code}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {product.category && (
                          <Badge variant="secondary">
                            {categories.items.find((c) => c.value === product.category)?.label || product.category}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {product.material && (
                          <span className="text-sm text-muted-foreground">
                            {materials.items.find((m) => m.value === product.material)?.label || product.material}
                          </span>
                        )}
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
                      <TableCell>
                        {product.pendente_envio ? (
                          <Badge variant="outline" className="text-xs text-amber-600 border-amber-400 gap-1">
                            <RefreshCw className="h-3 w-3" />
                            Pendente
                          </Badge>
                        ) : product.erp_last_sync_at ? (
                          <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-400 gap-1">
                            Sincronizado
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
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
            </div>
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
