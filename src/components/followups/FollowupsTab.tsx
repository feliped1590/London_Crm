import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  MessageSquarePlus,
  Phone,
  Mail,
  MessageCircle,
  Users,
  Video,
  Monitor,
  MoreHorizontal,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';

export type FollowupChannel =
  | 'whatsapp'
  | 'email'
  | 'phone'
  | 'in_person'
  | 'video_conference'
  | 'system'
  | 'other';

const CHANNELS: { value: FollowupChannel; label: string; icon: typeof Phone }[] = [
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { value: 'email', label: 'E-mail', icon: Mail },
  { value: 'phone', label: 'Telefone', icon: Phone },
  { value: 'in_person', label: 'Presencial', icon: Users },
  { value: 'video_conference', label: 'Videoconferência', icon: Video },
  { value: 'system', label: 'Sistema', icon: Monitor },
  { value: 'other', label: 'Outro', icon: MoreHorizontal },
];

interface FollowupsTabProps {
  dealId?: string;
  companyId?: string;
  allowDealPicker?: boolean;
}

type FollowupGroup = {
  id: string;
  name: string;
  color: string | null;
  sort_order: number;
  is_active: boolean;
};

type FollowupSubgroup = {
  id: string;
  group_id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  requires_description: boolean;
};

type DealFollowupRow = {
  id: string;
  deal_id: string | null;
  company_id: string;
  channel: FollowupChannel;
  description: string | null;
  interaction_at: string;
  created_by: string;
  followup_group_id: string;
  followup_subgroup_id: string;
  deleted_at: string | null;
};

