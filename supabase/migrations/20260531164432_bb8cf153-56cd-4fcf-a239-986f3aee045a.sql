-- Remove uniqueness constraints on pipeline stage statuses
DROP INDEX IF EXISTS public.unique_won_stage_per_pipeline;
DROP INDEX IF EXISTS public.unique_lost_stage_per_pipeline;

DROP TRIGGER IF EXISTS trg_validate_pipeline_stage_status ON public.pipeline_stages;
DROP FUNCTION IF EXISTS public.validate_pipeline_stage_status();

-- Update helper to return arrays for won/lost
CREATE OR REPLACE FUNCTION public.get_pipeline_stage_status(p_pipeline_id uuid)
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'won_stage_ids', COALESCE((
      SELECT json_agg(id ORDER BY sort_order)
      FROM public.pipeline_stages
      WHERE pipeline_id = p_pipeline_id AND stage_status = 'won'
    ), '[]'::json),
    'lost_stage_ids', COALESCE((
      SELECT json_agg(id ORDER BY sort_order)
      FROM public.pipeline_stages
      WHERE pipeline_id = p_pipeline_id AND stage_status = 'lost'
    ), '[]'::json),
    'open_stage_ids', COALESCE((
      SELECT json_agg(id ORDER BY sort_order)
      FROM public.pipeline_stages
      WHERE pipeline_id = p_pipeline_id AND stage_status = 'open'
    ), '[]'::json),
    -- legado: primeiro id (menor sort_order) para compatibilidade
    'won_stage_id', (
      SELECT id FROM public.pipeline_stages
      WHERE pipeline_id = p_pipeline_id AND stage_status = 'won'
      ORDER BY sort_order LIMIT 1
    ),
    'lost_stage_id', (
      SELECT id FROM public.pipeline_stages
      WHERE pipeline_id = p_pipeline_id AND stage_status = 'lost'
      ORDER BY sort_order LIMIT 1
    )
  );
$$;