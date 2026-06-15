CREATE OR REPLACE FUNCTION public.trg_promote_lead_to_prospect()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_trigger text;
  v_pipeline_type text;
BEGIN
  IF NEW.company_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT lead_to_prospect_trigger INTO v_trigger
  FROM public.lifecycle_config
  ORDER BY created_at ASC
  LIMIT 1;

  IF COALESCE(v_trigger, 'deal_open') <> 'deal_open' THEN
    RETURN NEW;
  END IF;

  SELECT p.type INTO v_pipeline_type
  FROM public.pipelines p
  LEFT JOIN public.pipeline_stages ps ON ps.pipeline_id = p.id
  WHERE (NEW.pipeline_id IS NOT NULL AND p.id = NEW.pipeline_id)
     OR (NEW.pipeline_stage_id IS NOT NULL AND ps.id = NEW.pipeline_stage_id)
     OR (
       NEW.pipeline_id IS NOT NULL
       AND NEW.stage IS NOT NULL
       AND ps.pipeline_id = NEW.pipeline_id
       AND ps.stage = NEW.stage
     )
  ORDER BY CASE WHEN NEW.pipeline_id IS NOT NULL AND p.id = NEW.pipeline_id THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_pipeline_type IS NOT NULL AND v_pipeline_type NOT IN ('sales','commercial') THEN
    RETURN NEW;
  END IF;

  UPDATE public.companies
  SET lifecycle_stage = 'prospect'::lifecycle_stage,
      activity_status_updated_at = now()
  WHERE id = NEW.company_id
    AND lifecycle_stage = 'lead'::lifecycle_stage;

  RETURN NEW;
END;
$function$;