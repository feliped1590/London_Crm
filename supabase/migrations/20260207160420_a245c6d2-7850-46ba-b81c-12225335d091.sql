-- Corrigir views com SECURITY DEFINER para usar SECURITY INVOKER

-- 1. Recriar profiles_safe com security_invoker
DROP VIEW IF EXISTS public.profiles_safe;
CREATE VIEW public.profiles_safe 
WITH (security_invoker = true) AS
SELECT 
  id,
  user_id,
  full_name,
  avatar_url,
  CASE 
    WHEN public.has_role(auth.uid(), 'admin') THEN phone
    WHEN auth.uid() = user_id THEN phone
    ELSE NULL
  END as phone,
  created_at,
  updated_at
FROM public.profiles;

GRANT SELECT ON public.profiles_safe TO authenticated;

-- 2. Recriar company_activity_summary com security_invoker
DROP VIEW IF EXISTS public.company_activity_summary;
CREATE VIEW public.company_activity_summary
WITH (security_invoker = true) AS
SELECT 
  c.id AS company_id,
  c.name AS company_name,
  c.cnpj,
  c.state,
  c.city,
  c.owner_id,
  c.active,
  c.created_at AS company_created_at,
  cc.regiao,
  cc.subregiao,
  COALESCE(
    GREATEST(
      (SELECT MAX(a.created_at) FROM activities a WHERE a.company_id = c.id),
      (SELECT MAX(t.completed_at) FROM tasks t WHERE t.company_id = c.id AND t.status = 'concluida'),
      (SELECT MAX(el.sent_at) FROM email_logs el JOIN contacts ct ON el.contact_id = ct.id WHERE ct.company_id = c.id AND el.sent_at IS NOT NULL),
      (SELECT MAX(wm.created_at) FROM whatsapp_messages wm WHERE wm.company_id = c.id AND wm.direction = 'outbound')
    ),
    c.created_at
  ) AS last_interaction_at,
  (SELECT MAX(o.created_at) FROM orders o WHERE o.company_id = c.id) AS last_order_at,
  (SELECT COUNT(*) FROM orders o WHERE o.company_id = c.id) AS total_orders,
  (SELECT COALESCE(SUM(o.total_value), 0) FROM orders o WHERE o.company_id = c.id) AS total_order_value
FROM companies c
LEFT JOIN crm_clients cc ON (
  REPLACE(REPLACE(c.cnpj, '.', ''), '/', '') = REPLACE(REPLACE(cc.cnpj_cpf, '.', ''), '/', '')
  AND c.cnpj IS NOT NULL 
  AND cc.cnpj_cpf IS NOT NULL
);

GRANT SELECT ON public.company_activity_summary TO authenticated;

-- 3. Recriar unified_company_for_reallocation com security_invoker
DROP VIEW IF EXISTS public.unified_company_for_reallocation;
CREATE VIEW public.unified_company_for_reallocation
WITH (security_invoker = true) AS
WITH crm_data AS (
  SELECT 
    c.id AS company_id,
    c.name AS company_name,
    COALESCE(NULLIF(regexp_replace(c.cnpj, '[^0-9]', '', 'g'), ''), NULL) AS cnpj_normalized,
    c.cnpj,
    c.state,
    c.city,
    c.owner_id,
    NULL::text AS regiao,
    NULL::text AS subregiao,
    COALESCE(c.active, true) AS active,
    'crm'::text AS source,
    (SELECT MAX(a.created_at) FROM activities a WHERE a.company_id = c.id) AS last_interaction_at,
    (SELECT MAX(o.created_at) FROM orders o WHERE o.company_id = c.id) AS last_order_at,
    (SELECT COUNT(*)::integer FROM orders o WHERE o.company_id = c.id) AS total_orders,
    (SELECT COALESCE(SUM(o.total_value), 0) FROM orders o WHERE o.company_id = c.id) AS total_order_value
  FROM companies c
  WHERE COALESCE(c.active, true) = true
),
erp_data AS (
  SELECT 
    ec.id AS company_id,
    COALESCE(ec.razao_social, ec.nome_fantasia, 'Cliente ERP') AS company_name,
    COALESCE(NULLIF(regexp_replace(ec.cnpj_cpf, '[^0-9]', '', 'g'), ''), NULL) AS cnpj_normalized,
    ec.cnpj_cpf AS cnpj,
    (SELECT ea.uf FROM crm_client_addresses ea WHERE ea.client_id = ec.id LIMIT 1) AS state,
    (SELECT ea.cidade FROM crm_client_addresses ea WHERE ea.client_id = ec.id LIMIT 1) AS city,
    ec.owner_id,
    ec.regiao,
    ec.subregiao,
    true AS active,
    'erp'::text AS source,
    NULL::timestamp with time zone AS last_interaction_at,
    (SELECT MAX(co.data_emissao::timestamp with time zone) FROM crm_orders co WHERE co.client_id = ec.id AND co.data_emissao IS NOT NULL) AS last_order_at,
    (SELECT COUNT(*)::integer FROM crm_orders co WHERE co.client_id = ec.id) AS total_orders,
    (SELECT COALESCE(SUM(co.valor_total), 0) FROM crm_orders co WHERE co.client_id = ec.id) AS total_order_value
  FROM crm_clients ec
  WHERE NOT EXISTS (
    SELECT 1 FROM companies c 
    WHERE COALESCE(NULLIF(regexp_replace(c.cnpj, '[^0-9]', '', 'g'), ''), 'X') = 
          COALESCE(NULLIF(regexp_replace(ec.cnpj_cpf, '[^0-9]', '', 'g'), ''), 'Y')
  )
)
SELECT company_id, company_name, cnpj, state, city, owner_id, regiao, subregiao, 
       last_interaction_at, last_order_at, total_orders, total_order_value, source
FROM crm_data
UNION ALL
SELECT company_id, company_name, cnpj, state, city, owner_id, regiao, subregiao,
       last_interaction_at, last_order_at, total_orders, total_order_value, source
FROM erp_data;

GRANT SELECT ON public.unified_company_for_reallocation TO authenticated;