import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface FunnelStage {
  stage: string;
  label: string;
  count: number;
  value: number;
  conversionRate: number | null;
  color: string;
}

export interface PipelineVelocity {
  stage: string;
  label: string;
  avgDurationSeconds: number;
  avgDurationFormatted: string;
  dealsCount: number;
}

export interface FunnelData {
  stages: FunnelStage[];
  totalDeals: number;
  totalValue: number;
  overallConversionRate: number;
  avgSalesCycle: number;
  avgSalesCycleFormatted: string;
  velocityByStage: PipelineVelocity[];
  lossReasons: Array<{ reason: string; count: number; percentage: number }>;
}

const STAGE_CONFIG: Record<string, { label: string; color: string; order: number }> = {
  prospeccao: { label: 'Prospecção', color: 'hsl(var(--stage-prospeccao))', order: 1 },
  qualificacao: { label: 'Qualificação', color: 'hsl(var(--stage-qualificacao))', order: 2 },
  proposta: { label: 'Proposta', color: 'hsl(var(--stage-proposta))', order: 3 },
  negociacao: { label: 'Negociação', color: 'hsl(var(--stage-negociacao))', order: 4 },
  fechado_ganho: { label: 'Ganho', color: 'hsl(var(--stage-ganho))', order: 5 },
  fechado_perdido: { label: 'Perdido', color: 'hsl(var(--stage-perdido))', order: 6 },
};

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}min`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86400)} dias`;
}

export function useSalesFunnelData() {
  // Fetch sales pipeline IDs to filter only commercial deals
  const { data: salesPipelineIds } = useQuery({
    queryKey: ['sales-pipeline-ids'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pipelines')
        .select('id')
        .eq('type', 'sales')
        .eq('is_active', true);
      if (error) throw error;
      return data?.map(p => p.id) || [];
    },
  });

  // Fetch only deals from sales pipelines
  const { data: deals, isLoading: dealsLoading } = useQuery({
    queryKey: ['funnel-deals', salesPipelineIds],
    queryFn: async () => {
      let query = supabase
        .from('deals')
        .select('id, stage, value, created_at, closed_at, lost_reason, pipeline_id');
      
      if (salesPipelineIds && salesPipelineIds.length > 0) {
        query = query.in('pipeline_id', salesPipelineIds);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!salesPipelineIds,
  });

  // Fetch stage history for velocity calculations
  const { data: stageHistory, isLoading: historyLoading } = useQuery({
    queryKey: ['funnel-stage-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deal_stage_history')
        .select('deal_id, from_stage, to_stage, duration_seconds, changed_at')
        .not('duration_seconds', 'is', null);
      if (error) throw error;
      return data;
    },
  });

  // Calculate funnel data
  const funnelData: FunnelData | null = deals ? (() => {
    // Count deals by stage
    const stageCounts = deals.reduce((acc, deal) => {
      if (!acc[deal.stage]) acc[deal.stage] = { count: 0, value: 0 };
      acc[deal.stage].count++;
      acc[deal.stage].value += Number(deal.value || 0);
      return acc;
    }, {} as Record<string, { count: number; value: number }>);

    // Build stages array with conversion rates
    const activeStages = ['prospeccao', 'qualificacao', 'proposta', 'negociacao', 'fechado_ganho'];
    const stages: FunnelStage[] = activeStages.map((stage, index) => {
      const data = stageCounts[stage] || { count: 0, value: 0 };
      const config = STAGE_CONFIG[stage];
      
      // Calculate conversion rate from previous stage
      let conversionRate: number | null = null;
      if (index > 0) {
        const prevStage = activeStages[index - 1];
        const prevCount = stageCounts[prevStage]?.count || 0;
        if (prevCount > 0) {
          // For funnel, we show cumulative deals that made it to this stage or beyond
          const currentAndBeyond = activeStages.slice(index).reduce(
            (sum, s) => sum + (stageCounts[s]?.count || 0),
            0
          );
          conversionRate = (currentAndBeyond / prevCount) * 100;
        }
      }

      return {
        stage,
        label: config.label,
        count: data.count,
        value: data.value,
        conversionRate,
        color: config.color,
      };
    });

    // Calculate totals
    const totalDeals = deals.length;
    const totalValue = deals.reduce((sum, d) => sum + Number(d.value || 0), 0);
    
    // Win rate calculation
    const wonDeals = deals.filter(d => d.stage === 'fechado_ganho').length;
    const lostDeals = deals.filter(d => d.stage === 'fechado_perdido').length;
    const closedDeals = wonDeals + lostDeals;
    const overallConversionRate = closedDeals > 0 ? (wonDeals / closedDeals) * 100 : 0;

    // Calculate velocity by stage (only forward transitions)
    const velocityByStage: PipelineVelocity[] = [];
    if (stageHistory) {
      const forwardTransitions: Record<string, { totalDuration: number; count: number }> = {};
      
      stageHistory.forEach(record => {
        const fromOrder = STAGE_CONFIG[record.from_stage]?.order || 0;
        const toOrder = STAGE_CONFIG[record.to_stage]?.order || 0;
        
        // Only count forward transitions (from stage)
        if (toOrder > fromOrder && record.from_stage) {
          if (!forwardTransitions[record.from_stage]) {
            forwardTransitions[record.from_stage] = { totalDuration: 0, count: 0 };
          }
          forwardTransitions[record.from_stage].totalDuration += record.duration_seconds || 0;
          forwardTransitions[record.from_stage].count++;
        }
      });

      ['prospeccao', 'qualificacao', 'proposta', 'negociacao'].forEach(stage => {
        const data = forwardTransitions[stage];
        if (data && data.count > 0) {
          const avgDuration = data.totalDuration / data.count;
          velocityByStage.push({
            stage,
            label: STAGE_CONFIG[stage].label,
            avgDurationSeconds: avgDuration,
            avgDurationFormatted: formatDuration(avgDuration),
            dealsCount: data.count,
          });
        }
      });
    }

    // Calculate average sales cycle (time to close won deals)
    const wonDealsWithTime = deals.filter(d => d.stage === 'fechado_ganho' && d.closed_at);
    let avgSalesCycle = 0;
    if (wonDealsWithTime.length > 0) {
      const totalCycleTime = wonDealsWithTime.reduce((sum, deal) => {
        const created = new Date(deal.created_at).getTime();
        const closed = new Date(deal.closed_at!).getTime();
        return sum + (closed - created) / 1000; // in seconds
      }, 0);
      avgSalesCycle = totalCycleTime / wonDealsWithTime.length;
    }

    // Aggregate loss reasons
    const lostDealsWithReason = deals.filter(d => d.stage === 'fechado_perdido' && d.lost_reason);
    const reasonCounts: Record<string, number> = {};
    lostDealsWithReason.forEach(deal => {
      const reason = deal.lost_reason || 'Não informado';
      reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
    });
    
    const lossReasons = Object.entries(reasonCounts)
      .map(([reason, count]) => ({
        reason,
        count,
        percentage: lostDeals > 0 ? (count / lostDeals) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);

    return {
      stages,
      totalDeals,
      totalValue,
      overallConversionRate,
      avgSalesCycle,
      avgSalesCycleFormatted: formatDuration(avgSalesCycle),
      velocityByStage,
      lossReasons,
    };
  })() : null;

  return {
    funnelData,
    isLoading: dealsLoading || historyLoading,
  };
}
