CREATE OR REPLACE FUNCTION public.search_customers_paginated(p_search text DEFAULT NULL::text, p_status text DEFAULT 'all'::text, p_state text DEFAULT NULL::text, p_city text DEFAULT NULL::text, p_owner_id text DEFAULT NULL::text, p_setor_id text DEFAULT NULL::text, p_segmento_id text DEFAULT NULL::text, p_atividade_id text DEFAULT NULL::text, p_allowed_sales_rep_ids uuid[] DEFAULT NULL::uuid[], p_lifecycle_stage text DEFAULT NULL::text, p_sort_field text DEFAULT 'name'::text, p_sort_dir text DEFAULT 'asc'::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, name text, fantasia text, cnpj text, phone text, email text, city text, state text, address text, active boolean, tenant_id uuid, custom_fields jsonb, owner_id uuid, owner_name text, created_at text, contact_name text, primary_contact_name text, primary_contact_job_title text, primary_contact_mobile text, primary_contact_email text, contacts_count bigint, deals_count bigint, deals_open_count bigint, deals_won_count bigint, deals_lost_count bigint, deals_total_value numeric, last_interaction_at text, last_order_at text, total_count bigint, regiao text, setor_id uuid, segmento_id uuid, atividade_id uuid, contribuinte_ipi boolean, erp_code text)
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
    p.id, p.name, p.fantasia, p.cnpj, p.phone, p.email, p.city, p.state, p.address, p.active,
    p.tenant_id, p.custom_fields, p.sales_rep_id AS owner_id, p.sr_name AS owner_name,
    p.created_at::text, p.contact_name,
    p.primary_contact_name, p.primary_contact_job_title, p.primary_contact_mobile, p.primary_contact_email,
    (SELECT count(*) FROM public.contacts ct WHERE ct.company_id = p.id) AS contacts_count,
    (SELECT count(*) FROM public.deals d WHERE d.company_id = p.id) AS deals_count,
    (SELECT count(*) FROM public.deals d WHERE d.company_id = p.id AND d.status = 'open') AS deals_open_count,
    (SELECT count(*) FROM public.deals d WHERE d.company_id = p.id AND d.status = 'won') AS deals_won_count,
    (SELECT count(*) FROM public.deals d WHERE d.company_id = p.id AND d.status = 'lost') AS deals_lost_count,
    (SELECT coalesce(sum(d.value),0) FROM public.deals d WHERE d.company_id = p.id AND d.status = 'won') AS deals_total_value,
    p.last_interaction_at::text, p.last_order_at::text,
    p.total_count,
    p.regiao, p.setor_id, p.segmento_id, p.atividade_id, p.contribuinte_ipi, p.erp_code
  FROM page p;
END;
$function$;