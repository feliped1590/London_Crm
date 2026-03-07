
-- Drop and recreate view with sales_rep_id column
DROP VIEW IF EXISTS unified_company_for_reallocation;

CREATE VIEW unified_company_for_reallocation AS
WITH crm_data AS (
  SELECT c.id AS company_id,
    c.name AS company_name,
    COALESCE(NULLIF(regexp_replace(c.cnpj, '[^0-9]', '', 'g'), ''), NULL) AS cnpj_normalized,
    c.cnpj,
    c.state,
    c.city,
    c.owner_id,
    c.sales_rep_id,
    NULL::text AS regiao,
    NULL::text AS subregiao,
    COALESCE(c.active, true) AS active,
    'crm'::text AS source,
    COALESCE(GREATEST(
      (SELECT max(a.created_at) FROM activities a WHERE a.company_id = c.id),
      (SELECT max(t.completed_at) FROM tasks t WHERE t.company_id = c.id AND t.status = 'concluida'),
      (SELECT max(el.sent_at) FROM email_logs el JOIN contacts ct ON el.contact_id = ct.id WHERE ct.company_id = c.id AND el.sent_at IS NOT NULL),
      (SELECT max(wm.created_at) FROM whatsapp_messages wm WHERE wm.company_id = c.id AND wm.direction = 'outbound')
    ), c.created_at) AS last_interaction_at,
    (SELECT max(o.created_at) FROM orders o WHERE o.company_id = c.id) AS last_order_at,
    (SELECT count(*)::integer FROM orders o WHERE o.company_id = c.id) AS total_orders,
    (SELECT COALESCE(sum(o.total_value), 0) FROM orders o WHERE o.company_id = c.id) AS total_order_value
  FROM companies c
  WHERE COALESCE(c.active, true) = true
),
erp_data AS (
  SELECT ec.id AS company_id,
    COALESCE(ec.razao_social, ec.nome_fantasia, 'Cliente ERP') AS company_name,
    COALESCE(NULLIF(regexp_replace(ec.cnpj_cpf, '[^0-9]', '', 'g'), ''), NULL) AS cnpj_normalized,
    ec.cnpj_cpf AS cnpj,
    (SELECT ea.uf FROM crm_client_addresses ea WHERE ea.client_id = ec.id LIMIT 1) AS state,
    (SELECT ea.cidade FROM crm_client_addresses ea WHERE ea.client_id = ec.id LIMIT 1) AS city,
    ec.owner_id,
    NULL::uuid AS sales_rep_id,
    ec.regiao,
    ec.subregiao,
    true AS active,
    'erp'::text AS source,
    NULL::timestamp with time zone AS last_interaction_at,
    (SELECT max(co.data_emissao::timestamp with time zone) FROM crm_orders co WHERE co.client_id = ec.id AND co.data_emissao IS NOT NULL) AS last_order_at,
    (SELECT count(*)::integer FROM crm_orders co WHERE co.client_id = ec.id) AS total_orders,
    (SELECT COALESCE(sum(co.valor_total), 0) FROM crm_orders co WHERE co.client_id = ec.id) AS total_order_value
  FROM crm_clients ec
  WHERE NOT EXISTS (
    SELECT 1 FROM companies c
    WHERE COALESCE(NULLIF(regexp_replace(c.cnpj, '[^0-9]', '', 'g'), ''), 'X') = COALESCE(NULLIF(regexp_replace(ec.cnpj_cpf, '[^0-9]', '', 'g'), ''), 'Y')
  )
)
SELECT company_id, company_name, cnpj, state, city, owner_id, sales_rep_id, regiao, subregiao, last_interaction_at, last_order_at, total_orders, total_order_value, source FROM crm_data
UNION ALL
SELECT company_id, company_name, cnpj, state, city, owner_id, sales_rep_id, regiao, subregiao, last_interaction_at, last_order_at, total_orders, total_order_value, source FROM erp_data;

