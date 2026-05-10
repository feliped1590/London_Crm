import { useMemo } from 'react';
import type { OperationalOrder } from '@/hooks/useOperationalKanbanData';
import type { OperationalStage } from '@/hooks/useOperationalPipelines';
import { computeSlaLevel } from '@/lib/operationalConstants';

export function useOperationalDashboard(
  orders: OperationalOrder[],
  stages: OperationalStage[],
) {
  return useMemo(() => {
    const stageMap = new Map(stages.map(s => [s.id, s]));
    const byStage = new Map<string, number>();
    let overdue = 0;
    let withoutOwner = 0;
    let blocked = 0;
    let urgent = 0;
    const stageDurations = new Map<string, { total: number; count: number }>();

    for (const o of orders) {
      if (o.operational_stage_id) {
        byStage.set(o.operational_stage_id, (byStage.get(o.operational_stage_id) ?? 0) + 1);
      }
      if (!o.operational_owner_id) withoutOwner++;
      if (o.operational_priority === 'bloqueado') blocked++;
      if (o.operational_priority === 'urgente') urgent++;

      const stage = o.operational_stage_id ? stageMap.get(o.operational_stage_id) : null;
      const lvl = computeSlaLevel(
        o.operational_entered_stage_at,
        stage?.sla_warning_hours ?? null,
        stage?.sla_critical_hours ?? null,
      );
      if (lvl === 'critical') overdue++;

      if (o.operational_stage_id && o.operational_entered_stage_at) {
        const hrs = (Date.now() - new Date(o.operational_entered_stage_at).getTime()) / 3_600_000;
        const cur = stageDurations.get(o.operational_stage_id) ?? { total: 0, count: 0 };
        cur.total += hrs;
        cur.count += 1;
        stageDurations.set(o.operational_stage_id, cur);
      }
    }

    const bottlenecks = Array.from(stageDurations.entries())
      .map(([id, v]) => ({
        stageId: id,
        stageName: stageMap.get(id)?.name ?? '—',
        avgHours: v.total / v.count,
        count: v.count,
      }))
      .sort((a, b) => b.avgHours - a.avgHours)
      .slice(0, 5);

    return {
      total: orders.length,
      byStage,
      overdue,
      withoutOwner,
      blocked,
      urgent,
      bottlenecks,
    };
  }, [orders, stages]);
}
