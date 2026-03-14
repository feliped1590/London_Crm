import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useModulePermissions } from '@/hooks/useModulePermissions';

/** Number of days without activity to consider a client inactive */
export const INACTIVITY_TRANSFER_DAYS = 60;

export interface PortfolioProtectionInfo {
  isBlocked: boolean;
  ownerSalesRepId: string | null;
  ownerSalesRepName: string | null;
  lastActivity: {
    date: string | null;
    userName: string | null;
    type: string | null;
    subject: string | null;
  } | null;
  companyId: string;
  companyName: string;
  /** Days since last interaction, null if no activity */
  daysSinceLastActivity: number | null;
  /** Whether the client is considered inactive (> INACTIVITY_TRANSFER_DAYS or no activity) */
  isInactive: boolean;
}

export function usePortfolioProtection(companyId: string | undefined) {
  const { user } = useAuth();
  const { isAdmin } = useModulePermissions();
  const [showProtectionModal, setShowProtectionModal] = useState(false);

  // Get user's linked sales rep IDs
  const { data: mySalesRepIds } = useQuery({
    queryKey: ['my_sales_reps_ids', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from('user_sales_reps')
        .select('sales_rep_id')
        .eq('user_id', user.id);
      return (data || []).map(d => d.sales_rep_id);
    },
    enabled: !!user?.id,
  });

  // Get company's sales rep info
  const { data: companyInfo } = useQuery({
    queryKey: ['company_sales_rep_info', companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data } = await supabase
        .from('companies')
        .select('id, name, fantasia, sales_rep_id, sales_reps(id, name)')
        .eq('id', companyId)
        .single();
      return data;
    },
    enabled: !!companyId,
  });

  // Get last activity using company_activity_summary
  const { data: lastActivity } = useQuery({
    queryKey: ['company_last_activity', companyId],
    queryFn: async () => {
      if (!companyId) return null;

      const { data: summary } = await supabase
        .from('company_activity_summary')
        .select('last_interaction_at, company_created_at')
        .eq('company_id', companyId)
        .maybeSingle();

      const lastInteraction = summary?.last_interaction_at;
      const companyCreated = summary?.company_created_at;

      if (!lastInteraction || lastInteraction === companyCreated) {
        return null;
      }

      // Try to get details of the most recent activity record
      const { data: activityDetail } = await supabase
        .from('activities')
        .select('created_at, created_by, type, subject')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: dealDetail } = await supabase
        .from('deals')
        .select('created_at, name')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: orderDetail } = await supabase
        .from('orders')
        .select('created_at, number')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const actDate = activityDetail?.created_at ? new Date(activityDetail.created_at).getTime() : 0;
      const dealDate = dealDetail?.created_at ? new Date(dealDetail.created_at).getTime() : 0;
      const orderDate = orderDetail?.created_at ? new Date(orderDetail.created_at).getTime() : 0;

      const maxDate = Math.max(actDate, dealDate, orderDate);

      if (maxDate === orderDate && orderDate > 0 && orderDetail) {
        return {
          date: orderDetail.created_at,
          userName: null,
          type: 'Pedido lançado',
          subject: `Pedido #${orderDetail.number}`,
        };
      }

      if (maxDate === dealDate && dealDate > 0 && dealDetail) {
        return {
          date: dealDetail.created_at,
          userName: null,
          type: 'Negócio criado',
          subject: dealDetail.name,
        };
      }

      if (activityDetail) {
        let userName: string | null = null;
        if (activityDetail.created_by) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', activityDetail.created_by)
            .single();
          userName = profile?.full_name || null;
        }
        return {
          date: activityDetail.created_at,
          userName,
          type: activityDetail.type,
          subject: activityDetail.subject,
        };
      }

      return {
        date: lastInteraction,
        userName: null,
        type: 'Interação registrada',
        subject: null,
      };
    },
    enabled: !!companyId,
  });

  const companySalesRepId = (companyInfo as any)?.sales_rep_id || null;
  const companySalesRepName = (companyInfo as any)?.sales_reps?.name || null;
  const companyDisplayName = (companyInfo as any)?.fantasia || (companyInfo as any)?.name || '';

  // Calculate inactivity
  const daysSinceLastActivity = lastActivity?.date
    ? Math.floor((Date.now() - new Date(lastActivity.date).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const isInactive = daysSinceLastActivity === null || daysSinceLastActivity > INACTIVITY_TRANSFER_DAYS;

  // Determine if user is blocked
  const isBlocked = (() => {
    if (isAdmin) return false;
    if (!companySalesRepId) return false;
    if (!mySalesRepIds || mySalesRepIds.length === 0) return true;
    return !mySalesRepIds.includes(companySalesRepId);
  })();

  const protectionInfo: PortfolioProtectionInfo = {
    isBlocked,
    ownerSalesRepId: companySalesRepId,
    ownerSalesRepName: companySalesRepName,
    lastActivity: lastActivity || null,
    companyId: companyId || '',
    companyName: companyDisplayName,
    daysSinceLastActivity,
    isInactive,
  };

  const checkAccess = useCallback((): boolean => {
    if (!isBlocked) return true;
    setShowProtectionModal(true);
    return false;
  }, [isBlocked]);

  return {
    isBlocked,
    protectionInfo,
    showProtectionModal,
    setShowProtectionModal,
    checkAccess,
    isLoaded: mySalesRepIds !== undefined && companyInfo !== undefined,
  };
}
