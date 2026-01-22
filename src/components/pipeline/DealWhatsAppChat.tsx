import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSendMessage, useWhatsAppInstances, WhatsAppMessage } from '@/hooks/useWhatsApp';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Send, User, MessageCircle, AlertCircle, Phone, FileText, Mic, Video } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface DealWhatsAppChatProps {
  contactId: string | null;
  contactPhone: string | null;
  contactName: string;
}

// Normalize phone number - remove non-digits and ensure 55 prefix
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('55')) {
    return digits;
  }
  return `55${digits}`;
}

// Format phone for display
function formatPhoneNumber(phone: string): string {
  if (phone.length === 13 && phone.startsWith('55')) {
    const ddd = phone.slice(2, 4);
    const part1 = phone.slice(4, 9);
    const part2 = phone.slice(9);
    return `(${ddd}) ${part1}-${part2}`;
  }
  if (phone.length === 11) {
    const ddd = phone.slice(0, 2);
    const part1 = phone.slice(2, 7);
    const part2 = phone.slice(7);
    return `(${ddd}) ${part1}-${part2}`;
  }
  return phone;
}

// Hook to fetch messages by contact
function useWhatsAppMessagesByContact(contactId: string | null, contactPhone: string | null) {
  return useQuery({
    queryKey: ['whatsapp-messages-contact', contactId, contactPhone],
    queryFn: async () => {
      let messages: WhatsAppMessage[] = [];
      
      // First try to find by contact_id
      if (contactId) {
        const { data } = await supabase
          .from('whatsapp_messages')
          .select('*')
          .eq('contact_id', contactId)
          .order('created_at', { ascending: true });
        
        if (data && data.length > 0) {
          return data as WhatsAppMessage[];
        }
      }
      
      // If not found by contact_id, try by phone number
      if (contactPhone) {
        const normalizedPhone = normalizePhone(contactPhone);
        // Try different formats
        const { data } = await supabase
          .from('whatsapp_messages')
          .select('*')
          .or(`phone.eq.${normalizedPhone},phone.eq.${normalizedPhone.slice(2)}`)
          .order('created_at', { ascending: true });
        
        if (data && data.length > 0) {
          return data as WhatsAppMessage[];
        }
      }
      
      return messages;
    },
    enabled: !!(contactId || contactPhone)
  });
}

export function DealWhatsAppChat({ contactId, contactPhone, contactName }: DealWhatsAppChatProps) {
  const [message, setMessage] = useState('');
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { data: messages, isLoading } = useWhatsAppMessagesByContact(contactId, contactPhone);
  const { data: instances } = useWhatsAppInstances();
  const sendMessage = useSendMessage();

  // Determine the phone to use for sending
  const phoneToUse = messages?.[0]?.phone || (contactPhone ? normalizePhone(contactPhone) : null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-select first connected instance
  useEffect(() => {
    if (instances && instances.length > 0 && !selectedInstanceId) {
      const connectedInstance = instances.find(i => i.status === 'connected');
      setSelectedInstanceId(connectedInstance?.id || instances[0].id);
    }
  }, [instances, selectedInstanceId]);

  const handleSend = () => {
    if (!message.trim() || !selectedInstanceId || !phoneToUse) return;

    sendMessage.mutate({
      instanceId: selectedInstanceId,
      phone: phoneToUse,
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

  // No contact linked
  if (!contactId && !contactPhone) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-muted/30 rounded-lg h-[400px]">
        <User className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-1">Nenhum contato vinculado</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Este negócio não possui um contato vinculado. Vincule um contato na aba "Dados" para visualizar as conversas de WhatsApp.
        </p>
      </div>
    );
  }

  // No phone number
  if (!contactPhone) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-muted/30 rounded-lg h-[400px]">
        <Phone className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-1">Contato sem telefone</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          O contato <strong>{contactName}</strong> não possui número de telefone cadastrado. Adicione um telefone ao contato para visualizar as conversas.
        </p>
      </div>
    );
  }

  // No messages found
  if (!isLoading && (!messages || messages.length === 0)) {
    return (
      <div className="flex flex-col h-[400px]">
        {/* Header */}
        <div className="border-b p-3 flex items-center gap-3 bg-card rounded-t-lg">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary/10 text-primary text-sm">
              {contactName?.[0] || <User className="h-4 w-4" />}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h3 className="font-medium text-sm">{contactName}</h3>
            <p className="text-xs text-muted-foreground">{formatPhoneNumber(contactPhone)}</p>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-muted/20">
          <MessageCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-1">Nenhuma conversa encontrada</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Não há conversas de WhatsApp com este contato. Envie uma mensagem para iniciar a conversa.
          </p>
        </div>

        {/* Input Area */}
        <InputArea 
          instances={instances}
          selectedInstanceId={selectedInstanceId}
          setSelectedInstanceId={setSelectedInstanceId}
          message={message}
          setMessage={setMessage}
          handleKeyDown={handleKeyDown}
          handleSend={handleSend}
          sendMessagePending={sendMessage.isPending}
        />
      </div>
    );
  }

  const connectedInstances = instances?.filter(i => i.status === 'connected') || [];

  return (
    <div className="flex flex-col h-[400px]">
      {/* Chat Header */}
      <div className="border-b p-3 flex items-center gap-3 bg-card rounded-t-lg">
        <Avatar className="h-9 w-9">
          <AvatarFallback className="bg-primary/10 text-primary text-sm">
            {contactName?.[0] || <User className="h-4 w-4" />}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h3 className="font-medium text-sm">{contactName}</h3>
          <p className="text-xs text-muted-foreground">{formatPhoneNumber(contactPhone)}</p>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-muted/20 scrollbar-thin">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={cn("flex", i % 2 === 0 ? "justify-start" : "justify-end")}>
                <Skeleton className="h-10 w-40 rounded-lg" />
              </div>
            ))}
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
        <Alert className="mx-3 mt-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Adicione uma instância Z-API na página de WhatsApp para enviar mensagens.
          </AlertDescription>
        </Alert>
      )}

      {connectedInstances.length === 0 && instances && instances.length > 0 && (
        <Alert className="mx-3 mt-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Nenhuma instância conectada. Verifique o status na página de WhatsApp.
          </AlertDescription>
        </Alert>
      )}

      {/* Input Area */}
      <InputArea 
        instances={instances}
        selectedInstanceId={selectedInstanceId}
        setSelectedInstanceId={setSelectedInstanceId}
        message={message}
        setMessage={setMessage}
        handleKeyDown={handleKeyDown}
        handleSend={handleSend}
        sendMessagePending={sendMessage.isPending}
      />
    </div>
  );
}

