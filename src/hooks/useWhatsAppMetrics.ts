import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, subDays, differenceInMinutes, format, parseISO, startOfHour } from 'date-fns';
import { WHATSAPP_ENABLED } from '@/config/features';

export interface WhatsAppMetrics {
  avgFirstResponseTime: number | null; // in minutes
  avgResponseTime: number | null; // in minutes
  totalConversations: number;
  activeConversations: number; // last 7 days
  pendingConversations: number; // awaiting response
  totalMessages: number;
  inboundMessages: number;
  outboundMessages: number;
  responseRate: number; // percentage
}

export interface SellerPerformance {
  userId: string;
  userName: string;
  avgResponseTime: number | null;
  totalConversations: number;
  totalMessages: number;
  responseRate: number;
}

export interface VolumeByDay {
  date: string;
  dayName: string;
  inbound: number;
  outbound: number;
  total: number;
}

export interface VolumeByHour {
  hour: number;
  label: string;
  inbound: number;
  outbound: number;
  total: number;
}

export interface ResponseTimeByDay {
  date: string;
  avgMinutes: number;
}

export interface ContactWithMetrics {
  phone: string;
  contactId: string | null;
  contactName: string | null;
  companyName: string | null;
  totalMessages: number;
  inboundMessages: number;
  outboundMessages: number;
  responseRate: number;
  avgResponseTime: number | null;
  lastMessageAt: string;
  isPending: boolean; // last message is inbound (awaiting response)
}

