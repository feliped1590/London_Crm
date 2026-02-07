import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Check, AlertTriangle, X, Loader2 } from 'lucide-react';
import { NCMSemanticValidation, riskLevelConfig } from '@/types/fiscal';
import { cn } from '@/lib/utils';

interface NCMValidationBadgeProps {
  validation: NCMSemanticValidation | null;
  isLoading?: boolean;
  showTooltip?: boolean;
  size?: 'sm' | 'default';
}

export function NCMValidationBadge({
  validation,
  isLoading = false,
  showTooltip = true,
  size = 'default',
}: NCMValidationBadgeProps) {
  if (isLoading) {
    return (
      <Badge variant="outline" className={cn("gap-1", size === 'sm' && "text-xs py-0")}>
        <Loader2 className={cn("animate-spin", size === 'sm' ? "h-3 w-3" : "h-4 w-4")} />
        {size !== 'sm' && "Validando..."}
      </Badge>
    );
  }

  if (!validation) return null;

  const config = riskLevelConfig[validation.risk_level];
  const Icon = validation.risk_level === 'low' ? Check : 
               validation.risk_level === 'medium' ? AlertTriangle : X;

  const badge = (
    <Badge 
      variant="outline" 
      className={cn(
        "gap-1",
        config.color,
        config.bgColor,
        config.borderColor,
        size === 'sm' && "text-xs py-0"
      )}
    >
      <Icon className={cn(size === 'sm' ? "h-3 w-3" : "h-4 w-4")} />
      {config.label}
    </Badge>
  );

  if (!showTooltip) return badge;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="space-y-1">
            <p className="font-medium">{config.label}</p>
            <p className="text-sm text-muted-foreground">{validation.summary}</p>
            <p className="text-xs text-muted-foreground">
              Confiança: {Math.round(validation.confidence * 100)}%
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
