import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Clock, Database, ArrowRight } from 'lucide-react';

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

export function CompanyAuditHistory({ companyId, isErpCustomer = false }: CompanyAuditHistoryProps) {
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

  // Fetch user profiles for display names
  const { data: profiles } = useQuery({
    queryKey: ['profiles-for-audit', auditLogs?.map(l => l.changed_by).filter(Boolean)],
    queryFn: async () => {
      const userIds = auditLogs?.map(l => l.changed_by).filter(Boolean) as string[];
      if (!userIds.length) return {};

      const { data } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds);

      return (data || []).reduce((acc, p) => {
        acc[p.user_id] = p.full_name;
        return acc;
      }, {} as Record<string, string>);
    },
    enabled: !!auditLogs?.length,
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatValue = (value: string | null, fieldName: string): string => {
    if (value === null || value === '') return '(vazio)';
    
    if (fieldName === 'active') {
      return value;
    }
    
    // Truncate long values
    if (value.length > 50) {
      return value.substring(0, 50) + '...';
    }
    
    return value;
  };

  if (isErpCustomer) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Alterações</CardTitle>
          <CardDescription>
            Registro de alterações em campos críticos do cadastro
          </CardDescription>
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
        <CardHeader>
          <CardTitle>Histórico de Alterações</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico de Alterações</CardTitle>
        <CardDescription>
          Registro de alterações em campos críticos: segmento, responsável, status e matriz
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!auditLogs?.length ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Clock className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">Nenhuma alteração registrada</h3>
            <p className="text-muted-foreground">
              Alterações em campos críticos aparecerão aqui.
            </p>
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
              {auditLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {formatDate(log.changed_at)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{log.field_label}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground line-through">
                        {formatValue(log.old_value, log.field_name)}
                      </span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium">
                        {formatValue(log.new_value, log.field_name)}
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
  );
}
