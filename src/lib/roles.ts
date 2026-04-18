import {
  Shield,
  Users,
  Headphones,
  DollarSign,
  FileText,
  Truck,
  CheckCircle,
  Code2,
  type LucideIcon,
} from 'lucide-react';

/**
 * Single source of truth for application roles.
 * Mirrors the Postgres enum `public.app_role`.
 */
export type AppRole =
  | 'admin'
  | 'vendedor'
  | 'atendente'
  | 'desenvolvedor'
  | 'financeiro'
  | 'faturamento'
  | 'logistica'
  | 'qualidade';

export interface RoleDefinition {
  value: AppRole;
  label: string;
  description: string;
  icon: LucideIcon;
  /** If false, role is not exposed in the UI (managed only via DB / dev-tools). */
  assignable: boolean;
  /** If false, role is not configurable in the Permissions Manager (e.g. admin/dev have implicit full access). */
  editablePermissions: boolean;
}

export const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    value: 'admin',
    label: 'Administrador',
    description: 'Acesso total a todos os módulos (não configurável)',
    icon: Shield,
    assignable: true,
    editablePermissions: false,
  },
  {
    value: 'vendedor',
    label: 'Vendedor',
    description: 'Foco em vendas, pipeline e relacionamento com clientes',
    icon: Users,
    assignable: true,
    editablePermissions: true,
  },
  {
    value: 'atendente',
    label: 'Atendente',
    description: 'Foco em atendimento e suporte via WhatsApp',
    icon: Headphones,
    assignable: true,
    editablePermissions: true,
  },
  {
    value: 'financeiro',
    label: 'Financeiro',
    description: 'Gestão financeira, crédito, recebíveis e cobrança',
    icon: DollarSign,
    assignable: true,
    editablePermissions: true,
  },
  {
    value: 'faturamento',
    label: 'Faturamento',
    description: 'Emissão de notas, conferência e fechamento de pedidos',
    icon: FileText,
    assignable: true,
    editablePermissions: true,
  },
  {
    value: 'logistica',
    label: 'Logística',
    description: 'Expedição, transporte, separação e distribuição',
    icon: Truck,
    assignable: true,
    editablePermissions: true,
  },
  {
    value: 'qualidade',
    label: 'Qualidade',
    description: 'Controle de qualidade, conformidade e inspeção',
    icon: CheckCircle,
    assignable: true,
    editablePermissions: true,
  },
  {
    value: 'desenvolvedor',
    label: 'Desenvolvedor',
    description: 'Ferramentas internas de manutenção (gerenciado via DB)',
    icon: Code2,
    assignable: false,
    editablePermissions: false,
  },
];

export const ROLE_VALUES: AppRole[] = ROLE_DEFINITIONS.map((r) => r.value);

export const ASSIGNABLE_ROLES = ROLE_DEFINITIONS.filter((r) => r.assignable);

export const EDITABLE_PERMISSION_ROLES = ROLE_DEFINITIONS.filter(
  (r) => r.editablePermissions,
);

export const ROLE_LABELS: Record<AppRole, string> = ROLE_DEFINITIONS.reduce(
  (acc, r) => {
    acc[r.value] = r.label;
    return acc;
  },
  {} as Record<AppRole, string>,
);

export function getRoleDefinition(role: AppRole): RoleDefinition | undefined {
  return ROLE_DEFINITIONS.find((r) => r.value === role);
}

export function isValidAppRole(value: unknown): value is AppRole {
  return typeof value === 'string' && ROLE_VALUES.includes(value as AppRole);
}
