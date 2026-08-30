export type CustomerHealth = 'critical' | 'attention' | 'healthy' | 'unknown';

export type WorkspaceTaskBucket = 'overdue' | 'today' | 'upcoming' | 'later';

export interface WorkspaceOpenTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  due_time: string | null;
  waiting_on: 'internal' | 'customer' | 'third_party' | null;
  task_kind: string | null;
  assigned_to: string | null;
  deal_id: string | null;
  contact_id: string | null;
  bucket: WorkspaceTaskBucket;
}

export interface WorkspaceProcess {
  id: string;
  name: string;
  pipeline_id: string | null;
  pipeline_stage_id: string | null;
  owner_id: string | null;
  expected_close_date: string | null;
  stage_name: string | null;
  stage_status: string | null;
  waiting_for_customer: boolean | null;
  pipeline_name: string | null;
  pipeline_mode: string | null;
  is_operational: boolean | null;
  presentation: 'process' | 'service' | 'deal';
  sla_state: 'ok' | 'warning' | 'critical';
  is_open: boolean;
}

export interface WorkspaceContact {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  mobile: string | null;
  job_title: string | null;
}

export interface WorkspaceTeamMember {
  user_id: string;
  role: string;
}

export interface WorkspaceWaitingItem {
  id: string;
  kind: string;
  title: string;
  due_on: string | null;
  waiting_on: string | null;
}

export interface WorkspaceDeadline {
  id: string;
  kind: string;
  label: string;
  due_on: string | null;
}

export interface CustomerWorkspaceSummary {
  company_id: string;
  as_of: string;
  timezone: string;
  health: CustomerHealth;
  health_reasons: string[];
  counts: {
    tasks_pending: number;
    tasks_overdue: number;
    tasks_today: number;
    tasks_next_7_days: number;
    tasks_waiting_customer: number;
    active_processes: number;
    sla_warning: number;
    sla_critical: number;
    documents: number;
    documents_waiting_customer: number;
    documents_expired: number;
  };
  open_tasks: WorkspaceOpenTask[];
  processes: WorkspaceProcess[];
  primary_contacts: WorkspaceContact[];
  last_interaction: {
    id: string;
    source: string;
    title: string;
    occurred_at: string;
  } | null;
  team: WorkspaceTeamMember[];
  waiting_items: WorkspaceWaitingItem[];
  upcoming_deadlines: WorkspaceDeadline[];
}

export interface WorkspaceTimelineEvent {
  id: string;
  event_type: string;
  event_source: string;
  source_id: string;
  title: string;
  description: string | null;
  user_id: string | null;
  legal_entity_id: string | null;
  occurred_at: string;
}

export const DOCUMENT_STATUS_LABELS: Record<string, string> = {
  not_requested: 'Não solicitado',
  requested: 'Solicitado',
  waiting_customer: 'Aguardando cliente',
  received: 'Recebido',
  in_review: 'Em análise',
  approved: 'Aprovado',
  rejected: 'Recusado',
  expired: 'Vencido',
  waived: 'Dispensado',
};

export const CONTRACT_STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho',
  active: 'Ativo',
  pending_renewal: 'Em renovação',
  expired: 'Encerrado',
  cancelled: 'Cancelado',
};

export const SERVICE_STATUS_LABELS: Record<string, string> = {
  planned: 'Planejado',
  active: 'Em andamento',
  paused: 'Pausado',
  completed: 'Concluído',
  cancelled: 'Cancelado',
};

export const WAITING_ON_LABELS: Record<string, string> = {
  internal: 'Equipe interna',
  customer: 'Cliente',
  third_party: 'Terceiro',
};

export function processNoun(presentation: WorkspaceProcess['presentation'] | string | null | undefined) {
  if (presentation === 'process') return 'Processo';
  if (presentation === 'service') return 'Serviço';
  return 'Processo';
}