-- Update main function to return sales_rep_name and filter by sales_rep_id
CREATE OR REPLACE FUNCTION public.get_companies_for_reallocation(
  p_states text[] DEFAULT NULL,
  p_regions text[] DEFAULT NULL,
  p_owner_id uuid DEFAULT NULL,
  p_min_days_no_interaction integer DEFAULT NULL,
  p_min_days_no_order integer DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_limit integer DEFAULT 500,
  p_offset integer DEFAULT 0,
  p_no_owner boolean DEFAULT NULL,
  p_sales_rep_id uuid DEFAULT NULL
)
RETURNS TABLE(
  company_id uuid, company_name text, cnpj text, state text, city text,
  owner_id uuid, owner_name text, sales_rep_name text,
  regiao text, subregiao text,
  last_interaction_at timestamptz, days_since_interaction integer,
  last_order_at timestamptz, days_since_order integer,
  total_orders integer, total_order_value numeric, source text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    u.company_id, u.company_name, u.cnpj, u.state, u.city, u.owner_id,
    COALESCE(p.full_name, 'Sem usuário') AS owner_name,
    COALESCE(sr.name, 'Sem vendedor') AS sales_rep_name,
    COALESCE(NULLIF(u.regiao, ''), public.get_region_by_state(u.state)) AS regiao,
    u.subregiao, u.last_interaction_at,
    COALESCE(EXTRACT(DAY FROM (now() - u.last_interaction_at))::integer, 9999) AS days_since_interaction,
    u.last_order_at,
    COALESCE(EXTRACT(DAY FROM (now() - u.last_order_at))::integer, 9999) AS days_since_order,
    u.total_orders, u.total_order_value, u.source
  FROM unified_company_for_reallocation u
  LEFT JOIN profiles p ON p.user_id = u.owner_id
  LEFT JOIN sales_reps sr ON sr.id = u.sales_rep_id
  WHERE 
    (p_states IS NULL OR u.state = ANY(p_states))
    AND (p_regions IS NULL OR COALESCE(NULLIF(u.regiao, ''), public.get_region_by_state(u.state)) = ANY(p_regions))
    AND (
      CASE
        WHEN p_no_owner = true THEN u.sales_rep_id IS NULL
        WHEN p_sales_rep_id IS NOT NULL THEN u.sales_rep_id = p_sales_rep_id
        WHEN p_owner_id IS NOT NULL THEN u.owner_id = p_owner_id
        ELSE true
      END
    )
    AND (p_min_days_no_interaction IS NULL OR u.last_interaction_at IS NULL OR EXTRACT(DAY FROM (now() - u.last_interaction_at)) >= p_min_days_no_interaction)
    AND (p_min_days_no_order IS NULL OR u.last_order_at IS NULL OR EXTRACT(DAY FROM (now() - u.last_order_at)) >= p_min_days_no_order)
    AND (p_search IS NULL OR p_search = '' OR u.company_name ILIKE '%' || p_search || '%' OR u.cnpj ILIKE '%' || p_search || '%')
  ORDER BY 
    CASE WHEN u.sales_rep_id IS NULL THEN 0 ELSE 1 END,
    COALESCE(EXTRACT(DAY FROM (now() - u.last_interaction_at))::integer, 9999) DESC,
    u.company_name
  LIMIT p_limit OFFSET p_offset;
END;
$function$;

-- Update count function to filter by sales_rep_id
CREATE OR REPLACE FUNCTION public.get_companies_for_reallocation_count(
  p_states text[] DEFAULT NULL,
  p_regions text[] DEFAULT NULL,
  p_owner_id uuid DEFAULT NULL,
  p_min_days_no_interaction integer DEFAULT NULL,
  p_min_days_no_order integer DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_no_owner boolean DEFAULT NULL,
  p_sales_rep_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  result integer;
BEGIN
  SELECT COUNT(*)::integer INTO result
  FROM unified_company_for_reallocation c
  WHERE
    (p_states IS NULL OR c.state = ANY(p_states))
    AND (p_regions IS NULL OR COALESCE(NULLIF(c.regiao, ''), public.get_region_by_state(c.state)) = ANY(p_regions))
    AND (
      CASE
        WHEN p_no_owner = true THEN c.sales_rep_id IS NULL
        WHEN p_sales_rep_id IS NOT NULL THEN c.sales_rep_id = p_sales_rep_id
        WHEN p_owner_id IS NOT NULL THEN c.owner_id = p_owner_id
        ELSE true
      END
    )
    AND (p_min_days_no_interaction IS NULL OR c.last_interaction_at IS NULL OR EXTRACT(DAY FROM (now() - c.last_interaction_at)) >= p_min_days_no_interaction)
    AND (p_min_days_no_order IS NULL OR c.last_order_at IS NULL OR EXTRACT(DAY FROM (now() - c.last_order_at)) >= p_min_days_no_order)
    AND (p_search IS NULL OR p_search = '' OR c.company_name ILIKE '%' || p_search || '%' OR c.cnpj ILIKE '%' || p_search || '%');
  RETURN result;
END;
$function$;
