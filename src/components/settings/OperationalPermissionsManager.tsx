import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { OPERATIONAL_DEPARTMENTS, DEPARTMENT_LABEL, type OperationalDepartment } from '@/lib/operationalConstants';
import { ASSIGNABLE_ROLES, ROLE_LABELS, type AppRole } from '@/lib/roles';
import { useOperationalPipelines } from '@/hooks/useOperationalPipelines';
import { Plus, Trash2, Eye, ArrowRightLeft } from 'lucide-react';
import { toast } from 'sonner';

interface PermRow {
  id: string;
  pipeline_id: string;
  department: string;
  role: string;
  access_level: 'move' | 'observe';
}

export function OperationalPermissionsManager() {
  const qc = useQueryClient();
  const { pipelines } = useOperationalPipelines();
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const [dept, setDept] = useState<OperationalDepartment>('PCP');
  const [role, setRole] = useState<AppRole | null>(null);
  const [level, setLevel] = useState<'move' | 'observe'>('move');

  const { data: rows = [] } = useQuery({
    queryKey: ['osp_admin', pipelineId],
    queryFn: async () => {
      if (!pipelineId) return [] as PermRow[];
      const { data, error } = await supabase
        .from('operational_stage_permissions')
        .select('*')
        .eq('pipeline_id', pipelineId)
        .order('department');
      if (error) throw error;
      return (data ?? []) as PermRow[];
    },
    enabled: !!pipelineId,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!pipelineId || !role) throw new Error('Selecione pipeline e papel');
      const { data: pipe } = await supabase
        .from('pipelines')
        .select('id, legal_entity_id')
        .eq('id', pipelineId)
        .maybeSingle();
      const userId = (await supabase.auth.getUser()).data.user?.id;
      if (!userId) throw new Error('Sessão expirada');
      const { data: tenant } = await supabase.rpc('get_user_tenant_ids', { p_user_id: userId });
      const tenantId = Array.isArray(tenant) ? tenant[0] : tenant;
      const { error } = await supabase.from('operational_stage_permissions').insert({
        pipeline_id: pipelineId,
        department: dept,
        role,
        access_level: level,
        tenant_id: tenantId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['osp_admin', pipelineId] });
      qc.invalidateQueries({ queryKey: ['operational_stage_permissions'] });
      toast.success('Permissão adicionada');
    },
    onError: (e: any) => toast.error(e?.message ?? 'Erro'),
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('operational_stage_permissions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['osp_admin', pipelineId] });
      qc.invalidateQueries({ queryKey: ['operational_stage_permissions'] });
      toast.success('Permissão removida');
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Permissões operacionais</h2>
        <p className="text-sm text-muted-foreground">
          Defina quem pode mover cards (mover) ou apenas visualizar (observador) por departamento em
          cada pipeline operacional. Admin e Desenvolvedor sempre têm acesso completo.
        </p>
      </div>

      <Card className="p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
          <Select value={pipelineId ?? undefined} onValueChange={setPipelineId}>
            <SelectTrigger><SelectValue placeholder="Pipeline operacional" /></SelectTrigger>
            <SelectContent>
              {pipelines.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={dept} onValueChange={(v) => setDept(v as OperationalDepartment)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {OPERATIONAL_DEPARTMENTS.map(d => (
                <SelectItem key={d} value={d}>{DEPARTMENT_LABEL[d]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={role ?? undefined} onValueChange={(v) => setRole(v as AppRole)}>
            <SelectTrigger><SelectValue placeholder="Papel" /></SelectTrigger>
            <SelectContent>
              {ASSIGNABLE_ROLES.map(r => (
                <SelectItem key={r.role} value={r.role}>{ROLE_LABELS[r.role]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={level} onValueChange={(v) => setLevel(v as 'move' | 'observe')}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="move">Mover</SelectItem>
              <SelectItem value="observe">Observador</SelectItem>
            </SelectContent>
          </Select>

          <Button onClick={() => addMutation.mutate()} disabled={!pipelineId || !role || addMutation.isPending}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar
          </Button>
        </div>
      </Card>

      <Card className="p-4">
        {!pipelineId && <p className="text-sm text-muted-foreground">Selecione um pipeline para listar permissões.</p>}
        {pipelineId && rows.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhuma permissão configurada — etapas sem departamento ficam liberadas; etapas com
            departamento exigem permissão explícita (admin/dev sempre liberados).
          </p>
        )}
        <div className="space-y-2">
          {rows.map(r => (
            <div key={r.id} className="flex items-center justify-between border rounded p-2 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{DEPARTMENT_LABEL[r.department as OperationalDepartment] ?? r.department}</Badge>
                <span>{ROLE_LABELS[r.role as AppRole] ?? r.role}</span>
                <Badge variant={r.access_level === 'move' ? 'default' : 'secondary'} className="text-[10px]">
                  {r.access_level === 'move'
                    ? <><ArrowRightLeft className="h-3 w-3 mr-1 inline" />Mover</>
                    : <><Eye className="h-3 w-3 mr-1 inline" />Observador</>}
                </Badge>
              </div>
              <Button variant="ghost" size="icon" onClick={() => removeMutation.mutate(r.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
