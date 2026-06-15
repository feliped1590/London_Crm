/**
 * Paleta executiva centralizada para os relatórios compostos do BI.
 * Usada em Recharts (cores diretas) e como referência das CSS vars `--bi-*`
 * declaradas em src/index.css dentro do escopo `.bi-executive`.
 */
export const BI_COLORS = {
  navy: '#0F172A',
  primary: '#2563EB',
  secondary: '#4F46E5',
  success: '#16A34A',
  warning: '#F59E0B',
  danger: '#DC2626',
  bg: '#F8FAFC',
  card: '#FFFFFF',
  border: '#E2E8F0',
  muted: '#64748B',
  grid: '#CBD5E1',
  headerBg: '#EFF4FB',
} as const;

/** Paleta para séries genéricas em gráficos categóricos. */
export const BI_CHART_PALETTE = [
  BI_COLORS.primary,
  BI_COLORS.secondary,
  BI_COLORS.success,
  BI_COLORS.warning,
  BI_COLORS.danger,
  '#0EA5E9',
  '#A855F7',
  '#14B8A6',
];

export type BiTone =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'neutral';

export const BI_TONE_HEX: Record<BiTone, string> = {
  primary: BI_COLORS.primary,
  secondary: BI_COLORS.secondary,
  success: BI_COLORS.success,
  warning: BI_COLORS.warning,
  danger: BI_COLORS.danger,
  neutral: BI_COLORS.muted,
};
