-- Phase 06 staging compatibility:
-- Ensure lifecycle columns exist before migration 20260614164223.

ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS lifecycle_baseline_at timestamptz,
ADD COLUMN IF NOT EXISTS activity_status_updated_at timestamptz;
