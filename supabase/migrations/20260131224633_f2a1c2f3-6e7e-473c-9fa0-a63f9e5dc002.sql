-- Alter entity_id from UUID to TEXT to support CNPJ strings
-- UUIDs are valid TEXT values, so existing records continue to work
ALTER TABLE public.erp_sync_logs 
  ALTER COLUMN entity_id TYPE TEXT;