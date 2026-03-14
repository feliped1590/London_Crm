
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
  primary_contact_name text, primary_contact_job_title text,
  primary_contact_mobile text, primary_contact_email text,
  contacts_count bigint, deals_count bigint, deals_open_count bigint,
  deals_won_count bigint, deals_lost_count bigint, deals_total_value numeric,
  last_interaction_at text, last_order_at text, total_count bigint,
  regiao text, setor_id uuid, segmento_id uuid, atividade_id uuid,
  contribuinte_ipi boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total bigint;
  v_search_lower text;
  v_search_digits text;
BEGIN
  SET LOCAL row_security = off;

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
  WITH base AS (
    SELECT
      c.id AS c_id,
      c.name AS c_name,
      c.fantasia AS c_fantasia,
      c.cnpj AS c_cnpj,
      c.phone AS c_phone,
      c.email AS c_email,
      c.city AS c_city,
      c.state AS c_state,
      c.address AS c_address,
      c.active AS c_active,
      c.custom_fields::jsonb AS c_custom_fields,
      c.owner_id AS c_owner_id,
      sr.name AS c_owner_name,
      c.created_at::text AS c_created_at,
      c.contact_name AS c_contact_name,
      (SELECT ct.first_name || coalesce(' ' || ct.last_name, '') FROM contacts ct WHERE ct.company_id = c.id ORDER BY ct.created_at LIMIT 1) AS c_primary_contact_name,
      (SELECT ct.job_title FROM contacts ct WHERE ct.company_id = c.id ORDER BY ct.created_at LIMIT 1) AS c_primary_contact_job_title,
      (SELECT ct.mobile FROM contacts ct WHERE ct.company_id = c.id ORDER BY ct.created_at LIMIT 1) AS c_primary_contact_mobile,
      (SELECT ct.email FROM contacts ct WHERE ct.company_id = c.id ORDER BY ct.created_at LIMIT 1) AS c_primary_contact_email,
      (SELECT COUNT(*) FROM contacts ct WHERE ct.company_id = c.id) AS c_contacts_count,
      (SELECT COUNT(*) FROM deals dl WHERE dl.company_id = c.id) AS c_deals_count,
      (SELECT COUNT(*) FROM deals dl WHERE dl.company_id = c.id AND dl.stage NOT IN ('fechado_ganho','fechado_perdido')) AS c_deals_open_count,
      (SELECT COUNT(*) FROM deals dl WHERE dl.company_id = c.id AND dl.stage = 'fechado_ganho') AS c_deals_won_count,
      (SELECT COUNT(*) FROM deals dl WHERE dl.company_id = c.id AND dl.stage = 'fechado_perdido') AS c_deals_lost_count,
      (SELECT COALESCE(SUM(dl.value), 0) FROM deals dl WHERE dl.company_id = c.id) AS c_deals_total_value,
      GREATEST(
        (SELECT MAX(a.created_at) FROM activities a WHERE a.company_id = c.id),
        (SELECT MAX(t.completed_at) FROM tasks t WHERE t.company_id = c.id AND t.status = 'concluida'),
        (SELECT MAX(el.sent_at) FROM email_logs el JOIN contacts ct ON el.contact_id = ct.id WHERE ct.company_id = c.id AND el.sent_at IS NOT NULL),
        (SELECT MAX(wm.created_at) FROM whatsapp_messages wm WHERE wm.company_id = c.id AND wm.direction = 'outbound'),
        (SELECT MAX(dl.created_at) FROM deals dl WHERE dl.company_id = c.id),
        (SELECT MAX(o.created_at) FROM orders o WHERE o.company_id = c.id)
      ) AS c_last_interaction_at,
      (SELECT MAX(o.created_at) FROM orders o WHERE o.company_id = c.id) AS c_last_order_at,
      public.get_region_by_state(c.state) AS c_regiao,
      c.setor_id AS c_setor_id,
      c.segmento_id AS c_segmento_id,
      c.atividade_id AS c_atividade_id,
      COALESCE(c.contribuinte_ipi, false) AS c_contribuinte_ipi
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
  )
  SELECT
    b.c_id, b.c_name, b.c_fantasia, b.c_cnpj, b.c_phone, b.c_email,
    b.c_city, b.c_state, b.c_address, b.c_active, b.c_custom_fields,
    b.c_owner_id, b.c_owner_name, b.c_created_at, b.c_contact_name,
    b.c_primary_contact_name, b.c_primary_contact_job_title,
    b.c_primary_contact_mobile, b.c_primary_contact_email,
    b.c_contacts_count, b.c_deals_count, b.c_deals_open_count,
    b.c_deals_won_count, b.c_deals_lost_count, b.c_deals_total_value,
    b.c_last_interaction_at::text, b.c_last_order_at::text,
    v_total,
    b.c_regiao, b.c_setor_id, b.c_segmento_id, b.c_atividade_id,
    b.c_contribuinte_ipi
  FROM base b
  ORDER BY
    -- Text fields ASC
    CASE WHEN p_sort_dir = 'asc' THEN
      CASE p_sort_field
        WHEN 'name' THEN coalesce(b.c_fantasia, b.c_name)
        WHEN 'contact' THEN coalesce(b.c_contact_name, '')
        WHEN 'phone' THEN coalesce(b.c_phone, '')
        WHEN 'owner' THEN coalesce(b.c_owner_name, '')
        WHEN 'created_at' THEN b.c_created_at
      END
    END ASC NULLS LAST,
    -- Text fields DESC
    CASE WHEN p_sort_dir = 'desc' THEN
      CASE p_sort_field
        WHEN 'name' THEN coalesce(b.c_fantasia, b.c_name)
        WHEN 'contact' THEN coalesce(b.c_contact_name, '')
        WHEN 'phone' THEN coalesce(b.c_phone, '')
        WHEN 'owner' THEN coalesce(b.c_owner_name, '')
        WHEN 'created_at' THEN b.c_created_at
      END
    END DESC NULLS LAST,
    -- Timestamp: last_activity ASC
    CASE WHEN p_sort_field = 'last_activity' AND p_sort_dir = 'asc' THEN b.c_last_interaction_at END ASC NULLS LAST,
    -- Timestamp: last_activity DESC
    CASE WHEN p_sort_field = 'last_activity' AND p_sort_dir = 'desc' THEN b.c_last_interaction_at END DESC NULLS LAST,
    -- Numeric: deals ASC
    CASE WHEN p_sort_field = 'deals' AND p_sort_dir = 'asc' THEN b.c_deals_count END ASC NULLS LAST,
    -- Numeric: deals DESC
    CASE WHEN p_sort_field = 'deals' AND p_sort_dir = 'desc' THEN b.c_deals_count END DESC NULLS LAST,
    -- Fallback
    b.c_name ASC
  LIMIT p_limit OFFSET p_offset;
END;
$function$;
