ALTER TABLE public.pipeline_stages DROP CONSTRAINT IF EXISTS pipeline_stages_stage_status_check;
ALTER TABLE public.pipeline_stages ADD CONSTRAINT pipeline_stages_stage_status_check
  CHECK (stage_status = ANY (ARRAY['open','won','lost','rejected','cancelled','no_profile']::text[]));