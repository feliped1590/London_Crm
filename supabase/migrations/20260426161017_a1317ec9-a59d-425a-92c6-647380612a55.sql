CREATE TABLE IF NOT EXISTS public.manager_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  manager_user_id uuid NOT NULL,
  user_id uuid NOT NULL,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  CONSTRAINT manager_users_unique_user_per_tenant UNIQUE (tenant_id, user_id),
  CONSTRAINT manager_users_manager_not_user CHECK (manager_user_id <> user_id)
);

CREATE INDEX IF NOT EXISTS idx_manager_users_manager
ON public.manager_users (tenant_id, manager_user_id);

CREATE INDEX IF NOT EXISTS idx_manager_users_user
ON public.manager_users (tenant_id, user_id);

ALTER TABLE public.manager_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view manager links in their tenants" ON public.manager_users;
DROP POLICY IF EXISTS "Admins and developers can create manager links" ON public.manager_users;
DROP POLICY IF EXISTS "Admins and developers can update manager links" ON public.manager_users;
DROP POLICY IF EXISTS "Admins and developers can delete manager links" ON public.manager_users;

CREATE POLICY "Users can view manager links in their tenants"
ON public.manager_users
FOR SELECT
TO authenticated
USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Admins and developers can create manager links"
ON public.manager_users
FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'desenvolvedor'))
);

CREATE POLICY "Admins and developers can update manager links"
ON public.manager_users
FOR UPDATE
TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'desenvolvedor'))
)
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'desenvolvedor'))
);

CREATE POLICY "Admins and developers can delete manager links"
ON public.manager_users
FOR DELETE
TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'desenvolvedor'))
);

