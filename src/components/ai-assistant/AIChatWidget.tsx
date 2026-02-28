import { useState, useRef, useEffect, useCallback } from "react";
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
  Sparkles,
  Mic,
  MicOff,
  GripVertical
} from "lucide-react";
import { useAIAssistant } from "@/hooks/useAIAssistant";
import { useSpeechToText } from "@/hooks/useSpeechToText";
import { ChatMessage } from "./ChatMessage";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function AIChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [btnPosition, setBtnPosition] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const btnDragRef = useRef<{ startX: number; startY: number; origX: number; origY: number; moved: boolean } | null>(null);
  const { messages, isLoading, sendMessage, clearConversation } = useAIAssistant();
  const { 
    transcript, 
    isListening, 
    isSupported, 
    startListening, 
    stopListening, 
    resetTranscript,
    error: speechError 
  } = useSpeechToText();
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  // Drag handlers
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (window.matchMedia('(pointer: coarse)').matches) return;
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: position.x, origY: position.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [position]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    let newX = dragRef.current.origX + dx;
    let newY = dragRef.current.origY + dy;
    
    // Clamp to viewport
    if (chatRef.current) {
      const rect = chatRef.current.getBoundingClientRect();
      const maxX = window.innerWidth - 24 - rect.width + position.x - (rect.left - 24);
      const minX = -(rect.left - 24) + position.x;
      const maxY = window.innerHeight - 24 - rect.height + position.y - (rect.top - 24);
      const minY = -(rect.top - 24) + position.y;
      newX = Math.max(minX, Math.min(maxX, newX));
      newY = Math.max(minY, Math.min(maxY, newY));
    }
    
    setPosition({ x: newX, y: newY });
  }, [position]);

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  // Button drag handlers
  const handleBtnPointerDown = useCallback((e: React.PointerEvent) => {
    if (window.matchMedia('(pointer: coarse)').matches) return;
    btnDragRef.current = { startX: e.clientX, startY: e.clientY, origX: btnPosition.x, origY: btnPosition.y, moved: false };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [btnPosition]);

  const handleBtnPointerMove = useCallback((e: React.PointerEvent) => {
    if (!btnDragRef.current) return;
    const dx = e.clientX - btnDragRef.current.startX;
    const dy = e.clientY - btnDragRef.current.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) btnDragRef.current.moved = true;
    if (!btnDragRef.current.moved) return;
    let newX = btnDragRef.current.origX + dx;
    let newY = btnDragRef.current.origY + dy;
    const btnSize = 56;
    const margin = 24;
    const maxX = -(window.innerWidth - btnSize - margin - margin);
    const minY = -(window.innerHeight - btnSize - margin - margin);
    newX = Math.min(0, Math.max(maxX, newX));
    newY = Math.min(0, Math.max(minY, newY));
    setBtnPosition({ x: newX, y: newY });
  }, [btnPosition]);

  const handleBtnPointerUp = useCallback(() => {
    const wasDrag = btnDragRef.current?.moved;
    btnDragRef.current = null;
    if (!wasDrag) {
      setIsOpen(true);
      setPosition({ x: 0, y: 0 });
    }
  }, []);

  // Scroll to bottom when new messages arrive or loading state changes
  useEffect(() => {
    if (scrollRef.current) {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
          if (scrollContainer) {
            scrollContainer.scrollTo({
              top: scrollContainer.scrollHeight,
              behavior: 'smooth',
            });
          }
        }
      });
    }
  }, [messages, isLoading]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Update input with transcript
  useEffect(() => {
    if (transcript) {
      setInput(transcript);
    }
  }, [transcript]);

  // Show speech error as toast
  useEffect(() => {
    if (speechError) {
      toast.error(speechError);
    }
  }, [speechError]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      sendMessage(input);
      setInput("");
      resetTranscript();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleMicClick = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <>
      {/* Floating button — draggable */}
      <Button
        onPointerDown={handleBtnPointerDown}
        onPointerMove={handleBtnPointerMove}
        onPointerUp={handleBtnPointerUp}
        className={cn(
          "fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg cursor-grab active:cursor-grabbing",
          "bg-primary hover:bg-primary/90 transition-all duration-300",
          "hover:scale-110 touch-none",
          isOpen && "hidden"
        )}
        style={{ transform: `translate(${btnPosition.x}px, ${btnPosition.y}px)` }}
        size="icon"
      >
        <Sparkles className="h-6 w-6" />
      </Button>

      {/* Chat window */}
      <div
        ref={chatRef}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex flex-col",
          "w-[400px] h-[600px] max-h-[80vh]",
          "bg-background border rounded-xl shadow-2xl",
          isOpen ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none",
          !dragRef.current && "transition-all duration-300 ease-out"
        )}
        style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
      >
        {/* Header — drag handle */}
        <div
          className="flex items-center justify-between p-4 border-b bg-primary/5 rounded-t-xl cursor-grab active:cursor-grabbing select-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Assistente IA</h3>
              <p className="text-xs text-muted-foreground">
                {isLoading ? "Processando..." : isListening ? "Ouvindo..." : "Como posso ajudar?"}
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
                buscar informações e muito mais.
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
              placeholder={isListening ? "Fale agora..." : "Digite sua mensagem..."}
              disabled={isLoading}
              className={cn(
                "flex-1 transition-all",
                isListening && "border-primary ring-2 ring-primary/20"
              )}
            />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant={isListening ? "destructive" : "outline"}
                    onClick={handleMicClick}
                    disabled={!isSupported || isLoading}
                    className={cn(
                      "relative transition-all",
                      isListening && "animate-pulse"
                    )}
                  >
                    {isListening ? (
                      <MicOff className="h-4 w-4" />
                    ) : (
                      <Mic className="h-4 w-4" />
                    )}
                    {isListening && (
                      <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-destructive animate-ping" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {!isSupported 
                    ? "Seu navegador não suporta entrada por voz" 
                    : isListening 
                      ? "Parar gravação" 
                      : "Falar mensagem"
                  }
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
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
