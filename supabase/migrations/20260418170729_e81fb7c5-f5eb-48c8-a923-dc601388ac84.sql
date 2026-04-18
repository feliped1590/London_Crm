-- Disable user triggers (owner-consistency check needs auth.uid() context).
ALTER TABLE public.deals DISABLE TRIGGER USER;

-- Only populate pipeline_stage_id; leave legacy `stage` untouched (it's NOT NULL and resolver prioritizes pipeline_stage_id).
UPDATE public.deals d
SET pipeline_stage_id = ps.id
FROM public.pipeline_stages ps
WHERE d.stage = ps.id::text
  AND d.pipeline_stage_id IS NULL;

ALTER TABLE public.deals ENABLE TRIGGER USER;
