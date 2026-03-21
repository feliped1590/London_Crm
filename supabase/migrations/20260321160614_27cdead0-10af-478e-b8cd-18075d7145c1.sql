CREATE OR REPLACE FUNCTION public.search_customers_paginated(
  p_search text DEFAULT NULL::text,
  p_status text DEFAULT 'active'::text,
  p_state text DEFAULT NULL::text,
  p_city text DEFAULT NULL::text,
  p_owner_id text DEFAULT NULL::text,
  p_setor_id text DEFAULT NULL::text,
  p_segmento_id text DEFAULT NULL::text,
  p_atividade_id text DEFAULT NULL::text,
  p_sort_field text DEFAULT 'name'::text,
  p_sort_dir text DEFAULT 'asc'::text,
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0,
  p_allowed_sales_rep_ids uuid[] DEFAULT NULL::uuid[],
  p_lifecycle_stage text DEFAULT NULL::text
)
RETURNS TABLE(
  id uuid,
  name text,
  fantasia text,
  cnpj text,
  phone text,
  email text,
  city text,
  state text,
  address text,
  active boolean,
  custom_fields jsonb,
  owner_id uuid,
  owner_name text,
  created_at text,
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
  last_interaction_at text,
  last_order_at text,
  total_count bigint,
  regiao text,
  setor_id uuid,
  segmento_id uuid,
  atividade_id uuid,
  contribuinte_ipi boolean,
  last_relevant_interaction_at text,
  last_relevant_legal_entity_id uuid,
  last_relevant_legal_entity_name text,
  last_relevant_interaction_source text
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
    AND (p_lifecycle_stage IS NULL OR c.lifecycle_stage::text = p_lifecycle_stage)
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
  WITH
  activities_agg AS (
    SELECT a.company_id, MAX(a.created_at) AS last_activity_at
    FROM activities a GROUP BY a.company_id
  ),
  tasks_agg AS (
    SELECT t.company_id, MAX(t.completed_at) AS last_task_at
    FROM tasks t WHERE t.status = 'concluida' GROUP BY t.company_id
  ),
  emails_agg AS (
    SELECT ct.company_id, MAX(el.sent_at) AS last_email_at
    FROM email_logs el JOIN contacts ct ON el.contact_id = ct.id
    WHERE el.sent_at IS NOT NULL GROUP BY ct.company_id
  ),
  whatsapp_agg AS (
    SELECT wm.company_id, MAX(wm.created_at) AS last_whatsapp_at
    FROM whatsapp_messages wm WHERE wm.direction = 'outbound' GROUP BY wm.company_id
  ),
  deals_agg AS (
    SELECT dl.company_id,
      COUNT(*) AS total_count,
      COUNT(*) FILTER (WHERE dl.stage NOT IN ('fechado_ganho','fechado_perdido')) AS open_count,
      COUNT(*) FILTER (WHERE dl.stage = 'fechado_ganho') AS won_count,
      COUNT(*) FILTER (WHERE dl.stage = 'fechado_perdido') AS lost_count,
      COALESCE(SUM(dl.value), 0) AS total_value,
      MAX(dl.created_at) AS last_deal_at
    FROM deals dl GROUP BY dl.company_id
  ),
  orders_agg AS (
    SELECT o.company_id, MAX(o.created_at) AS last_order_at
    FROM orders o GROUP BY o.company_id
  ),
  contacts_agg AS (
    SELECT ct.company_id, COUNT(*) AS total_count, MIN(ct.created_at) AS first_contact_created
    FROM contacts ct GROUP BY ct.company_id
  ),
  primary_contacts AS (
    SELECT DISTINCT ON (ct.company_id)
      ct.company_id,
      ct.first_name || coalesce(' ' || ct.last_name, '') AS full_name,
      ct.job_title,
      ct.mobile,
      ct.email
    FROM contacts ct
    ORDER BY ct.company_id, ct.created_at
  ),
  filtered_companies AS (
    SELECT c.id
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
      AND (p_lifecycle_stage IS NULL OR c.lifecycle_stage::text = p_lifecycle_stage)
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
  ),
  filtered_company_ids AS (
    SELECT array_agg(fc.id) AS company_ids
    FROM filtered_companies fc
  ),
  relevant_interactions AS (
    SELECT ri.*
    FROM filtered_company_ids fci
    CROSS JOIN LATERAL public.get_customer_last_relevant_interactions(fci.company_ids) ri
    WHERE fci.company_ids IS NOT NULL
  ),
  base AS (
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
      pc.full_name AS c_primary_contact_name,
      pc.job_title AS c_primary_contact_job_title,
      pc.mobile AS c_primary_contact_mobile,
      pc.email AS c_primary_contact_email,
      COALESCE(ca.total_count, 0) AS c_contacts_count,
      COALESCE(da.total_count, 0) AS c_deals_count,
      COALESCE(da.open_count, 0) AS c_deals_open_count,
      COALESCE(da.won_count, 0) AS c_deals_won_count,
      COALESCE(da.lost_count, 0) AS c_deals_lost_count,
      COALESCE(da.total_value, 0) AS c_deals_total_value,
      GREATEST(
        aa.last_activity_at, ta.last_task_at, ea.last_email_at,
        wa.last_whatsapp_at, da.last_deal_at, oa.last_order_at
      )::text AS c_last_interaction_at,
      oa.last_order_at::text AS c_last_order_at,
      public.get_region_by_state(c.state) AS c_regiao,
      c.setor_id AS c_setor_id,
      c.segmento_id AS c_segmento_id,
      c.atividade_id AS c_atividade_id,
      COALESCE(c.contribuinte_ipi, false) AS c_contribuinte_ipi,
      ri.last_relevant_interaction_at::text AS c_last_relevant_interaction_at,
      ri.legal_entity_id AS c_last_relevant_legal_entity_id,
      ri.legal_entity_name AS c_last_relevant_legal_entity_name,
      ri.interaction_source AS c_last_relevant_interaction_source
    FROM filtered_companies fc
    JOIN companies c ON c.id = fc.id
    LEFT JOIN sales_reps sr ON sr.id = c.sales_rep_id
    LEFT JOIN primary_contacts pc ON pc.company_id = c.id
    LEFT JOIN contacts_agg ca ON ca.company_id = c.id
    LEFT JOIN deals_agg da ON da.company_id = c.id
    LEFT JOIN activities_agg aa ON aa.company_id = c.id
    LEFT JOIN tasks_agg ta ON ta.company_id = c.id
    LEFT JOIN emails_agg ea ON ea.company_id = c.id
    LEFT JOIN whatsapp_agg wa ON wa.company_id = c.id
    LEFT JOIN orders_agg oa ON oa.company_id = c.id
    LEFT JOIN relevant_interactions ri ON ri.customer_company_id = c.id
  ),
  page_base AS (
    SELECT
      b.c_id, b.c_name, b.c_fantasia, b.c_cnpj, b.c_phone, b.c_email,
      b.c_city, b.c_state, b.c_address, b.c_active, b.c_custom_fields,
      b.c_owner_id, b.c_owner_name, b.c_created_at, b.c_contact_name,
      b.c_primary_contact_name, b.c_primary_contact_job_title,
      b.c_primary_contact_mobile, b.c_primary_contact_email,
      b.c_contacts_count, b.c_deals_count, b.c_deals_open_count,
      b.c_deals_won_count, b.c_deals_lost_count, b.c_deals_total_value,
      b.c_last_interaction_at, b.c_last_order_at,
      b.c_regiao, b.c_setor_id, b.c_segmento_id, b.c_atividade_id,
      b.c_contribuinte_ipi,
      b.c_last_relevant_interaction_at,
      b.c_last_relevant_legal_entity_id,
      b.c_last_relevant_legal_entity_name,
      b.c_last_relevant_interaction_source
    FROM base b
    ORDER BY
      CASE WHEN p_sort_dir = 'asc' THEN
        CASE p_sort_field
          WHEN 'name' THEN lower(b.c_name)
          WHEN 'contact' THEN lower(coalesce(b.c_primary_contact_name, b.c_contact_name, ''))
          WHEN 'phone' THEN coalesce(b.c_primary_contact_mobile, b.c_phone, '')
          WHEN 'owner' THEN lower(coalesce(b.c_owner_name, ''))
          WHEN 'created_at' THEN b.c_created_at
          WHEN 'last_activity' THEN coalesce(b.c_last_relevant_interaction_at, '0')
          WHEN 'last_interaction_entity' THEN lower(coalesce(b.c_last_relevant_legal_entity_name, ''))
          WHEN 'deals' THEN lpad(b.c_deals_count::text, 10, '0')
          ELSE lower(b.c_name)
        END
      END ASC NULLS LAST,
      CASE WHEN p_sort_dir = 'desc' THEN
        CASE p_sort_field
          WHEN 'name' THEN lower(b.c_name)
          WHEN 'contact' THEN lower(coalesce(b.c_primary_contact_name, b.c_contact_name, ''))
          WHEN 'phone' THEN coalesce(b.c_primary_contact_mobile, b.c_phone, '')
          WHEN 'owner' THEN lower(coalesce(b.c_owner_name, ''))
          WHEN 'created_at' THEN b.c_created_at
          WHEN 'last_activity' THEN coalesce(b.c_last_relevant_interaction_at, '0')
          WHEN 'last_interaction_entity' THEN lower(coalesce(b.c_last_relevant_legal_entity_name, ''))
          WHEN 'deals' THEN lpad(b.c_deals_count::text, 10, '0')
          ELSE lower(b.c_name)
        END
      END DESC NULLS LAST
    LIMIT p_limit OFFSET p_offset
  )
  SELECT
    pb.c_id,
    pb.c_name,
    pb.c_fantasia,
    pb.c_cnpj,
    pb.c_phone,
    pb.c_email,
    pb.c_city,
    pb.c_state,
    pb.c_address,
    pb.c_active,
    pb.c_custom_fields,
    pb.c_owner_id,
    pb.c_owner_name,
    pb.c_created_at,
    pb.c_contact_name,
    pb.c_primary_contact_name,
    pb.c_primary_contact_job_title,
    pb.c_primary_contact_mobile,
    pb.c_primary_contact_email,
    pb.c_contacts_count,
    pb.c_deals_count,
    pb.c_deals_open_count,
    pb.c_deals_won_count,
    pb.c_deals_lost_count,
    pb.c_deals_total_value,
    pb.c_last_interaction_at,
    pb.c_last_order_at,
    v_total,
    pb.c_regiao,
    pb.c_setor_id,
    pb.c_segmento_id,
    pb.c_atividade_id,
    pb.c_contribuinte_ipi,
    pb.c_last_relevant_interaction_at,
    pb.c_last_relevant_legal_entity_id,
    pb.c_last_relevant_legal_entity_name,
    pb.c_last_relevant_interaction_source
  FROM page_base pb
  ORDER BY
    CASE WHEN p_sort_dir = 'asc' THEN
      CASE p_sort_field
        WHEN 'name' THEN lower(pb.c_name)
        WHEN 'contact' THEN lower(coalesce(pb.c_primary_contact_name, pb.c_contact_name, ''))
        WHEN 'phone' THEN coalesce(pb.c_primary_contact_mobile, pb.c_phone, '')
        WHEN 'owner' THEN lower(coalesce(pb.c_owner_name, ''))
        WHEN 'created_at' THEN pb.c_created_at
        WHEN 'last_activity' THEN coalesce(pb.c_last_relevant_interaction_at, '0')
        WHEN 'last_interaction_entity' THEN lower(coalesce(pb.c_last_relevant_legal_entity_name, ''))
        WHEN 'deals' THEN lpad(pb.c_deals_count::text, 10, '0')
        ELSE lower(pb.c_name)
      END
    END ASC NULLS LAST,
    CASE WHEN p_sort_dir = 'desc' THEN
      CASE p_sort_field
        WHEN 'name' THEN lower(pb.c_name)
        WHEN 'contact' THEN lower(coalesce(pb.c_primary_contact_name, pb.c_contact_name, ''))
        WHEN 'phone' THEN coalesce(pb.c_primary_contact_mobile, pb.c_phone, '')
        WHEN 'owner' THEN lower(coalesce(pb.c_owner_name, ''))
        WHEN 'created_at' THEN pb.c_created_at
        WHEN 'last_activity' THEN coalesce(pb.c_last_relevant_interaction_at, '0')
        WHEN 'last_interaction_entity' THEN lower(coalesce(pb.c_last_relevant_legal_entity_name, ''))
        WHEN 'deals' THEN lpad(pb.c_deals_count::text, 10, '0')
        ELSE lower(pb.c_name)
      END
    END DESC NULLS LAST;
END;
$function$;