
DROP FUNCTION IF EXISTS public.search_customers_paginated(text,text,text,text,uuid,text,text,text,integer,integer);

CREATE OR REPLACE FUNCTION public.search_customers_paginated(p_search text DEFAULT NULL::text, p_status text DEFAULT 'active'::text, p_state text DEFAULT NULL::text, p_city text DEFAULT NULL::text, p_owner_id uuid DEFAULT NULL::uuid, p_industry text DEFAULT NULL::text, p_sort_field text DEFAULT 'name'::text, p_sort_dir text DEFAULT 'asc'::text, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, name text, fantasia text, cnpj text, phone text, email text, industry text, city text, state text, address text, active boolean, custom_fields jsonb, owner_id uuid, owner_name text, created_at timestamp with time zone, contact_name text, primary_contact_name text, primary_contact_job_title text, primary_contact_mobile text, primary_contact_email text, contacts_count bigint, deals_count bigint, deals_open_count bigint, deals_won_count bigint, deals_lost_count bigint, deals_total_value numeric, last_interaction_at timestamp with time zone, last_order_at timestamp with time zone, total_count bigint, region text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
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
    AND (p_owner_id IS NULL OR c.owner_id = p_owner_id)
    AND (p_industry IS NULL OR c.industry = p_industry)
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
    c.id, c.name, c.fantasia, c.cnpj, c.phone, c.email, c.industry, c.city, c.state, c.address, c.active,
    c.custom_fields::jsonb, c.owner_id, p.full_name as owner_name, c.created_at, c.contact_name,
    (SELECT ct.first_name || coalesce(' ' || ct.last_name, '') FROM contacts ct WHERE ct.company_id = c.id ORDER BY ct.created_at LIMIT 1),
    (SELECT ct.job_title FROM contacts ct WHERE ct.company_id = c.id ORDER BY ct.created_at LIMIT 1),
    (SELECT ct.mobile FROM contacts ct WHERE ct.company_id = c.id ORDER BY ct.created_at LIMIT 1),
    (SELECT ct.email FROM contacts ct WHERE ct.company_id = c.id ORDER BY ct.created_at LIMIT 1),
    (SELECT COUNT(*) FROM contacts ct WHERE ct.company_id = c.id),
    (SELECT COUNT(*) FROM deals d WHERE d.company_id = c.id),
    (SELECT COUNT(*) FROM deals d WHERE d.company_id = c.id AND d.stage NOT IN ('fechado_ganho', 'fechado_perdido')),
    (SELECT COUNT(*) FROM deals d WHERE d.company_id = c.id AND d.stage = 'fechado_ganho'),
    (SELECT COUNT(*) FROM deals d WHERE d.company_id = c.id AND d.stage = 'fechado_perdido'),
    (SELECT COALESCE(SUM(d.value), 0) FROM deals d WHERE d.company_id = c.id),
    cas.last_interaction_at,
    cas.last_order_at,
    v_total,
    public.get_region_by_state(c.state)
  FROM companies c
  LEFT JOIN profiles p ON p.user_id = c.owner_id
  LEFT JOIN company_activity_summary cas ON cas.company_id = c.id
  WHERE
    (p_status = 'all' OR (p_status = 'active' AND c.active = true) OR (p_status = 'inactive' AND c.active = false))
    AND (p_state IS NULL OR c.state = p_state)
    AND (p_city IS NULL OR c.city = p_city)
    AND (p_owner_id IS NULL OR c.owner_id = p_owner_id)
    AND (p_industry IS NULL OR c.industry = p_industry)
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
    CASE WHEN p_sort_field = 'name' AND p_sort_dir = 'asc' THEN lower(coalesce(c.fantasia, c.name)) END ASC NULLS LAST,
    CASE WHEN p_sort_field = 'name' AND p_sort_dir = 'desc' THEN lower(coalesce(c.fantasia, c.name)) END DESC NULLS LAST,
    CASE WHEN p_sort_field = 'created_at' AND p_sort_dir = 'asc' THEN c.created_at END ASC NULLS LAST,
    CASE WHEN p_sort_field = 'created_at' AND p_sort_dir = 'desc' THEN c.created_at END DESC NULLS LAST,
    CASE WHEN p_sort_field = 'status' AND p_sort_dir = 'asc' THEN c.active END ASC,
    CASE WHEN p_sort_field = 'status' AND p_sort_dir = 'desc' THEN c.active END DESC,
    CASE WHEN p_sort_field = 'owner' AND p_sort_dir = 'asc' THEN lower(coalesce(p.full_name, '')) END ASC NULLS LAST,
    CASE WHEN p_sort_field = 'owner' AND p_sort_dir = 'desc' THEN lower(coalesce(p.full_name, '')) END DESC NULLS LAST,
    c.name ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$function$;
