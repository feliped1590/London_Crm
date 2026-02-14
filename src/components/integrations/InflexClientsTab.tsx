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
  Database,
  AlertTriangle,
  History,
  Clock,
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
  companies_inserted?: number;
  companies_updated?: number;
  conflicts_detected?: number;
  conflicts_auto_resolved?: number;
  last_sync_at: string;
}

interface SyncLogEntry {
  id: string;
  entity_type: string;
  status: string;
  created_at: string;
  response_payload: {
    created?: number;
    updated?: number;
    companies_inserted?: number;
    companies_updated?: number;
    conflicts_detected?: number;
    conflicts_auto_resolved?: number;
  } | null;
}

interface ConflictEntry {
  id: string;
  entity_type: string;
  erp_code: string | null;
  field_name: string;
  crm_value: string | null;
  erp_value: string | null;
  auto_resolved: boolean;
  resolution: string;
  created_at: string;
}

export function InflexClientsTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [importingIds, setImportingIds] = useState<Set<string>>(new Set());
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const { config, isConfigured } = useInflexConfig();

  // Query para última sincronização
  const { data: syncControl } = useQuery({
    queryKey: ['erp-sync-control-clientes'],
    queryFn: async () => {
      const { data } = await supabase
        .from('erp_sync_control')
        .select('last_sync_at, last_sync_count')
        .eq('entity', 'clientes')
        .maybeSingle();
      return data;
    },
  });

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
      const parts = [`${data.processed} clientes processados`];
      if (data.companies_inserted) parts.push(`${data.companies_inserted} empresas criadas`);
      if (data.companies_updated) parts.push(`${data.companies_updated} empresas atualizadas`);
      if (data.conflicts_detected) parts.push(`${data.conflicts_detected} conflitos`);
      toast.success(`Sincronização concluída: ${parts.join(', ')}`);
      setLastSyncResult(data);
      queryClient.invalidateQueries({ queryKey: ['crm-clients-external-ids'] });
      queryClient.invalidateQueries({ queryKey: ['iniflex-correntistas'] });
      queryClient.invalidateQueries({ queryKey: ['erp-sync-control-clientes'] });
      queryClient.invalidateQueries({ queryKey: ['erp-sync-logs'] });
      queryClient.invalidateQueries({ queryKey: ['erp-conflicts'] });
    },
    onError: (error: Error) => {
      toast.error(`Erro na sincronização: ${error.message}`);
    },
  });

  // Query para histórico de sincronizações
  const { data: syncLogs } = useQuery({
    queryKey: ['erp-sync-logs'],
    queryFn: async () => {
      const { data } = await supabase
        .from('erp_sync_logs')
        .select('id, entity_type, status, created_at, response_payload')
        .eq('entity_type', 'sync_clients')
        .order('created_at', { ascending: false })
        .limit(10);
      return (data || []) as unknown as SyncLogEntry[];
    },
  });

  // Query para conflitos pendentes
  const { data: pendingConflicts } = useQuery({
    queryKey: ['erp-conflicts'],
    queryFn: async () => {
      const { data } = await supabase
        .from('import_conflict_log')
        .select('id, entity_type, erp_code, field_name, crm_value, erp_value, auto_resolved, resolution, created_at')
        .eq('resolution', 'pending')
        .order('created_at', { ascending: false })
        .limit(50);
      return (data || []) as unknown as ConflictEntry[];
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

  // Buscar contatos já importados (por iniflex_id e CPF)
  const { data: existingContacts } = useQuery({
    queryKey: ['contacts-iniflex-ids'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('iniflex_id, cpf');
      if (error) throw error;
      const ids = new Set<string>();
      data.forEach(c => {
        if (c.iniflex_id) ids.add(String(c.iniflex_id));
        if (c.cpf) ids.add(c.cpf.replace(/\D/g, ''));
      });
      return ids;
    },
  });

  // Buscar empresas já importadas (por iniflex_id e CNPJ)
  const { data: existingCompanies } = useQuery({
    queryKey: ['companies-iniflex-ids'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('iniflex_id, cnpj');
      if (error) throw error;
      const ids = new Set<string>();
      data.forEach(c => {
        if (c.iniflex_id) ids.add(String(c.iniflex_id));
        if (c.cnpj) ids.add(c.cnpj.replace(/\D/g, ''));
      });
      return ids;
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
    if (syncedClients?.has(correntista.id)) return true;
    
    const cleanDoc = correntista.cnpj_cpf?.replace(/\D/g, '') || '';
    const isPJ = correntista.pfpj === 'PJ' || cleanDoc.length > 11;
    
    if (isPJ) {
      return existingCompanies?.has(correntista.id) || existingCompanies?.has(cleanDoc);
    }
    return existingContacts?.has(correntista.id) || existingContacts?.has(cleanDoc);
  };

  const formatDocument = (doc: string, pfpj: string) => {
    if (!doc) return '-';
    const isPJ = pfpj === 'PJ' || doc.length > 11;
    return isPJ ? formatCNPJ(doc) : formatCPF(doc);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '-';
    }
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
      {/* Painel de Monitoramento de Sincronização */}
      <Card className="bg-muted/30 border-primary/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Database className="h-5 w-5" />
                Sincronização Contínua
              </CardTitle>
              <CardDescription>
                Sincronização incremental via <code className="text-xs">erp_last_update_date</code> — detecta e registra conflitos automaticamente
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
              Sincronizar Agora
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isConfigured ? (
            <p className="text-sm text-muted-foreground">
              Configure URL e Token na aba <strong>Sandbox</strong> para habilitar a sincronização.
            </p>
          ) : (
            <>
              {lastSyncResult ? (
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="gap-1">
                    <Database className="h-3 w-3" />
                    CRM: {lastSyncResult.processed} processados
                  </Badge>
                  <Badge variant="secondary" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Criados: {lastSyncResult.created}
                  </Badge>
                  <Badge variant="secondary" className="gap-1">
                    <RefreshCw className="h-3 w-3" />
                    Atualizados: {lastSyncResult.updated}
                  </Badge>
                  {(lastSyncResult.companies_inserted || 0) > 0 && (
                    <Badge variant="secondary" className="gap-1">
                      <Building2 className="h-3 w-3" />
                      Empresas +{lastSyncResult.companies_inserted}
                    </Badge>
                  )}
                  {(lastSyncResult.companies_updated || 0) > 0 && (
                    <Badge variant="secondary" className="gap-1">
                      <Building2 className="h-3 w-3" />
                      Empresas ↻{lastSyncResult.companies_updated}
                    </Badge>
                  )}
                  {(lastSyncResult.conflicts_detected || 0) > 0 && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {lastSyncResult.conflicts_detected} conflitos ({lastSyncResult.conflicts_auto_resolved} auto)
                    </Badge>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhuma sincronização realizada nesta sessão.
                </p>
              )}

              {syncControl?.last_sync_at && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Última sincronização: {formatDate(syncControl.last_sync_at)}
                  {syncControl.last_sync_count != null && ` (${syncControl.last_sync_count} registros)`}
                </p>
              )}

              {/* Tabs de monitoramento */}
              <Tabs defaultValue="conflicts" className="mt-4">
                <TabsList>
                  <TabsTrigger value="conflicts" className="gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Conflitos ({pendingConflicts?.length || 0})
                  </TabsTrigger>
                  <TabsTrigger value="history" className="gap-1">
                    <History className="h-3 w-3" />
                    Histórico
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="conflicts">
                  {!pendingConflicts?.length ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">Nenhum conflito pendente.</p>
                  ) : (
                    <div className="max-h-64 overflow-auto rounded border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Código ERP</TableHead>
                            <TableHead>Campo</TableHead>
                            <TableHead>Valor CRM</TableHead>
                            <TableHead>Valor ERP</TableHead>
                            <TableHead>Data</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pendingConflicts.map((c) => (
                            <TableRow key={c.id}>
                              <TableCell className="font-mono text-xs">{c.erp_code || '-'}</TableCell>
                              <TableCell><Badge variant="outline" className="text-xs">{c.field_name}</Badge></TableCell>
                              <TableCell className="text-xs max-w-[150px] truncate">{c.crm_value || <span className="text-muted-foreground italic">vazio</span>}</TableCell>
                              <TableCell className="text-xs max-w-[150px] truncate font-medium">{c.erp_value}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{formatDate(c.created_at)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="history">
                  {!syncLogs?.length ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">Nenhum registro encontrado.</p>
                  ) : (
                    <div className="max-h-64 overflow-auto rounded border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Data</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>CRM +</TableHead>
                            <TableHead>CRM ↻</TableHead>
                            <TableHead>Empresas</TableHead>
                            <TableHead>Conflitos</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {syncLogs.map((log) => {
                            const rp = log.response_payload;
                            return (
                              <TableRow key={log.id}>
                                <TableCell className="text-xs">{formatDate(log.created_at)}</TableCell>
                                <TableCell>
                                  <Badge variant={log.status === 'success' ? 'secondary' : 'destructive'} className="text-xs">
                                    {log.status === 'success' ? 'OK' : log.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs">{rp?.created ?? '-'}</TableCell>
                                <TableCell className="text-xs">{rp?.updated ?? '-'}</TableCell>
                                <TableCell className="text-xs">
                                  {(rp?.companies_inserted || 0) + (rp?.companies_updated || 0) > 0
                                    ? `+${rp?.companies_inserted || 0}/↻${rp?.companies_updated || 0}` : '-'}
                                </TableCell>
                                <TableCell className="text-xs">
                                  {(rp?.conflicts_detected || 0) > 0
                                    ? `${rp?.conflicts_detected} (${rp?.conflicts_auto_resolved || 0} auto)` : '-'}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </>
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
