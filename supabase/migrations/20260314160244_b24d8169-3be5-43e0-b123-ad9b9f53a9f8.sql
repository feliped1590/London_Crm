
-- Table: crm_activity_weights (configurable scoring)
CREATE TABLE public.crm_activity_weights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  weight INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.crm_activity_weights ENABLE ROW LEVEL SECURITY;

-- Only admins can read/write weights
CREATE POLICY "admins_manage_weights" ON public.crm_activity_weights
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed default weights
INSERT INTO public.crm_activity_weights (type, label, weight) VALUES
  ('activities', 'Atividades / Follow-ups', 1),
  ('tasks_created', 'Tarefas Criadas', 1),
  ('tasks_completed', 'Tarefas Concluídas', 2),
  ('stage_changes', 'Mudanças de Etapa', 3),
  ('proposals', 'Propostas Enviadas', 4),
  ('orders', 'Pedidos Lançados', 6),
  ('notes', 'Observações Adicionadas', 1),
  ('emails', 'E-mails Enviados', 1),
  ('deal_updates', 'Atualizações de Negócios', 1);

-- Function: get_seller_productivity
CREATE OR REPLACE FUNCTION public.get_seller_productivity(
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ,
  p_seller_id UUID DEFAULT NULL
)
RETURNS TABLE (
  seller_id UUID,
  seller_name TEXT,
  total_interactions BIGINT,
  interaction_score BIGINT,
  activities BIGINT,
  tasks_created BIGINT,
  tasks_completed BIGINT,
  stage_changes BIGINT,
  proposals BIGINT,
  orders BIGINT,
  notes BIGINT,
  emails BIGINT,
  deal_updates BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Admin check
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem acessar este relatório';
  END IF;

  RETURN QUERY
  WITH raw_interactions AS (
    -- Activities
    SELECT a.created_by AS uid, 'activities' AS itype
    FROM public.activities a
    WHERE a.created_at >= p_start_date AND a.created_at < p_end_date
      AND (p_seller_id IS NULL OR a.created_by = p_seller_id)

    UNION ALL

    -- Tasks created
    SELECT t.created_by, 'tasks_created'
    FROM public.tasks t
    WHERE t.created_at >= p_start_date AND t.created_at < p_end_date
      AND (p_seller_id IS NULL OR t.created_by = p_seller_id)

    UNION ALL

    -- Tasks completed
    SELECT t.assigned_to, 'tasks_completed'
    FROM public.tasks t
    WHERE t.completed_at >= p_start_date AND t.completed_at < p_end_date
      AND t.completed_at IS NOT NULL
      AND (p_seller_id IS NULL OR t.assigned_to = p_seller_id)

    UNION ALL

    -- Stage changes
    SELECT dsh.changed_by, 'stage_changes'
    FROM public.deal_stage_history dsh
    WHERE dsh.changed_at >= p_start_date AND dsh.changed_at < p_end_date
      AND (p_seller_id IS NULL OR dsh.changed_by = p_seller_id)

    UNION ALL

    -- Proposals
    SELECT pr.created_by, 'proposals'
    FROM public.proposals pr
    WHERE pr.created_at >= p_start_date AND pr.created_at < p_end_date
      AND (p_seller_id IS NULL OR pr.created_by = p_seller_id)

    UNION ALL

    -- Orders
    SELECT o.created_by, 'orders'
    FROM public.orders o
    WHERE o.created_at >= p_start_date AND o.created_at < p_end_date
      AND (p_seller_id IS NULL OR o.created_by = p_seller_id)

    UNION ALL

    -- Entity notes
    SELECT en.created_by, 'notes'
    FROM public.entity_notes en
    WHERE en.created_at >= p_start_date AND en.created_at < p_end_date
      AND (p_seller_id IS NULL OR en.created_by = p_seller_id)

    UNION ALL

    -- Deal audit log (deduplicated: max 1 per deal per day per user)
    SELECT sub.changed_by, 'deal_updates'
    FROM (
      SELECT DISTINCT dal.changed_by, dal.deal_id, dal.changed_at::DATE
      FROM public.deal_audit_log dal
      WHERE dal.changed_at >= p_start_date AND dal.changed_at < p_end_date
        AND (p_seller_id IS NULL OR dal.changed_by = p_seller_id)
    ) sub

    UNION ALL

    -- Email logs
    SELECT el.sent_by, 'emails'
    FROM public.email_logs el
    WHERE el.sent_at >= p_start_date AND el.sent_at < p_end_date
      AND (p_seller_id IS NULL OR el.sent_by = p_seller_id)
  ),
  counts AS (
    SELECT
      ri.uid,
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
    SELECT w.type AS wtype, w.weight AS wval
    FROM public.crm_activity_weights w
  )
  SELECT
    c.uid,
    COALESCE(p.full_name, 'Sem nome')::TEXT,
    c.c_total,
    (
      c.c_activities   * COALESCE((SELECT wval FROM weights WHERE wtype = 'activities'), 1) +
      c.c_tasks_created * COALESCE((SELECT wval FROM weights WHERE wtype = 'tasks_created'), 1) +
      c.c_tasks_completed * COALESCE((SELECT wval FROM weights WHERE wtype = 'tasks_completed'), 2) +
      c.c_stage_changes * COALESCE((SELECT wval FROM weights WHERE wtype = 'stage_changes'), 3) +
      c.c_proposals    * COALESCE((SELECT wval FROM weights WHERE wtype = 'proposals'), 4) +
      c.c_orders       * COALESCE((SELECT wval FROM weights WHERE wtype = 'orders'), 6) +
      c.c_notes        * COALESCE((SELECT wval FROM weights WHERE wtype = 'notes'), 1) +
      c.c_emails       * COALESCE((SELECT wval FROM weights WHERE wtype = 'emails'), 1) +
      c.c_deal_updates * COALESCE((SELECT wval FROM weights WHERE wtype = 'deal_updates'), 1)
    )::BIGINT,
    c.c_activities,
    c.c_tasks_created,
    c.c_tasks_completed,
    c.c_stage_changes,
    c.c_proposals,
    c.c_orders,
    c.c_notes,
    c.c_emails,
    c.c_deal_updates
  FROM counts c
  LEFT JOIN public.profiles p ON p.user_id = c.uid
  ORDER BY 4 DESC; -- order by interaction_score
END;
$$;
