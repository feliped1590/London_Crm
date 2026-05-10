import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface HistoryRow {
  id: string;
  order_id: string;
  pipeline_id: string;
  from_stage_id: string | null;
  to_stage_id: string | null;
  from_pipeline_id: string | null;
  to_pipeline_id: string | null;
  move_kind: string | null;
  time_in_stage_seconds: number | null;
  is_non_sequential: boolean;
  reason: string | null;
  moved_by: string | null;
  moved_at: string;
  from_stage_name?: string | null;
  to_stage_name?: string | null;
  from_pipeline_name?: string | null;
  to_pipeline_name?: string | null;
  moved_by_name?: string | null;
}

export function useOperationalOrderHistory(orderId: string | null) {
  return useQuery({
    queryKey: ['operational_order_history', orderId],
    queryFn: async () => {
      if (!orderId) return [];
      const { data, error } = await supabase
        .from('order_operational_stage_history')
        .select('*')
        .eq('order_id', orderId)
        .order('moved_at', { ascending: false });
      if (error) throw error;

      const stageIds = new Set<string>();
      const pipelineIds = new Set<string>();
      const userIds = new Set<string>();
      (data ?? []).forEach((r: any) => {
        if (r.from_stage_id) stageIds.add(r.from_stage_id);
        if (r.to_stage_id) stageIds.add(r.to_stage_id);
        if (r.from_pipeline_id) pipelineIds.add(r.from_pipeline_id);
        if (r.to_pipeline_id) pipelineIds.add(r.to_pipeline_id);
        if (r.moved_by) userIds.add(r.moved_by);
      });

      const [stagesRes, pipelinesRes, profilesRes] = await Promise.all([
        stageIds.size
          ? supabase.from('pipeline_stages').select('id, name').in('id', Array.from(stageIds))
          : Promise.resolve({ data: [] as any[] }),
        pipelineIds.size
          ? supabase.from('pipelines').select('id, name').in('id', Array.from(pipelineIds))
          : Promise.resolve({ data: [] as any[] }),
        userIds.size
          ? supabase.from('profiles').select('id, full_name, email').in('id', Array.from(userIds))
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const stageMap = new Map((stagesRes.data ?? []).map((s: any) => [s.id, s.name]));
      const pipelineMap = new Map((pipelinesRes.data ?? []).map((p: any) => [p.id, p.name]));
      const profileMap = new Map(
        (profilesRes.data ?? []).map((p: any) => [p.id, p.full_name ?? p.email ?? '']),
      );

      return (data ?? []).map((r: any) => ({
        ...r,
        from_stage_name: r.from_stage_id ? stageMap.get(r.from_stage_id) ?? null : null,
        to_stage_name: r.to_stage_id ? stageMap.get(r.to_stage_id) ?? null : null,
        from_pipeline_name: r.from_pipeline_id ? pipelineMap.get(r.from_pipeline_id) ?? null : null,
        to_pipeline_name: r.to_pipeline_id ? pipelineMap.get(r.to_pipeline_id) ?? null : null,
        moved_by_name: r.moved_by ? profileMap.get(r.moved_by) ?? null : null,
      })) as HistoryRow[];
    },
    enabled: !!orderId,
  });
}
