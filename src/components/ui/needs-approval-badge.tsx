import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  className?: string;
  label?: string;
}

/** Badge laranja padrão para itens/pedidos que excedem regras de governança comercial. */
export function NeedsApprovalBadge({ className, label = 'Pendente aprovação' }: Props) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1 border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100 dark:border-amber-700',
        className,
      )}
    >
      <AlertTriangle className="h-3 w-3" />
      {label}
    </Badge>
  );
}
