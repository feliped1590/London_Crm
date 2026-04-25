import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileText, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Tables } from '@/integrations/supabase/types';
import { ROLE_LABELS, type AppRole } from '@/lib/roles';

type PermissionChange = Tables<'user_permission_changes'> & {
  changed_by_name?: string | null;
  module_name?: string | null;
};

const actionLabels: Record<string, string> = {
  view: 'Visualizar',
  create: 'Criar',
  edit: 'Editar',
  delete: 'Excluir',
};

const valueLabel = (value: boolean | null) => {
  if (value === null) return '—';
  return value ? 'Permitido' : 'Bloqueado';
};

export function PermissionAuditViewer() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const { data: changes, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['user_permission_changes', roleFilter],
    queryFn: async () => {
      let query = supabase
        .from('user_permission_changes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(150);

      if (roleFilter !== 'all') query = query.eq('target_role', roleFilter as AppRole);

      const { data, error } = await query;
      if (error) throw error;

      const userIds = [...new Set((data || []).map((item) => item.changed_by).filter(Boolean))] as string[];
      const moduleIds = [...new Set((data || []).map((item) => item.module_id).filter(Boolean))] as string[];

      const [{ data: profiles }, { data: modules }] = await Promise.all([
        userIds.length > 0
          ? supabase.from('profiles').select('user_id, full_name').in('user_id', userIds)
          : Promise.resolve({ data: [] }),
        moduleIds.length > 0
          ? supabase.from('system_modules').select('id, name').in('id', moduleIds)
          : Promise.resolve({ data: [] }),
      ]);

      const profileMap = new Map((profiles || []).map((profile) => [profile.user_id, profile.full_name]));
      const moduleMap = new Map((modules || []).map((module) => [module.id, module.name]));

      return (data || []).map((item) => ({
        ...item,
        changed_by_name: item.changed_by ? profileMap.get(item.changed_by) ?? null : null,
        module_name: item.module_id ? moduleMap.get(item.module_id) ?? null : null,
      })) as PermissionChange[];
    },
  });

  const filteredChanges = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return changes || [];
    return (changes || []).filter((item) => [
      item.changed_by_name,
      item.module_name,
      item.module_key,
      item.target_role,
      item.action,
    ].some((value) => String(value || '').toLowerCase().includes(normalized)));
  }, [changes, search]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Auditoria de Permissões</CardTitle>
              <CardDescription>Histórico de alterações por perfil, módulo e ação</CardDescription>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-[1fr_220px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-10" placeholder="Buscar por usuário, módulo ou ação..." value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger><SelectValue placeholder="Perfil" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os perfis</SelectItem>
              {Object.entries(ROLE_LABELS).map(([role, label]) => (
                <SelectItem key={role} value={role}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : filteredChanges.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">Nenhuma alteração encontrada</h3>
            <p className="text-muted-foreground">Não há registros de permissões para os filtros aplicados.</p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">Data/Hora</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Módulo</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Antes</TableHead>
                  <TableHead>Depois</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredChanges.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-sm">{format(new Date(item.created_at), 'dd/MM/yy HH:mm', { locale: ptBR })}</TableCell>
                    <TableCell>{item.changed_by_name || 'Sistema'}</TableCell>
                    <TableCell>{item.target_role ? ROLE_LABELS[item.target_role] : '—'}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{item.module_name || item.module_key || '—'}</span>
                        {item.module_key && <span className="text-xs text-muted-foreground">{item.module_key}</span>}
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline">{item.action ? actionLabels[item.action] || item.action : '—'}</Badge></TableCell>
                    <TableCell><Badge variant="secondary">{valueLabel(item.old_value)}</Badge></TableCell>
                    <TableCell><Badge variant={item.new_value ? 'default' : 'destructive'}>{valueLabel(item.new_value)}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}