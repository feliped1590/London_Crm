import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { CustomerWorkspaceSummary } from '../types';

function asSummary(value: unknown): CustomerWorkspaceSummary {
  const raw = (value ?? {}) as Record<string, unknown>;
  const counts = (raw.counts ?? {}) as Record<string, number>;
  return {
    company_id: String(raw.company_id ?? ''),
    as_of: String(raw.as_of ?? ''),
    timezone: String(raw.timezone ?? 'America/Sao_Paulo'),
    health: (raw.health as CustomerWorkspaceSummary['health']) || 'unknown',
    health_reasons: Array.isArray(raw.health_reasons) ? raw.health_reasons.map(String) : [],
    counts: {
      tasks_pending: Number(counts.tasks_pending || 0),
      tasks_overdue: Number(counts.tasks_overdue || 0),
      tasks_today: Number(counts.tasks_today || 0),
      tasks_next_7_days: Number(counts.tasks_next_7_days || 0),
      tasks_waiting_customer: Number(counts.tasks_waiting_customer || 0),
      active_processes: Number(counts.active_processes || 0),
      sla_warning: Number(counts.sla_warning || 0),
      sla_critical: Number(counts.sla_critical || 0),
      documents: Number(counts.documents || 0),
      documents_waiting_customer: Number(counts.documents_waiting_customer || 0),
      documents_expired: Number(counts.documents_expired || 0),
    },
    open_tasks: Array.isArray(raw.open_tasks) ? (raw.open_tasks as CustomerWorkspaceSummary['open_tasks']) : [],
    processes: Array.isArray(raw.processes) ? (raw.processes as CustomerWorkspaceSummary['processes']) : [],
    primary_contacts: Array.isArray(raw.primary_contacts)
      ? (raw.primary_contacts as CustomerWorkspaceSummary['primary_contacts'])
      : [],
    last_interaction: (raw.last_interaction as CustomerWorkspaceSummary['last_interaction']) || null,
    team: Array.isArray(raw.team) ? (raw.team as CustomerWorkspaceSummary['team']) : [],
    waiting_items: Array.isArray(raw.waiting_items)
      ? (raw.waiting_items as CustomerWorkspaceSummary['waiting_items'])
      : [],
    upcoming_deadlines: Array.isArray(raw.upcoming_deadlines)
      ? (raw.upcoming_deadlines as CustomerWorkspaceSummary['upcoming_deadlines'])
      : [],
  };
}

export function useCustomerWorkspaceSummary(companyId: string | undefined) {
  return useQuery({
    queryKey: ['customer-workspace-summary', companyId],
    enabled: Boolean(companyId),
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_customer_workspace_summary', {
        p_company_id: companyId!,
      });
      if (error) throw error;
      return asSummary(data);
    },
  });
}
