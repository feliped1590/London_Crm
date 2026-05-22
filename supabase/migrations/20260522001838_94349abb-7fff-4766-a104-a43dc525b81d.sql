
CREATE OR REPLACE VIEW public.company_activity_summary AS
SELECT c.id AS company_id,
    c.name AS company_name,
    c.cnpj,
    c.state,
    c.city,
    c.owner_id,
    c.active,
    c.created_at AS company_created_at,
    cc.regiao,
    cc.subregiao,
    GREATEST(
      (SELECT max(a.created_at) FROM activities a WHERE a.company_id = c.id),
      (SELECT max(t.created_at) FROM tasks t WHERE t.company_id = c.id),
      (SELECT max(t.completed_at) FROM tasks t WHERE t.company_id = c.id AND t.status = 'concluida'::task_status),
      (SELECT max(el.sent_at) FROM email_logs el JOIN contacts ct ON el.contact_id = ct.id WHERE ct.company_id = c.id AND el.sent_at IS NOT NULL),
      (SELECT max(wm.created_at) FROM whatsapp_messages wm WHERE wm.company_id = c.id AND wm.direction = 'outbound'::text),
      (SELECT max(GREATEST(d.created_at, d.updated_at)) FROM deals d WHERE d.company_id = c.id),
      (SELECT max(dsh.created_at) FROM deal_stage_history dsh JOIN deals d ON dsh.deal_id = d.id WHERE d.company_id = c.id),
      (SELECT max(GREATEST(o.created_at, o.updated_at)) FROM orders o WHERE o.company_id = c.id),
      (SELECT max(GREATEST(p.created_at, p.updated_at)) FROM proposals p WHERE p.company_id = c.id),
      (SELECT max(en.created_at) FROM entity_notes en WHERE en.entity_type = 'company'::text AND en.entity_id = c.id),
      (SELECT max(en.created_at) FROM entity_notes en JOIN contacts ct ON en.entity_id = ct.id WHERE en.entity_type = 'contact'::text AND ct.company_id = c.id),
      (SELECT max(en.created_at) FROM entity_notes en JOIN deals d ON en.entity_id = d.id WHERE en.entity_type = 'deal'::text AND d.company_id = c.id)
    ) AS last_interaction_at,
    (SELECT max(o.created_at) FROM orders o WHERE o.company_id = c.id) AS last_order_at,
    (SELECT count(*) FROM orders o WHERE o.company_id = c.id) AS total_orders,
    (SELECT COALESCE(sum(o.total_value), 0::numeric) FROM orders o WHERE o.company_id = c.id) AS total_order_value
FROM companies c
LEFT JOIN crm_clients cc ON replace(replace(c.cnpj, '.', ''), '/', '') = replace(replace(cc.cnpj_cpf, '.', ''), '/', '') 
  AND c.cnpj IS NOT NULL AND cc.cnpj_cpf IS NOT NULL;
