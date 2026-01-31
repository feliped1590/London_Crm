import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Layers } from 'lucide-react';
import { usePipelines, Pipeline } from '@/hooks/usePipelines';
import { cn } from '@/lib/utils';

interface PipelineSelectorProps {
  value: string | null;
  onChange: (pipelineId: string | null) => void;
  className?: string;
}

const typeLabels: Record<string, string> = {
  sales: 'Vendas',
  post_sales: 'Pós-Venda',
  support: 'Suporte',
};

export function PipelineSelector({ value, onChange, className }: PipelineSelectorProps) {
  const { pipelines, isLoading, defaultPipeline } = usePipelines();

  // Use defaultPipeline if no value is set
  const selectedValue = value || defaultPipeline?.id || '';

  if (isLoading) {
    return (
      <div className={cn('h-9 w-[180px] animate-pulse bg-muted rounded-md', className)} />
    );
  }

  // If no pipelines or only one, don't show selector
  if (!pipelines || pipelines.length <= 1) {
    return null;
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
