export const OPERATIONAL_DEPARTMENTS = [
  'PCP',
  'QUALIDADE',
  'LOGISTICA',
  'COMERCIAL',
  'FINANCEIRO',
  'EXPEDICAO',
  'SUPRIMENTOS',
  'OUTROS',
] as const;
export type OperationalDepartment = (typeof OPERATIONAL_DEPARTMENTS)[number];

export const DEPARTMENT_LABEL: Record<OperationalDepartment, string> = {
  PCP: 'PCP',
  QUALIDADE: 'Qualidade',
  LOGISTICA: 'Logística',
  COMERCIAL: 'Comercial',
  FINANCEIRO: 'Financeiro',
  EXPEDICAO: 'Expedição',
  SUPRIMENTOS: 'Suprimentos',
  OUTROS: 'Outros',
};

export const OPERATIONAL_PRIORITIES = ['baixa', 'media', 'alta', 'urgente', 'bloqueado'] as const;
export type OperationalPriority = (typeof OPERATIONAL_PRIORITIES)[number];

export const PRIORITY_LABEL: Record<OperationalPriority, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  urgente: 'Urgente',
  bloqueado: 'Bloqueado',
};

export const PRIORITY_COLOR: Record<OperationalPriority, string> = {
  baixa: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  media: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  alta: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300',
  urgente: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-300',
  bloqueado: 'bg-zinc-900 text-zinc-100 dark:bg-zinc-200 dark:text-zinc-900',
};

export type SlaLevel = 'ok' | 'warning' | 'critical';

export function computeSlaLevel(
  enteredAt: string | null,
  warningHours: number | null,
  criticalHours: number | null,
): SlaLevel {
  if (!enteredAt) return 'ok';
  const hours = (Date.now() - new Date(enteredAt).getTime()) / 3_600_000;
  if (criticalHours != null && hours >= criticalHours) return 'critical';
  if (warningHours != null && hours >= warningHours) return 'warning';
  return 'ok';
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return '—';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

export function hoursSince(iso: string | null): number | null {
  if (!iso) return null;
  return (Date.now() - new Date(iso).getTime()) / 3_600_000;
}
