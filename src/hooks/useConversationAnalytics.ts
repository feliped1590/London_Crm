import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ContactMetrics {
  totalMessages: number;
  sentMessages: number;
  receivedMessages: number;
  responseRate: number;
  avgResponseTimeMinutes: number | null;
  firstMessageAt: string | null;
  lastMessageAt: string | null;
  isPending: boolean;
  lastMessageDirection: 'inbound' | 'outbound' | null;
}

export interface ConversationSummary {
  id: string;
  phone: string;
  contact_id: string | null;
  summary: string;
  sentiment: 'positive' | 'neutral' | 'negative' | null;
  customer_intent: string | null;
  next_steps: string[] | null;
  message_count: number | null;
  analyzed_at: string;
}

export interface ConversationObjection {
  id: string;
  phone: string;
  contact_id: string | null;
  type: 'price' | 'timing' | 'competition' | 'authority' | 'need' | 'other';
  description: string;
  message_excerpt: string | null;
  status: 'raised' | 'addressed' | 'resolved';
  resolution: string | null;
  detected_at: string;
}

// Hook to get metrics for a specific phone number
export function useContactMetrics(phone: string | null) {
  return useQuery({
    queryKey: ['contact-metrics', phone],
    queryFn: async (): Promise<ContactMetrics> => {
      if (!phone) throw new Error('Phone is required');

      const { data: messages, error } = await supabase
        .from('whatsapp_messages')
        .select('id, direction, created_at')
        .eq('phone', phone)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const sent = messages?.filter(m => m.direction === 'outbound').length || 0;
      const received = messages?.filter(m => m.direction === 'inbound').length || 0;
      const total = messages?.length || 0;

      // Calculate response rate (outbound responses to inbound)
      let responses = 0;
      let inboundCount = 0;
      for (let i = 0; i < (messages?.length || 0); i++) {
        if (messages![i].direction === 'inbound') {
          inboundCount++;
          // Check if there's an outbound after this
          for (let j = i + 1; j < messages!.length; j++) {
            if (messages![j].direction === 'outbound') {
              responses++;
              break;
            }
            if (messages![j].direction === 'inbound') break;
          }
        }
      }
      const responseRate = inboundCount > 0 ? Math.round((responses / inboundCount) * 100) : 100;

      // Calculate average response time
      let totalResponseTime = 0;
      let responseCount = 0;
      for (let i = 0; i < (messages?.length || 0) - 1; i++) {
        if (messages![i].direction === 'inbound') {
          for (let j = i + 1; j < messages!.length; j++) {
            if (messages![j].direction === 'outbound') {
              const inboundTime = new Date(messages![i].created_at).getTime();
              const outboundTime = new Date(messages![j].created_at).getTime();
              totalResponseTime += (outboundTime - inboundTime) / 1000 / 60; // minutes
              responseCount++;
              break;
            }
            if (messages![j].direction === 'inbound') break;
          }
        }
      }
      const avgResponseTimeMinutes = responseCount > 0 ? Math.round(totalResponseTime / responseCount) : null;

      const lastMessage = messages && messages.length > 0 ? messages[messages.length - 1] : null;

      return {
        totalMessages: total,
        sentMessages: sent,
        receivedMessages: received,
        responseRate,
        avgResponseTimeMinutes,
        firstMessageAt: messages && messages.length > 0 ? messages[0].created_at : null,
        lastMessageAt: lastMessage?.created_at || null,
        isPending: lastMessage?.direction === 'inbound',
        lastMessageDirection: lastMessage?.direction as 'inbound' | 'outbound' | null,
      };
    },
    enabled: !!phone,
  });
}

// Hook to get conversation summary
export function useConversationSummary(phone: string | null) {
  return useQuery({
    queryKey: ['conversation-summary', phone],
    queryFn: async (): Promise<ConversationSummary | null> => {
      if (!phone) return null;

      const { data, error } = await supabase
        .from('whatsapp_conversation_summaries')
        .select('*')
        .eq('phone', phone)
        .order('analyzed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as ConversationSummary | null;
    },
    enabled: !!phone,
  });
}

// Hook to get conversation objections
export function useConversationObjections(phone: string | null) {
  return useQuery({
    queryKey: ['conversation-objections', phone],
    queryFn: async (): Promise<ConversationObjection[]> => {
      if (!phone) return [];

      const { data, error } = await supabase
        .from('whatsapp_objections')
        .select('*')
        .eq('phone', phone)
        .order('detected_at', { ascending: false });

      if (error) throw error;
      return (data || []) as ConversationObjection[];
    },
    enabled: !!phone,
  });
}

// Mutation to generate/refresh AI summary
export function useGenerateConversationSummary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ phone, contactId }: { phone: string; contactId?: string | null }) => {
      const { data, error } = await supabase.functions.invoke('analyze-whatsapp-conversation', {
        body: { phone, contactId },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['conversation-summary', variables.phone] });
      queryClient.invalidateQueries({ queryKey: ['conversation-objections', variables.phone] });
    },
  });
}

// Mutation to update objection status
export function useUpdateObjectionStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      objectionId, 
      status, 
      resolution 
    }: { 
      objectionId: string; 
      status: 'raised' | 'addressed' | 'resolved'; 
      resolution?: string;
    }) => {
      const { error } = await supabase
        .from('whatsapp_objections')
        .update({ status, resolution })
        .eq('id', objectionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversation-objections'] });
    },
  });
}