// Hook to fetch all WhatsApp metrics
export function useWhatsAppMetrics(days: number = 30) {
  return useQuery({
    queryKey: ['whatsapp-metrics', days],
    queryFn: async () => {
      const startDate = subDays(new Date(), days);

      // Fetch messages within the date range
      const { data: messages, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Calculate metrics
      const inboundMessages = messages?.filter(m => m.direction === 'inbound') || [];
      const outboundMessages = messages?.filter(m => m.direction === 'outbound') || [];

      // Get unique phones (conversations)
      const uniquePhones = new Set(messages?.map(m => m.phone) || []);
      const totalConversations = uniquePhones.size;

      // Active conversations (last 7 days)
      const sevenDaysAgo = subDays(new Date(), 7);
      const recentMessages = messages?.filter(m => new Date(m.created_at) >= sevenDaysAgo) || [];
      const activeConversations = new Set(recentMessages.map(m => m.phone)).size;

      // Calculate response times
      const responseTimes: number[] = [];
      const firstResponseTimes: number[] = [];

      // Group messages by phone
      const messagesByPhone = new Map<string, typeof messages>();
      messages?.forEach(msg => {
        const existing = messagesByPhone.get(msg.phone) || [];
        existing.push(msg);
        messagesByPhone.set(msg.phone, existing);
      });

      // For each conversation, find response times
      messagesByPhone.forEach((phoneMessages) => {
        let firstInbound: Date | null = null;
        let firstResponse: Date | null = null;
        let lastInbound: Date | null = null;

        phoneMessages.forEach(msg => {
          const msgDate = new Date(msg.created_at);
          
          if (msg.direction === 'inbound') {
            if (!firstInbound) firstInbound = msgDate;
            lastInbound = msgDate;
          } else if (msg.direction === 'outbound') {
            // First response time
            if (firstInbound && !firstResponse) {
              firstResponse = msgDate;
              const minutes = differenceInMinutes(msgDate, firstInbound);
              if (minutes >= 0 && minutes < 1440) { // max 24 hours
                firstResponseTimes.push(minutes);
              }
            }
            // Response time (time between last inbound and this outbound)
            if (lastInbound) {
              const minutes = differenceInMinutes(msgDate, lastInbound);
              if (minutes >= 0 && minutes < 1440) {
                responseTimes.push(minutes);
              }
              lastInbound = null; // reset
            }
          }
        });
      });

      // Calculate averages
      const avgFirstResponseTime = firstResponseTimes.length > 0
        ? Math.round(firstResponseTimes.reduce((a, b) => a + b, 0) / firstResponseTimes.length)
        : null;

      const avgResponseTime = responseTimes.length > 0
        ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
        : null;

      // Response rate (conversations with at least one response) and pending
      let conversationsWithResponse = 0;
      let conversationsWithInbound = 0;
      let pendingConversations = 0;

      messagesByPhone.forEach((phoneMessages) => {
        const hasInbound = phoneMessages.some(m => m.direction === 'inbound');
        const hasOutbound = phoneMessages.some(m => m.direction === 'outbound');
        if (hasInbound) {
          conversationsWithInbound++;
          if (hasOutbound) conversationsWithResponse++;
        }
        
        // Check if pending (last message is inbound)
        const sortedMsgs = [...phoneMessages].sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        if (sortedMsgs[0]?.direction === 'inbound') {
          pendingConversations++;
        }
      });

      const responseRate = conversationsWithInbound > 0
        ? Math.round((conversationsWithResponse / conversationsWithInbound) * 100)
        : 100;

      const metrics: WhatsAppMetrics = {
        avgFirstResponseTime,
        avgResponseTime,
        totalConversations,
        activeConversations,
        pendingConversations,
        totalMessages: messages?.length || 0,
        inboundMessages: inboundMessages.length,
        outboundMessages: outboundMessages.length,
        responseRate
      };

      return metrics;
    },
    enabled: WHATSAPP_ENABLED,
  });
}

// Hook to fetch volume by day of week
export function useVolumeByDay(days: number = 30) {
  return useQuery({
    queryKey: ['whatsapp-volume-by-day', days],
    queryFn: async () => {
      const startDate = subDays(new Date(), days);

      const { data: messages, error } = await supabase
        .from('whatsapp_messages')
        .select('direction, created_at')
        .gte('created_at', startDate.toISOString());

      if (error) throw error;

      // Initialize day counters
      const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      const volumeByDay: VolumeByDay[] = dayNames.map((name, index) => ({
        date: index.toString(),
        dayName: name,
        inbound: 0,
        outbound: 0,
        total: 0
      }));

      // Count messages by day of week
      messages?.forEach(msg => {
        const dayOfWeek = new Date(msg.created_at).getDay();
        if (msg.direction === 'inbound') {
          volumeByDay[dayOfWeek].inbound++;
        } else {
          volumeByDay[dayOfWeek].outbound++;
        }
        volumeByDay[dayOfWeek].total++;
      });

      return volumeByDay;
    },
    enabled: WHATSAPP_ENABLED,
  });
}

// Hook to fetch volume by hour
export function useVolumeByHour(days: number = 30) {
  return useQuery({
    queryKey: ['whatsapp-volume-by-hour', days],
    queryFn: async () => {
      const startDate = subDays(new Date(), days);

      const { data: messages, error } = await supabase
        .from('whatsapp_messages')
        .select('direction, created_at')
        .gte('created_at', startDate.toISOString());

      if (error) throw error;

      // Initialize hour counters
      const volumeByHour: VolumeByHour[] = Array.from({ length: 24 }, (_, i) => ({
        hour: i,
        label: `${i.toString().padStart(2, '0')}h`,
        inbound: 0,
        outbound: 0,
        total: 0
      }));

      // Count messages by hour
      messages?.forEach(msg => {
        const hour = new Date(msg.created_at).getHours();
        if (msg.direction === 'inbound') {
          volumeByHour[hour].inbound++;
        } else {
          volumeByHour[hour].outbound++;
        }
        volumeByHour[hour].total++;
      });

      return volumeByHour;
    },
    enabled: WHATSAPP_ENABLED,
  });
}

// Hook to fetch seller performance
export function useSellerPerformance(days: number = 30) {
  return useQuery({
    queryKey: ['whatsapp-seller-performance', days],
    queryFn: async () => {
      const startDate = subDays(new Date(), days);

      // Get instances with their users
      const { data: instances, error: instancesError } = await supabase
        .from('whatsapp_instances')
        .select('id, user_id, name');

      if (instancesError) throw instancesError;

      // Get profiles for user names
      const userIds = [...new Set(instances?.map(i => i.user_id) || [])];
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      // Get messages
      const { data: messages, error: messagesError } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      if (messagesError) throw messagesError;

      // Map instance IDs to user IDs
      const instanceToUser = new Map<string, string>();
      instances?.forEach(i => instanceToUser.set(i.id, i.user_id));

      // Group messages by user
      const messagesByUser = new Map<string, typeof messages>();
      messages?.forEach(msg => {
        if (!msg.instance_id) return;
        const userId = instanceToUser.get(msg.instance_id);
        if (!userId) return;
        
        const existing = messagesByUser.get(userId) || [];
        existing.push(msg);
        messagesByUser.set(userId, existing);
      });

      // Calculate performance per user
      const performance: SellerPerformance[] = [];

      messagesByUser.forEach((userMessages, userId) => {
        const profile = profiles?.find(p => p.user_id === userId);
        
        // Group by phone for this user
        const byPhone = new Map<string, typeof userMessages>();
        userMessages.forEach(msg => {
          const existing = byPhone.get(msg.phone) || [];
          existing.push(msg);
          byPhone.set(msg.phone, existing);
        });

        // Calculate response times
        const responseTimes: number[] = [];
        let conversationsWithResponse = 0;
        let conversationsWithInbound = 0;

        byPhone.forEach((phoneMessages) => {
          let lastInbound: Date | null = null;
          const hasInbound = phoneMessages.some(m => m.direction === 'inbound');
          const hasOutbound = phoneMessages.some(m => m.direction === 'outbound');

          if (hasInbound) {
            conversationsWithInbound++;
            if (hasOutbound) conversationsWithResponse++;
          }

          phoneMessages.forEach(msg => {
            const msgDate = new Date(msg.created_at);
            
            if (msg.direction === 'inbound') {
              lastInbound = msgDate;
            } else if (msg.direction === 'outbound' && lastInbound) {
              const minutes = differenceInMinutes(msgDate, lastInbound);
              if (minutes >= 0 && minutes < 1440) {
                responseTimes.push(minutes);
              }
              lastInbound = null;
            }
          });
        });

        const avgResponseTime = responseTimes.length > 0
          ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
          : null;

        const responseRate = conversationsWithInbound > 0
          ? Math.round((conversationsWithResponse / conversationsWithInbound) * 100)
          : 100;

        performance.push({
          userId,
          userName: profile?.full_name || 'Usuário sem nome',
          avgResponseTime,
          totalConversations: byPhone.size,
          totalMessages: userMessages.length,
          responseRate
        });
      });

      // Sort by response time (nulls last)
      performance.sort((a, b) => {
        if (a.avgResponseTime === null && b.avgResponseTime === null) return 0;
        if (a.avgResponseTime === null) return 1;
        if (b.avgResponseTime === null) return -1;
        return a.avgResponseTime - b.avgResponseTime;
      });

      return performance;
    },
    enabled: WHATSAPP_ENABLED,
  });
}

// Hook to fetch response time trend
export function useResponseTimeTrend(days: number = 30) {
  return useQuery({
    queryKey: ['whatsapp-response-time-trend', days],
    queryFn: async () => {
      const startDate = subDays(new Date(), days);

      const { data: messages, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Group messages by phone
      const messagesByPhone = new Map<string, typeof messages>();
      messages?.forEach(msg => {
        const existing = messagesByPhone.get(msg.phone) || [];
        existing.push(msg);
        messagesByPhone.set(msg.phone, existing);
      });

      // Calculate response times by date
      const responseTimesByDate = new Map<string, number[]>();

      messagesByPhone.forEach((phoneMessages) => {
        let lastInbound: Date | null = null;

        phoneMessages.forEach(msg => {
          const msgDate = new Date(msg.created_at);
          
          if (msg.direction === 'inbound') {
            lastInbound = msgDate;
          } else if (msg.direction === 'outbound' && lastInbound) {
            const minutes = differenceInMinutes(msgDate, lastInbound);
            if (minutes >= 0 && minutes < 1440) {
              const dateKey = format(msgDate, 'yyyy-MM-dd');
              const existing = responseTimesByDate.get(dateKey) || [];
              existing.push(minutes);
              responseTimesByDate.set(dateKey, existing);
            }
            lastInbound = null;
          }
        });
      });

      // Convert to array with averages
      const trend: ResponseTimeByDay[] = [];
      responseTimesByDate.forEach((times, date) => {
        const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
        trend.push({ date, avgMinutes: avg });
      });

      // Sort by date
      trend.sort((a, b) => a.date.localeCompare(b.date));

      return trend;
    },
    enabled: WHATSAPP_ENABLED,
  });
}

// Hook to fetch contacts with individual metrics
export function useContactsWithMetrics(days: number = 30) {
  return useQuery({
    queryKey: ['whatsapp-contacts-metrics', days],
    queryFn: async () => {
      const startDate = subDays(new Date(), days);

      // Fetch messages with contact and company info
      const { data: messages, error } = await supabase
        .from('whatsapp_messages')
        .select('id, phone, direction, message_type, content, created_at, contact_id, company_id')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Get unique contact and company IDs from messages
      const contactIds = [...new Set(messages?.map(m => m.contact_id).filter(Boolean) || [])] as string[];
      const companyIds = [...new Set(messages?.map(m => m.company_id).filter(Boolean) || [])] as string[];

      // Fetch contacts for names
      const { data: contacts } = contactIds.length > 0 
        ? await supabase.from('contacts').select('id, name').in('id', contactIds)
        : { data: [] };

      // Fetch companies for names
      const { data: companies } = companyIds.length > 0
        ? await supabase.from('companies').select('id, name').in('id', companyIds)
        : { data: [] };

      // Build lookup maps
      const contactMap = new Map<string, string>();
      contacts?.forEach(c => contactMap.set(c.id, c.name));
      const companyMap = new Map<string, string>();
      companies?.forEach(c => companyMap.set(c.id, c.name));

      // Group messages by phone
      const messagesByPhone = new Map<string, typeof messages>();
      messages?.forEach(msg => {
        const existing = messagesByPhone.get(msg.phone) || [];
        existing.push(msg);
        messagesByPhone.set(msg.phone, existing);
      });

      // Calculate metrics per contact
      const contactsMetrics: ContactWithMetrics[] = [];

      messagesByPhone.forEach((phoneMessages, phone) => {
        if (!phoneMessages || phoneMessages.length === 0) return;
        
        // Get contact/company from first message with data
        const msgWithContact = phoneMessages.find(m => m.contact_id);
        const msgWithCompany = phoneMessages.find(m => m.company_id);
        const contactId = msgWithContact?.contact_id || null;
        const companyId = msgWithCompany?.company_id || null;
        const contactName = contactId ? contactMap.get(contactId) || null : null;
        const companyName = companyId ? companyMap.get(companyId) || null : null;

        const inboundMsgs = phoneMessages.filter(m => m.direction === 'inbound');
        const outboundMsgs = phoneMessages.filter(m => m.direction === 'outbound');

        // Calculate response times
        const responseTimes: number[] = [];
        let lastInbound: Date | null = null;

        phoneMessages.forEach(msg => {
          const msgDate = new Date(msg.created_at);
          if (msg.direction === 'inbound') {
            lastInbound = msgDate;
          } else if (msg.direction === 'outbound' && lastInbound) {
            const minutes = differenceInMinutes(msgDate, lastInbound);
            if (minutes >= 0 && minutes < 1440) {
              responseTimes.push(minutes);
            }
            lastInbound = null;
          }
        });

        const avgResponseTime = responseTimes.length > 0
          ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
          : null;

        // Response rate for this contact
        const hasInbound = inboundMsgs.length > 0;
        const hasOutbound = outboundMsgs.length > 0;
        const responseRate = hasInbound && hasOutbound ? 100 : (hasInbound && !hasOutbound ? 0 : 100);

        // Check if pending (last message is inbound)
        const sortedMsgs = [...phoneMessages].sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        const isPending = sortedMsgs[0]?.direction === 'inbound';
        const lastMessageAt = sortedMsgs[0]?.created_at || '';

        contactsMetrics.push({
          phone,
          contactId,
          contactName,
          companyName,
          totalMessages: phoneMessages.length,
          inboundMessages: inboundMsgs.length,
          outboundMessages: outboundMsgs.length,
          responseRate,
          avgResponseTime,
          lastMessageAt,
          isPending
        });
      });

      // Sort by last message (most recent first)
      contactsMetrics.sort((a, b) => 
        new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
      );

      return contactsMetrics;
    },
    enabled: WHATSAPP_ENABLED,
  });
}
