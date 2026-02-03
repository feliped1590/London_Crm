import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, Check, X, Lightbulb } from "lucide-react";
import { CopilotSuggestion } from "@/hooks/useAICopilot";
import { cn } from "@/lib/utils";

interface SuggestionCardProps {
  suggestion: CopilotSuggestion;
  onAccept: () => void;
  onDismiss: () => void;
  getPriorityColor: (priority: string) => string;
  getSuggestionIcon: (type: string) => string;
  iconMap: Record<string, React.ComponentType<{ className?: string }>>;
}

export function SuggestionCard({
  suggestion,
  onAccept,
  onDismiss,
  getPriorityColor,
  getSuggestionIcon,
  iconMap,
}: SuggestionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const IconComponent = iconMap[getSuggestionIcon(suggestion.suggestion_type)] || Lightbulb;

  const priorityLabel: Record<string, string> = {
    critical: "Crítico",
    high: "Alta",
    medium: "Média",
    low: "Baixa",
  };

  return (
    <Card
      className={cn(
        "transition-all duration-200 hover:shadow-md",
        suggestion.priority === "critical" && "border-red-500/50 bg-red-50/50 dark:bg-red-950/20",
        suggestion.priority === "high" && "border-orange-500/30"
      )}
    >
      <CardHeader className="p-3 pb-2">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
              suggestion.priority === "critical"
                ? "bg-red-100 dark:bg-red-900/30"
                : suggestion.priority === "high"
                ? "bg-orange-100 dark:bg-orange-900/30"
                : "bg-violet-100 dark:bg-violet-900/30"
            )}
          >
            <IconComponent
              className={cn(
                "h-4 w-4",
                suggestion.priority === "critical"
                  ? "text-red-600"
                  : suggestion.priority === "high"
                  ? "text-orange-600"
                  : "text-violet-600"
              )}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge
                className={cn(
                  "text-[10px] px-1.5 py-0",
                  getPriorityColor(suggestion.priority)
                )}
              >
                {priorityLabel[suggestion.priority] || suggestion.priority}
              </Badge>
            </div>
            <CardTitle className="text-sm font-medium leading-tight">
              {suggestion.title}
            </CardTitle>
            <CardDescription className="text-xs mt-1 line-clamp-2">
              {suggestion.description}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-3 pt-0">
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-7 text-xs text-muted-foreground hover:text-foreground"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="h-3 w-3 mr-1" />
                  Ocultar detalhes
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3 mr-1" />
                  Por que esta sugestão?
                </>
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Análise:</p>
              <p>{suggestion.reasoning || "Baseado nos dados atuais do CRM."}</p>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <div className="flex gap-2 mt-3">
          <Button
            size="sm"
            variant="outline"
            onClick={onDismiss}
            className="flex-1 h-8 text-xs"
          >
            <X className="h-3 w-3 mr-1" />
            Ignorar
          </Button>
          <Button
            size="sm"
            onClick={onAccept}
            className={cn(
              "flex-1 h-8 text-xs",
              suggestion.priority === "critical"
                ? "bg-red-600 hover:bg-red-700"
                : suggestion.priority === "high"
                ? "bg-orange-600 hover:bg-orange-700"
                : "bg-violet-600 hover:bg-violet-700"
            )}
          >
            <Check className="h-3 w-3 mr-1" />
            {suggestion.action_url ? "Ver" : "Aceitar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
