import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Search, 
  Download, 
  RefreshCw, 
  Building2, 
  Users, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  ArrowDownToLine,
  Database
} from 'lucide-react';
import { toast } from 'sonner';
import { formatCPF, formatCNPJ } from '@/lib/cpfCnpjMask';
import { useInflexConfig } from '@/hooks/useInflexConfig';

interface Correntista {
  id: string;
  cnpj_cpf: string;
  nome: string;
  fantasia?: string;
  email?: string;
  fone?: string;
  pfpj: string;
  cidade?: string;
  estado?: string;
  insc_estadual?: string;
  endereco?: string;
  bairro?: string;
  cep?: string;
}

interface SyncResult {
  success: boolean;
  entity: string;
  processed: number;
  created: number;
  updated: number;
  last_sync_at: string;
}

export function InflexTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [importingIds, setImportingIds] = useState<Set<string>>(new Set());
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const { config, isConfigured } = useInflexConfig();

  // Mutation para sincronização incremental de clientes
  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('sync-iniflex-clients', {
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
      toast.success(`Sincronização concluída: ${data.processed} clientes processados`);
      setLastSyncResult(data);
      // Invalidar cache para atualizar contadores
      queryClient.invalidateQueries({ queryKey: ['crm-clients-external-ids'] });
      queryClient.invalidateQueries({ queryKey: ['iniflex-correntistas'] });
    },
    onError: (error: Error) => {
      toast.error(`Erro na sincronização: ${error.message}`);
    },
  });

  // Buscar correntistas do Iniflex
  const { data: inflexData, isLoading: isLoadingIniflex, refetch: refetchIniflex } = useQuery({
    queryKey: ['iniflex-correntistas', search, config.baseUrl],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('iniflex-list-correntistas', {
        body: { 
          baseUrl: config.baseUrl,
          token: config.token,
          search, 
          page: 1, 
          limit: 100 
        },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Erro ao buscar correntistas');
      return data as { correntistas: Correntista[]; total: number };
    },
    enabled: isConfigured,
  });

  // Buscar contatos e empresas já importados
  const { data: existingContacts } = useQuery({
    queryKey: ['contacts-iniflex-ids'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('iniflex_id, cpf')
        .not('iniflex_id', 'is', null);
      if (error) throw error;
      return new Set(data.map(c => c.iniflex_id));
    },
  });

  const { data: existingCompanies } = useQuery({
    queryKey: ['companies-iniflex-ids'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('iniflex_id, cnpj');
      if (error) throw error;
      return new Set(data.filter(c => c.iniflex_id).map(c => c.iniflex_id));
    },
  });

  // Buscar clientes sincronizados (crm_clients)
  const { data: syncedClients } = useQuery({
    queryKey: ['crm-clients-external-ids'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_clients')
        .select('external_id');
      if (error) throw error;
      return new Set(data.map(c => c.external_id));
    },
  });

  // Mutation para importar correntista
  const importMutation = useMutation({
    mutationFn: async (correntista: Correntista) => {
      setImportingIds(prev => new Set(prev).add(correntista.id));
      const { data, error } = await supabase.functions.invoke('iniflex-import-correntista', {
        body: { correntista },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Erro ao importar');
      return { ...data, correntista };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['contacts-iniflex-ids'] });
      queryClient.invalidateQueries({ queryKey: ['companies-iniflex-ids'] });
      toast.success(
        `${data.type === 'company' ? 'Empresa' : 'Contato'} ${data.action === 'created' ? 'criado' : 'atualizado'}: ${data.correntista.nome}`
      );
      setImportingIds(prev => {
        const next = new Set(prev);
        next.delete(data.correntista.id);
        return next;
      });
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(data.correntista.id);
        return next;
      });
    },
    onError: (error: any, variables) => {
      toast.error(`Erro ao importar ${variables.nome}: ${error.message}`);
      setImportingIds(prev => {
        const next = new Set(prev);
        next.delete(variables.id);
        return next;
      });
    },
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(inflexData?.correntistas.map(c => c.id) || []);
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
    const selected = inflexData?.correntistas.filter(c => selectedIds.has(c.id)) || [];
    for (const correntista of selected) {
      await importMutation.mutateAsync(correntista);
    }
  };

  const isImported = (correntista: Correntista) => {
    // Prioridade: verificar se foi sincronizado via crm_clients
    if (syncedClients?.has(correntista.id)) return true;
    
    // Fallback: verificar importação manual (companies/contacts)
    const isPJ = correntista.pfpj === 'PJ' || correntista.cnpj_cpf?.length > 11;
    if (isPJ) {
      return existingCompanies?.has(correntista.id);
    }
    return existingContacts?.has(correntista.id);
  };

  const formatDocument = (doc: string, pfpj: string) => {
    if (!doc) return '-';
    const isPJ = pfpj === 'PJ' || doc.length > 11;
    return isPJ ? formatCNPJ(doc) : formatCPF(doc);
  };

  const correntistas = inflexData?.correntistas || [];
  const pf = correntistas.filter(c => c.pfpj === 'PF' || (c.cnpj_cpf?.length <= 11));
  const pj = correntistas.filter(c => c.pfpj === 'PJ' || (c.cnpj_cpf?.length > 11));

  const stats = {
    total: correntistas.length,
    pf: pf.length,
    pj: pj.length,
    imported: correntistas.filter(c => isImported(c)).length,
    pending: correntistas.filter(c => !isImported(c)).length,
  };

  return (
    <div className="space-y-6">
      {/* Seção de Sincronização Incremental */}
      <Card className="bg-muted/30 border-primary/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Database className="h-5 w-5" />
                Sincronização de Clientes
              </CardTitle>
              <CardDescription>
                Busca incremental de clientes alterados no ERP Iniflex
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
          ) : lastSyncResult ? (
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
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Importação Manual</h2>
          <p className="text-sm text-muted-foreground">Importe correntistas individualmente do ERP Iniflex</p>
        </div>
        <div className="flex gap-2">
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
          <Button 
            variant="outline" 
            onClick={() => refetchIniflex()}
            disabled={isLoadingIniflex}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoadingIniflex ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total</CardDescription>
            <CardTitle className="text-2xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Users className="h-3 w-3" /> Pessoa Física
            </CardDescription>
            <CardTitle className="text-2xl">{stats.pf}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Building2 className="h-3 w-3" /> Pessoa Jurídica
            </CardDescription>
            <CardTitle className="text-2xl">{stats.pj}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-600" /> Importados
            </CardDescription>
            <CardTitle className="text-2xl text-green-600">{stats.imported}</CardTitle>
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

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar correntistas no Iniflex..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all">
            <TabsList className="mb-4">
              <TabsTrigger value="all">Todos ({stats.total})</TabsTrigger>
              <TabsTrigger value="pf">Pessoa Física ({stats.pf})</TabsTrigger>
              <TabsTrigger value="pj">Pessoa Jurídica ({stats.pj})</TabsTrigger>
              <TabsTrigger value="pending">Pendentes ({stats.pending})</TabsTrigger>
            </TabsList>

            {isLoadingIniflex ? (
              <div className="flex items-center justify-center py-10">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : correntistas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Download className="h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-semibold">Nenhum correntista encontrado</h3>
                <p className="text-muted-foreground">Verifique sua conexão com o ERP Iniflex.</p>
              </div>
            ) : (
              <>
                <TabsContent value="all">
                  <CorrentistasTable 
                    correntistas={correntistas}
                    selectedIds={selectedIds}
                    importingIds={importingIds}
                    isImported={isImported}
                    formatDocument={formatDocument}
                    onSelectAll={handleSelectAll}
                    onSelect={handleSelect}
                    onImport={(c) => importMutation.mutate(c)}
                  />
                </TabsContent>
                <TabsContent value="pf">
                  <CorrentistasTable 
                    correntistas={pf}
                    selectedIds={selectedIds}
                    importingIds={importingIds}
                    isImported={isImported}
                    formatDocument={formatDocument}
                    onSelectAll={handleSelectAll}
                    onSelect={handleSelect}
                    onImport={(c) => importMutation.mutate(c)}
                  />
                </TabsContent>
                <TabsContent value="pj">
                  <CorrentistasTable 
                    correntistas={pj}
                    selectedIds={selectedIds}
                    importingIds={importingIds}
                    isImported={isImported}
                    formatDocument={formatDocument}
                    onSelectAll={handleSelectAll}
                    onSelect={handleSelect}
                    onImport={(c) => importMutation.mutate(c)}
                  />
                </TabsContent>
                <TabsContent value="pending">
                  <CorrentistasTable 
                    correntistas={correntistas.filter(c => !isImported(c))}
                    selectedIds={selectedIds}
                    importingIds={importingIds}
                    isImported={isImported}
                    formatDocument={formatDocument}
                    onSelectAll={handleSelectAll}
                    onSelect={handleSelect}
                    onImport={(c) => importMutation.mutate(c)}
                  />
                </TabsContent>
              </>
            )}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

interface CorrentistasTableProps {
  correntistas: Correntista[];
  selectedIds: Set<string>;
  importingIds: Set<string>;
  isImported: (c: Correntista) => boolean | undefined;
  formatDocument: (doc: string, pfpj: string) => string;
  onSelectAll: (checked: boolean) => void;
  onSelect: (id: string, checked: boolean) => void;
  onImport: (c: Correntista) => void;
}

function CorrentistasTable({
  correntistas,
  selectedIds,
  importingIds,
  isImported,
  formatDocument,
  onSelectAll,
  onSelect,
  onImport,
}: CorrentistasTableProps) {
  const allSelected = correntistas.length > 0 && correntistas.every(c => selectedIds.has(c.id));
  const someSelected = correntistas.some(c => selectedIds.has(c.id)) && !allSelected;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">
            <Checkbox 
              checked={allSelected}
              ref={(el) => {
                if (el) (el as any).indeterminate = someSelected;
              }}
              onCheckedChange={onSelectAll}
            />
          </TableHead>
          <TableHead>Nome</TableHead>
          <TableHead>CPF/CNPJ</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Telefone</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {correntistas.map((correntista) => {
          const imported = isImported(correntista);
          const importing = importingIds.has(correntista.id);
          const isPJ = correntista.pfpj === 'PJ' || correntista.cnpj_cpf?.length > 11;

          return (
            <TableRow key={correntista.id} className={imported ? 'opacity-60' : ''}>
              <TableCell>
                <Checkbox 
                  checked={selectedIds.has(correntista.id)}
                  onCheckedChange={(checked) => onSelect(correntista.id, !!checked)}
                  disabled={imported}
                />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {isPJ ? (
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Users className="h-4 w-4 text-muted-foreground" />
                  )}
                  <div>
                    <p className="font-medium">{correntista.nome}</p>
                    {correntista.fantasia && correntista.fantasia !== correntista.nome && (
                      <p className="text-xs text-muted-foreground">{correntista.fantasia}</p>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <span className="font-mono text-sm">
                  {formatDocument(correntista.cnpj_cpf, correntista.pfpj)}
                </span>
              </TableCell>
              <TableCell>
                <Badge variant={isPJ ? 'default' : 'secondary'}>
                  {isPJ ? 'PJ' : 'PF'}
                </Badge>
              </TableCell>
              <TableCell>{correntista.email || '-'}</TableCell>
              <TableCell>{correntista.fone || '-'}</TableCell>
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
                  onClick={() => onImport(correntista)}
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
  );
}
