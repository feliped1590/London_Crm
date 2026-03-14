
-- 1. Create lifecycle_stage enum
CREATE TYPE public.lifecycle_stage AS ENUM ('lead', 'prospect', 'customer_active', 'customer_inactive', 'customer_lost');

-- 2. Add lifecycle_stage column to companies
ALTER TABLE public.companies ADD COLUMN lifecycle_stage public.lifecycle_stage DEFAULT 'lead';

-- 3. Insert CRM_GO_LIVE_DATE into system_settings
INSERT INTO public.system_settings (key, value)
VALUES ('crm_config', '{"crm_go_live_date": "2026-03-14"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = system_settings.value || '{"crm_go_live_date": "2026-03-14"}'::jsonb;

-- 4. Migrate existing data based on origin
UPDATE public.companies
SET lifecycle_stage = CASE
  WHEN origin = 'PROSPECT' THEN 'prospect'::public.lifecycle_stage
  WHEN origin IN ('CLIENTES', 'CLIENTES ISENTO IPI') THEN 'customer_active'::public.lifecycle_stage
  WHEN origin = 'manual' THEN 'lead'::public.lifecycle_stage
  ELSE 'lead'::public.lifecycle_stage
END;

-- 5. Create index for lifecycle queries
CREATE INDEX idx_companies_lifecycle_stage ON public.companies (lifecycle_stage);
