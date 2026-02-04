import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConversationList } from '@/components/whatsapp/ConversationList';
import { ChatView } from '@/components/whatsapp/ChatView';
import { WhatsAppMetrics } from '@/components/whatsapp/WhatsAppMetrics';
import { ConversationAnalyticsPanel } from '@/components/whatsapp/ConversationAnalyticsPanel';
import { WhatsAppTemplatesManager } from '@/components/settings/WhatsAppTemplatesManager';
import { Conversation, useWhatsAppRealtime, useUnreadCount, useWhatsAppConversations } from '@/hooks/useWhatsApp';
import { MessageSquare, ArrowLeft, Users, BarChart3, BarChart2, MessageSquareText } from 'lucide-react';
import { UnderDevelopmentBanner } from '@/components/UnderDevelopmentBanner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface UserWithInstances {
  user_id: string;
  full_name: string | null;
}

// Generate phone number variations for matching
function generatePhoneVariations(phone: string): string[] {
  const cleaned = phone.replace(/\D/g, '');
  const variations: string[] = [cleaned];
  
  // With 55 prefix
  if (!cleaned.startsWith('55') && cleaned.length >= 10) {
    variations.push('55' + cleaned);
  }
  
  // Without 55 prefix
  if (cleaned.startsWith('55') && cleaned.length >= 12) {
    variations.push(cleaned.slice(2));
  }
  
  // Handle 9th digit variations for mobile numbers
  const baseVariations = [...variations];
  for (const v of baseVariations) {
    // If has 9th digit, try without
    if (v.startsWith('55') && v.length === 13) {
      const withoutNinth = v.slice(0, 4) + v.slice(5);
      if (!variations.includes(withoutNinth)) variations.push(withoutNinth);
    }
    // If doesn't have 9th digit, try with
    if (v.startsWith('55') && v.length === 12) {
      const withNinth = v.slice(0, 4) + '9' + v.slice(4);
      if (!variations.includes(withNinth)) variations.push(withNinth);
    }
    // Without country code
    if (!v.startsWith('55') && v.length === 11) {
      const withoutNinth = v.slice(0, 2) + v.slice(3);
      if (!variations.includes(withoutNinth)) variations.push(withoutNinth);
    }
    if (!v.startsWith('55') && v.length === 10) {
      const withNinth = v.slice(0, 2) + '9' + v.slice(2);
      if (!variations.includes(withNinth)) variations.push(withNinth);
    }
  }
  
  return variations;
}

