import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ChevronDown, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConsistencyWarning {
  stage_id: string;
  stage_name: string;
  sort_order: number;
  stage_category: string;
  stage_phase: string;
  warning_code: string;
  warning_message: string;
  severity: 'warning' | 'info';
}

interface Props {
  pipelineId: string;
}

/**
 * Exibe avisos NÃO-BLOQUEANTES sobre inconsistências semânticas do funil
 * (ex: etapa operacional antes de comercial, perda no meio, etc).
 * Apenas analítico — não impede salvar nem mover.
 */
export function PipelineConsistencyWarnings({ pipelineId }: Props) {
  const { data: warnings, isLoading } = useQuery({
    queryKey: ['pipeline-consistency', pipelineId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        'analyze_pipeline_consistency' as never,
        { p_pipeline_id: pipelineId } as never,
      );
      if (error) throw error;
      return (data ?? []) as ConsistencyWarning[];
    },
    staleTime: 60_000,
  });

  if (isLoading || !warnings || warnings.length === 0) return null;

  const warningCount = warnings.filter(w => w.severity === 'warning').length;
  const infoCount = warnings.filter(w => w.severity === 'info').length;
  const hasWarnings = warningCount > 0;

  return (
    <Collapsible defaultOpen={false} className="border-b">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className={cn(
            'w-full flex items-center justify-between gap-2 px-4 sm:px-6 py-2.5 text-left transition-colors',
            hasWarnings
              ? 'bg-amber-500/5 hover:bg-amber-500/10 text-amber-900 dark:text-amber-200'
              : 'bg-muted/40 hover:bg-muted/60',
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            {hasWarnings ? (
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            ) : (
              <Info className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
            <span className="text-xs font-medium">
              {warnings.length} {warnings.length === 1 ? 'observação' : 'observações'} de consistência
            </span>
            {warningCount > 0 && (
              <Badge variant="outline" className="text-[10px] py-0 h-4 border-amber-500/40 text-amber-700 dark:text-amber-300">
                {warningCount} aviso{warningCount > 1 ? 's' : ''}
              </Badge>
            )}
            {infoCount > 0 && (
              <Badge variant="outline" className="text-[10px] py-0 h-4 text-muted-foreground">
                {infoCount} info
              </Badge>
            )}
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 transition-transform data-[state=open]:rotate-180" />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-4 sm:px-6 py-3 space-y-2 bg-muted/20">
          {warnings.map((w) => (
            <Alert
              key={`${w.stage_id}-${w.warning_code}`}
              variant="default"
              className={cn(
                'py-2 px-3',
                w.severity === 'warning'
                  ? 'border-amber-500/30 bg-amber-500/5'
                  : 'border-border bg-background',
              )}
            >
              <div className="flex items-start gap-2">
                {w.severity === 'warning' ? (
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                ) : (
                  <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <AlertTitle className="text-xs font-semibold mb-0.5">
                    {w.stage_name}
                  </AlertTitle>
                  <AlertDescription className="text-xs text-muted-foreground">
                    {w.warning_message}
                  </AlertDescription>
                </div>
              </div>
            </Alert>
          ))}
          <p className="text-[10px] text-muted-foreground italic pt-1">
            Estas observações são apenas analíticas e não bloqueiam o uso do funil.
          </p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
