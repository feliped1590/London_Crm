import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Bot, 
  X, 
  Send, 
  Loader2, 
  MessageSquare,
  Trash2,
  Sparkles
} from "lucide-react";
import { useAIAssistant } from "@/hooks/useAIAssistant";
import { ChatMessage } from "./ChatMessage";
import { cn } from "@/lib/utils";

export function AIChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const { messages, isLoading, sendMessage, clearConversation } = useAIAssistant();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      sendMessage(input);
      setInput("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <>
      {/* Floating button */}
      <Button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg",
          "bg-primary hover:bg-primary/90 transition-all duration-300",
          "hover:scale-110",
          isOpen && "hidden"
        )}
        size="icon"
      >
        <Sparkles className="h-6 w-6" />
      </Button>

      {/* Chat window */}
      <div
        className={cn(
          "fixed bottom-6 right-6 z-50 flex flex-col",
          "w-[400px] h-[600px] max-h-[80vh]",
          "bg-background border rounded-xl shadow-2xl",
          "transition-all duration-300 ease-out",
          isOpen ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-primary/5 rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Assistente IA</h3>
              <p className="text-xs text-muted-foreground">
                {isLoading ? "Processando..." : "Como posso ajudar?"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={clearConversation}
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                title="Limpar conversa"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
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

        {/* Messages */}
        <ScrollArea ref={scrollRef} className="flex-1 p-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-8">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <MessageSquare className="h-8 w-8 text-primary" />
              </div>
              <h4 className="font-medium text-foreground mb-2">Olá! Sou seu assistente.</h4>
              <p className="text-sm max-w-[280px]">
                Posso ajudar você a criar contatos, empresas, tarefas, 
                enviar WhatsApp, buscar informações e muito mais.
              </p>
              <div className="mt-4 space-y-2 text-xs">
                <p className="bg-muted px-3 py-2 rounded-lg">
                  "Crie um contato chamado João Silva"
                </p>
                <p className="bg-muted px-3 py-2 rounded-lg">
                  "Quantos negócios temos no pipeline?"
                </p>
                <p className="bg-muted px-3 py-2 rounded-lg">
                  "Crie uma tarefa para amanhã"
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}
              {isLoading && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Processando...</span>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Input */}
        <form onSubmit={handleSubmit} className="p-4 border-t">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite sua mensagem..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