export default function WhatsApp() {
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: unreadCount } = useUnreadCount();
  const isMobile = useIsMobile();
  const { user } = useAuth();

  // Check if current user is admin
  const { data: isAdmin } = useQuery({
    queryKey: ['user-is-admin', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data, error } = await supabase
        .rpc('has_role', { _user_id: user.id, _role: 'admin' });
      if (error) throw error;
      return data as boolean;
    },
    enabled: !!user?.id
  });

  // Fetch users with instances (only for admins)
  const { data: usersWithInstances } = useQuery({
    queryKey: ['users-with-instances'],
    queryFn: async () => {
      // Get all profiles that have at least one whatsapp instance
      const { data: instances, error: instancesError } = await supabase
        .from('whatsapp_instances')
        .select('user_id');

      if (instancesError) throw instancesError;

      // Get unique user IDs
      const userIds = [...new Set(instances?.map(i => i.user_id) || [])];

      if (userIds.length === 0) return [];

      // Get profile info for these users
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      return profiles as UserWithInstances[];
    },
    enabled: isAdmin === true
  });

  // Enable realtime updates
  useWhatsAppRealtime();

  // Get filter user ID for conversations
  const filterUserId = isAdmin ? (selectedUserId === 'all' ? null : selectedUserId) : null;

  // Get conversations for URL-based selection
  const { data: conversations } = useWhatsAppConversations(filterUserId);

  // Handle URL parameters to auto-select conversation from Contacts page
  const handleUrlConversation = useCallback(() => {
    const phoneFromUrl = searchParams.get('phone');
    const contactIdFromUrl = searchParams.get('contactId');
    const contactNameFromUrl = searchParams.get('contactName');

    if (!phoneFromUrl) return;

    // Try to find existing conversation
    if (conversations) {
      const phoneVariations = generatePhoneVariations(phoneFromUrl);
      const existingConversation = conversations.find(c => 
        phoneVariations.some(v => generatePhoneVariations(c.phone).includes(v))
      );

      if (existingConversation) {
        setSelectedConversation(existingConversation);
      } else {
        // Create virtual conversation for new contact
        const normalizedPhone = phoneFromUrl.replace(/\D/g, '');
        const phoneWithCountry = normalizedPhone.startsWith('55') ? normalizedPhone : '55' + normalizedPhone;
        
        setSelectedConversation({
          phone: phoneWithCountry,
          profileName: null,
          profilePicture: null,
          lastMessage: null as any, // Will be handled in ChatView for new conversations
          unreadCount: 0,
          contactId: contactIdFromUrl,
          contactName: contactNameFromUrl ? decodeURIComponent(contactNameFromUrl) : null
        });
      }
    }

    // Clear URL params after processing
    setSearchParams({});
  }, [searchParams, conversations, setSearchParams]);

  useEffect(() => {
    const phoneFromUrl = searchParams.get('phone');
    if (phoneFromUrl && conversations !== undefined) {
      handleUrlConversation();
    }
  }, [searchParams, conversations, handleUrlConversation]);

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      <div className="px-4 sm:px-6 pt-4">
        <UnderDevelopmentBanner 
          description="A integração com WhatsApp está sendo aprimorada para facilitar a configuração. Em breve você poderá conectar sua conta de forma simplificada."
        />
      </div>
      <Tabs defaultValue="conversations" className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">WhatsApp</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">Gerencie conversas e instâncias Z-API</p>
            </div>
            
            {/* User selector for admins */}
            {isAdmin && usersWithInstances && usersWithInstances.length > 0 && (
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Todos os usuários" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os usuários</SelectItem>
                    {usersWithInstances.map((userItem) => (
                      <SelectItem key={userItem.user_id} value={userItem.user_id}>
                        {userItem.full_name || 'Usuário sem nome'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
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
            <TabsTrigger value="templates" className="gap-2 flex-1 sm:flex-initial">
              <MessageSquareText className="h-4 w-4" />
              <span className="hidden sm:inline">Templates</span>
            </TabsTrigger>
            <TabsTrigger value="metrics" className="gap-2 flex-1 sm:flex-initial">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Métricas</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="conversations" className="flex-1 m-0 overflow-hidden">
          {isMobile ? (
            // Mobile: show one view at a time with analytics sheet
            selectedConversation ? (
              <div className="flex flex-col h-full">
                <div className="p-2 border-b bg-card flex items-center justify-between">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setSelectedConversation(null)}
                    className="gap-2"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Voltar
                  </Button>
                  
                  {/* Analytics Sheet for Mobile */}
                  <Sheet>
                    <SheetTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-2">
                        <BarChart2 className="h-4 w-4" />
                        Análises
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="right" className="w-full sm:w-96 p-0">
                      <SheetHeader className="p-4 border-b">
                        <SheetTitle>Análise da Conversa</SheetTitle>
                      </SheetHeader>
                      <ConversationAnalyticsPanel
                        phone={selectedConversation.phone}
                        contactId={selectedConversation.contactId}
                        contactName={selectedConversation.contactName}
                      />
                    </SheetContent>
                  </Sheet>
                </div>
                <ChatView conversation={selectedConversation} />
              </div>
            ) : (
              <div className="h-full flex flex-col">
                <ConversationList
                  selectedPhone={null}
                  onSelectConversation={setSelectedConversation}
                  filterUserId={filterUserId}
                />
              </div>
            )
          ) : (
            // Desktop: three column layout - List | Chat | Analytics
            <div className="flex h-full">
              {/* Conversations List */}
              <div className="w-80 border-r bg-card flex flex-col shrink-0">
                <ConversationList
                  selectedPhone={selectedConversation?.phone || null}
                  onSelectConversation={setSelectedConversation}
                  filterUserId={filterUserId}
                />
              </div>
              
              {/* Chat View */}
              <div className="flex-1 min-w-0">
                <ChatView conversation={selectedConversation} />
              </div>
              
              {/* Analytics Panel - Only shows when conversation selected */}
              {selectedConversation && (
                <div className="w-80 xl:w-96 border-l bg-card shrink-0">
                  <ConversationAnalyticsPanel
                    phone={selectedConversation.phone}
                    contactId={selectedConversation.contactId}
                    contactName={selectedConversation.contactName}
                  />
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="templates" className="flex-1 m-0 overflow-auto p-4 sm:p-6">
          <WhatsAppTemplatesManager />
        </TabsContent>

        <TabsContent value="metrics" className="flex-1 m-0 overflow-auto">
          <WhatsAppMetrics />
        </TabsContent>
      </Tabs>
    </div>
  );
}