-- Compatibility patch: keep lifecycle functions aligned with
-- public.companies.activity_status typed as text.
-- This migration intentionally does not create/alter enum types.

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
    SELECT
      c.id,
      CASE
        WHEN c.lifecycle_stage <> 'customer_active' THEN NULL::text
        ELSE (
          CASE
            WHEN COALESCE(s.last_interaction_at, c.lifecycle_baseline_at) >= now() - make_interval(days => v_active_days)
              THEN 'ativo'
            WHEN COALESCE(s.last_interaction_at, c.lifecycle_baseline_at) >= now() - make_interval(days => v_inactive_days)
              THEN 'inativo'
            ELSE 'perdido'
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

CREATE OR REPLACE FUNCTION public.trg_promote_to_customer_on_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_trigger text;
BEGIN
  IF NEW.company_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT prospect_to_customer_trigger INTO v_trigger
  FROM public.lifecycle_config ORDER BY created_at ASC LIMIT 1;

  IF COALESCE(v_trigger, 'order_created') <> 'order_created' THEN
    RETURN NEW;
  END IF;

  UPDATE public.companies
  SET lifecycle_stage = 'customer_active'::lifecycle_stage,
      activity_status = 'ativo',
      activity_status_updated_at = now(),
      last_interaction_at = now()
  WHERE id = NEW.company_id
    AND lifecycle_stage <> 'customer_active'::lifecycle_stage;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.flag_lost_customers_for_release()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer := 0;
  v_lost_releases boolean;
  v_requires_conf boolean;
BEGIN
  SELECT lost_releases_portfolio, lost_release_requires_confirmation
    INTO v_lost_releases, v_requires_conf
  FROM public.lifecycle_config ORDER BY created_at ASC LIMIT 1;

  IF NOT COALESCE(v_lost_releases, true) THEN
    RETURN 0;
  END IF;

  IF COALESCE(v_requires_conf, true) THEN
    WITH ins AS (
      INSERT INTO public.portfolio_release_queue (tenant_id, company_id, previous_sales_rep_id, status)
      SELECT c.tenant_id, c.id, c.sales_rep_id, 'pending_confirmation'
      FROM public.companies c
      WHERE c.activity_status = 'perdido'
        AND c.sales_rep_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.portfolio_release_queue q
          WHERE q.company_id = c.id AND q.status = 'pending_confirmation'
        )
      RETURNING 1
    )
    SELECT count(*) INTO v_count FROM ins;
  ELSE
    WITH upd AS (
      UPDATE public.companies c
      SET sales_rep_id = NULL, owner_id = NULL
      WHERE c.activity_status = 'perdido'
        AND c.sales_rep_id IS NOT NULL
      RETURNING c.id
    )
    SELECT count(*) INTO v_count FROM upd;
  END IF;

  RETURN v_count;
END;
$function$;
