import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export function useAIAssistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const { toast } = useToast();

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("Você precisa estar logado para usar o assistente");
      }

      const response = await supabase.functions.invoke("ai-assistant", {
        body: {
          message: content.trim(),
          conversationId,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Erro ao processar mensagem");
      }

      const { response: aiResponse, conversationId: newConvId } = response.data;

      if (newConvId && !conversationId) {
        setConversationId(newConvId);
      }

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: aiResponse,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao enviar mensagem",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, isLoading, toast]);

  const clearConversation = useCallback(() => {
    setMessages([]);
    setConversationId(null);
  }, []);

  const loadConversation = useCallback(async (convId: string) => {
    try {
      const { data, error } = await supabase
        .from("ai_conversations")
        .select("messages")
        .eq("id", convId)
        .single();

      if (error) throw error;

      if (data?.messages) {
        const loadedMessages: Message[] = (data.messages as Array<{ role: string; content: string }>).map(
          (msg, index) => ({
            id: `${convId}-${index}`,
            role: msg.role as "user" | "assistant",
            content: msg.content,
            timestamp: new Date(),
          })
        );
        setMessages(loadedMessages);
        setConversationId(convId);
      }
    } catch (error) {
      console.error("Error loading conversation:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar a conversa",
        variant: "destructive",
      });
    }
  }, []);

  return {
    messages,
    isLoading,
    conversationId,
    sendMessage,
    clearConversation,
    loadConversation,
  };
}
