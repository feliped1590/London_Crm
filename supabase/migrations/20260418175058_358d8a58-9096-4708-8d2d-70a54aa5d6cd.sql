CREATE OR REPLACE FUNCTION public.sync_pipeline_legal_entity_legacy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_pipeline_id uuid;
  v_count int;
  v_single_entity uuid;
BEGIN
  v_pipeline_id := COALESCE(NEW.pipeline_id, OLD.pipeline_id);

  SELECT count(*) INTO v_count
  FROM public.pipeline_legal_entities
  WHERE pipeline_id = v_pipeline_id;

  IF v_count = 1 THEN
    SELECT legal_entity_id INTO v_single_entity
    FROM public.pipeline_legal_entities
    WHERE pipeline_id = v_pipeline_id
    LIMIT 1;
    UPDATE public.pipelines SET legal_entity_id = v_single_entity WHERE id = v_pipeline_id;
  ELSE
    UPDATE public.pipelines SET legal_entity_id = NULL WHERE id = v_pipeline_id;
  END IF;

  RETURN NULL;
END;
$function$;