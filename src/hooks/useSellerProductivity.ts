import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay, subDays, startOfMonth } from 'date-fns';

export type PeriodFilter = 'today' | '7days' | 'month' | 'custom';
export type ProductivityMode = 'user' | 'sales_rep';

export interface SellerProductivityRow {
  seller_id: string;
  seller_name: string;
  total_interactions: number;
  interaction_score: number;
  rank_position: number;
  participation_percent: number;
  efficiency_rate: number;
  proposal_conversion_rate: number;
  pipeline_conversion_rate: number;
  activities: number;
  tasks_created: number;
  tasks_completed: number;
  stage_changes: number;
  proposals: number;
  orders: number;
  notes: number;
  emails: number;
  deal_updates: number;
}

export interface ActivityWeight {
  id: string;
  type: string;
  label: string;
  weight: number;
  updated_at: string;
  updated_by: string | null;
}

export interface ProductivityTarget {
  id: string;
  seller_id: string;
  period_type: 'week' | 'month';
  target_score: number;
}

export interface ProductivityManagerOption {
  id: string;
  name: string;
  email: string | null;
  label: string | null;
}

function getDateRange(period: PeriodFilter, customStart?: Date, customEnd?: Date) {
  const now = new Date();
  switch (period) {
    case 'today':
      return { start: startOfDay(now), end: endOfDay(now) };
    case '7days':
      return { start: startOfDay(subDays(now, 6)), end: endOfDay(now) };
    case 'month':
      return { start: startOfMonth(now), end: endOfDay(now) };
    case 'custom':
      return {
        start: customStart ? startOfDay(customStart) : startOfDay(subDays(now, 29)),
        end: customEnd ? endOfDay(customEnd) : endOfDay(now),
      };
  }
}

function periodToPeriodType(period: PeriodFilter): 'week' | 'month' {
  return period === '7days' ? 'week' : 'month';
}

export function useSellerProductivity() {
  const [period, setPeriod] = useState<PeriodFilter>('month');
  const [customStart, setCustomStart] = useState<Date | undefined>();
  const [customEnd, setCustomEnd] = useState<Date | undefined>();
  const [selectedSellerId, setSelectedSellerId] = useState<string | undefined>();
  const [selectedManagerId, setSelectedManagerId] = useState<string | undefined>();
  const [mode, setMode] = useState<ProductivityMode>('user');

  const dateRange = useMemo(
    () => getDateRange(period, customStart, customEnd),
    [period, customStart, customEnd]
  );

  const { data, isLoading, error } = useQuery({
    queryKey: ['seller-productivity', mode, dateRange.start.toISOString(), dateRange.end.toISOString(), selectedSellerId, selectedManagerId],
    queryFn: async () => {
      const params: Record<string, unknown> = {
        p_start_date: dateRange.start.toISOString(),
        p_end_date: dateRange.end.toISOString(),
      };
      if (selectedManagerId) {
        params.p_manager_user_id = selectedManagerId;
      }
      const rpcName = mode === 'sales_rep' ? 'get_sales_rep_productivity' : 'get_seller_productivity';
      if (selectedSellerId) {
        if (mode === 'sales_rep') {
          params.p_sales_rep_id = selectedSellerId;
        } else {
          params.p_seller_id = selectedSellerId;
        }
      }
      const { data, error } = await supabase.rpc(rpcName as any, params as any);
      if (error) throw error;
      return (data ?? []) as unknown as SellerProductivityRow[];
    },
  });

  const { data: managers, isLoading: isLoadingManagers } = useQuery({
    queryKey: ['productivity-managers'],
    queryFn: async () => {
      const { data: managerLinks, error } = await (supabase as any)
        .from('manager_users')
        .select('manager_user_id, label')
        .order('manager_user_id', { ascending: true });
      if (error) throw error;

      const managerIds = Array.from(
        new Set<string>((managerLinks ?? []).map((link: any) => link.manager_user_id).filter(Boolean))
      );

      if (managerIds.length === 0) return [] as ProductivityManagerOption[];

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', managerIds);
      if (profilesError) throw profilesError;

      const profileMap = new Map((profiles ?? []).map((profile) => [profile.user_id, profile]));

      const managerMap = new Map<string, ProductivityManagerOption>();

      (managerLinks ?? []).forEach((link: any) => {
        const id = link.manager_user_id;
        const profile = profileMap.get(id);
        if (!id || managerMap.has(id)) return;

        managerMap.set(id, {
          id,
          name: profile?.full_name || profile?.email || 'Sem nome',
          email: profile?.email ?? null,
          label: link.label ?? null,
        });
      });

      return Array.from(managerMap.values())
        .sort((a, b) => a.name.localeCompare(b.name)) as ProductivityManagerOption[];
    },
  });

  const { data: weights, isLoading: isLoadingWeights } = useQuery({
    queryKey: ['activity-weights'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_activity_weights')
        .select('*')
        .order('weight', { ascending: false });
      if (error) throw error;
      return data as unknown as ActivityWeight[];
    },
  });

  const periodType = periodToPeriodType(period);

  const { data: targets, isLoading: isLoadingTargets } = useQuery({
    queryKey: ['productivity-targets', periodType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_productivity_targets')
        .select('*')
        .eq('period_type', periodType);
      if (error) throw error;
      return data as unknown as ProductivityTarget[];
    },
  });

  const targetMap = useMemo(() => {
    const map = new Map<string, number>();
    (targets ?? []).forEach((t) => map.set(t.seller_id, t.target_score));
    return map;
  }, [targets]);

  return {
    data: data ?? [],
    managers: managers ?? [],
    weights: weights ?? [],
    targets: targets ?? [],
    targetMap,
    isLoading,
    isLoadingManagers,
    isLoadingWeights,
    isLoadingTargets,
    error,
    period,
    setPeriod,
    customStart,
    setCustomStart,
    customEnd,
    setCustomEnd,
    selectedSellerId,
    setSelectedSellerId,
    selectedManagerId,
    setSelectedManagerId,
    dateRange,
    periodType,
    mode,
    setMode,
  };
}
