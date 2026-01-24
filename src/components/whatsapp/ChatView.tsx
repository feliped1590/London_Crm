import { useState, useRef, useEffect } from 'react';
import { useWhatsAppMessages, useSendMessage, useMarkAsRead, WhatsAppMessage, Conversation, useWhatsAppInstances } from '@/hooks/useWhatsApp';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Send, Image, FileText, Mic, Video, User, MessageCircle, AlertCircle, MessageSquarePlus } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ChatViewProps {
  conversation: Conversation | null;
}

export function ChatView({ conversation }: ChatViewProps) {
  const [message, setMessage] = useState('');
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { data: messages, isLoading } = useWhatsAppMessages(conversation?.phone || null);
  const { data: instances } = useWhatsAppInstances();
  const sendMessage = useSendMessage();
  const markAsRead = useMarkAsRead();

  // Check if this is a new conversation (no lastMessage)
  const isNewConversation = conversation && !conversation.lastMessage;

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mark as read when conversation is opened
  useEffect(() => {
    if (conversation?.phone && conversation.unreadCount > 0) {
      markAsRead.mutate(conversation.phone);
    }
  }, [conversation?.phone]);

  // Auto-select first connected instance
  useEffect(() => {
    if (instances && instances.length > 0 && !selectedInstanceId) {
      const connectedInstance = instances.find(i => i.status === 'connected');
      setSelectedInstanceId(connectedInstance?.id || instances[0].id);
    }
  }, [instances, selectedInstanceId]);

  const handleSend = () => {
    if (!message.trim() || !selectedInstanceId || !conversation) return;

    sendMessage.mutate({
      instanceId: selectedInstanceId,
      phone: conversation.phone,
      message: message.trim()
    }, {
      onSuccess: () => {
        setMessage('');
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!conversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-muted/30">
        <MessageCircle className="h-16 w-16 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-1">Selecione uma conversa</h3>
        <p className="text-sm text-muted-foreground">
          Escolha uma conversa na lista ao lado para visualizar as mensagens
        </p>
      </div>
    );
  }

  const connectedInstances = instances?.filter(i => i.status === 'connected') || [];

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Chat Header */}
      <div className="border-b p-4 flex items-center gap-3 bg-card">
        <Avatar className="h-10 w-10">
          <AvatarImage src={conversation.profilePicture || undefined} />
          <AvatarFallback className="bg-primary/10 text-primary">
            {conversation.contactName?.[0] || conversation.profileName?.[0] || <User className="h-5 w-5" />}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h3 className="font-medium">
            {conversation.contactName || conversation.profileName || formatPhoneNumber(conversation.phone)}
          </h3>
          <p className="text-sm text-muted-foreground">{formatPhoneNumber(conversation.phone)}</p>
        </div>
        {isNewConversation && (
          <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
            Nova conversa
          </span>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-muted/20 scrollbar-thin">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={cn("flex", i % 2 === 0 ? "justify-start" : "justify-end")}>
                <Skeleton className="h-12 w-48 rounded-lg" />
              </div>
            ))}
          </div>
        ) : isNewConversation || !messages || messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageSquarePlus className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <h3 className="font-medium text-muted-foreground mb-1">
              {isNewConversation ? 'Iniciar nova conversa' : 'Nenhuma mensagem ainda'}
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              {conversation.contactName 
                ? `Envie a primeira mensagem para ${conversation.contactName}`
                : 'Envie a primeira mensagem para iniciar a conversa'}
            </p>
          </div>
        ) : (
          <>
            {messages?.map((msg, index) => (
              <MessageBubble key={msg.id} message={msg} showDate={shouldShowDate(messages, index)} />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Instance selector warning */}
      {instances && instances.length === 0 && (
        <Alert className="mx-4 mt-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Você precisa adicionar uma instância Z-API para enviar mensagens. Vá para a aba "Instâncias".
          </AlertDescription>
        </Alert>
      )}

      {connectedInstances.length === 0 && instances && instances.length > 0 && (
        <Alert className="mx-4 mt-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Nenhuma instância está conectada. Verifique o status na aba "Instâncias".
          </AlertDescription>
        </Alert>
      )}

      {/* Input Area */}
      <div className="border-t p-4 bg-card space-y-3">
        {instances && instances.length > 1 && (
          <Select value={selectedInstanceId} onValueChange={setSelectedInstanceId}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Selecione instância" />
            </SelectTrigger>
            <SelectContent>
              {instances.map(instance => (
                <SelectItem key={instance.id} value={instance.id}>
                  {instance.name} {instance.status === 'connected' ? '✅' : '❌'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        
        <div className="flex items-end gap-2">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite uma mensagem..."
            className="min-h-[44px] max-h-32 resize-none"
            rows={1}
            disabled={!selectedInstanceId || connectedInstances.length === 0}
          />
          <Button 
            onClick={handleSend} 
            disabled={!message.trim() || sendMessage.isPending || !selectedInstanceId || connectedInstances.length === 0}
            size="icon"
            className="h-11 w-11 shrink-0"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

interface MessageBubbleProps {
  message: WhatsAppMessage;
  showDate: boolean;
}

function MessageBubble({ message, showDate }: MessageBubbleProps) {
  const isOutbound = message.direction === 'outbound';

  return (
    <>
      {showDate && (
        <div className="flex justify-center my-4">
          <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
            {format(new Date(message.created_at), "d 'de' MMMM", { locale: ptBR })}
          </span>
        </div>
      )}
      <div className={cn("flex", isOutbound ? "justify-end" : "justify-start")}>
        <div
          className={cn(
            "max-w-[70%] rounded-lg px-3 py-2 shadow-sm",
            isOutbound 
              ? "bg-primary text-primary-foreground rounded-br-none" 
              : "bg-card rounded-bl-none"
          )}
        >
          {message.message_type !== 'text' && message.media_url && (
            <div className="mb-2">
              {message.message_type === 'image' && (
                <img 
                  src={message.media_url} 
                  alt="Imagem" 
                  className="rounded max-w-full max-h-64 object-cover"
                />
              )}
              {message.message_type === 'video' && (
                <div className="flex items-center gap-2 text-sm">
                  <Video className="h-4 w-4" />
                  <span>Vídeo</span>
                </div>
              )}
              {message.message_type === 'audio' && (
                <div className="flex items-center gap-2 text-sm">
                  <Mic className="h-4 w-4" />
                  <span>Áudio</span>
                </div>
              )}
              {message.message_type === 'document' && (
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4" />
                  <span>{message.content || 'Documento'}</span>
                </div>
              )}
            </div>
          )}
          
          {message.content && message.message_type === 'text' && (
            <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
          )}
          {message.content && message.message_type !== 'text' && message.message_type !== 'document' && (
            <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
          )}
          
          <div className={cn(
            "flex items-center justify-end gap-1 mt-1",
            isOutbound ? "text-primary-foreground/70" : "text-muted-foreground"
          )}>
            <span className="text-xs">
              {format(new Date(message.created_at), 'HH:mm')}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

function shouldShowDate(messages: WhatsAppMessage[], index: number): boolean {
  if (index === 0) return true;
  const current = new Date(messages[index].created_at);
  const previous = new Date(messages[index - 1].created_at);
  return current.toDateString() !== previous.toDateString();
}

function formatPhoneNumber(phone: string): string {
  if (phone.length === 13 && phone.startsWith('55')) {
    const ddd = phone.slice(2, 4);
    const part1 = phone.slice(4, 9);
    const part2 = phone.slice(9);
    return `(${ddd}) ${part1}-${part2}`;
  }
  if (phone.length === 12 && phone.startsWith('55')) {
    const ddd = phone.slice(2, 4);
    const part1 = phone.slice(4, 8);
    const part2 = phone.slice(8);
    return `(${ddd}) ${part1}-${part2}`;
  }
  return phone;
}