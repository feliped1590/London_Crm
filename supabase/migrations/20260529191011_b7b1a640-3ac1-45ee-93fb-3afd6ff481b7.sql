
CREATE OR REPLACE FUNCTION public.get_sales_rep_productivity(
  p_start_date timestamp with time zone,
  p_end_date timestamp with time zone,
  p_sales_rep_id uuid DEFAULT NULL,
  p_manager_user_id uuid DEFAULT NULL
)
RETURNS TABLE(
  seller_id uuid,
  seller_name text,
  total_interactions bigint,
  interaction_score bigint,
  rank_position bigint,
  participation_percent numeric,
  efficiency_rate numeric,
  proposal_conversion_rate numeric,
  pipeline_conversion_rate numeric,
  activities bigint,
  tasks_created bigint,
  tasks_completed bigint,
  stage_changes bigint,
  proposals bigint,
  orders bigint,
  notes bigint,
  emails bigint,
  deal_updates bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'desenvolvedor')) THEN
    RAISE EXCEPTION 'Apenas administradores e desenvolvedores podem acessar este relatório';
  END IF;

  RETURN QUERY
  WITH user_tenants AS (
    SELECT tenant_id FROM public.get_user_tenant_ids(auth.uid()) AS tenant_id
  ),
  manager_sales_reps AS (
    -- sales reps whose linked user is managed by p_manager_user_id
    SELECT DISTINCT usr.sales_rep_id
    FROM public.user_sales_reps usr
    JOIN public.manager_users mu ON mu.user_id = usr.user_id
    WHERE p_manager_user_id IS NOT NULL
      AND mu.manager_user_id = p_manager_user_id
  ),
  raw_interactions AS (
    -- activities: via company_id -> companies.sales_rep_id, fallback via deal
    SELECT COALESCE(c.sales_rep_id, dc.sales_rep_id) AS srid, a.tenant_id, 'activities' AS itype
    FROM public.activities a
    LEFT JOIN public.companies c ON c.id = a.company_id
    LEFT JOIN public.deals d ON d.id = a.deal_id
    LEFT JOIN public.companies dc ON dc.id = d.company_id
    WHERE a.created_at >= p_start_date AND a.created_at < p_end_date
      AND a.tenant_id IN (SELECT tenant_id FROM user_tenants)

    UNION ALL
    -- tasks created: via company_id
    SELECT c.sales_rep_id, t.tenant_id, 'tasks_created'
    FROM public.tasks t
    LEFT JOIN public.companies c ON c.id = t.company_id
    WHERE t.created_at >= p_start_date AND t.created_at < p_end_date
      AND t.tenant_id IN (SELECT tenant_id FROM user_tenants)

    UNION ALL
    -- tasks completed: via company_id
    SELECT c.sales_rep_id, t.tenant_id, 'tasks_completed'
    FROM public.tasks t
    LEFT JOIN public.companies c ON c.id = t.company_id
    WHERE t.completed_at IS NOT NULL
      AND t.completed_at >= p_start_date AND t.completed_at < p_end_date
      AND t.tenant_id IN (SELECT tenant_id FROM user_tenants)

    UNION ALL
    -- stage changes: via deal -> company -> sales_rep
    SELECT c.sales_rep_id, d.tenant_id, 'stage_changes'
    FROM public.deal_stage_history dsh
    JOIN public.deals d ON d.id = dsh.deal_id
    LEFT JOIN public.companies c ON c.id = d.company_id
    WHERE dsh.changed_at >= p_start_date AND dsh.changed_at < p_end_date
      AND d.tenant_id IN (SELECT tenant_id FROM user_tenants)

    UNION ALL
    -- proposals: via company_id
    SELECT c.sales_rep_id, pr.tenant_id, 'proposals'
    FROM public.proposals pr
    LEFT JOIN public.companies c ON c.id = pr.company_id
    WHERE pr.created_at >= p_start_date AND pr.created_at < p_end_date
      AND pr.tenant_id IN (SELECT tenant_id FROM user_tenants)

    UNION ALL
    -- orders: direct sales_rep_id
    SELECT o.sales_rep_id, o.tenant_id, 'orders'
    FROM public.orders o
    WHERE o.created_at >= p_start_date AND o.created_at < p_end_date
      AND o.tenant_id IN (SELECT tenant_id FROM user_tenants)

    UNION ALL
    -- notes on deals
    SELECT c.sales_rep_id, d.tenant_id, 'notes'
    FROM public.entity_notes en
    JOIN public.deals d ON en.entity_type = 'deal' AND d.id = en.entity_id
    LEFT JOIN public.companies c ON c.id = d.company_id
    WHERE en.created_at >= p_start_date AND en.created_at < p_end_date
      AND d.tenant_id IN (SELECT tenant_id FROM user_tenants)

    UNION ALL
    -- notes on companies
    SELECT c.sales_rep_id, c.tenant_id, 'notes'
    FROM public.entity_notes en
    JOIN public.companies c ON en.entity_type = 'company' AND c.id = en.entity_id
    WHERE en.created_at >= p_start_date AND en.created_at < p_end_date
      AND c.tenant_id IN (SELECT tenant_id FROM user_tenants)

    UNION ALL
    -- deal updates (audit): via deal -> company
    SELECT sub.srid, sub.tenant_id, 'deal_updates' FROM (
      SELECT DISTINCT c.sales_rep_id AS srid, d.tenant_id, dal.deal_id, dal.changed_at::date
      FROM public.deal_audit_log dal
      JOIN public.deals d ON d.id = dal.deal_id
      LEFT JOIN public.companies c ON c.id = d.company_id
      WHERE dal.changed_at >= p_start_date AND dal.changed_at < p_end_date
        AND d.tenant_id IN (SELECT tenant_id FROM user_tenants)
    ) sub

    UNION ALL
    -- emails: via deal_id -> company
    SELECT c.sales_rep_id, el.tenant_id, 'emails'
    FROM public.email_logs el
    LEFT JOIN public.deals d ON d.id = el.deal_id
    LEFT JOIN public.companies c ON c.id = d.company_id
    WHERE el.sent_at >= p_start_date AND el.sent_at < p_end_date
      AND el.tenant_id IN (SELECT tenant_id FROM user_tenants)
  ),
  filtered AS (
    SELECT ri.srid, ri.itype
    FROM raw_interactions ri
    WHERE ri.srid IS NOT NULL
      AND (p_sales_rep_id IS NULL OR ri.srid = p_sales_rep_id)
      AND (p_manager_user_id IS NULL OR ri.srid IN (SELECT sales_rep_id FROM manager_sales_reps))
  ),
  counts AS (
    SELECT f.srid,
      COUNT(*) FILTER (WHERE f.itype = 'activities') AS c_activities,
      COUNT(*) FILTER (WHERE f.itype = 'tasks_created') AS c_tasks_created,
      COUNT(*) FILTER (WHERE f.itype = 'tasks_completed') AS c_tasks_completed,
      COUNT(*) FILTER (WHERE f.itype = 'stage_changes') AS c_stage_changes,
      COUNT(*) FILTER (WHERE f.itype = 'proposals') AS c_proposals,
      COUNT(*) FILTER (WHERE f.itype = 'orders') AS c_orders,
      COUNT(*) FILTER (WHERE f.itype = 'notes') AS c_notes,
      COUNT(*) FILTER (WHERE f.itype = 'emails') AS c_emails,
      COUNT(*) FILTER (WHERE f.itype = 'deal_updates') AS c_deal_updates,
      COUNT(*) AS c_total
    FROM filtered f
    GROUP BY f.srid
  ),
  weights AS (
    SELECT w.type AS wtype, w.weight AS wval FROM public.crm_activity_weights w
  ),
  scored AS (
    SELECT
      c.srid AS seller_id,
      COALESCE(sr.name, 'Sem nome')::text AS seller_name,
      c.c_total AS total_interactions,
      (
        c.c_activities * COALESCE((SELECT wval FROM weights WHERE wtype = 'activities'), 1) +
        c.c_tasks_created * COALESCE((SELECT wval FROM weights WHERE wtype = 'tasks_created'), 1) +
        c.c_tasks_completed * COALESCE((SELECT wval FROM weights WHERE wtype = 'tasks_completed'), 2) +
        c.c_stage_changes * COALESCE((SELECT wval FROM weights WHERE wtype = 'stage_changes'), 3) +
        c.c_proposals * COALESCE((SELECT wval FROM weights WHERE wtype = 'proposals'), 4) +
        c.c_orders * COALESCE((SELECT wval FROM weights WHERE wtype = 'orders'), 6) +
        c.c_notes * COALESCE((SELECT wval FROM weights WHERE wtype = 'notes'), 1) +
        c.c_emails * COALESCE((SELECT wval FROM weights WHERE wtype = 'emails'), 1) +
        c.c_deal_updates * COALESCE((SELECT wval FROM weights WHERE wtype = 'deal_updates'), 1)
      )::bigint AS interaction_score,
      c.c_orders, c.c_activities, c.c_tasks_created, c.c_tasks_completed,
      c.c_stage_changes, c.c_proposals, c.c_notes, c.c_emails, c.c_deal_updates
    FROM counts c
    LEFT JOIN public.sales_reps sr ON sr.id = c.srid
  )
  SELECT
    s.seller_id, s.seller_name, s.total_interactions, s.interaction_score,
    RANK() OVER (ORDER BY s.interaction_score DESC)::bigint AS rank_position,
    CASE WHEN SUM(s.interaction_score) OVER () > 0
      THEN ROUND((s.interaction_score * 100.0) / SUM(s.interaction_score) OVER (), 1) ELSE 0
    END::numeric AS participation_percent,
    CASE WHEN s.total_interactions > 0
      THEN ROUND((s.c_orders * 100.0) / s.total_interactions, 1) ELSE 0
    END::numeric AS efficiency_rate,
    CASE WHEN s.c_proposals > 0
      THEN ROUND((s.c_orders * 100.0) / s.c_proposals, 1) ELSE 0
    END::numeric AS proposal_conversion_rate,
    CASE WHEN s.c_stage_changes > 0
      THEN ROUND((s.c_orders * 100.0) / s.c_stage_changes, 1) ELSE 0
    END::numeric AS pipeline_conversion_rate,
    s.c_activities, s.c_tasks_created, s.c_tasks_completed, s.c_stage_changes,
    s.c_proposals, s.c_orders, s.c_notes, s.c_emails, s.c_deal_updates
  FROM scored s
  ORDER BY s.interaction_score DESC;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_sales_rep_productivity(timestamp with time zone, timestamp with time zone, uuid, uuid) TO authenticated;
