DROP FUNCTION IF EXISTS public.search_customers_paginated(text,text,text,text,text,text,text,text,text,text,integer,integer,uuid[]);

CREATE OR REPLACE FUNCTION public.search_customers_paginated(
  p_search text DEFAULT NULL,
  p_status text DEFAULT 'active',
  p_state text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_owner_id text DEFAULT NULL,
  p_setor_id text DEFAULT NULL,
  p_segmento_id text DEFAULT NULL,
  p_atividade_id text DEFAULT NULL,
  p_sort_field text DEFAULT 'name',
  p_sort_dir text DEFAULT 'asc',
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0,
  p_allowed_sales_rep_ids uuid[] DEFAULT NULL
)
RETURNS TABLE(
  id uuid, name text, fantasia text, cnpj text, phone text, email text,
  city text, state text, address text, active boolean, custom_fields jsonb,
  owner_id uuid, owner_name text, created_at text, contact_name text,
  primary_contact_name text, primary_contact_job_title text, primary_contact_mobile text, primary_contact_email text,
  contacts_count bigint, deals_count bigint, deals_open_count bigint, deals_won_count bigint, deals_lost_count bigint,
  deals_total_value numeric, last_interaction_at text, last_order_at text, total_count bigint,
  regiao text, setor_id uuid, segmento_id uuid, atividade_id uuid, contribuinte_ipi boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_total bigint;
  v_search_lower text;
  v_search_digits text;
BEGIN
  v_search_lower := lower(trim(coalesce(p_search, '')));
  v_search_digits := regexp_replace(coalesce(p_search, ''), '\D', '', 'g');

  SELECT COUNT(*)::bigint INTO v_total
  FROM companies c
  WHERE
    (p_status = 'all' OR (p_status = 'active' AND c.active = true) OR (p_status = 'inactive' AND c.active = false))
    AND (p_state IS NULL OR c.state = p_state)
    AND (p_city IS NULL OR c.city = p_city)
    AND (p_owner_id IS NULL OR c.sales_rep_id = p_owner_id::uuid)
    AND (p_setor_id IS NULL OR c.setor_id = p_setor_id::uuid)
    AND (p_segmento_id IS NULL OR c.segmento_id = p_segmento_id::uuid)
    AND (p_atividade_id IS NULL OR c.atividade_id = p_atividade_id::uuid)
    AND (p_allowed_sales_rep_ids IS NULL OR c.sales_rep_id = ANY(p_allowed_sales_rep_ids))
    AND (
      v_search_lower = '' 
      OR lower(c.name) LIKE '%' || v_search_lower || '%'
      OR lower(coalesce(c.fantasia, '')) LIKE '%' || v_search_lower || '%'
      OR (v_search_digits != '' AND regexp_replace(coalesce(c.cnpj, ''), '\D', '', 'g') LIKE '%' || v_search_digits || '%')
      OR lower(coalesce(c.city, '')) LIKE '%' || v_search_lower || '%'
      OR lower(coalesce(c.email, '')) LIKE '%' || v_search_lower || '%'
      OR (v_search_digits != '' AND regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') LIKE '%' || v_search_digits || '%')
      OR lower(coalesce(c.contact_name, '')) LIKE '%' || v_search_lower || '%'
    );

  RETURN QUERY
  SELECT
    c.id, c.name, c.fantasia, c.cnpj, c.phone, c.email, c.city, c.state, c.address, c.active,
    c.custom_fields::jsonb, c.owner_id, sr.name as owner_name, c.created_at::text, c.contact_name,
    (SELECT ct.first_name || coalesce(' ' || ct.last_name, '') FROM contacts ct WHERE ct.company_id = c.id ORDER BY ct.created_at LIMIT 1),
    (SELECT ct.job_title FROM contacts ct WHERE ct.company_id = c.id ORDER BY ct.created_at LIMIT 1),
    (SELECT ct.mobile FROM contacts ct WHERE ct.company_id = c.id ORDER BY ct.created_at LIMIT 1),
    (SELECT ct.email FROM contacts ct WHERE ct.company_id = c.id ORDER BY ct.created_at LIMIT 1),
    (SELECT COUNT(*) FROM contacts ct WHERE ct.company_id = c.id),
    (SELECT COUNT(*) FROM deals dl WHERE dl.company_id = c.id),
    (SELECT COUNT(*) FROM deals dl WHERE dl.company_id = c.id AND dl.stage NOT IN ('fechado_ganho','fechado_perdido')),
    (SELECT COUNT(*) FROM deals dl WHERE dl.company_id = c.id AND dl.stage = 'fechado_ganho'),
    (SELECT COUNT(*) FROM deals dl WHERE dl.company_id = c.id AND dl.stage = 'fechado_perdido'),
    (SELECT COALESCE(SUM(dl.value), 0) FROM deals dl WHERE dl.company_id = c.id),
    (SELECT MAX(a.created_at)::text FROM activities a WHERE a.company_id = c.id),
    (SELECT MAX(o.created_at)::text FROM orders o WHERE o.company_id = c.id),
    v_total,
    public.get_region_by_state(c.state),
    c.setor_id, c.segmento_id, c.atividade_id, c.contribuinte_ipi
  FROM companies c
  LEFT JOIN sales_reps sr ON sr.id = c.sales_rep_id
  WHERE
    (p_status = 'all' OR (p_status = 'active' AND c.active = true) OR (p_status = 'inactive' AND c.active = false))
    AND (p_state IS NULL OR c.state = p_state)
    AND (p_city IS NULL OR c.city = p_city)
    AND (p_owner_id IS NULL OR c.sales_rep_id = p_owner_id::uuid)
    AND (p_setor_id IS NULL OR c.setor_id = p_setor_id::uuid)
    AND (p_segmento_id IS NULL OR c.segmento_id = p_segmento_id::uuid)
    AND (p_atividade_id IS NULL OR c.atividade_id = p_atividade_id::uuid)
    AND (p_allowed_sales_rep_ids IS NULL OR c.sales_rep_id = ANY(p_allowed_sales_rep_ids))
    AND (
      v_search_lower = '' 
      OR lower(c.name) LIKE '%' || v_search_lower || '%'
      OR lower(coalesce(c.fantasia, '')) LIKE '%' || v_search_lower || '%'
      OR (v_search_digits != '' AND regexp_replace(coalesce(c.cnpj, ''), '\D', '', 'g') LIKE '%' || v_search_digits || '%')
      OR lower(coalesce(c.city, '')) LIKE '%' || v_search_lower || '%'
      OR lower(coalesce(c.email, '')) LIKE '%' || v_search_lower || '%'
      OR (v_search_digits != '' AND regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') LIKE '%' || v_search_digits || '%')
      OR lower(coalesce(c.contact_name, '')) LIKE '%' || v_search_lower || '%'
    )
  ORDER BY
    CASE WHEN p_sort_dir = 'asc' THEN
      CASE p_sort_field
        WHEN 'name' THEN lower(c.name)
        WHEN 'city' THEN lower(coalesce(c.city, ''))
        WHEN 'state' THEN lower(coalesce(c.state, ''))
        WHEN 'created_at' THEN c.created_at::text
        WHEN 'owner' THEN lower(coalesce(sr.name, ''))
      END
    END ASC NULLS LAST,
    CASE WHEN p_sort_dir = 'desc' THEN
      CASE p_sort_field
        WHEN 'name' THEN lower(c.name)
        WHEN 'city' THEN lower(coalesce(c.city, ''))
        WHEN 'state' THEN lower(coalesce(c.state, ''))
        WHEN 'created_at' THEN c.created_at::text
        WHEN 'owner' THEN lower(coalesce(sr.name, ''))
      END
    END DESC NULLS LAST
  LIMIT p_limit
  OFFSET p_offset;
END;
$function$;