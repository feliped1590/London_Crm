
-- Drop old function signature and recreate with new return type
DROP FUNCTION IF EXISTS public.get_customer_filter_options();

CREATE OR REPLACE FUNCTION public.get_customer_filter_options()
 RETURNS TABLE(states text[], cities text[], industries text[], setores json[], segmentos json[], atividades json[])
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    (SELECT ARRAY_AGG(DISTINCT state ORDER BY state) FROM companies WHERE state IS NOT NULL AND state != '') as states,
    (SELECT ARRAY_AGG(DISTINCT city ORDER BY city) FROM companies WHERE city IS NOT NULL AND city != '') as cities,
    (SELECT ARRAY_AGG(DISTINCT industry ORDER BY industry) FROM companies WHERE industry IS NOT NULL AND industry != '') as industries,
    (SELECT ARRAY_AGG(json_build_object('id', s.id, 'nome', s.nome) ORDER BY s.sort_order) FROM setores s WHERE s.is_active = true) as setores,
    (SELECT ARRAY_AGG(json_build_object('id', sg.id, 'nome', sg.nome, 'setor_id', sg.setor_id) ORDER BY sg.sort_order) FROM segmentos sg WHERE sg.is_active = true) as segmentos,
    (SELECT ARRAY_AGG(json_build_object('id', a.id, 'nome', a.nome, 'segmento_id', a.segmento_id) ORDER BY a.sort_order) FROM atividades a WHERE a.is_active = true) as atividades;
$function$;

-- Drop old search function and recreate with new params
DROP FUNCTION IF EXISTS public.search_customers_paginated(text, text, text, text, uuid, text, text, text, integer, integer);

CREATE OR REPLACE FUNCTION public.search_customers_paginated(
  p_search text DEFAULT NULL,
  p_status text DEFAULT 'active',
  p_state text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_owner_id uuid DEFAULT NULL,
  p_industry text DEFAULT NULL,
  p_setor_id uuid DEFAULT NULL,
  p_segmento_id uuid DEFAULT NULL,
  p_atividade_id uuid DEFAULT NULL,
  p_sort_field text DEFAULT 'name',
  p_sort_dir text DEFAULT 'asc',
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0
)
 RETURNS TABLE(
   id uuid, name text, fantasia text, cnpj text, phone text, email text,
   industry text, city text, state text, address text, active boolean,
   custom_fields jsonb, owner_id uuid, owner_name text, created_at timestamptz,
   contact_name text, primary_contact_name text, primary_contact_job_title text,
   primary_contact_mobile text, primary_contact_email text, contacts_count bigint,
   deals_count bigint, deals_open_count bigint, deals_won_count bigint,
   deals_lost_count bigint, deals_total_value numeric, last_interaction_at timestamptz,
   last_order_at timestamptz, total_count bigint, region text
 )
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
    AND (p_setor_id IS NULL OR c.setor_id = p_setor_id)
    AND (p_segmento_id IS NULL OR c.segmento_id = p_segmento_id)
    AND (p_atividade_id IS NULL OR c.atividade_id = p_atividade_id)
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
    AND (p_setor_id IS NULL OR c.setor_id = p_setor_id)
    AND (p_segmento_id IS NULL OR c.segmento_id = p_segmento_id)
    AND (p_atividade_id IS NULL OR c.atividade_id = p_atividade_id)
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
