import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';
import { toast } from 'sonner';

export interface WhatsAppInstance {
  id: string;
  user_id: string;
  instance_id: string;
  instance_token: string;
  phone_number: string | null;
  name: string;
  status: string;
  connected_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppMessage {
  id: string;
  instance_id: string | null;
  contact_id: string | null;
  company_id: string | null;
  phone: string;
  direction: 'inbound' | 'outbound';
  message_type: string;
  content: string | null;
  media_url: string | null;
  status: string;
  zapi_message_id: string | null;
  is_read: boolean;
  created_at: string;
}

export interface WhatsAppContact {
  id: string;
  contact_id: string | null;
  phone_number: string;
  profile_name: string | null;
  profile_picture_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  phone: string;
  profileName: string | null;
  profilePicture: string | null;
  lastMessage: WhatsAppMessage;
  unreadCount: number;
  contactId: string | null;
  contactName: string | null;
}

// Fetch all instances
export function useWhatsAppInstances() {
  return useQuery({
    queryKey: ['whatsapp-instances'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as WhatsAppInstance[];
    }
  });
}

// Fetch conversations (grouped messages by phone)
export function useWhatsAppConversations() {
  return useQuery({
    queryKey: ['whatsapp-conversations'],
    queryFn: async () => {
      // Get all messages
      const { data: messages, error: messagesError } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .order('created_at', { ascending: false });

      if (messagesError) throw messagesError;

      // Get all whatsapp contacts
      const { data: waContacts, error: waContactsError } = await supabase
        .from('whatsapp_contacts')
        .select('*');

      if (waContactsError) throw waContactsError;

      // Get all CRM contacts
      const { data: crmContacts, error: crmContactsError } = await supabase
        .from('contacts')
        .select('id, first_name, last_name');

      if (crmContactsError) throw crmContactsError;

      // Group messages by phone number
      const conversationMap = new Map<string, Conversation>();

      (messages as WhatsAppMessage[]).forEach((msg) => {
        const existing = conversationMap.get(msg.phone);
        const waContact = (waContacts as WhatsAppContact[]).find(c => c.phone_number === msg.phone);
        const crmContact = waContact?.contact_id 
          ? (crmContacts as { id: string; first_name: string; last_name: string | null }[]).find(c => c.id === waContact.contact_id)
          : null;

        if (!existing) {
          conversationMap.set(msg.phone, {
            phone: msg.phone,
            profileName: waContact?.profile_name || null,
            profilePicture: waContact?.profile_picture_url || null,
            lastMessage: msg,
            unreadCount: msg.direction === 'inbound' && !msg.is_read ? 1 : 0,
            contactId: waContact?.contact_id || null,
            contactName: crmContact ? `${crmContact.first_name} ${crmContact.last_name || ''}`.trim() : null
          });
        } else {
          if (!msg.is_read && msg.direction === 'inbound') {
            existing.unreadCount++;
          }
        }
      });

      return Array.from(conversationMap.values()).sort(
        (a, b) => new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime()
      );
    }
  });
}

// Fetch messages for a specific phone
export function useWhatsAppMessages(phone: string | null) {
  return useQuery({
    queryKey: ['whatsapp-messages', phone],
    queryFn: async () => {
      if (!phone) return [];

      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('phone', phone)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as WhatsAppMessage[];
    },
    enabled: !!phone
  });
}

// Fetch unread count
export function useUnreadCount() {
  return useQuery({
    queryKey: ['whatsapp-unread-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('whatsapp_messages')
        .select('*', { count: 'exact', head: true })
        .eq('direction', 'inbound')
        .eq('is_read', false);

      if (error) throw error;
      return count || 0;
    }
  });
}

// Add instance mutation
export function useAddInstance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { name: string; instance_id: string; instance_token: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: instance, error } = await supabase
        .from('whatsapp_instances')
        .insert({
          user_id: user.id,
          name: data.name,
          instance_id: data.instance_id,
          instance_token: data.instance_token,
          status: 'disconnected'
        })
        .select()
        .single();

      if (error) throw error;
      return instance;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-instances'] });
      toast.success('Instância adicionada com sucesso!');
    },
    onError: (error) => {
      toast.error(`Erro ao adicionar instância: ${error.message}`);
    }
  });
}

// Send message mutation
export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { instanceId: string; phone: string; message: string }) => {
      const { data: result, error } = await supabase.functions.invoke('zapi-send-message', {
        body: data
      });

      if (error) throw error;
      if (result.error) throw new Error(result.error);

      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-messages', variables.phone] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] });
    },
    onError: (error) => {
      toast.error(`Erro ao enviar mensagem: ${error.message}`);
    }
  });
}

// Mark messages as read mutation
export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (phone: string) => {
      const { error } = await supabase
        .from('whatsapp_messages')
        .update({ is_read: true })
        .eq('phone', phone)
        .eq('direction', 'inbound')
        .eq('is_read', false);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-unread-count'] });
    }
  });
}

// Check instance status mutation
export function useCheckInstanceStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (instanceId: string) => {
      const { data: result, error } = await supabase.functions.invoke('zapi-instance-status', {
        body: {},
        method: 'GET',
        headers: {}
      });

      // Need to use fetch with query params for GET request
      const { data: session } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zapi-instance-status?instanceId=${instanceId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.session?.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-instances'] });
    }
  });
}

// Real-time subscription hook
export function useWhatsAppRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('whatsapp-messages-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'whatsapp_messages'
        },
        (payload) => {
          console.log('New WhatsApp message:', payload);
          queryClient.invalidateQueries({ queryKey: ['whatsapp-messages'] });
          queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] });
          queryClient.invalidateQueries({ queryKey: ['whatsapp-unread-count'] });

          // Show notification for inbound messages
          const message = payload.new as WhatsAppMessage;
          if (message.direction === 'inbound') {
            toast.info(`Nova mensagem de ${message.phone}`, {
              description: message.content?.substring(0, 50) || 'Mensagem recebida'
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
