import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConversationList } from '@/components/whatsapp/ConversationList';
import { ChatView } from '@/components/whatsapp/ChatView';
import { InstanceManager } from '@/components/whatsapp/InstanceManager';
import { Conversation, useWhatsAppRealtime, useUnreadCount } from '@/hooks/useWhatsApp';
import { MessageSquare, Smartphone, ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';

export default function WhatsApp() {
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const { data: unreadCount } = useUnreadCount();
  const isMobile = useIsMobile();

  // Enable realtime updates
  useWhatsAppRealtime();

  return (
    <div className="h-[calc(100vh-4rem)]">
      <Tabs defaultValue="conversations" className="h-full flex flex-col">
        <div className="border-b px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">WhatsApp</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Gerencie conversas e instâncias Z-API</p>
          </div>
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="conversations" className="gap-2 flex-1 sm:flex-initial">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Conversas</span>
              {unreadCount && unreadCount > 0 && (
                <Badge variant="destructive" className="h-5 min-w-5 flex items-center justify-center px-1.5">
                  {unreadCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="instances" className="gap-2 flex-1 sm:flex-initial">
              <Smartphone className="h-4 w-4" />
              <span className="hidden sm:inline">Instâncias</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="conversations" className="flex-1 m-0 overflow-hidden">
          {isMobile ? (
            // Mobile: show one view at a time
            selectedConversation ? (
              <div className="flex flex-col h-full">
                <div className="p-2 border-b bg-card">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setSelectedConversation(null)}
                    className="gap-2"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Voltar
                  </Button>
                </div>
                <ChatView conversation={selectedConversation} />
              </div>
            ) : (
              <div className="h-full flex flex-col">
                <div className="p-4 border-b bg-card">
                  <h2 className="font-semibold">Conversas</h2>
                </div>
                <ConversationList
                  selectedPhone={null}
                  onSelectConversation={setSelectedConversation}
                />
              </div>
            )
          ) : (
            // Desktop: side by side layout
            <div className="flex h-full">
              <div className="w-80 border-r bg-card flex flex-col">
                <div className="p-4 border-b">
                  <h2 className="font-semibold">Conversas</h2>
                </div>
                <div className="flex-1 overflow-hidden">
                  <ConversationList
                    selectedPhone={selectedConversation?.phone || null}
                    onSelectConversation={setSelectedConversation}
                  />
                </div>
              </div>
              <ChatView conversation={selectedConversation} />
            </div>
          )}
        </TabsContent>

        <TabsContent value="instances" className="flex-1 m-0 overflow-auto p-4 sm:p-6">
          <InstanceManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
