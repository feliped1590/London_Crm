import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Shield, ChevronDown, ChevronUp, Search, FileText, RefreshCw } from 'lucide-react';

type InterventionLog = {
  id: string;
  admin_user_id: string;
  action_type: string;
  entity_type: string;
  entity_id: string;
  entity_name: string | null;
  client_id: string | null;
  client_name: string | null;
  client_owner_id: string | null;
  client_owner_name: string | null;
  justification: string;
  details: Record<string, unknown>;
  created_at: string;
  admin_profile?: { full_name: string } | null;
};

const actionTypeLabels: Record<string, string> = {
  CREATE_DEAL: 'Criar Negócio',
  UPDATE_DEAL: 'Editar Negócio',
  MOVE_STAGE: 'Mover Etapa',
  CREATE_TASK: 'Criar Tarefa',
  UPDATE_TASK: 'Editar Tarefa',
  CREATE_ORDER: 'Criar Pedido',
  UPDATE_ORDER: 'Editar Pedido',
};

const entityTypeLabels: Record<string, string> = {
  deal: 'Negócio',
  task: 'Tarefa',
  order: 'Pedido',
};

export function AdminInterventionsViewer() {
  const [search, setSearch] = useState('');
  const [actionTypeFilter, setActionTypeFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const { data: interventions, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin_interventions', search, actionTypeFilter, dateFrom, dateTo],
    queryFn: async () => {
      let query = supabase
        .from('admin_intervention_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (actionTypeFilter !== 'all') {
        query = query.eq('action_type', actionTypeFilter);
      }

      if (dateFrom) {
        query = query.gte('created_at', dateFrom);
      }

      if (dateTo) {
        query = query.lte('created_at', `${dateTo}T23:59:59`);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch admin profiles
      const adminIds = [...new Set(data?.map(d => d.admin_user_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', adminIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      return (data || []).map(log => ({
        ...log,
        admin_profile: profileMap.get(log.admin_user_id) || null,
      })) as InterventionLog[];
    },
  });

  const filteredInterventions = interventions?.filter(log => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      log.client_name?.toLowerCase().includes(searchLower) ||
      log.entity_name?.toLowerCase().includes(searchLower) ||
      log.admin_profile?.full_name?.toLowerCase().includes(searchLower) ||
      log.justification.toLowerCase().includes(searchLower)
    );
  });

  const handleRefresh = () => {
    refetch();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-amber-500" />
            <div>
              <CardTitle>Intervenções Administrativas</CardTitle>
              <CardDescription>
                Histórico de ações realizadas por administradores em clientes de outros vendedores
              </CardDescription>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isFetching}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={actionTypeFilter} onValueChange={setActionTypeFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Tipo de Ação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {Object.entries(actionTypeLabels).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div>
            <Input
              type="date"
              placeholder="Data inicial"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div>
            <Input
              type="date"
              placeholder="Data final"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
        </div>

        {/* Results */}
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : filteredInterventions?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">Nenhuma intervenção encontrada</h3>
            <p className="text-muted-foreground">
              Não há registros de intervenções administrativas com os filtros aplicados.
            </p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">Data/Hora</TableHead>
                  <TableHead>Administrador</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Responsável Original</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInterventions?.map((log) => (
                  <Collapsible key={log.id} asChild open={expandedRow === log.id}>
                    <>
                      <TableRow className="cursor-pointer hover:bg-muted/50">
                        <TableCell className="font-mono text-sm">
                          {format(new Date(log.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          {log.admin_profile?.full_name || 'Desconhecido'}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge variant="outline" className="w-fit">
                              {actionTypeLabels[log.action_type] || log.action_type}
                            </Badge>
                            {log.entity_name && (
                              <span className="text-xs text-muted-foreground">
                                {log.entity_name}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {log.client_name || '-'}
                        </TableCell>
                        <TableCell>
                          {log.client_owner_name || '-'}
                        </TableCell>
                        <TableCell>
                          <CollapsibleTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setExpandedRow(expandedRow === log.id ? null : log.id)}
                            >
                              {expandedRow === log.id ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </CollapsibleTrigger>
                        </TableCell>
                      </TableRow>
                      <CollapsibleContent asChild>
                        <TableRow className="bg-muted/30">
                          <TableCell colSpan={6} className="py-4">
                            <div className="space-y-2">
                              <div>
                                <Label className="text-xs font-medium">Justificativa:</Label>
                                <p className="text-sm mt-1 p-3 bg-background rounded-md border">
                                  {log.justification}
                                </p>
                              </div>
                              {log.details && Object.keys(log.details).length > 0 && (
                                <div>
                                  <Label className="text-xs font-medium">Detalhes Adicionais:</Label>
                                  <pre className="text-xs mt-1 p-3 bg-background rounded-md border overflow-x-auto">
                                    {JSON.stringify(log.details, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      </CollapsibleContent>
                    </>
                  </Collapsible>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
