CREATE OR REPLACE FUNCTION public.get_group_deal_metrics_v1(p_company_id uuid)
RETURNS TABLE(
  total_deals bigint,
  total_value numeric,
  counts_by_stage jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_cnpj_root text;
BEGIN
  SELECT c.tenant_id, c.cnpj_root
  INTO v_tenant_id, v_cnpj_root
  FROM public.companies c
  WHERE c.id = p_company_id;

  IF v_tenant_id IS NULL OR v_cnpj_root IS NULL THEN
    RETURN QUERY
    SELECT 0::bigint, 0::numeric, '{}'::jsonb;
    RETURN;
  END IF;

  RETURN QUERY
  WITH group_deals AS (
    SELECT d.stage::text AS stage, d.value
    FROM public.deals d
    INNER JOIN public.companies c
      ON c.id = d.company_id
    WHERE c.tenant_id = v_tenant_id
      AND c.cnpj_root = v_cnpj_root
  ),
  stage_counts AS (
    SELECT gd.stage, COUNT(*)::bigint AS stage_total
    FROM group_deals gd
    GROUP BY gd.stage
  )
  SELECT
    COUNT(*)::bigint AS total_deals,
    COALESCE(SUM(gd.value), 0)::numeric AS total_value,
    COALESCE(
      (
        SELECT jsonb_object_agg(sc.stage, sc.stage_total)
        FROM stage_counts sc
      ),
      '{}'::jsonb
    ) AS counts_by_stage
  FROM group_deals gd;
END;
$$;