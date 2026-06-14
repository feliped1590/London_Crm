
UPDATE public.companies SET lifecycle_baseline_at = '2026-04-01 00:00:00+00';

CREATE OR REPLACE FUNCTION public.recompute_company_lifecycle(p_company_id uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_updated integer := 0;
  v_active_days integer;
  v_inactive_days integer;
BEGIN
  SELECT active_days, inactive_days INTO v_active_days, v_inactive_days
  FROM public.lifecycle_config ORDER BY created_at ASC LIMIT 1;
  v_active_days := COALESCE(v_active_days, 180);
  v_inactive_days := COALESCE(v_inactive_days, 365);

  WITH source AS (
    SELECT c.id,
      CASE
        WHEN c.lifecycle_stage <> 'customer_active' THEN NULL::activity_status
        ELSE (
          CASE
            WHEN COALESCE(s.last_interaction_at, c.lifecycle_baseline_at) >= now() - make_interval(days => v_active_days)
              THEN 'ativo'::activity_status
            WHEN COALESCE(s.last_interaction_at, c.lifecycle_baseline_at) >= now() - make_interval(days => v_inactive_days)
              THEN 'inativo'::activity_status
            ELSE 'perdido'::activity_status
          END
        )
      END AS new_status,
      COALESCE(s.last_interaction_at, c.lifecycle_baseline_at) AS last_int
    FROM companies c
    LEFT JOIN company_activity_summary s ON s.company_id = c.id
    WHERE p_company_id IS NULL OR c.id = p_company_id
  ),
  upd AS (
    UPDATE companies c
    SET activity_status = src.new_status,
        last_interaction_at = src.last_int,
        activity_status_updated_at = now()
    FROM source src
    WHERE c.id = src.id
      AND (c.activity_status IS DISTINCT FROM src.new_status
           OR c.last_interaction_at IS DISTINCT FROM src.last_int)
    RETURNING c.id
  )
  SELECT COUNT(*) INTO v_updated FROM upd;
  RETURN v_updated;
END;
$function$;
