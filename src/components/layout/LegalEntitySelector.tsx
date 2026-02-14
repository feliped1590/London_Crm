import { Building2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useLegalEntities } from '@/hooks/useLegalEntities';
import { formatCNPJ } from '@/lib/cpfCnpjMask';

export function LegalEntitySelector() {
  const {
    accessibleEntities,
    activeLegalEntity,
    hasEntities,
    switchEntity,
    isSwitching,
  } = useLegalEntities();

  if (!hasEntities) return null;

  // Single entity: show as badge, no dropdown
  if (accessibleEntities.length === 1) {
    const entity = accessibleEntities[0];
    return (
      <Badge variant="outline" className="gap-1.5 py-1 px-2.5 text-xs font-normal">
        <Building2 className="h-3 w-3" />
        {entity.name}
      </Badge>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 max-w-[260px] font-normal"
          disabled={isSwitching}
        >
          <Building2 className="h-4 w-4 shrink-0" />
          <span className="truncate">
            {activeLegalEntity
              ? `${activeLegalEntity.name} — ${formatCNPJ(activeLegalEntity.cnpj)}`
              : 'Selecionar CNPJ'}
          </span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[300px]">
        {accessibleEntities.map((entity) => (
          <DropdownMenuItem
            key={entity.id}
            onClick={() => switchEntity(entity.id)}
            className="flex flex-col items-start gap-0.5 cursor-pointer"
          >
            <span className="font-medium text-sm">{entity.name}</span>
            <span className="text-xs text-muted-foreground">
              {formatCNPJ(entity.cnpj)}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
