-- 1. Add new column
ALTER TABLE public.deals
ADD COLUMN IF NOT EXISTS pipeline_stage_id UUID REFERENCES public.pipeline_stages(id) ON DELETE SET NULL;

-- 2. Disable user triggers during backfill (audit trigger requires auth.uid())
ALTER TABLE public.deals DISABLE TRIGGER USER;

-- 3. Backfill: match by pipeline_id + legacy stage string
UPDATE public.deals d
SET pipeline_stage_id = ps.id
FROM public.pipeline_stages ps
WHERE d.pipeline_stage_id IS NULL
  AND ps.pipeline_id = d.pipeline_id
  AND ps.stage IS NOT NULL
  AND ps.stage::text = d.stage::text;

-- 4. Fallback: deals without pipeline_id → match against default pipeline
UPDATE public.deals d
SET pipeline_stage_id = ps.id
FROM public.pipeline_stages ps, public.pipelines p
WHERE d.pipeline_stage_id IS NULL
  AND d.pipeline_id IS NULL
  AND p.is_default = true
  AND ps.pipeline_id = p.id
  AND ps.stage IS NOT NULL
  AND ps.stage::text = d.stage::text;

-- 5. Re-enable triggers
ALTER TABLE public.deals ENABLE TRIGGER USER;

-- 6. Index
CREATE INDEX IF NOT EXISTS idx_deals_pipeline_stage_id
ON public.deals(pipeline_id, pipeline_stage_id)
WHERE pipeline_stage_id IS NOT NULL;