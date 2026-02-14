import { Badge } from '@/components/ui/badge';
import { UserCheck } from 'lucide-react';
import { usePortfolioDelegations } from '@/hooks/usePortfolioDelegations';

interface DelegationBadgeProps {
  ownerId?: string | null;
  className?: string;
  compact?: boolean;
}

export function DelegationBadge({ ownerId, className, compact = false }: DelegationBadgeProps) {
  const { hasDelegationFor, getOwnerName } = usePortfolioDelegations();

  if (!ownerId || !hasDelegationFor(ownerId)) return null;

  const ownerName = getOwnerName(ownerId);

  if (compact) {
    return (
      <span title={`Gerindo carteira de ${ownerName}`} className={className}>
        <UserCheck className="h-3.5 w-3.5 text-amber-500" />
      </span>
    );
  }

  return (
    <Badge variant="outline" className={`gap-1 text-xs border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-700 ${className || ''}`}>
      <UserCheck className="h-3 w-3" />
      Carteira de {ownerName}
    </Badge>
  );
}
