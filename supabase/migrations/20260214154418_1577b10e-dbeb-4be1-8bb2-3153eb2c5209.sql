
CREATE OR REPLACE VIEW unified_company_for_reallocation AS
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
        COALESCE(
          GREATEST(
            (SELECT max(a.created_at) FROM activities a WHERE a.company_id = c.id),
            (SELECT max(t.completed_at) FROM tasks t WHERE t.company_id = c.id AND t.status = 'concluida'),
            (SELECT max(el.sent_at) FROM email_logs el JOIN contacts ct ON el.contact_id = ct.id WHERE ct.company_id = c.id AND el.sent_at IS NOT NULL),
            (SELECT max(wm.created_at) FROM whatsapp_messages wm WHERE wm.company_id = c.id AND wm.direction = 'outbound')
          ),
          c.created_at
        ) AS last_interaction_at,
        (SELECT max(o.created_at) FROM orders o WHERE o.company_id = c.id) AS last_order_at,
        (SELECT count(*)::integer FROM orders o WHERE o.company_id = c.id) AS total_orders,
        (SELECT COALESCE(sum(o.total_value), 0::numeric) FROM orders o WHERE o.company_id = c.id) AS total_order_value
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
        (SELECT max(co.data_emissao::timestamp with time zone) FROM crm_orders co WHERE co.client_id = ec.id AND co.data_emissao IS NOT NULL) AS last_order_at,
        (SELECT count(*)::integer FROM crm_orders co WHERE co.client_id = ec.id) AS total_orders,
        (SELECT COALESCE(sum(co.valor_total), 0::numeric) FROM crm_orders co WHERE co.client_id = ec.id) AS total_order_value
    FROM crm_clients ec
    WHERE NOT EXISTS (
        SELECT 1 FROM companies c
        WHERE COALESCE(NULLIF(regexp_replace(c.cnpj, '[^0-9]', '', 'g'), ''), 'X') = COALESCE(NULLIF(regexp_replace(ec.cnpj_cpf, '[^0-9]', '', 'g'), ''), 'Y')
    )
)
SELECT company_id, company_name, cnpj, state, city, owner_id, regiao, subregiao, last_interaction_at, last_order_at, total_orders, total_order_value, source FROM crm_data
UNION ALL
SELECT company_id, company_name, cnpj, state, city, owner_id, regiao, subregiao, last_interaction_at, last_order_at, total_orders, total_order_value, source FROM erp_data;
