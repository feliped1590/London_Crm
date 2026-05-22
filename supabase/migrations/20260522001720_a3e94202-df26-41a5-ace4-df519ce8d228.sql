
DROP FUNCTION IF EXISTS public.recompute_company_lifecycle(uuid);

CREATE OR REPLACE FUNCTION public.recompute_company_lifecycle(p_company_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer := 0;
BEGIN
  WITH source AS (
    SELECT
      c.id,
      CASE
        WHEN c.lifecycle_stage <> 'customer_active' THEN NULL::activity_status
        ELSE (
          CASE
            WHEN COALESCE(s.last_interaction_at, c.created_at) >= now() - interval '6 months'
              THEN 'ativo'::activity_status
            WHEN COALESCE(s.last_interaction_at, c.created_at) >= now() - interval '12 months'
              THEN 'inativo'::activity_status
            ELSE 'perdido'::activity_status
          END
        )
      END AS new_status,
      COALESCE(s.last_interaction_at, c.created_at) AS last_int
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
$$;

CREATE OR REPLACE FUNCTION public.get_activity_status_counts()
RETURNS TABLE(activity_status text, total bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(activity_status::text, 'unknown') AS activity_status,
         COUNT(*)::bigint AS total
  FROM companies
  WHERE lifecycle_stage = 'customer_active'
  GROUP BY 1;
$$;
