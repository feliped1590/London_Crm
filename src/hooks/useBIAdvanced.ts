import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';
import { subDays, format } from 'date-fns';
import { useLegalEntities } from '@/hooks/useLegalEntities';

export interface PipelineHealthData {
  stage: string;
  stage_order: number;
  total_deals: number;
  total_value: number;
  avg_days_in_stage: number;
  sla_hours: number | null;
  deals_over_sla: number;
  sla_violation_rate: number;
  advancement_rate: number;
}

export interface SellerPerformanceData {
  seller_id: string;
  seller_name: string;
  deals_created: number;
  deals_won: number;
  deals_lost: number;
  total_value_won: number;
  conversion_rate: number;
  avg_cycle_days: number;
  deals_stalled: number;
  prev_deals_created: number;
  prev_deals_won: number;
  prev_conversion_rate: number;
}

export interface AnomalyData {
  anomaly_type: string;
  severity: 'critical' | 'warning';
  title: string;
  description: string;
  affected_count: number;
  affected_value: number;
  action_label: string;
  filter_params: Record<string, any>;
}

export interface StalledDealData {
  deal_id: string;
  deal_name: string;
  company_name: string | null;
  stage: string;
  value: number | null;
  days_stalled: number;
  owner_id: string;
  owner_name: string | null;
}

export interface ConversionByStageData {
  stage: string;
  stage_order: number;
  entered_count: number;
  exited_count: number;
  conversion_rate: number;
}

export interface BIFilters {
  startDate: Date;
  endDate: Date;
  sellerId?: string;
  pipelineId?: string;
  legalEntityId?: string;
}

export function useBIAdvanced() {
  const { activeLegalEntityId } = useLegalEntities();
  const [filters, setFiltersRaw] = useState<BIFilters>({
    startDate: subDays(new Date(), 30),
    endDate: new Date(),
  });
  // Empresa Ativa entra automaticamente quando o filtro local não definir entidade.
  const effectiveLegalEntityId = queryLegalEntityId ?? activeLegalEntityId ?? undefined;
  const setFilters = setFiltersRaw;
  // Mantemos `filters` imutável para os consumidores; injetamos a entidade ativa apenas para queries.
  const queryLegalEntityId = effectiveLegalEntityId;

  // Pipeline Health
  const {
    data: pipelineHealth,
    isLoading: isLoadingPipelineHealth,
    isError: isPipelineHealthError,
    error: pipelineHealthError,
    refetch: refetchPipelineHealth,
  } = useQuery({
    queryKey: ['bi-pipeline-health', filters.startDate, filters.endDate, filters.pipelineId, queryLegalEntityId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_pipeline_health', {
        p_pipeline_id: filters.pipelineId || null,
        p_start_date: format(filters.startDate, 'yyyy-MM-dd'),
        p_end_date: format(filters.endDate, 'yyyy-MM-dd'),
        p_legal_entity_id: queryLegalEntityId || null,
      } as any);
      if (error) throw error;
      return (data || []) as PipelineHealthData[];
    },
  });

  // Seller Performance
  const {
    data: sellerPerformance,
    isLoading: isLoadingSellerPerformance,
    isError: isSellerPerformanceError,
    error: sellerPerformanceError,
    refetch: refetchSellerPerformance,
  } = useQuery({
    queryKey: ['bi-seller-performance', filters.startDate, filters.endDate, queryLegalEntityId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_seller_performance', {
        p_start_date: format(filters.startDate, 'yyyy-MM-dd'),
        p_end_date: format(filters.endDate, 'yyyy-MM-dd'),
        p_compare_previous: true,
        p_legal_entity_id: queryLegalEntityId || null,
      } as any);
      if (error) throw error;
      return (data || []) as SellerPerformanceData[];
    },
  });

  // Anomalies
  const {
    data: anomalies,
    isLoading: isLoadingAnomalies,
    isError: isAnomaliesError,
    error: anomaliesError,
    refetch: refetchAnomalies,
  } = useQuery({
    queryKey: ['bi-anomalies', queryLegalEntityId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_bi_anomalies', {
        p_legal_entity_id: queryLegalEntityId || null,
      } as any);
      if (error) throw error;
      return (data || []) as AnomalyData[];
    },
  });

  // Stalled Deals (for drill-down)
  const {
    data: stalledDeals,
    isLoading: isLoadingStalledDeals,
    isError: isStalledDealsError,
    error: stalledDealsError,
    refetch: refetchStalledDeals,
  } = useQuery({
    queryKey: ['bi-stalled-deals', filters.sellerId, queryLegalEntityId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_stalled_deals_by_seller', {
        p_seller_id: filters.sellerId || null,
        p_min_days: 7,
        p_legal_entity_id: queryLegalEntityId || null,
      } as any);
      if (error) throw error;
      return (data || []) as StalledDealData[];
    },
  });

  // Conversion by Stage
  const {
    data: conversionByStage,
    isLoading: isLoadingConversion,
    isError: isConversionError,
    error: conversionError,
    refetch: refetchConversion,
  } = useQuery({
    queryKey: ['bi-conversion-stage', filters.startDate, filters.endDate, queryLegalEntityId, filters.pipelineId, filters.sellerId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_conversion_by_stage', {
        p_start_date: format(filters.startDate, 'yyyy-MM-dd'),
        p_end_date: format(filters.endDate, 'yyyy-MM-dd'),
        p_legal_entity_id: queryLegalEntityId || null,
        p_pipeline_id: filters.pipelineId || null,
        p_seller_id: filters.sellerId || null,
      } as any);
      if (error) throw error;
      return (data || []) as ConversionByStageData[];
    },
  });

  // Summary metrics
  const summary = {
    totalSLAViolations: pipelineHealth?.reduce((acc, s) => acc + (s.deals_over_sla || 0), 0) || 0,
    avgConversionRate: sellerPerformance?.length 
      ? sellerPerformance.reduce((acc, s) => acc + s.conversion_rate, 0) / sellerPerformance.length 
      : 0,
    criticalAnomalies: anomalies?.filter(a => a.severity === 'critical').length || 0,
    totalStalledDeals: stalledDeals?.length || 0,
  };

  const isLoading = isLoadingPipelineHealth || isLoadingSellerPerformance || 
                    isLoadingAnomalies || isLoadingStalledDeals || isLoadingConversion;

  const getMessage = (error: unknown) => error instanceof Error ? error.message : null;

  const sectionErrors = {
    pipelineHealth: getMessage(pipelineHealthError),
    sellerPerformance: getMessage(sellerPerformanceError),
    anomalies: getMessage(anomaliesError),
    stalledDeals: getMessage(stalledDealsError),
    conversionByStage: getMessage(conversionError),
  };

  const partialErrorMessages = Object.values(sectionErrors).filter(Boolean) as string[];
  const isError = isPipelineHealthError && isSellerPerformanceError;

  const refetchAll = () => {
    refetchPipelineHealth();
    refetchSellerPerformance();
    refetchAnomalies();
    refetchStalledDeals();
    refetchConversion();
  };

  return {
    // Data
    pipelineHealth: pipelineHealth || [],
    sellerPerformance: sellerPerformance || [],
    anomalies: anomalies || [],
    stalledDeals: stalledDeals || [],
    conversionByStage: conversionByStage || [],
    summary,
    
    // Filters
    filters,
    setFilters,
    
    // State
    isLoading,
    isError,
    errorMessage: partialErrorMessages[0] || null,
    sectionErrors,
    partialErrorMessages,
    refetchAll,
  };
}
