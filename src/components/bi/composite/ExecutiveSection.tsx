import { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Info } from 'lucide-react';

interface Props {
  title: string;
  description?: string;
  isLoading?: boolean;
  error?: unknown;
  isEmpty?: boolean;
  emptyMessage?: string;
  className?: string;
  children?: ReactNode;
}

export function ExecutiveSection({
  title,
  description,
  isLoading,
  error,
  isEmpty,
  emptyMessage = 'Sem dados suficientes no período.',
  className,
  children,
}: Props) {
  return (
    <Card className={`p-4 ${className ?? ''}`}>
      <div className="mb-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-32 w-full" />
        </div>
      ) : error ? (
        <div className="flex items-start gap-2 text-destructive text-sm py-4">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error instanceof Error ? error.message : 'Erro ao carregar bloco.'}</span>
        </div>
      ) : isEmpty ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-6 justify-center">
          <Info className="h-4 w-4" /> {emptyMessage}
        </div>
      ) : (
        children
      )}
    </Card>
  );
}
