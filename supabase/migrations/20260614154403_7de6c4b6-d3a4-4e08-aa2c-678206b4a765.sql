CREATE OR REPLACE FUNCTION public.search_customers_paginated(
  p_search text DEFAULT NULL,
  p_status text DEFAULT 'all',
  p_state text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_owner_id text DEFAULT NULL,
  p_setor_id text DEFAULT NULL,
  p_segmento_id text DEFAULT NULL,
  p_atividade_id text DEFAULT NULL,
  p_allowed_sales_rep_ids uuid[] DEFAULT NULL,
  p_lifecycle_stage text DEFAULT NULL,
  p_sort_field text DEFAULT 'name',
  p_sort_dir text DEFAULT 'asc',
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid, name text, fantasia text, cnpj text, phone text, email text,
  city text, state text, address text, active boolean, tenant_id uuid,
  custom_fields jsonb, owner_id uuid, owner_name text, created_at text,
  contact_name text, primary_contact_name text, primary_contact_job_title text,
  primary_contact_mobile text, primary_contact_email text,
  contacts_count bigint, deals_count bigint, deals_open_count bigint,
  deals_won_count bigint, deals_lost_count bigint, deals_total_value numeric,
  last_interaction_at text, last_order_at text, total_count bigint,
  regiao text, setor_id uuid, segmento_id uuid, atividade_id uuid,
  contribuinte_ipi boolean, erp_code text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_search_lower text;
  v_search_digits text;
  v_sort_field text;
  v_sort_dir_asc boolean;
BEGIN
  SET LOCAL row_security = off;

  v_search_lower := lower(trim(coalesce(p_search, '')));
  v_search_digits := regexp_replace(coalesce(p_search, ''), '\D', '', 'g');
  v_sort_dir_asc := lower(coalesce(p_sort_dir, 'asc')) <> 'desc';
  v_sort_field := CASE
    WHEN p_sort_field IN ('name','created_at','owner','last_activity') THEN p_sort_field
    ELSE 'name'
  END;

  RETURN QUERY
  WITH filtered AS (
    SELECT
      c.id,
      count(*) OVER () AS total_count
    FROM public.companies c
    WHERE
      (p_status = 'all' OR (p_status = 'active' AND c.active = true) OR (p_status = 'inactive' AND c.active = false))
      AND (p_state IS NULL OR c.state = p_state)
      AND (p_city IS NULL OR c.city = p_city)
      AND (p_owner_id IS NULL OR c.sales_rep_id = p_owner_id::uuid)
      AND (p_setor_id IS NULL OR c.setor_id = p_setor_id::uuid)
      AND (p_segmento_id IS NULL OR c.segmento_id = p_segmento_id::uuid)
      AND (p_atividade_id IS NULL OR c.atividade_id = p_atividade_id::uuid)
      AND (p_allowed_sales_rep_ids IS NULL OR c.sales_rep_id = ANY(p_allowed_sales_rep_ids))
      AND (p_lifecycle_stage IS NULL OR c.lifecycle_stage::text = p_lifecycle_stage)
      AND (
        v_search_lower = ''
        OR lower(c.name) LIKE '%' || v_search_lower || '%'
        OR lower(coalesce(c.fantasia, '')) LIKE '%' || v_search_lower || '%'
        OR (v_search_digits <> '' AND regexp_replace(coalesce(c.cnpj, ''), '\D', '', 'g') LIKE '%' || v_search_digits || '%')
        OR lower(coalesce(c.city, '')) LIKE '%' || v_search_lower || '%'
        OR lower(coalesce(c.email, '')) LIKE '%' || v_search_lower || '%'
        OR (v_search_digits <> '' AND regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') LIKE '%' || v_search_digits || '%')
        OR lower(coalesce(c.contact_name, '')) LIKE '%' || v_search_lower || '%'
        OR lower(coalesce(c.erp_code, '')) LIKE '%' || v_search_lower || '%'
      )
  ),
  page AS (
    SELECT
      c.*,
      sr.name AS sr_name,
      f.total_count
    FROM filtered f
    JOIN public.companies c ON c.id = f.id
    LEFT JOIN public.sales_reps sr ON sr.id = c.sales_rep_id
    ORDER BY
      CASE WHEN v_sort_field = 'name'          AND v_sort_dir_asc       THEN lower(c.name) END ASC NULLS LAST,
      CASE WHEN v_sort_field = 'name'          AND NOT v_sort_dir_asc   THEN lower(c.name) END DESC NULLS LAST,
      CASE WHEN v_sort_field = 'created_at'    AND v_sort_dir_asc       THEN c.created_at END ASC NULLS LAST,
      CASE WHEN v_sort_field = 'created_at'    AND NOT v_sort_dir_asc   THEN c.created_at END DESC NULLS LAST,
      CASE WHEN v_sort_field = 'owner'         AND v_sort_dir_asc       THEN lower(coalesce(sr.name,'')) END ASC NULLS LAST,
      CASE WHEN v_sort_field = 'owner'         AND NOT v_sort_dir_asc   THEN lower(coalesce(sr.name,'')) END DESC NULLS LAST,
      CASE WHEN v_sort_field = 'last_activity' AND v_sort_dir_asc       THEN c.last_interaction_at END ASC NULLS LAST,
      CASE WHEN v_sort_field = 'last_activity' AND NOT v_sort_dir_asc   THEN c.last_interaction_at END DESC NULLS LAST,
      lower(c.name) ASC
    LIMIT p_limit OFFSET p_offset
  )
  SELECT
    p.id,
    p.name,
    p.fantasia,
    p.cnpj,
    p.phone,
    p.email,
    p.city,
    p.state,
    p.address,
    p.active,
    p.tenant_id,
    p.custom_fields::jsonb,
    p.owner_id,
    p.sr_name AS owner_name,
    p.created_at::text,
    p.contact_name,
    pc.full_name AS primary_contact_name,
    pc.job_title AS primary_contact_job_title,
    pc.mobile AS primary_contact_mobile,
    pc.email AS primary_contact_email,
    COALESCE(ca.cnt, 0)::bigint AS contacts_count,
    COALESCE(da.deals_total, 0)::bigint AS deals_count,
    COALESCE(da.open_count, 0)::bigint AS deals_open_count,
    COALESCE(da.won_count, 0)::bigint AS deals_won_count,
    COALESCE(da.lost_count, 0)::bigint AS deals_lost_count,
    COALESCE(da.deals_value, 0) AS deals_total_value,
    p.last_interaction_at::text AS last_interaction_at,
    oa.last_order_at::text AS last_order_at,
    p.total_count,
    public.get_region_by_state(p.state) AS regiao,
    p.setor_id,
    p.segmento_id,
    p.atividade_id,
    COALESCE(p.contribuinte_ipi, false) AS contribuinte_ipi,
    p.erp_code
  FROM page p
  LEFT JOIN LATERAL (
    SELECT
      ct.first_name || coalesce(' ' || ct.last_name, '') AS full_name,
      ct.job_title, ct.mobile, ct.email
    FROM public.contacts ct
    WHERE ct.company_id = p.id
    ORDER BY ct.created_at
    LIMIT 1
  ) pc ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS cnt FROM public.contacts ct WHERE ct.company_id = p.id
  ) ca ON true
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*) AS deals_total,
      COUNT(*) FILTER (WHERE dl.stage NOT IN ('fechado_ganho','fechado_perdido')) AS open_count,
      COUNT(*) FILTER (WHERE dl.stage = 'fechado_ganho') AS won_count,
      COUNT(*) FILTER (WHERE dl.stage = 'fechado_perdido') AS lost_count,
      COALESCE(SUM(dl.value), 0) AS deals_value
    FROM public.deals dl
    WHERE dl.company_id = p.id
  ) da ON true
  LEFT JOIN LATERAL (
    SELECT MAX(o.created_at) AS last_order_at
    FROM public.orders o
    WHERE o.company_id = p.id
  ) oa ON true
  ORDER BY
    CASE WHEN v_sort_field = 'name'          AND v_sort_dir_asc       THEN lower(p.name) END ASC NULLS LAST,
    CASE WHEN v_sort_field = 'name'          AND NOT v_sort_dir_asc   THEN lower(p.name) END DESC NULLS LAST,
    CASE WHEN v_sort_field = 'created_at'    AND v_sort_dir_asc       THEN p.created_at END ASC NULLS LAST,
    CASE WHEN v_sort_field = 'created_at'    AND NOT v_sort_dir_asc   THEN p.created_at END DESC NULLS LAST,
    CASE WHEN v_sort_field = 'owner'         AND v_sort_dir_asc       THEN lower(coalesce(p.sr_name,'')) END ASC NULLS LAST,
    CASE WHEN v_sort_field = 'owner'         AND NOT v_sort_dir_asc   THEN lower(coalesce(p.sr_name,'')) END DESC NULLS LAST,
    CASE WHEN v_sort_field = 'last_activity' AND v_sort_dir_asc       THEN p.last_interaction_at END ASC NULLS LAST,
    CASE WHEN v_sort_field = 'last_activity' AND NOT v_sort_dir_asc   THEN p.last_interaction_at END DESC NULLS LAST,
    lower(p.name) ASC;
END;
$function$;