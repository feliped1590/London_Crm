/**
 * Shape of a database record as received via Supabase Realtime.
 * Contains the common fields present in most CRM tables.
 */
export interface RealtimeRecord {
  id: string;
  updated_at?: string;
  owner_id?: string;
  created_by?: string;
  assigned_to?: string;
  [key: string]: unknown;
}
