export type DealStage = 'prospeccao' | 'qualificacao' | 'proposta' | 'negociacao' | 'fechado_ganho' | 'fechado_perdido';
export type TaskStatus = 'pendente' | 'em_andamento' | 'concluida' | 'cancelada';
export type TaskPriority = 'baixa' | 'media' | 'alta' | 'urgente';
export type CustomFieldType = 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'checkbox' | 'url' | 'email' | 'phone' | 'currency';
export type CustomFieldEntity = 'company' | 'contact' | 'deal';
export type AppRole = 'admin' | 'vendedor';

export interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  avatar_url?: string;
  phone?: string;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export interface Company {
  id: string;
  name: string;
  domain?: string;
  industry?: string;
  setor_id?: string | null;
  segmento_id?: string | null;
  atividade_id?: string | null;
  employee_count?: string;
  annual_revenue?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  country: string;
  notes?: string;
  owner_id?: string;
  created_by?: string;
  custom_fields: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: string;
  company_id?: string;
  first_name: string;
  last_name?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  job_title?: string;
  department?: string;
  linkedin_url?: string;
  notes?: string;
  owner_id?: string;
  created_by?: string;
  custom_fields: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  company?: Company;
}

export interface Deal {
  id: string;
  name: string;
  company_id?: string;
  contact_id?: string;
  stage: DealStage;
  value: number;
  probability: number;
  expected_close_date?: string;
  notes?: string;
  owner_id?: string;
  created_by?: string;
  closed_at?: string;
  lost_reason?: string;
  custom_fields: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  company?: Company;
  contact?: Contact;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date?: string;
  due_time?: string;
  company_id?: string;
  contact_id?: string;
  deal_id?: string;
  assigned_to?: string;
  created_by?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  company?: Company;
  contact?: Contact;
  deal?: Deal;
  assignee?: Profile;
}

export interface Activity {
  id: string;
  type: string;
  subject?: string;
  content?: string;
  company_id?: string;
  contact_id?: string;
  deal_id?: string;
  created_by?: string;
  metadata: Record<string, unknown>;
  created_at: string;
  creator?: Profile;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  created_by?: string;
  is_shared: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmailLog {
  id: string;
  contact_id?: string;
  deal_id?: string;
  template_id?: string;
  subject: string;
  body: string;
  to_email: string;
  from_email?: string;
  status: string;
  sent_by?: string;
  sent_at: string;
  opened_at?: string;
  metadata: Record<string, unknown>;
}

export interface CustomField {
  id: string;
  entity: CustomFieldEntity;
  name: string;
  label: string;
  field_type: CustomFieldType;
  options?: { value: string; label: string }[];
  is_required: boolean;
  sort_order: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface PipelineStage {
  id: string;
  name: string;
  stage: DealStage;
  color: string;
  probability: number;
  sort_order: number;
  created_at: string;
}

export interface DashboardStats {
  totalDeals: number;
  totalValue: number;
  wonDeals: number;
  wonValue: number;
  openDeals: number;
  openValue: number;
  conversionRate: number;
  avgDealValue: number;
  totalContacts: number;
  totalCompanies: number;
  pendingTasks: number;
  overdueTasks: number;
}