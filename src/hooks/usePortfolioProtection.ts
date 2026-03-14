import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useModulePermissions } from '@/hooks/useModulePermissions';

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

  // Get last activity using company_activity_summary (considers activities, tasks, emails, whatsapp, deals)
  const { data: lastActivity } = useQuery({
    queryKey: ['company_last_activity', companyId],
    queryFn: async () => {
      if (!companyId) return null;

      // Get last_interaction_at from the unified view
      const { data: summary } = await supabase
        .from('company_activity_summary')
        .select('last_interaction_at, company_created_at')
        .eq('company_id', companyId)
        .maybeSingle();

      const lastInteraction = summary?.last_interaction_at;
      const companyCreated = summary?.company_created_at;

      // If last_interaction_at equals company created_at, there's no real activity
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

      // Also check deals
      const { data: dealDetail } = await supabase
        .from('deals')
        .select('created_at, title')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Pick the most recent between activity and deal
      const actDate = activityDetail?.created_at ? new Date(activityDetail.created_at).getTime() : 0;
      const dealDate = dealDetail?.created_at ? new Date(dealDetail.created_at).getTime() : 0;

      if (dealDate > actDate && dealDetail) {
        return {
          date: dealDetail.created_at,
          userName: null,
          type: 'Negócio criado',
          subject: dealDetail.title,
        };
      }

      if (activityDetail) {
        // Get creator name
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

      // Fallback: show the interaction date from the view
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

  // Determine if user is blocked
  const isBlocked = (() => {
    if (isAdmin) return false;
    if (!companySalesRepId) return false; // No sales rep assigned, allow
    if (!mySalesRepIds || mySalesRepIds.length === 0) return true; // User has no reps
    return !mySalesRepIds.includes(companySalesRepId);
  })();

  const protectionInfo: PortfolioProtectionInfo = {
    isBlocked,
    ownerSalesRepId: companySalesRepId,
    ownerSalesRepName: companySalesRepName,
    lastActivity: lastActivity || null,
    companyId: companyId || '',
    companyName: companyDisplayName,
  };

  /**
   * Call this before any write action (create note, activity, task).
   * Returns true if action is allowed, false if blocked (modal shown).
   */
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
