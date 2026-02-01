import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  XCircle,
  Loader2,
  Package,
  PackageCheck,
  PackageX,
  Database,
  ChevronLeft,
  ChevronRight,
  ArrowDownToLine,
  Download,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useInflexConfig } from '@/hooks/useInflexConfig';

interface CRMProduct {
  id: string;
  external_id: string;
  produto_codigo: string | null;
  descricao: string | null;
  descricao_simples: string | null;
  descricao_completa: string | null;
  versao: string | null;
  sku: string | null;
  unidade: string | null;
  grupo: string | null;
  subgrupo: string | null;
  tipo_item: string | null;
  ncm: string | null;
  ativo: boolean;
  gera_estoque: boolean;
  preco_venda: number | null;
  data_alteracao_erp: string | null;
  synced_at: string | null;
}

interface SyncResult {
  success: boolean;
  entity: string;
  processed: number;
  created: number;
  updated: number;
  last_sync_at: string;
}

const PAGE_SIZE = 25;

export function InflexProductsTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [importingIds, setImportingIds] = useState<Set<string>>(new Set());
  const { config, isConfigured } = useInflexConfig();

  // Query para buscar produtos do banco (crm_products)
  const { data: products, isLoading } = useQuery({
    queryKey: ['crm-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_products')
        .select('*')
        .order('data_alteracao_erp', { ascending: false });
      if (error) throw error;
      return data as CRMProduct[];
    },
  });

  // Query para buscar SKUs já importados na tabela products
  const { data: existingSkus } = useQuery({
    queryKey: ['products-skus'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('sku');
      if (error) throw error;
      return new Set(data.map(p => p.sku));
    },
  });

  // Query para última sincronização
  const { data: syncControl } = useQuery({
    queryKey: ['erp-sync-control-produtos'],
    queryFn: async () => {
      const { data } = await supabase
        .from('erp_sync_control')
        .select('last_sync_at, last_sync_count')
        .eq('entity', 'produtos')
        .maybeSingle();
      return data;
    },
  });

  // Mutation para sincronização
  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('sync-iniflex-products', {
        body: {
          baseUrl: config.baseUrl,
          token: config.token,
        },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Erro na sincronização');
      return data as SyncResult;
    },
    onSuccess: (data) => {
      toast.success(`Sincronização de produtos: ${data.processed} processados`);
      setLastSyncResult(data);
      queryClient.invalidateQueries({ queryKey: ['crm-products'] });
      queryClient.invalidateQueries({ queryKey: ['erp-sync-control-produtos'] });
    },
    onError: (error: Error) => {
      toast.error(`Erro na sincronização de produtos: ${error.message}`);
    },
  });

  // Mutation para importar produto
  const importMutation = useMutation({
    mutationFn: async (product: CRMProduct) => {
      setImportingIds(prev => new Set(prev).add(product.id));
      
      // Gerar SKU único: external_id + versao
      const sku = product.versao 
        ? `${product.external_id}-${product.versao}` 
        : product.external_id;
      
      const productData = {
        sku,
        name: product.descricao_completa || product.descricao || product.external_id,
        description: product.descricao_simples || null,
        category: product.grupo || null,
        unit_measure: product.unidade || null,
        unit_price: product.preco_venda || null,
        active: product.ativo ?? true,
      };

      const { error } = await supabase
        .from('products')
        .upsert(productData, { onConflict: 'sku' });
      
      if (error) throw error;
      return { product, sku };
    },
    onSuccess: ({ product }) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['products-skus'] });
      toast.success(`Produto importado: ${product.descricao_completa || product.external_id}`);
      setImportingIds(prev => {
        const next = new Set(prev);
        next.delete(product.id);
        return next;
      });
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(product.id);
        return next;
      });
    },
    onError: (error: any, product) => {
      toast.error(`Erro ao importar ${product.external_id}: ${error.message}`);
      setImportingIds(prev => {
        const next = new Set(prev);
        next.delete(product.id);
        return next;
      });
    },
  });

  // Verificar se produto já foi importado
  const isImported = (product: CRMProduct) => {
    const sku = product.versao 
      ? `${product.external_id}-${product.versao}` 
      : product.external_id;
    return existingSkus?.has(sku);
  };

  // Handlers de seleção
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(paginatedProducts.filter(p => !isImported(p)).map(p => p.id));
      setSelectedIds(allIds);
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelect = (id: string, checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) {
      next.add(id);
    } else {
      next.delete(id);
    }
    setSelectedIds(next);
  };

  const handleImportSelected = async () => {
    const selected = products?.filter(p => selectedIds.has(p.id)) || [];
    for (const product of selected) {
      await importMutation.mutateAsync(product);
    }
  };

  // Filtro client-side
  const filteredProducts = products?.filter(p => {
    const searchLower = search.toLowerCase();
    return (
      p.external_id?.toLowerCase().includes(searchLower) ||
      p.descricao?.toLowerCase().includes(searchLower) ||
      p.descricao_completa?.toLowerCase().includes(searchLower) ||
      p.grupo?.toLowerCase().includes(searchLower) ||
      p.sku?.toLowerCase().includes(searchLower)
    );
  }) || [];

  // Paginação
  const totalPages = Math.ceil(filteredProducts.length / PAGE_SIZE);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  // Reset página ao buscar
  const handleSearch = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
    setSelectedIds(new Set());
  };

  // Stats
  const stats = {
    total: products?.length || 0,
    ativos: products?.filter(p => p.ativo).length || 0,
    inativos: products?.filter(p => !p.ativo).length || 0,
    imported: products?.filter(p => isImported(p)).length || 0,
    pending: products?.filter(p => !isImported(p)).length || 0,
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    try {
      // Tentar parsear como ISO ou como formato ERP (DD/MM/YYYY)
      let date: Date;
      if (dateStr.includes('/')) {
        const [datePart, timePart] = dateStr.split(' ');
        const [day, month, year] = datePart.split('/').map(Number);
        const [hour = 0, minute = 0] = (timePart || '').split(':').map(Number);
        date = new Date(year, month - 1, day, hour, minute);
      } else {
        date = new Date(dateStr);
      }
      return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const allSelected = paginatedProducts.filter(p => !isImported(p)).length > 0 && 
    paginatedProducts.filter(p => !isImported(p)).every(p => selectedIds.has(p.id));
  const someSelected = paginatedProducts.some(p => selectedIds.has(p.id)) && !allSelected;

  return (
    <div className="space-y-6">
      {/* Card de Sincronização */}
      <Card className="bg-muted/30 border-primary/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Package className="h-5 w-5" />
                Sincronização de Produtos
              </CardTitle>
              <CardDescription>
                Busca incremental de produtos/versões do ERP Iniflex
              </CardDescription>
            </div>
            <Button 
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending || !isConfigured}
              className="gap-2"
            >
              {syncMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Sincronizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!isConfigured ? (
            <p className="text-sm text-muted-foreground">
              Configure URL e Token na aba <strong>Sandbox</strong> para habilitar a sincronização.
            </p>
          ) : (
            <div className="space-y-2">
              {lastSyncResult ? (
                <div className="flex flex-wrap gap-3">
                  <Badge variant="outline" className="gap-1">
                    <Database className="h-3 w-3" />
                    Processados: {lastSyncResult.processed}
                  </Badge>
                  <Badge variant="secondary" className="gap-1 text-green-600">
                    <CheckCircle2 className="h-3 w-3" />
                    Criados: {lastSyncResult.created}
                  </Badge>
                  <Badge variant="secondary" className="gap-1 text-blue-600">
                    <RefreshCw className="h-3 w-3" />
                    Atualizados: {lastSyncResult.updated}
                  </Badge>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhuma sincronização realizada nesta sessão.
                </p>
              )}
              {syncControl?.last_sync_at && (
                <p className="text-xs text-muted-foreground">
                  Última sincronização: {formatDate(syncControl.last_sync_at)}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Package className="h-3 w-3" /> Total
            </CardDescription>
            <CardTitle className="text-2xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-600" /> Ativos
            </CardDescription>
            <CardTitle className="text-2xl text-green-600">{stats.ativos}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <XCircle className="h-3 w-3 text-red-600" /> Inativos
            </CardDescription>
            <CardTitle className="text-2xl text-red-600">{stats.inativos}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <PackageCheck className="h-3 w-3 text-blue-600" /> Importados
            </CardDescription>
            <CardTitle className="text-2xl text-blue-600">{stats.imported}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <AlertCircle className="h-3 w-3 text-amber-600" /> Pendentes
            </CardDescription>
            <CardTitle className="text-2xl text-amber-600">{stats.pending}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Tabela de Produtos */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por produto, descrição, grupo ou SKU..."
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Badge variant="outline">
              {filteredProducts.length} produto(s)
            </Badge>
            {selectedIds.size > 0 && (
              <Button 
                onClick={handleImportSelected}
                disabled={importMutation.isPending}
                className="gap-2"
              >
                {importMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowDownToLine className="h-4 w-4" />
                )}
                Importar Selecionados ({selectedIds.size})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : paginatedProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <PackageX className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">Nenhum produto encontrado</h3>
              <p className="text-muted-foreground">
                {search ? 'Tente uma busca diferente.' : 'Execute a sincronização para importar produtos do ERP.'}
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox 
                          checked={allSelected}
                          ref={(el) => {
                            if (el) (el as any).indeterminate = someSelected;
                          }}
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead className="w-[100px]">Produto</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="w-[100px]">Versão</TableHead>
                      <TableHead className="w-[120px]">Grupo</TableHead>
                      <TableHead className="w-[60px]">Unid.</TableHead>
                      <TableHead className="w-[80px]">Ativo</TableHead>
                      <TableHead className="w-[100px]">Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedProducts.map((product) => {
                      const imported = isImported(product);
                      const importing = importingIds.has(product.id);

                      return (
                        <TableRow key={product.id} className={imported ? 'opacity-60' : ''}>
                          <TableCell>
                            <Checkbox 
                              checked={selectedIds.has(product.id)}
                              onCheckedChange={(checked) => handleSelect(product.id, !!checked)}
                              disabled={imported}
                            />
                          </TableCell>
                          <TableCell className="font-mono text-sm font-medium">
                            {product.external_id}
                          </TableCell>
                          <TableCell>
                            <div className="max-w-[300px]">
                              <p className="font-medium truncate" title={product.descricao_completa || product.descricao || ''}>
                                {product.descricao_completa || product.descricao || '-'}
                              </p>
                              {product.descricao_simples && product.descricao_simples !== product.descricao_completa && (
                                <p className="text-xs text-muted-foreground truncate">
                                  {product.descricao_simples}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {product.versao || '-'}
                          </TableCell>
                          <TableCell className="text-sm">{product.grupo || '-'}</TableCell>
                          <TableCell className="text-sm text-center">{product.unidade || '-'}</TableCell>
                          <TableCell>
                            {product.ativo ? (
                              <Badge variant="secondary" className="gap-1 text-green-600">
                                <CheckCircle2 className="h-3 w-3" />
                                Ativo
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="gap-1 text-red-600">
                                <XCircle className="h-3 w-3" />
                                Inativo
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {imported ? (
                              <Badge variant="secondary" className="gap-1">
                                <CheckCircle2 className="h-3 w-3 text-green-600" />
                                Importado
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="gap-1 text-amber-600">
                                <AlertCircle className="h-3 w-3" />
                                Pendente
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => importMutation.mutate(product)}
                              disabled={importing || imported}
                              className="gap-1"
                            >
                              {importing ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Download className="h-4 w-4" />
                              )}
                              {imported ? 'Importado' : 'Importar'}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Paginação */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Mostrando {(currentPage - 1) * PAGE_SIZE + 1} a {Math.min(currentPage * PAGE_SIZE, filteredProducts.length)} de {filteredProducts.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm">
                      Página {currentPage} de {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
