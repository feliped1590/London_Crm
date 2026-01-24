import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowRight, Clock, User, Edit2, DollarSign, Calendar, Building2, Users, FileText, UserCheck } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency } from '@/lib/formatters';

interface DealHistoryTabProps {
  dealId: string;
}

type DealStage = 'prospeccao' | 'qualificacao' | 'proposta' | 'negociacao' | 'fechado_ganho' | 'fechado_perdido';

const stageConfig: Record<DealStage, { label: string; color: string }> = {
  prospeccao: { label: 'Prospecção', color: 'bg-slate-500' },
  qualificacao: { label: 'Qualificação', color: 'bg-blue-500' },
  proposta: { label: 'Proposta', color: 'bg-yellow-500' },
  negociacao: { label: 'Negociação', color: 'bg-orange-500' },
  fechado_ganho: { label: 'Fechado (Ganho)', color: 'bg-green-500' },
  fechado_perdido: { label: 'Fechado (Perdido)', color: 'bg-red-500' },
};

const fieldIcons: Record<string, React.ElementType> = {
  name: FileText,
  value: DollarSign,
  expected_close_date: Calendar,
  company_id: Building2,
  contact_id: Users,
  notes: Edit2,
  owner_id: UserCheck,
  probability: DollarSign,
  lost_reason: FileText,
};

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}min`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  const days = Math.floor(seconds / 86400);
  return `${days} dia${days > 1 ? 's' : ''}`;
}

export function DealHistoryTab({ dealId }: DealHistoryTabProps) {
  // Stage history
  const { data: stageHistory, isLoading: isLoadingStages } = useQuery({
    queryKey: ['deal_stage_history', dealId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deal_stage_history')
        .select('*')
        .eq('deal_id', dealId)
        .order('changed_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!dealId,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // Audit log - fetch separately and join manually to avoid Supabase FK join issues
  const { data: auditLog, isLoading: isLoadingAudit } = useQuery({
    queryKey: ['deal_audit_log', dealId],
    queryFn: async () => {
      // Get audit logs
      const { data: auditData, error: auditError } = await supabase
        .from('deal_audit_log')
        .select('*')
        .eq('deal_id', dealId)
        .order('changed_at', { ascending: false });
      if (auditError) throw auditError;
      
      // Get profiles for joining
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name');
      if (profilesError) throw profilesError;
      
      // Manually join profiles
      const auditWithProfiles = auditData.map(entry => ({
        ...entry,
        profiles: {
          full_name: profilesData.find(p => p.user_id === entry.changed_by)?.full_name || null
        }
      }));
      
      return auditWithProfiles;
    },
    enabled: !!dealId,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // Get company/contact names for display
  const { data: companies } = useQuery({
    queryKey: ['companies_for_audit'],
    queryFn: async () => {
      const { data, error } = await supabase.from('companies').select('id, name');
      if (error) throw error;
      return data;
    },
  });

  const { data: contacts } = useQuery({
    queryKey: ['contacts_for_audit'],
    queryFn: async () => {
      const { data, error } = await supabase.from('contacts').select('id, first_name, last_name');
      if (error) throw error;
      return data;
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ['profiles_for_audit'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('user_id, full_name');
      if (error) throw error;
      return data;
    },
  });

  const isLoading = isLoadingStages || isLoadingAudit;

  const formatFieldValue = (fieldName: string, value: string | null) => {
    if (!value) return <span className="text-muted-foreground italic">vazio</span>;

    switch (fieldName) {
      case 'value':
        return formatCurrency(parseFloat(value) || 0);
      case 'expected_close_date':
        return format(new Date(value), 'dd/MM/yyyy', { locale: ptBR });
      case 'company_id':
        const company = companies?.find((c) => c.id === value);
        return company?.name || value;
      case 'contact_id':
        const contact = contacts?.find((c) => c.id === value);
        return contact ? `${contact.first_name} ${contact.last_name || ''}`.trim() : value;
      case 'owner_id':
        const profile = profiles?.find((p) => p.user_id === value);
        return profile?.full_name || value;
      case 'probability':
        return `${value}%`;
      default:
        return value.length > 50 ? `${value.substring(0, 50)}...` : value;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const hasStageHistory = stageHistory && stageHistory.length > 0;
  const hasAuditLog = auditLog && auditLog.length > 0;

  if (!hasStageHistory && !hasAuditLog) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>Nenhum histórico registrado ainda.</p>
        <p className="text-sm mt-1">O histórico aparecerá quando o negócio for modificado.</p>
      </div>
    );
  }

  return (
    <Tabs defaultValue="all" className="h-full">
      <TabsList className="mb-4">
        <TabsTrigger value="all">Tudo</TabsTrigger>
        <TabsTrigger value="stages">Etapas</TabsTrigger>
        <TabsTrigger value="fields">Campos</TabsTrigger>
      </TabsList>

      <TabsContent value="all" className="mt-0">
        <ScrollArea className="h-[350px]">
          <AllHistoryTimeline
            stageHistory={stageHistory || []}
            auditLog={auditLog || []}
            formatFieldValue={formatFieldValue}
          />
        </ScrollArea>
      </TabsContent>

      <TabsContent value="stages" className="mt-0">
        <ScrollArea className="h-[350px]">
          <StageHistoryTimeline stageHistory={stageHistory || []} />
        </ScrollArea>
      </TabsContent>

      <TabsContent value="fields" className="mt-0">
        <ScrollArea className="h-[350px]">
          <FieldAuditTimeline auditLog={auditLog || []} formatFieldValue={formatFieldValue} />
        </ScrollArea>
      </TabsContent>
    </Tabs>
  );
}

function AllHistoryTimeline({
  stageHistory,
  auditLog,
  formatFieldValue,
}: {
  stageHistory: any[];
  auditLog: any[];
  formatFieldValue: (field: string, value: string | null) => React.ReactNode;
}) {
  // Combine and sort all history entries
  const allEntries = [
    ...stageHistory.map((entry) => ({
      type: 'stage' as const,
      date: new Date(entry.changed_at),
      data: entry,
    })),
    ...auditLog.map((entry) => ({
      type: 'field' as const,
      date: new Date(entry.changed_at),
      data: entry,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <div className="relative pl-6">
      <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-border" />

      <div className="space-y-4">
        {allEntries.map((entry, index) => {
          if (entry.type === 'stage') {
            return <StageHistoryEntry key={`stage-${entry.data.id}`} entry={entry.data} />;
          }
          return (
            <FieldAuditEntry
              key={`field-${entry.data.id}`}
              entry={entry.data}
              formatFieldValue={formatFieldValue}
            />
          );
        })}
      </div>
    </div>
  );
}

function StageHistoryTimeline({ stageHistory }: { stageHistory: any[] }) {
  if (stageHistory.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>Nenhuma movimentação de etapa registrada.</p>
      </div>
    );
  }

  return (
    <div className="relative pl-6">
      <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-border" />
      <div className="space-y-4">
        {stageHistory.map((entry) => (
          <StageHistoryEntry key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  );
}

function StageHistoryEntry({ entry }: { entry: any }) {
  const fromStage = entry.from_stage as DealStage | null;
  const toStage = entry.to_stage as DealStage;

  return (
    <div className="relative">
      <div
        className={`absolute -left-4 top-1 h-3 w-3 rounded-full border-2 border-background ${
          stageConfig[toStage]?.color || 'bg-primary'
        }`}
      />

      <div className="bg-muted/50 rounded-lg p-3">
        <div className="flex items-center gap-2 text-sm">
          {fromStage ? (
            <>
              <div className="flex items-center gap-1.5">
                <div className={`h-2 w-2 rounded-full ${stageConfig[fromStage]?.color || 'bg-muted'}`} />
                <span className="text-muted-foreground">{stageConfig[fromStage]?.label || fromStage}</span>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <div className="flex items-center gap-1.5">
                <div className={`h-2 w-2 rounded-full ${stageConfig[toStage]?.color || 'bg-primary'}`} />
                <span className="font-medium">{stageConfig[toStage]?.label || toStage}</span>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-1.5">
              <div className={`h-2 w-2 rounded-full ${stageConfig[toStage]?.color || 'bg-primary'}`} />
              <span className="font-medium">Criado em {stageConfig[toStage]?.label || toStage}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{format(new Date(entry.changed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
          </div>

          {entry.duration_seconds && entry.duration_seconds > 0 && (
            <Badge variant="outline" className="text-xs">
              {formatDuration(entry.duration_seconds)} na etapa anterior
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

function FieldAuditTimeline({
  auditLog,
  formatFieldValue,
}: {
  auditLog: any[];
  formatFieldValue: (field: string, value: string | null) => React.ReactNode;
}) {
  if (auditLog.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>Nenhuma alteração de campo registrada.</p>
      </div>
    );
  }

  return (
    <div className="relative pl-6">
      <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-border" />
      <div className="space-y-4">
        {auditLog.map((entry) => (
          <FieldAuditEntry key={entry.id} entry={entry} formatFieldValue={formatFieldValue} />
        ))}
      </div>
    </div>
  );
}

function FieldAuditEntry({
  entry,
  formatFieldValue,
}: {
  entry: any;
  formatFieldValue: (field: string, value: string | null) => React.ReactNode;
}) {
  const Icon = fieldIcons[entry.field_name] || Edit2;

  return (
    <div className="relative">
      <div className="absolute -left-4 top-1 h-3 w-3 rounded-full border-2 border-background bg-blue-500" />

      <div className="bg-blue-500/10 rounded-lg p-3 border border-blue-500/20">
        <div className="flex items-start gap-2">
          <Icon className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm">{entry.field_label}</div>
            <div className="flex items-center gap-2 mt-1 text-sm">
              <span className="text-muted-foreground line-through">
                {formatFieldValue(entry.field_name, entry.old_value)}
              </span>
              <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              <span className="font-medium">{formatFieldValue(entry.field_name, entry.new_value)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{format(new Date(entry.changed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
          </div>
          {entry.profiles?.full_name && (
            <div className="flex items-center gap-1">
              <User className="h-3 w-3" />
              <span>{entry.profiles.full_name}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