export function FollowupsTab({ dealId, companyId, allowDealPicker }: FollowupsTabProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [groupId, setGroupId] = useState<string>('');
  const [subgroupId, setSubgroupId] = useState<string>('');
  const [channel, setChannel] = useState<FollowupChannel>('whatsapp');
  const [description, setDescription] = useState('');
  const [interactionAt, setInteractionAt] = useState(
    () => format(new Date(), "yyyy-MM-dd'T'HH:mm"),
  );
  const [selectedDealId, setSelectedDealId] = useState(dealId || 'none');

  const { data: groups = [], isLoading: loadingGroups } = useQuery({
    queryKey: ['followup_groups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('followup_groups')
        .select('id, name, color, sort_order, is_active')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return (data || []) as FollowupGroup[];
    },
  });

  const { data: subgroups = [] } = useQuery({
    queryKey: ['followup_subgroups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('followup_subgroups')
        .select('id, group_id, name, sort_order, is_active, requires_description')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return (data || []) as FollowupSubgroup[];
    },
  });

  const { data: companyDeals = [] } = useQuery({
    queryKey: ['company_deals_for_followups', companyId],
    enabled: !!companyId && !!allowDealPicker && !dealId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deals')
        .select('id, name, pipeline_stage_id')
        .eq('company_id', companyId!)
        .order('updated_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  const effectiveDealId = dealId || (selectedDealId === 'none' ? null : selectedDealId) || null;

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['deal_followups', dealId || null, companyId || null],
    enabled: !!(dealId || companyId),
    queryFn: async () => {
      let q = supabase
        .from('deal_followups')
        .select(
          'id, deal_id, company_id, channel, description, interaction_at, created_by, followup_group_id, followup_subgroup_id, deleted_at',
        )
        .is('deleted_at', null)
        .order('interaction_at', { ascending: false });
      if (dealId) q = q.eq('deal_id', dealId);
      else if (companyId) q = q.eq('company_id', companyId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as DealFollowupRow[];
    },
  });

  const followupUserIds = useMemo(
    () => [...new Set(rows.map((r) => r.created_by).filter(Boolean))],
    [rows],
  );

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles_min_for_followups', followupUserIds],
    enabled: followupUserIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('user_id, full_name').in('user_id', followupUserIds);
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const filteredSubgroups = useMemo(
    () => subgroups.filter((s) => s.group_id === groupId),
    [subgroups, groupId],
  );

  const selectedSubgroup = filteredSubgroups.find((s) => s.id === subgroupId);
  const groupById = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);
  const subgroupById = useMemo(() => new Map(subgroups.map((s) => [s.id, s])), [subgroups]);
  const profileById = useMemo(
    () => new Map(profiles.map((p) => [p.user_id, p.full_name || 'Usuário'])),
    [profiles],
  );

  const invalidateFollowupViews = () => {
    qc.invalidateQueries({ queryKey: ['deal_followups'] });
    qc.invalidateQueries({ queryKey: ['customer-workspace-timeline'] });
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!effectiveDealId && !companyId) throw new Error('Cliente ou negócio não identificado');
      if (!groupId || !subgroupId) throw new Error('Selecione grupo e subgrupo');
      if (selectedSubgroup?.requires_description && !description.trim()) {
        throw new Error('Descrição obrigatória para este subgrupo');
      }

      const { error } = await supabase.from('deal_followups').insert({
        deal_id: effectiveDealId,
        company_id: companyId || undefined,
        followup_group_id: groupId,
        followup_subgroup_id: subgroupId,
        channel,
        description: description.trim() || null,
        interaction_at: new Date(interactionAt).toISOString(),
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Interação registrada');
      setDescription('');
      setSubgroupId('');
      invalidateFollowupViews();
    },
    onError: (err: Error) => toast.error(err.message || 'Erro ao salvar interação'),
  });

  const softDeleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('deal_followups')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: user?.id,
          deletion_reason: 'Removido pela interface',
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Interação removida');
      invalidateFollowupViews();
    },
    onError: () => toast.error('Erro ao remover interação'),
  });

  if (loadingGroups) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <MessageSquarePlus className="h-4 w-4 text-primary" />
          Nova interação
        </div>

        {allowDealPicker && !dealId && (
          <div className="space-y-1.5">
            <Label>Processo (opcional)</Label>
            <Select value={selectedDealId} onValueChange={setSelectedDealId}>
              <SelectTrigger>
                <SelectValue placeholder="Sem processo vinculado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem processo vinculado</SelectItem>
                {companyDeals.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Grupo</Label>
            <Select
              value={groupId}
              onValueChange={(v) => {
                setGroupId(v);
                setSubgroupId('');
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Subgrupo</Label>
            <Select value={subgroupId} onValueChange={setSubgroupId} disabled={!groupId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {filteredSubgroups.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Canal</Label>
            <Select value={channel} onValueChange={(v) => setChannel(v as FollowupChannel)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHANNELS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Data/hora</Label>
            <Input
              type="datetime-local"
              value={interactionAt}
              onChange={(e) => setInteractionAt(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>
            Descrição
            {selectedSubgroup?.requires_description ? ' *' : ' (opcional)'}
          </Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={5000}
            placeholder="Detalhes da interação..."
          />
        </div>

        <div className="flex justify-end">
          <Button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || !groupId || !subgroupId || (!effectiveDealId && !companyId)}
          >
            Registrar
          </Button>
        </div>
      </Card>

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground">
          Histórico ({rows.length})
        </h3>
        {isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Nenhuma interação registrada ainda.
          </p>
        ) : (
          rows.map((row) => {
            const ch = CHANNELS.find((c) => c.value === row.channel);
            const Icon = ch?.icon || MoreHorizontal;
            const group = groupById.get(row.followup_group_id);
            const subgroup = subgroupById.get(row.followup_subgroup_id);
            return (
              <Card key={row.id} className="p-3 flex gap-3 items-start">
                <div
                  className="mt-0.5 h-8 w-8 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${group?.color || '#64748b'}22` }}
                >
                  <Icon className="h-4 w-4" style={{ color: group?.color || undefined }} />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{group?.name || 'Grupo'}</Badge>
                    <span className="text-sm font-medium">{subgroup?.name || 'Subgrupo'}</span>
                    <Badge variant="outline">{ch?.label || row.channel}</Badge>
                  </div>
                  {row.description && (
                    <p className="text-sm whitespace-pre-wrap">{row.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(row.interaction_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    {' · '}
                    {profileById.get(row.created_by) || 'Usuário'}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => softDeleteMutation.mutate(row.id)}
                  disabled={softDeleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
