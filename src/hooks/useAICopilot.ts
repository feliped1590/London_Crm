import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface CopilotSuggestion {
  id: string;
  user_id: string;
  context_type: string;
  context_entity_id: string | null;
  suggestion_type: string;
  title: string;
  description: string;
  reasoning: string | null;
  priority: "low" | "medium" | "high" | "critical";
  action_type: string | null;
  action_payload: Record<string, unknown> | null;
  action_url: string | null;
  status: "pending" | "accepted" | "dismissed" | "expired";
  created_at: string;
}

type ContextType = "deal" | "company" | "contact" | "pipeline" | "seller" | "general" | "dashboard";

interface UseCopilotOptions {
  contextType?: ContextType;
  contextEntityId?: string;
  autoFetch?: boolean;
}

export function useAICopilot(options: UseCopilotOptions = {}) {
  const { contextType = "dashboard", contextEntityId, autoFetch = false } = options;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);

  // Fetch existing pending suggestions
  const {
    data: suggestions = [],
    isLoading,
    refetch: refetchSuggestions,
  } = useQuery({
    queryKey: ["copilot-suggestions", contextType, contextEntityId],
    queryFn: async () => {
      const query = supabase
        .from("ai_copilot_suggestions")
        .select("*")
        .eq("status", "pending")
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(10);

      if (contextType !== "general" && contextType !== "dashboard") {
        query.eq("context_type", contextType);
        if (contextEntityId) {
          query.eq("context_entity_id", contextEntityId);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as CopilotSuggestion[];
    },
    enabled: autoFetch,
  });

  // Generate new suggestions
  const generateSuggestions = useCallback(
    async (refresh = false) => {
      setIsGenerating(true);
      try {
        const { data, error } = await supabase.functions.invoke("ai-copilot", {
          body: {
            context_type: contextType,
            context_entity_id: contextEntityId,
            refresh,
          },
        });

        if (error) {
          throw new Error(error.message);
        }

        if (data.error) {
          throw new Error(data.error);
        }

        // Refresh the query to show new suggestions
        await refetchSuggestions();

        if (!data.cached) {
          toast({
            title: "Sugestões atualizadas",
            description: `${data.suggestions?.length || 0} novas sugestões geradas.`,
          });
        }

        return data.suggestions as CopilotSuggestion[];
      } catch (error) {
        console.error("Error generating suggestions:", error);
        toast({
          title: "Erro",
          description: error instanceof Error ? error.message : "Erro ao gerar sugestões",
          variant: "destructive",
        });
        return [];
      } finally {
        setIsGenerating(false);
      }
    },
    [contextType, contextEntityId, refetchSuggestions, toast]
  );

  // Accept a suggestion
  const acceptSuggestionMutation = useMutation({
    mutationFn: async (suggestionId: string) => {
      const { error } = await supabase
        .from("ai_copilot_suggestions")
        .update({
          status: "accepted",
          accepted_at: new Date().toISOString(),
        })
        .eq("id", suggestionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["copilot-suggestions"] });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: "Não foi possível aceitar a sugestão",
        variant: "destructive",
      });
      console.error("Error accepting suggestion:", error);
    },
  });

  // Dismiss a suggestion
  const dismissSuggestionMutation = useMutation({
    mutationFn: async ({ suggestionId, feedback }: { suggestionId: string; feedback?: string }) => {
      const { error } = await supabase
        .from("ai_copilot_suggestions")
        .update({
          status: "dismissed",
          dismissed_at: new Date().toISOString(),
          user_feedback: feedback || null,
        })
        .eq("id", suggestionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["copilot-suggestions"] });
      toast({
        title: "Sugestão descartada",
        description: "A sugestão foi removida da lista.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: "Não foi possível descartar a sugestão",
        variant: "destructive",
      });
      console.error("Error dismissing suggestion:", error);
    },
  });

  // Get priority badge color
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical":
        return "bg-red-500 text-white";
      case "high":
        return "bg-orange-500 text-white";
      case "medium":
        return "bg-yellow-500 text-black";
      case "low":
        return "bg-blue-500 text-white";
      default:
        return "bg-gray-500 text-white";
    }
  };

  // Get suggestion type icon name
  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case "follow_up":
        return "Phone";
      case "review_proposal":
        return "FileText";
      case "redistribute_portfolio":
        return "Users";
      case "schedule_contact":
        return "Calendar";
      case "update_deal":
        return "RefreshCw";
      case "create_task":
        return "CheckSquare";
      case "alert":
        return "AlertTriangle";
      default:
        return "Lightbulb";
    }
  };

  return {
    suggestions,
    isLoading,
    isGenerating,
    generateSuggestions,
    acceptSuggestion: acceptSuggestionMutation.mutate,
    dismissSuggestion: dismissSuggestionMutation.mutate,
    refetchSuggestions,
    getPriorityColor,
    getSuggestionIcon,
  };
}
