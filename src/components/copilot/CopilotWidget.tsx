import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Brain,
  X,
  RefreshCw,
  Loader2,
  Sparkles,
  ChevronRight,
  Lightbulb,
  Phone,
  FileText,
  Users,
  Calendar,
  CheckSquare,
  AlertTriangle,
} from "lucide-react";
import { useAICopilot, CopilotSuggestion } from "@/hooks/useAICopilot";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { SuggestionCard } from "./SuggestionCard";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Phone,
  FileText,
  Users,
  Calendar,
  CheckSquare,
  AlertTriangle,
  RefreshCw: RefreshCw,
  Lightbulb,
};

export function CopilotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  
  const {
    suggestions,
    isLoading,
    isGenerating,
    generateSuggestions,
    acceptSuggestion,
    dismissSuggestion,
    getPriorityColor,
    getSuggestionIcon,
  } = useAICopilot({ contextType: "dashboard", autoFetch: false });

  const handleOpen = async () => {
    setIsOpen(true);
    if (suggestions.length === 0) {
      await generateSuggestions();
    }
  };

  const handleAccept = (suggestion: CopilotSuggestion) => {
    acceptSuggestion(suggestion.id);
    
    // Navigate if there's an action URL
    if (suggestion.action_url) {
      navigate(suggestion.action_url);
      setIsOpen(false);
    }
  };

  const handleDismiss = (suggestionId: string) => {
    dismissSuggestion({ suggestionId });
  };

  const pendingSuggestions = suggestions.filter(s => s.status === "pending");
  const criticalCount = pendingSuggestions.filter(s => s.priority === "critical").length;

  return (
    <>
      {/* Floating button */}
      <Button
        onClick={handleOpen}
        className={cn(
          "fixed bottom-24 right-6 z-50 h-14 w-14 rounded-full shadow-lg",
          "bg-gradient-to-br from-violet-600 to-purple-700 hover:from-violet-500 hover:to-purple-600",
          "transition-all duration-300 hover:scale-110",
          isOpen && "hidden"
        )}
        size="icon"
      >
        <Brain className="h-6 w-6 text-white" />
        {criticalCount > 0 && (
          <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-xs text-white flex items-center justify-center animate-pulse">
            {criticalCount}
          </span>
        )}
      </Button>

      {/* Panel */}
      <div
        className={cn(
          "fixed bottom-6 right-6 z-50 flex flex-col",
          "w-[420px] h-[650px] max-h-[85vh]",
          "bg-background border rounded-xl shadow-2xl",
          "transition-all duration-300 ease-out",
          isOpen ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-violet-600/10 to-purple-600/10 rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                Copiloto IA
                <Badge variant="secondary" className="text-xs">Beta</Badge>
              </h3>
              <p className="text-xs text-muted-foreground">
                {isGenerating ? "Analisando..." : `${pendingSuggestions.length} sugestões`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => generateSuggestions(true)}
              disabled={isGenerating}
              className="h-8 w-8"
              title="Atualizar sugestões"
            >
              <RefreshCw className={cn("h-4 w-4", isGenerating && "animate-spin")} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1 p-4">
          {isLoading || isGenerating ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <Loader2 className="h-10 w-10 animate-spin text-violet-600 mb-4" />
              <p className="text-sm text-muted-foreground">
                Analisando dados do CRM...
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Isso pode levar alguns segundos
              </p>
            </div>
          ) : pendingSuggestions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-8">
              <div className="h-16 w-16 rounded-full bg-violet-600/10 flex items-center justify-center mb-4">
                <Sparkles className="h-8 w-8 text-violet-600" />
              </div>
              <h4 className="font-medium text-foreground mb-2">Tudo em dia!</h4>
              <p className="text-sm text-muted-foreground max-w-[280px]">
                Não há sugestões pendentes no momento. Clique em atualizar para buscar novas análises.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => generateSuggestions(true)}
                className="mt-4"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Buscar novas sugestões
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingSuggestions.map((suggestion) => (
                <SuggestionCard
                  key={suggestion.id}
                  suggestion={suggestion}
                  onAccept={() => handleAccept(suggestion)}
                  onDismiss={() => handleDismiss(suggestion.id)}
                  getPriorityColor={getPriorityColor}
                  getSuggestionIcon={getSuggestionIcon}
                  iconMap={iconMap}
                />
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="p-3 border-t bg-muted/30 rounded-b-xl">
          <p className="text-xs text-muted-foreground text-center">
            💡 O Copiloto sugere, você decide. Nenhuma ação é executada automaticamente.
          </p>
        </div>
      </div>
    </>
  );
}
