/**
 * Constantes e tipos para integração ERP Iniflex
 * Fundação v1 - Middleware centralizado
 */

// Direção da sincronização
export const SYNC_DIRECTION = {
  CRM_TO_ERP: 'crm_to_erp',
  ERP_TO_CRM: 'erp_to_crm',
} as const;

export type SyncDirection = typeof SYNC_DIRECTION[keyof typeof SYNC_DIRECTION];

// Status da sincronização
export const SYNC_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  SUCCESS: 'success',
  FAILED: 'failed',
} as const;

export type SyncStatus = typeof SYNC_STATUS[keyof typeof SYNC_STATUS];

// Tipos de entidade suportados
export const ENTITY_TYPE = {
  COMPANY: 'company',
  CONTACT: 'contact',
} as const;

export type EntityType = typeof ENTITY_TYPE[keyof typeof ENTITY_TYPE];

// Resultado de sincronização
export interface SyncResult {
  success: boolean;
  externalId: string | null;
  rawResponse: unknown;
  error?: string;
}

// Requisição de sincronização
export interface SyncRequest {
  entity_type: EntityType;
  entity_id: string;
  
  /**
   * Se true, sincroniza dependências automaticamente.
   * Ex: para contact, sincroniza company primeiro se não existir no ERP.
   * 
   * NOTA FUTURA: Esta lógica será movida para o backend,
   * tornando a orquestração transparente para o frontend.
   * Por enquanto, o frontend deve enviar este parâmetro explicitamente.
   */
  ensure_dependencies?: boolean;
}

// Dados de empresa do CRM
export interface CRMCompany {
  id: string;
  name: string;
  fantasia?: string | null;
  cnpj?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  inscricao_estadual?: string | null;
  notes?: string | null;
}

// Dados de contato do CRM
export interface CRMContact {
  id: string;
  first_name: string;
  last_name?: string | null;
  cpf?: string | null;
  tipo_pessoa?: string | null;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  notes?: string | null;
  company_id?: string | null;
}

// Log de sincronização
export interface ErpSyncLog {
  id?: string;
  entity_type: EntityType;
  entity_id: string;
  direction: SyncDirection;
  status: SyncStatus;
  external_id?: string | null;
  error_message?: string | null;
  request_payload?: unknown;
  response_payload?: unknown;
}
