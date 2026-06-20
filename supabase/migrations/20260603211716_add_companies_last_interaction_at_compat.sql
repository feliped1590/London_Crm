-- Phase 06 staging compatibility:
-- Ensure companies.last_interaction_at exists before migration 20260603211717 creates indexes.

ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS last_interaction_at timestamptz;
