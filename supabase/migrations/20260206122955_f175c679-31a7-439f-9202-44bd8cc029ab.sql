-- Criar view unificada com deduplicação por CNPJ (priorizando CRM)
CREATE OR REPLACE VIEW public.unified_company_for_reallocation AS
WITH 
  crm_data AS (
    SELECT 
      c.id AS company_id,
      c.name AS company_name,
      COALESCE(NULLIF(regexp_replace(c.cnpj, '[^0-9]', '', 'g'), ''), NULL) AS cnpj_normalized,
      c.cnpj AS cnpj,
      c.state,
      c.city,
      c.owner_id,
      NULL::text AS regiao,
      NULL::text AS subregiao,
      COALESCE(c.active, true) AS active,
      'crm'::text AS source,
      (SELECT MAX(a.created_at) FROM activities a WHERE a.company_id = c.id) AS last_interaction_at,
      (SELECT MAX(o.created_at) FROM orders o WHERE o.company_id = c.id) AS last_order_at,
      (SELECT COUNT(*) FROM orders o WHERE o.company_id = c.id)::integer AS total_orders,
      (SELECT COALESCE(SUM(o.total_value), 0) FROM orders o WHERE o.company_id = c.id)::numeric AS total_order_value
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
      NULL::timestamptz AS last_interaction_at,
      (SELECT MAX(co.data_emissao::timestamptz) FROM crm_orders co WHERE co.client_id = ec.id AND co.data_emissao IS NOT NULL) AS last_order_at,
      (SELECT COUNT(*) FROM crm_orders co WHERE co.client_id = ec.id)::integer AS total_orders,
      (SELECT COALESCE(SUM(co.valor_total), 0) FROM crm_orders co WHERE co.client_id = ec.id)::numeric AS total_order_value
    FROM crm_clients ec
    WHERE ec.tipo_cliente IS NOT NULL OR ec.razao_social IS NOT NULL
  ),
  unified AS (
    SELECT * FROM crm_data
    UNION ALL
    SELECT * FROM erp_data e
    WHERE NOT EXISTS (
      SELECT 1 FROM crm_data c 
      WHERE c.cnpj_normalized IS NOT NULL 
        AND e.cnpj_normalized IS NOT NULL 
        AND c.cnpj_normalized = e.cnpj_normalized
    )
  )
SELECT * FROM unified;