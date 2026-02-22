
-- Server-side paginated search for customers page
CREATE OR REPLACE FUNCTION public.search_customers_paginated(
  p_search text DEFAULT NULL,
  p_status text DEFAULT 'active',
  p_state text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_owner_id uuid DEFAULT NULL,
  p_industry text DEFAULT NULL,
  p_sort_field text DEFAULT 'name',
  p_sort_dir text DEFAULT 'asc',
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  name text,
  fantasia text,
  cnpj text,
  phone text,
  email text,
  industry text,
  city text,
  state text,
  address text,
  active boolean,
  custom_fields jsonb,
  owner_id uuid,
  owner_name text,
  created_at timestamptz,
  contact_name text,
  primary_contact_name text,
  primary_contact_job_title text,
  primary_contact_mobile text,
  primary_contact_email text,
  contacts_count bigint,
  deals_count bigint,
  deals_open_count bigint,
  deals_won_count bigint,
  deals_lost_count bigint,
  deals_total_value numeric,
  last_interaction_at timestamptz,
  last_order_at timestamptz,
  total_count bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total bigint;
  v_search_lower text;
  v_search_digits text;
BEGIN
  v_search_lower := lower(trim(coalesce(p_search, '')));
  v_search_digits := regexp_replace(coalesce(p_search, ''), '\D', '', 'g');

  -- Get total count first
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
    c.id,
    c.name,
    c.fantasia,
    c.cnpj,
    c.phone,
    c.email,
    c.industry,
    c.city,
    c.state,
    c.address,
    c.active,
    c.custom_fields::jsonb,
    c.owner_id,
    p.full_name as owner_name,
    c.created_at,
    c.contact_name,
    -- Primary contact (first one)
    (SELECT ct.first_name || coalesce(' ' || ct.last_name, '') FROM contacts ct WHERE ct.company_id = c.id ORDER BY ct.created_at LIMIT 1) as primary_contact_name,
    (SELECT ct.job_title FROM contacts ct WHERE ct.company_id = c.id ORDER BY ct.created_at LIMIT 1) as primary_contact_job_title,
    (SELECT ct.mobile FROM contacts ct WHERE ct.company_id = c.id ORDER BY ct.created_at LIMIT 1) as primary_contact_mobile,
    (SELECT ct.email FROM contacts ct WHERE ct.company_id = c.id ORDER BY ct.created_at LIMIT 1) as primary_contact_email,
    -- Counts
    (SELECT COUNT(*) FROM contacts ct WHERE ct.company_id = c.id) as contacts_count,
    (SELECT COUNT(*) FROM deals d WHERE d.company_id = c.id) as deals_count,
    (SELECT COUNT(*) FROM deals d WHERE d.company_id = c.id AND d.stage NOT IN ('fechado_ganho', 'fechado_perdido')) as deals_open_count,
    (SELECT COUNT(*) FROM deals d WHERE d.company_id = c.id AND d.stage = 'fechado_ganho') as deals_won_count,
    (SELECT COUNT(*) FROM deals d WHERE d.company_id = c.id AND d.stage = 'fechado_perdido') as deals_lost_count,
    (SELECT COALESCE(SUM(d.value), 0) FROM deals d WHERE d.company_id = c.id) as deals_total_value,
    -- Activity
    cas.last_interaction_at,
    cas.last_order_at,
    -- Total
    v_total as total_count
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
$$;

-- Function to get distinct filter options efficiently
CREATE OR REPLACE FUNCTION public.get_customer_filter_options()
RETURNS TABLE(
  states text[],
  cities text[],
  industries text[]
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    (SELECT ARRAY_AGG(DISTINCT state ORDER BY state) FROM companies WHERE state IS NOT NULL AND state != '') as states,
    (SELECT ARRAY_AGG(DISTINCT city ORDER BY city) FROM companies WHERE city IS NOT NULL AND city != '') as cities,
    (SELECT ARRAY_AGG(DISTINCT industry ORDER BY industry) FROM companies WHERE industry IS NOT NULL AND industry != '') as industries;
$$;