interface InputAreaProps {
  instances: any[] | undefined;
  selectedInstanceId: string;
  setSelectedInstanceId: (id: string) => void;
  message: string;
  setMessage: (msg: string) => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  handleSend: () => void;
  sendMessagePending: boolean;
}

function InputArea({ 
  instances, 
  selectedInstanceId, 
  setSelectedInstanceId, 
  message, 
  setMessage, 
  handleKeyDown, 
  handleSend,
  sendMessagePending 
}: InputAreaProps) {
  const connectedInstances = instances?.filter(i => i.status === 'connected') || [];

  return (
    <div className="border-t p-3 bg-card rounded-b-lg space-y-2">
      {instances && instances.length > 1 && (
        <Select value={selectedInstanceId} onValueChange={setSelectedInstanceId}>
          <SelectTrigger className="w-40 h-8 text-xs">
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
          className="min-h-[36px] max-h-24 resize-none text-sm"
          rows={1}
          disabled={!selectedInstanceId || connectedInstances.length === 0}
        />
        <Button 
          onClick={handleSend} 
          disabled={!message.trim() || sendMessagePending || !selectedInstanceId || connectedInstances.length === 0}
          size="icon"
          className="h-9 w-9 shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
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
        <div className="flex justify-center my-3">
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {format(new Date(message.created_at), "d 'de' MMMM", { locale: ptBR })}
          </span>
        </div>
      )}
      <div className={cn("flex", isOutbound ? "justify-end" : "justify-start")}>
        <div
          className={cn(
            "max-w-[75%] rounded-lg px-2.5 py-1.5 shadow-sm",
            isOutbound 
              ? "bg-primary text-primary-foreground rounded-br-none" 
              : "bg-card rounded-bl-none"
          )}
        >
          {message.message_type !== 'text' && message.media_url && (
            <div className="mb-1">
              {message.message_type === 'image' && (
                <img 
                  src={message.media_url} 
                  alt="Imagem" 
                  className="rounded max-w-full max-h-48 object-cover"
                />
              )}
              {message.message_type === 'video' && (
                <div className="flex items-center gap-1 text-xs">
                  <Video className="h-3 w-3" />
                  <span>Vídeo</span>
                </div>
              )}
              {message.message_type === 'audio' && (
                <div className="flex items-center gap-1 text-xs">
                  <Mic className="h-3 w-3" />
                  <span>Áudio</span>
                </div>
              )}
              {message.message_type === 'document' && (
                <div className="flex items-center gap-1 text-xs">
                  <FileText className="h-3 w-3" />
                  <span>{message.content || 'Documento'}</span>
                </div>
              )}
            </div>
          )}
          
          {message.content && message.message_type === 'text' && (
            <p className="text-xs whitespace-pre-wrap break-words">{message.content}</p>
          )}
          {message.content && message.message_type !== 'text' && message.message_type !== 'document' && (
            <p className="text-xs whitespace-pre-wrap break-words">{message.content}</p>
          )}
          
          <div className={cn(
            "flex items-center justify-end gap-1 mt-0.5",
            isOutbound ? "text-primary-foreground/70" : "text-muted-foreground"
          )}>
            <span className="text-[10px]">
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
