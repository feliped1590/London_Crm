import { useEffect, useMemo, useState } from 'react';
import type { OperationalOrder } from '@/hooks/useOperationalKanbanData';
import type { OperationalStage } from '@/hooks/useOperationalPipelines';
import { computeSlaLevel } from '@/lib/operationalConstants';

export interface OperationalFilters {
  ownerId: string | null;
  priority: string | null;
  stageId: string | null;
  search: string;
  overdueOnly: boolean;
  withoutOwner: boolean;
  urgentOnly: boolean;
  blockedOnly: boolean;
}

const DEFAULT: OperationalFilters = {
  ownerId: null,
  priority: null,
  stageId: null,
  search: '',
  overdueOnly: false,
  withoutOwner: false,
  urgentOnly: false,
  blockedOnly: false,
};

export function useOperationalFilters(pipelineId: string | null) {
  const storageKey = pipelineId ? `opkanban:filters:${pipelineId}` : null;
  const [filters, setFilters] = useState<OperationalFilters>(DEFAULT);

  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = localStorage.getItem(storageKey);
      setFilters(raw ? { ...DEFAULT, ...JSON.parse(raw) } : DEFAULT);
    } catch {
      setFilters(DEFAULT);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(filters));
    } catch {/* ignore */}
  }, [storageKey, filters]);

  const update = <K extends keyof OperationalFilters>(k: K, v: OperationalFilters[K]) =>
    setFilters(prev => ({ ...prev, [k]: v }));

  const reset = () => setFilters(DEFAULT);

  const apply = useMemo(
    () => (orders: OperationalOrder[], stages: OperationalStage[]) => {
      const stageMap = new Map(stages.map(s => [s.id, s]));
      const term = filters.search.trim().toLowerCase();
      return orders.filter(o => {
        if (filters.ownerId && o.operational_owner_id !== filters.ownerId) return false;
        if (filters.priority && o.operational_priority !== filters.priority) return false;
        if (filters.stageId && o.operational_stage_id !== filters.stageId) return false;
        if (filters.withoutOwner && o.operational_owner_id) return false;
        if (filters.urgentOnly && o.operational_priority !== 'urgente') return false;
        if (filters.blockedOnly && o.operational_priority !== 'bloqueado') return false;
        if (filters.overdueOnly) {
          const stage = o.operational_stage_id ? stageMap.get(o.operational_stage_id) : null;
          const lvl = computeSlaLevel(
            o.operational_entered_stage_at,
            stage?.sla_warning_hours ?? null,
            stage?.sla_critical_hours ?? null,
          );
          if (lvl !== 'critical') return false;
        }
        if (term) {
          const hay = `${o.number} ${o.company_name ?? ''} ${o.owner_name ?? ''}`.toLowerCase();
          if (!hay.includes(term)) return false;
        }
        return true;
      });
    },
    [filters],
  );

  return { filters, update, reset, apply };
}
