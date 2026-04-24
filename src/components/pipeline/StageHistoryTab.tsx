import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, formatDistanceStrict } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowRight, Clock, User } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface StageHistoryTabProps {
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

function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}min`;
  }
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    return `${hours}h`;
  }
  const days = Math.floor(seconds / 86400);
  return `${days} dia${days > 1 ? 's' : ''}`;
}

export function StageHistoryTab({ dealId }: StageHistoryTabProps) {
  const { data: history, isLoading } = useQuery({
    queryKey: ['deal_stage_history', dealId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deal_stage_history')
        .select('*')
        .eq('deal_id', dealId)
        .order('changed_at', { ascending: false });
      if (error) throw error;

      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name');
      if (profilesError) throw profilesError;

      return data.map((entry) => ({
        ...entry,
        profiles: {
          full_name: profilesData.find((p) => p.user_id === entry.changed_by)?.full_name || null,
        },
      }));
    },
    enabled: !!dealId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>Nenhuma movimentação de etapa registrada ainda.</p>
        <p className="text-sm mt-1">O histórico aparecerá quando o negócio mudar de etapa.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px]">
      <div className="relative pl-6">
        {/* Timeline line */}
        <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-border" />

        <div className="space-y-4">
          {history.map((entry, index) => {
            const fromStage = entry.from_stage as DealStage | null;
            const toStage = entry.to_stage as DealStage;
            
            return (
              <div key={entry.id} className="relative">
                {/* Timeline dot */}
                <div className={`absolute -left-4 top-1 h-3 w-3 rounded-full border-2 border-background ${stageConfig[toStage]?.color || 'bg-primary'}`} />
                
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
                      <span>
                        {format(new Date(entry.changed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </div>

                    {entry.profiles?.full_name && (
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        <span>{entry.profiles.full_name}</span>
                      </div>
                    )}
                    
                    {entry.duration_seconds && entry.duration_seconds > 0 && (
                      <div className="text-xs bg-muted px-2 py-0.5 rounded">
                        Ficou {formatDuration(entry.duration_seconds)} na etapa anterior
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </ScrollArea>
  );
}
