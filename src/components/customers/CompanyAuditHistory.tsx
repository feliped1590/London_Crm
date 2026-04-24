import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Clock, Database, ArrowRight, ArrowLeftRight } from 'lucide-react';

interface CompanyAuditHistoryProps {
  companyId: string;
  isErpCustomer?: boolean;
}

interface AuditLogEntry {
  id: string;
  field_name: string;
  field_label: string;
  old_value: string | null;
  new_value: string | null;
  changed_by: string | null;
  changed_at: string;
}

interface CompanyCreationInfo {
  id: string;
  name: string;
  created_at: string;
  created_by: string | null;
}

export function CompanyAuditHistory({ companyId, isErpCustomer = false }: CompanyAuditHistoryProps) {
  const { data: companyInfo } = useQuery({
    queryKey: ['company-creation-info', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, created_at, created_by')
        .eq('id', companyId)
        .single();

      if (error) throw error;
      return data as CompanyCreationInfo;
    },
    enabled: !isErpCustomer && !!companyId,
  });

  const { data: auditLogs, isLoading } = useQuery({
    queryKey: ['company-audit-log', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_audit_log')
        .select('*')
        .eq('company_id', companyId)
        .order('changed_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as AuditLogEntry[];
    },
    enabled: !isErpCustomer && !!companyId,
  });

  // Fetch transfer history from portfolio_transfers
  const { data: transferHistory = [] } = useQuery({
    queryKey: ['company-transfer-history', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('portfolio_transfers')
        .select('*')
        .eq('entity_id', companyId)
        .eq('entity_type', 'company')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });

  // Collect all UUIDs that need profile resolution
  const allUserIds = React.useMemo(() => {
    if (!auditLogs?.length && !transferHistory.length && !companyInfo?.created_by) return [];
    const ids = new Set<string>();
    if (companyInfo?.created_by) ids.add(companyInfo.created_by);
    auditLogs?.forEach(log => {
      if (log.changed_by) ids.add(log.changed_by);
      if (log.field_name === 'owner_id') {
        if (log.old_value) ids.add(log.old_value);
        if (log.new_value) ids.add(log.new_value);
      }
    });
    transferHistory.forEach((t: any) => {
      if (t.transferred_by) ids.add(t.transferred_by);
      if (t.requested_by) ids.add(t.requested_by);
      if (t.approved_by) ids.add(t.approved_by);
      if (t.from_user_id) ids.add(t.from_user_id);
      if (t.to_user_id) ids.add(t.to_user_id);
    });
    return Array.from(ids);
  }, [auditLogs, transferHistory, companyInfo]);

  // Collect sales rep IDs from transfers
  const salesRepIds = React.useMemo(() => {
    const ids = new Set<string>();
    transferHistory.forEach((t: any) => {
      if (t.from_sales_rep_id) ids.add(t.from_sales_rep_id);
      if (t.to_sales_rep_id) ids.add(t.to_sales_rep_id);
    });
    return Array.from(ids);
  }, [transferHistory]);

  const { data: profiles } = useQuery({
    queryKey: ['profiles-for-audit', allUserIds],
    queryFn: async () => {
      if (!allUserIds.length) return {};
      const { data } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', allUserIds);
      return (data || []).reduce((acc, p) => {
        acc[p.user_id] = p.full_name;
        return acc;
      }, {} as Record<string, string>);
    },
    enabled: allUserIds.length > 0,
  });

  const { data: salesRepsMap } = useQuery({
    queryKey: ['sales-reps-for-audit', salesRepIds],
    queryFn: async () => {
      if (!salesRepIds.length) return {};
      const { data } = await supabase
        .from('sales_reps')
        .select('id, name')
        .in('id', salesRepIds);
      return (data || []).reduce((acc, sr) => {
        acc[sr.id] = sr.name;
        return acc;
      }, {} as Record<string, string>);
    },
    enabled: salesRepIds.length > 0,
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const formatValue = (value: string | null, fieldName: string, profilesMap?: Record<string, string>): string => {
    if (value === null || value === '') return '(vazio)';
    if (fieldName === 'owner_id' && profilesMap) return profilesMap[value] || value;
    if (value.length > 50) return value.substring(0, 50) + '...';
    return value;
  };

  const displayedAuditLogs = React.useMemo<AuditLogEntry[]>(() => {
    const logs = auditLogs || [];
    if (!companyInfo) return logs;

    const hasCreationEntry = logs.some((log) => log.field_name === 'created' || log.field_label.toLowerCase().includes('criado'));
    if (hasCreationEntry) return logs;

    return [
      {
        id: `company-created-${companyInfo.id}`,
        field_name: 'created',
        field_label: 'Cliente criado',
        old_value: null,
        new_value: companyInfo.name,
        changed_by: companyInfo.created_by,
        changed_at: companyInfo.created_at,
      },
      ...logs,
    ].sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime());
  }, [auditLogs, companyInfo]);

  if (isErpCustomer) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Alterações</CardTitle>
          <CardDescription>Registro de alterações em campos críticos do cadastro</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Database className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">Histórico não disponível</h3>
            <p className="text-muted-foreground max-w-md">
              O histórico de alterações não está disponível para clientes sincronizados do ERP.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>Histórico de Alterações</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Transfer History */}
      {transferHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5" />
              Histórico de Carteira
            </CardTitle>
            <CardDescription>Registro de transferências de carteira deste cliente</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {transferHistory.map((transfer: any) => {
                const fromRep = salesRepsMap?.[transfer.from_sales_rep_id] || transfer.from_sales_rep_id;
                const toRep = salesRepsMap?.[transfer.to_sales_rep_id] || transfer.to_sales_rep_id;
                const approver = profiles?.[transfer.approved_by] || profiles?.[transfer.transferred_by] || 'Sistema';
                const requester = profiles?.[transfer.requested_by];

                return (
                  <div key={transfer.id} className="flex gap-3 p-3 rounded-lg border bg-muted/20">
                    <div className="flex-shrink-0 mt-1">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <ArrowLeftRight className="h-4 w-4 text-primary" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-foreground">Transferência de carteira</span>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(transfer.created_at)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Badge variant="outline" className="text-xs">{fromRep || '?'}</Badge>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <Badge variant="default" className="text-xs">{toRep || '?'}</Badge>
                      </div>
                      {transfer.reason && (
                        <p className="text-sm text-muted-foreground mt-1">
                          <span className="font-medium">Motivo:</span> {transfer.reason}
                        </p>
                      )}
                      <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                        {requester && <span>Solicitado por: {requester}</span>}
                        <span>Aprovado por: {approver}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Audit Log */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Alterações</CardTitle>
          <CardDescription>
            Registro de alterações em campos críticos: segmento, responsável, status e matriz
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!displayedAuditLogs.length ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Clock className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">Nenhuma alteração registrada</h3>
              <p className="text-muted-foreground">Alterações em campos críticos aparecerão aqui.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Campo</TableHead>
                  <TableHead>Alteração</TableHead>
                  <TableHead>Usuário</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedAuditLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {formatDate(log.changed_at)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{log.field_label}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm">
                        {log.old_value && (
                          <>
                            <span className="text-muted-foreground line-through">
                              {formatValue(log.old_value, log.field_name, profiles)}
                            </span>
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          </>
                        )}
                        <span className="font-medium">
                          {formatValue(log.new_value, log.field_name, profiles)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {profiles?.[log.changed_by || ''] || 'Sistema'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
