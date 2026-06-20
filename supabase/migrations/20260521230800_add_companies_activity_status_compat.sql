-- Phase 06 - Compatibility for staging Supabase recreation
-- Reason: migration 20260521230824 creates public.get_activity_status_counts()
-- and expects public.companies.activity_status to exist at this point.

ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS activity_status text;
