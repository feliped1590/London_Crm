import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Layers, Sparkles } from 'lucide-react';
import { usePipelines } from '@/hooks/usePipelines';
import { cn } from '@/lib/utils';

interface PipelineSelectorProps {
  value: string | null;
  onChange: (pipelineId: string | null) => void;
  className?: string;
  legalEntityId?: string | null;
}

export function PipelineSelector({ value, onChange, className, legalEntityId }: PipelineSelectorProps) {
  const { pipelines, isLoading, defaultPipeline } = usePipelines({ legalEntityId });

  const selectedValue = value || defaultPipeline?.id || '';

  if (isLoading) {
    return (
      <div className={cn('h-9 w-[180px] animate-pulse bg-muted rounded-md', className)} />
    );
  }

  // Empty state explícito
  if (!pipelines || pipelines.length === 0) {
    return (
      <Badge variant="outline" className={cn('h-9 px-3 gap-2 text-muted-foreground border-dashed', className)}>
        <Layers className="h-3.5 w-3.5" />
        Sem pipelines disponíveis
      </Badge>
    );
  }

  // Exatamente 1 pipeline: badge informativo "selecionado automaticamente"
  if (pipelines.length === 1) {
    const only = pipelines[0];
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="secondary"
              className={cn(
                'h-9 px-3 gap-2 cursor-default border border-border/60',
                className,
              )}
            >
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="font-medium">{only.name}</span>
              <span className="text-[10px] text-muted-foreground hidden md:inline">· auto</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Pipeline selecionado automaticamente — único disponível para esta empresa
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Select value={selectedValue} onValueChange={(v) => onChange(v || null)}>
      <SelectTrigger className={cn('w-[200px] h-9 gap-2', className)}>
        <Layers className="h-4 w-4 text-muted-foreground shrink-0" />
        <SelectValue placeholder="Selecione o pipeline" />
      </SelectTrigger>
      <SelectContent>
        {pipelines.map((pipeline) => (
          <SelectItem key={pipeline.id} value={pipeline.id}>
            <div className="flex items-center gap-2">
              <span>{pipeline.name}</span>
              {pipeline.is_default && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  Padrão
                </Badge>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
