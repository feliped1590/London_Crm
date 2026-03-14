import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay, subDays, startOfMonth } from 'date-fns';

export type PeriodFilter = 'today' | '7days' | 'month' | 'custom';

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

  const dateRange = useMemo(
    () => getDateRange(period, customStart, customEnd),
    [period, customStart, customEnd]
  );

  const { data, isLoading, error } = useQuery({
    queryKey: ['seller-productivity', dateRange.start.toISOString(), dateRange.end.toISOString(), selectedSellerId],
    queryFn: async () => {
      const params: Record<string, unknown> = {
        p_start_date: dateRange.start.toISOString(),
        p_end_date: dateRange.end.toISOString(),
      };
      if (selectedSellerId) {
        params.p_seller_id = selectedSellerId;
      }
      const { data, error } = await supabase.rpc('get_seller_productivity', params as any);
      if (error) throw error;
      return (data ?? []) as unknown as SellerProductivityRow[];
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
    weights: weights ?? [],
    targets: targets ?? [],
    targetMap,
    isLoading,
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
    dateRange,
    periodType,
  };
}