DROP TRIGGER IF EXISTS update_manager_users_updated_at ON public.manager_users;
CREATE TRIGGER update_manager_users_updated_at
BEFORE UPDATE ON public.manager_users
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.get_seller_productivity(
  p_start_date timestamp with time zone,
  p_end_date timestamp with time zone,
  p_seller_id uuid DEFAULT NULL::uuid,
  p_manager_user_id uuid DEFAULT NULL::uuid
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
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'desenvolvedor')) THEN
    RAISE EXCEPTION 'Apenas administradores e desenvolvedores podem acessar este relatório';
  END IF;

  RETURN QUERY
  WITH raw_interactions AS (
    SELECT a.created_by AS uid, a.tenant_id, 'activities' AS itype FROM public.activities a
    WHERE a.created_at >= p_start_date AND a.created_at < p_end_date
      AND (p_seller_id IS NULL OR a.created_by = p_seller_id)
      AND (p_manager_user_id IS NULL OR EXISTS (
        SELECT 1 FROM public.manager_users mu
        WHERE mu.user_id = a.created_by AND mu.manager_user_id = p_manager_user_id AND mu.tenant_id = a.tenant_id
      ))
    UNION ALL
    SELECT t.created_by, t.tenant_id, 'tasks_created' FROM public.tasks t
    WHERE t.created_at >= p_start_date AND t.created_at < p_end_date
      AND (p_seller_id IS NULL OR t.created_by = p_seller_id)
      AND (p_manager_user_id IS NULL OR EXISTS (
        SELECT 1 FROM public.manager_users mu
        WHERE mu.user_id = t.created_by AND mu.manager_user_id = p_manager_user_id AND mu.tenant_id = t.tenant_id
      ))
    UNION ALL
    SELECT t.assigned_to, t.tenant_id, 'tasks_completed' FROM public.tasks t
    WHERE t.completed_at >= p_start_date AND t.completed_at < p_end_date AND t.completed_at IS NOT NULL
      AND (p_seller_id IS NULL OR t.assigned_to = p_seller_id)
      AND (p_manager_user_id IS NULL OR EXISTS (
        SELECT 1 FROM public.manager_users mu
        WHERE mu.user_id = t.assigned_to AND mu.manager_user_id = p_manager_user_id AND mu.tenant_id = t.tenant_id
      ))
    UNION ALL
    SELECT dsh.changed_by, d.tenant_id, 'stage_changes' FROM public.deal_stage_history dsh
    JOIN public.deals d ON d.id = dsh.deal_id
    WHERE dsh.changed_at >= p_start_date AND dsh.changed_at < p_end_date
      AND (p_seller_id IS NULL OR dsh.changed_by = p_seller_id)
      AND (p_manager_user_id IS NULL OR EXISTS (
        SELECT 1 FROM public.manager_users mu
        WHERE mu.user_id = dsh.changed_by AND mu.manager_user_id = p_manager_user_id AND mu.tenant_id = d.tenant_id
      ))
    UNION ALL
    SELECT pr.created_by, pr.tenant_id, 'proposals' FROM public.proposals pr
    WHERE pr.created_at >= p_start_date AND pr.created_at < p_end_date
      AND (p_seller_id IS NULL OR pr.created_by = p_seller_id)
      AND (p_manager_user_id IS NULL OR EXISTS (
        SELECT 1 FROM public.manager_users mu
        WHERE mu.user_id = pr.created_by AND mu.manager_user_id = p_manager_user_id AND mu.tenant_id = pr.tenant_id
      ))
    UNION ALL
    SELECT o.created_by, o.tenant_id, 'orders' FROM public.orders o
    WHERE o.created_at >= p_start_date AND o.created_at < p_end_date
      AND (p_seller_id IS NULL OR o.created_by = p_seller_id)
      AND (p_manager_user_id IS NULL OR EXISTS (
        SELECT 1 FROM public.manager_users mu
        WHERE mu.user_id = o.created_by AND mu.manager_user_id = p_manager_user_id AND mu.tenant_id = o.tenant_id
      ))
    UNION ALL
    SELECT en.created_by, d.tenant_id, 'notes' FROM public.entity_notes en
    JOIN public.deals d ON en.entity_type = 'deal' AND d.id = en.entity_id
    WHERE en.created_at >= p_start_date AND en.created_at < p_end_date
      AND (p_seller_id IS NULL OR en.created_by = p_seller_id)
      AND (p_manager_user_id IS NULL OR EXISTS (
        SELECT 1 FROM public.manager_users mu
        WHERE mu.user_id = en.created_by AND mu.manager_user_id = p_manager_user_id AND mu.tenant_id = d.tenant_id
      ))
    UNION ALL
    SELECT sub.changed_by, sub.tenant_id, 'deal_updates' FROM (
      SELECT DISTINCT dal.changed_by, d.tenant_id, dal.deal_id, dal.changed_at::date
      FROM public.deal_audit_log dal
      JOIN public.deals d ON d.id = dal.deal_id
      WHERE dal.changed_at >= p_start_date AND dal.changed_at < p_end_date
        AND (p_seller_id IS NULL OR dal.changed_by = p_seller_id)
        AND (p_manager_user_id IS NULL OR EXISTS (
          SELECT 1 FROM public.manager_users mu
          WHERE mu.user_id = dal.changed_by AND mu.manager_user_id = p_manager_user_id AND mu.tenant_id = d.tenant_id
        ))
    ) sub
    UNION ALL
    SELECT el.sent_by, el.tenant_id, 'emails' FROM public.email_logs el
    WHERE el.sent_at >= p_start_date AND el.sent_at < p_end_date
      AND (p_seller_id IS NULL OR el.sent_by = p_seller_id)
      AND (p_manager_user_id IS NULL OR EXISTS (
        SELECT 1 FROM public.manager_users mu
        WHERE mu.user_id = el.sent_by AND mu.manager_user_id = p_manager_user_id AND mu.tenant_id = el.tenant_id
      ))
  ),
  counts AS (
    SELECT ri.uid,
      COUNT(*) FILTER (WHERE ri.itype = 'activities') AS c_activities,
      COUNT(*) FILTER (WHERE ri.itype = 'tasks_created') AS c_tasks_created,
      COUNT(*) FILTER (WHERE ri.itype = 'tasks_completed') AS c_tasks_completed,
      COUNT(*) FILTER (WHERE ri.itype = 'stage_changes') AS c_stage_changes,
      COUNT(*) FILTER (WHERE ri.itype = 'proposals') AS c_proposals,
      COUNT(*) FILTER (WHERE ri.itype = 'orders') AS c_orders,
      COUNT(*) FILTER (WHERE ri.itype = 'notes') AS c_notes,
      COUNT(*) FILTER (WHERE ri.itype = 'emails') AS c_emails,
      COUNT(*) FILTER (WHERE ri.itype = 'deal_updates') AS c_deal_updates,
      COUNT(*) AS c_total
    FROM raw_interactions ri
    WHERE ri.uid IS NOT NULL
    GROUP BY ri.uid
  ),
  weights AS (
    SELECT w.type AS wtype, w.weight AS wval FROM public.crm_activity_weights w
  ),
  scored AS (
    SELECT
      c.uid AS seller_id,
      COALESCE(p.full_name, 'Sem nome')::text AS seller_name,
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
    LEFT JOIN public.profiles p ON p.user_id = c.uid
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
$$;