import { useState, useMemo } from 'react';
import { useWhatsAppConversations, Conversation } from '@/hooks/useWhatsApp';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { MessageCircle, User, Search } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';

interface ConversationListProps {
  selectedPhone: string | null;
  onSelectConversation: (conversation: Conversation) => void;
  filterUserId?: string | null;
}

export function ConversationList({ selectedPhone, onSelectConversation, filterUserId }: ConversationListProps) {
  const { data: conversations, isLoading } = useWhatsAppConversations(filterUserId);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredConversations = useMemo(() => {
    if (!conversations || !searchTerm.trim()) return conversations;
    
    const term = searchTerm.toLowerCase();
    return conversations.filter(conv => 
      conv.contactName?.toLowerCase().includes(term) ||
      conv.profileName?.toLowerCase().includes(term) ||
      conv.phone.includes(term) ||
      formatPhoneNumber(conv.phone).includes(term) ||
      conv.lastMessage?.content?.toLowerCase().includes(term)
    );
  }, [conversations, searchTerm]);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar conversas..."
              disabled
              className="pl-10"
            />
          </div>
        </div>
        <div className="space-y-2 p-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search bar */}
      <div className="p-3 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar conversas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Conversations list */}
      {!filteredConversations || filteredConversations.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-center p-6">
          <MessageCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            {searchTerm ? 'Nenhuma conversa encontrada' : 'Nenhuma conversa ainda'}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {searchTerm 
              ? 'Tente outro termo de busca' 
              : 'As mensagens aparecerão aqui quando você receber ou enviar'}
          </p>
        </div>
      ) : (
        <div className="overflow-y-auto scrollbar-thin flex-1">
          {filteredConversations.map((conversation) => (
            <button
              key={conversation.phone}
              onClick={() => onSelectConversation(conversation)}
              className={cn(
                "w-full flex items-center gap-3 p-3 hover:bg-accent transition-colors text-left",
                selectedPhone === conversation.phone && "bg-accent"
              )}
            >
              <Avatar className="h-10 w-10">
                <AvatarImage src={conversation.profilePicture || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary">
                  {conversation.contactName?.[0] || conversation.profileName?.[0] || <User className="h-5 w-5" />}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate">
                    {conversation.contactName || conversation.profileName || formatPhoneNumber(conversation.phone)}
                  </span>
                  {conversation.lastMessage && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatDistanceToNow(new Date(conversation.lastMessage.created_at), { 
                        addSuffix: true, 
                        locale: ptBR 
                      })}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <p className="text-sm text-muted-foreground truncate">
                    {conversation.lastMessage ? (
                      <>
                        {conversation.lastMessage.direction === 'outbound' && (
                          <span className="text-muted-foreground">Você: </span>
                        )}
                        {conversation.lastMessage.content || getMessageTypeLabel(conversation.lastMessage.message_type)}
                      </>
                    ) : (
                      <span className="text-muted-foreground/70 italic">Nova conversa</span>
                    )}
                  </p>
                  {conversation.unreadCount > 0 && (
                    <Badge variant="default" className="shrink-0 h-5 min-w-5 flex items-center justify-center px-1.5">
                      {conversation.unreadCount}
                    </Badge>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function formatPhoneNumber(phone: string): string {
  // Format Brazilian phone numbers
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

function getMessageTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    image: '📷 Imagem',
    video: '🎥 Vídeo',
    audio: '🎵 Áudio',
    document: '📄 Documento',
    sticker: '🎨 Figurinha',
    text: ''
  };
  return labels[type] || '';
}