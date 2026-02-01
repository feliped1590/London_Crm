import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
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
  const { config, isConfigured } = useInflexConfig();

  // Query para buscar produtos do banco
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
  };

  // Stats
  const stats = {
    total: products?.length || 0,
    ativos: products?.filter(p => p.ativo).length || 0,
    inativos: products?.filter(p => !p.ativo).length || 0,
    geraEstoque: products?.filter(p => p.gera_estoque).length || 0,
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
              <PackageCheck className="h-3 w-3 text-blue-600" /> Gera Estoque
            </CardDescription>
            <CardTitle className="text-2xl text-blue-600">{stats.geraEstoque}</CardTitle>
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
                      <TableHead className="w-[100px]">Produto</TableHead>
                      <TableHead className="w-[80px]">Versão</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="w-[120px]">Grupo</TableHead>
                      <TableHead className="w-[120px]">Subgrupo</TableHead>
                      <TableHead className="w-[60px]">Unid.</TableHead>
                      <TableHead className="w-[80px]">Ativo</TableHead>
                      <TableHead className="w-[100px]">Estoque</TableHead>
                      <TableHead className="w-[140px]">Alteração</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedProducts.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell className="font-mono text-sm font-medium">
                          {product.external_id}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {product.versao || '-'}
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
                        <TableCell className="text-sm">{product.grupo || '-'}</TableCell>
                        <TableCell className="text-sm">{product.subgrupo || '-'}</TableCell>
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
                          {product.gera_estoque ? (
                            <Badge variant="secondary" className="gap-1 text-blue-600">
                              <PackageCheck className="h-3 w-3" />
                              Sim
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1 text-muted-foreground">
                              —
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDate(product.data_alteracao_erp)}
                        </TableCell>
                      </TableRow>
                    ))}
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
