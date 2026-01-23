import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, subDays, differenceInMinutes, format, parseISO, startOfHour } from 'date-fns';

export interface WhatsAppMetrics {
  avgFirstResponseTime: number | null; // in minutes
  avgResponseTime: number | null; // in minutes
  totalConversations: number;
  activeConversations: number; // last 7 days
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

      // Response rate (conversations with at least one response)
      let conversationsWithResponse = 0;
      let conversationsWithInbound = 0;

      messagesByPhone.forEach((phoneMessages) => {
        const hasInbound = phoneMessages.some(m => m.direction === 'inbound');
        const hasOutbound = phoneMessages.some(m => m.direction === 'outbound');
        if (hasInbound) {
          conversationsWithInbound++;
          if (hasOutbound) conversationsWithResponse++;
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
        totalMessages: messages?.length || 0,
        inboundMessages: inboundMessages.length,
        outboundMessages: outboundMessages.length,
        responseRate
      };

      return metrics;
    }
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
    }
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
    }
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
    }
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
    }
  });
}
