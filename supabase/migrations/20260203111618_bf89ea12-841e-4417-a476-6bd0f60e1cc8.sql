-- Sprint 3: Add stagnation_reason to deals table
-- Campo append-only para justificativas de SLA estourado

ALTER TABLE public.deals 
ADD COLUMN IF NOT EXISTS stagnation_reason TEXT;