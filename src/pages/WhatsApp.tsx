import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConversationList } from '@/components/whatsapp/ConversationList';
import { ChatView } from '@/components/whatsapp/ChatView';
import { InstanceManager } from '@/components/whatsapp/InstanceManager';
import { WhatsAppMetrics } from '@/components/whatsapp/WhatsAppMetrics';
import { Conversation, useWhatsAppRealtime, useUnreadCount } from '@/hooks/useWhatsApp';
import { MessageSquare, Smartphone, ArrowLeft, Users, BarChart3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

export default function WhatsApp() {
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
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

  return (
    <div className="h-[calc(100vh-4rem)]">
      <Tabs defaultValue="conversations" className="h-full flex flex-col">
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
            <TabsTrigger value="instances" className="gap-2 flex-1 sm:flex-initial">
              <Smartphone className="h-4 w-4" />
              <span className="hidden sm:inline">Instâncias</span>
            </TabsTrigger>
            <TabsTrigger value="metrics" className="gap-2 flex-1 sm:flex-initial">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Métricas</span>
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
                  filterUserId={filterUserId}
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
                    filterUserId={filterUserId}
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

        <TabsContent value="metrics" className="flex-1 m-0 overflow-auto">
          <WhatsAppMetrics />
        </TabsContent>
      </Tabs>
    </div>
  );
}
