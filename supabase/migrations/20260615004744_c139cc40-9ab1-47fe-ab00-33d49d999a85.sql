
-- =========================================================================
-- FASE 2B — Padronização de segurança e filtro LE nas RPCs auxiliares de BI
-- =========================================================================

-- 1) get_pipeline_health
DROP FUNCTION IF EXISTS public.get_pipeline_health(uuid, date, date);
CREATE OR REPLACE FUNCTION public.get_pipeline_health(
  p_pipeline_id uuid DEFAULT NULL,
  p_start_date date DEFAULT (CURRENT_DATE - INTERVAL '30 days')::date,
  p_end_date date DEFAULT CURRENT_DATE,
  p_legal_entity_id uuid DEFAULT NULL
)
RETURNS TABLE(stage text, stage_order integer, total_deals bigint, total_value numeric,
              avg_days_in_stage numeric, sla_hours integer, deals_over_sla bigint,
              sla_violation_rate numeric, advancement_rate numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_admin boolean := public.bi_is_admin_or_dev();
  v_my_rep uuid := public.bi_my_sales_rep_id();
  v_tenants uuid[] := public.get_user_tenant_ids(auth.uid());
BEGIN
  IF p_legal_entity_id IS NOT NULL AND NOT v_admin AND NOT public.user_has_legal_entity_access(p_legal_entity_id) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH scoped_deals AS (
    SELECT d.*,
           COALESCE(NULLIF(ps.name, ''), d.stage)::TEXT AS stage_label,
           COALESCE(ps.sort_order, 99)::INT AS stage_sort_order,
           ps.sla_hours AS stage_sla_hours
    FROM public.deals d
    LEFT JOIN public.pipelines p ON p.id = d.pipeline_id
    LEFT JOIN public.companies c ON c.id = d.company_id
    LEFT JOIN LATERAL (
      SELECT s.name, s.sort_order, s.sla_hours FROM public.pipeline_stages s
      WHERE (s.id = d.pipeline_stage_id) OR (s.pipeline_id = d.pipeline_id AND s.stage = d.stage)
      ORDER BY CASE WHEN s.id = d.pipeline_stage_id THEN 0 ELSE 1 END, s.sort_order NULLS LAST LIMIT 1
    ) ps ON TRUE
    WHERE d.created_at >= p_start_date
      AND d.created_at < p_end_date + INTERVAL '1 day'
      AND d.tenant_id = ANY(v_tenants)
      AND (p_pipeline_id IS NULL OR d.pipeline_id = p_pipeline_id)
      AND (p_pipeline_id IS NOT NULL OR COALESCE(p.type, 'sales') = 'sales')
      AND (p_legal_entity_id IS NULL OR d.legal_entity_id = p_legal_entity_id)
      AND (v_admin OR public.bi_can_see_rep(COALESCE(c.sales_rep_id, d.owner_id)))
  ),
  stage_metrics AS (
    SELECT sd.stage::TEXT AS stage_key, sd.stage_label, sd.stage_sort_order, sd.stage_sla_hours,
      COUNT(sd.id)::BIGINT AS deal_count,
      COALESCE(SUM(sd.value), 0)::NUMERIC AS total_val,
      AVG(CASE WHEN sd.stage NOT IN ('fechado_ganho','fechado_perdido') THEN
        EXTRACT(EPOCH FROM (NOW() - COALESCE(
          (SELECT MAX(h.changed_at) FROM public.deal_stage_history h WHERE h.deal_id = sd.id AND h.to_stage = sd.stage),
          sd.created_at))) / 86400 END) AS avg_days,
      COUNT(CASE WHEN sd.stage_sla_hours IS NOT NULL AND sd.stage NOT IN ('fechado_ganho','fechado_perdido')
        AND EXTRACT(EPOCH FROM (NOW() - COALESCE(
          (SELECT MAX(h.changed_at) FROM public.deal_stage_history h WHERE h.deal_id = sd.id AND h.to_stage = sd.stage),
          sd.created_at))) / 3600 > sd.stage_sla_hours THEN 1 END)::BIGINT AS over_sla
    FROM scoped_deals sd
    GROUP BY sd.stage, sd.stage_label, sd.stage_sort_order, sd.stage_sla_hours
  ),
  stage_transitions AS (
    SELECT h.from_stage::TEXT AS stage_key,
      COUNT(*)::BIGINT AS total_transitions,
      COUNT(CASE WHEN h.to_stage <> 'fechado_perdido' THEN 1 END)::BIGINT AS advanced
    FROM public.deal_stage_history h
    JOIN public.deals d ON d.id = h.deal_id
    LEFT JOIN public.pipelines p ON p.id = d.pipeline_id
    LEFT JOIN public.companies c ON c.id = d.company_id
    WHERE h.changed_at >= p_start_date AND h.changed_at < p_end_date + INTERVAL '1 day'
      AND h.from_stage IS NOT NULL
      AND d.tenant_id = ANY(v_tenants)
      AND (p_pipeline_id IS NULL OR d.pipeline_id = p_pipeline_id)
      AND (p_pipeline_id IS NOT NULL OR COALESCE(p.type, 'sales') = 'sales')
      AND (p_legal_entity_id IS NULL OR d.legal_entity_id = p_legal_entity_id)
      AND (v_admin OR public.bi_can_see_rep(COALESCE(c.sales_rep_id, d.owner_id)))
    GROUP BY h.from_stage
  )
  SELECT sm.stage_label, sm.stage_sort_order, sm.deal_count, sm.total_val,
    ROUND(COALESCE(sm.avg_days,0)::NUMERIC,1), sm.stage_sla_hours, sm.over_sla,
    CASE WHEN sm.deal_count > 0 THEN ROUND((sm.over_sla::NUMERIC/sm.deal_count)*100,1) ELSE 0 END,
    CASE WHEN COALESCE(st.total_transitions,0) > 0 THEN ROUND((st.advanced::NUMERIC/st.total_transitions)*100,1) ELSE 0 END
  FROM stage_metrics sm LEFT JOIN stage_transitions st ON st.stage_key = sm.stage_key
  ORDER BY sm.stage_sort_order NULLS LAST, sm.stage_label;
END;
$$;

-- 2) get_seller_performance
DROP FUNCTION IF EXISTS public.get_seller_performance(date, date, boolean);
CREATE OR REPLACE FUNCTION public.get_seller_performance(
  p_start_date date DEFAULT (CURRENT_DATE - INTERVAL '30 days')::date,
  p_end_date date DEFAULT CURRENT_DATE,
  p_compare_previous boolean DEFAULT true,
  p_legal_entity_id uuid DEFAULT NULL
)
RETURNS TABLE(seller_id uuid, seller_name text, deals_created bigint, deals_won bigint,
              deals_lost bigint, total_value_won numeric, conversion_rate numeric,
              avg_cycle_days numeric, deals_stalled bigint, prev_deals_created bigint,
              prev_deals_won bigint, prev_conversion_rate numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_admin boolean := public.bi_is_admin_or_dev();
  v_tenants uuid[] := public.get_user_tenant_ids(auth.uid());
BEGIN
  IF p_legal_entity_id IS NOT NULL AND NOT v_admin AND NOT public.user_has_legal_entity_access(p_legal_entity_id) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH period_days AS (SELECT (p_end_date - p_start_date + 1) AS days),
  current_period AS (
    SELECT COALESCE(c.sales_rep_id, d.owner_id) AS responsible_id,
           COALESCE(sr.name, p.full_name, 'Sem vendedor')::TEXT AS responsible_name,
           COUNT(d.id)::BIGINT AS created,
           COUNT(CASE WHEN d.stage='fechado_ganho' THEN 1 END)::BIGINT AS won,
           COUNT(CASE WHEN d.stage='fechado_perdido' THEN 1 END)::BIGINT AS lost,
           COALESCE(SUM(CASE WHEN d.stage='fechado_ganho' THEN d.value END),0)::NUMERIC AS value_won,
           AVG(CASE WHEN d.closed_at IS NOT NULL THEN EXTRACT(EPOCH FROM (d.closed_at-d.created_at))/86400 END) AS avg_cycle,
           COUNT(CASE WHEN d.stage NOT IN ('fechado_ganho','fechado_perdido')
             AND EXTRACT(EPOCH FROM (NOW()-d.updated_at))/86400 > 7 THEN 1 END)::BIGINT AS stalled
    FROM public.deals d
    LEFT JOIN public.companies c ON c.id = d.company_id
    LEFT JOIN public.sales_reps sr ON sr.id = c.sales_rep_id
    LEFT JOIN public.profiles p ON p.user_id = d.owner_id
    LEFT JOIN public.pipelines pl ON pl.id = d.pipeline_id
    WHERE d.created_at >= p_start_date AND d.created_at < p_end_date + INTERVAL '1 day'
      AND d.tenant_id = ANY(v_tenants)
      AND COALESCE(pl.type,'sales')='sales'
      AND COALESCE(c.sales_rep_id, d.owner_id) IS NOT NULL
      AND (p_legal_entity_id IS NULL OR d.legal_entity_id = p_legal_entity_id)
      AND (v_admin OR public.bi_can_see_rep(COALESCE(c.sales_rep_id, d.owner_id)))
    GROUP BY COALESCE(c.sales_rep_id, d.owner_id), COALESCE(sr.name, p.full_name, 'Sem vendedor')
  ),
  previous_period AS (
    SELECT COALESCE(c.sales_rep_id, d.owner_id) AS responsible_id,
           COUNT(d.id)::BIGINT AS created,
           COUNT(CASE WHEN d.stage='fechado_ganho' THEN 1 END)::BIGINT AS won
    FROM public.deals d
    LEFT JOIN public.companies c ON c.id = d.company_id
    LEFT JOIN public.pipelines pl ON pl.id = d.pipeline_id
    WHERE d.created_at >= p_start_date - (SELECT days FROM period_days)*INTERVAL '1 day'
      AND d.created_at < p_start_date
      AND d.tenant_id = ANY(v_tenants)
      AND COALESCE(pl.type,'sales')='sales'
      AND COALESCE(c.sales_rep_id, d.owner_id) IS NOT NULL
      AND (p_legal_entity_id IS NULL OR d.legal_entity_id = p_legal_entity_id)
      AND (v_admin OR public.bi_can_see_rep(COALESCE(c.sales_rep_id, d.owner_id)))
    GROUP BY COALESCE(c.sales_rep_id, d.owner_id)
  )
  SELECT cp.responsible_id, cp.responsible_name, cp.created, cp.won, cp.lost, cp.value_won,
    CASE WHEN cp.created>0 THEN ROUND((cp.won::NUMERIC/cp.created)*100,1) ELSE 0 END,
    ROUND(COALESCE(cp.avg_cycle,0)::NUMERIC,1), cp.stalled,
    COALESCE(pp.created,0), COALESCE(pp.won,0),
    CASE WHEN COALESCE(pp.created,0)>0 THEN ROUND((pp.won::NUMERIC/pp.created)*100,1) ELSE 0 END
  FROM current_period cp LEFT JOIN previous_period pp ON pp.responsible_id = cp.responsible_id
  ORDER BY cp.value_won DESC, cp.created DESC;
END;
$$;

-- 3) get_stalled_deals_by_seller
DROP FUNCTION IF EXISTS public.get_stalled_deals_by_seller(uuid, integer);
CREATE OR REPLACE FUNCTION public.get_stalled_deals_by_seller(
  p_seller_id uuid DEFAULT NULL,
  p_min_days integer DEFAULT 7,
  p_legal_entity_id uuid DEFAULT NULL
)
RETURNS TABLE(deal_id uuid, deal_name text, company_name text, stage text, value numeric,
              days_stalled integer, owner_id uuid, owner_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_admin boolean := public.bi_is_admin_or_dev();
  v_tenants uuid[] := public.get_user_tenant_ids(auth.uid());
BEGIN
  IF p_legal_entity_id IS NOT NULL AND NOT v_admin AND NOT public.user_has_legal_entity_access(p_legal_entity_id) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT d.id, d.name, c.name,
         COALESCE(NULLIF(ps.name,''), d.stage)::TEXT, d.value,
         (EXTRACT(EPOCH FROM (NOW()-d.updated_at))/86400)::INT,
         COALESCE(c.sales_rep_id, d.owner_id),
         COALESCE(sr.name, p.full_name, 'Sem vendedor')::TEXT
  FROM public.deals d
  LEFT JOIN public.companies c ON c.id = d.company_id
  LEFT JOIN public.sales_reps sr ON sr.id = c.sales_rep_id
  LEFT JOIN public.profiles p ON p.user_id = d.owner_id
  LEFT JOIN public.pipelines pl ON pl.id = d.pipeline_id
  LEFT JOIN LATERAL (
    SELECT s.name FROM public.pipeline_stages s
    WHERE (s.id = d.pipeline_stage_id) OR (s.pipeline_id = d.pipeline_id AND s.stage = d.stage)
    ORDER BY CASE WHEN s.id = d.pipeline_stage_id THEN 0 ELSE 1 END, s.sort_order NULLS LAST LIMIT 1
  ) ps ON TRUE
  WHERE d.tenant_id = ANY(v_tenants)
    AND d.stage NOT IN ('fechado_ganho','fechado_perdido')
    AND COALESCE(pl.type,'sales')='sales'
    AND EXTRACT(EPOCH FROM (NOW()-d.updated_at))/86400 >= p_min_days
    AND (p_seller_id IS NULL OR COALESCE(c.sales_rep_id, d.owner_id) = p_seller_id)
    AND (p_legal_entity_id IS NULL OR d.legal_entity_id = p_legal_entity_id)
    AND (v_admin OR public.bi_can_see_rep(COALESCE(c.sales_rep_id, d.owner_id)))
  ORDER BY EXTRACT(EPOCH FROM (NOW()-d.updated_at)) DESC;
END;
$$;

-- 4) get_conversion_by_stage
DROP FUNCTION IF EXISTS public.get_conversion_by_stage(date, date);
CREATE OR REPLACE FUNCTION public.get_conversion_by_stage(
  p_start_date date DEFAULT (CURRENT_DATE - INTERVAL '30 days')::date,
  p_end_date date DEFAULT CURRENT_DATE,
  p_legal_entity_id uuid DEFAULT NULL,
  p_pipeline_id uuid DEFAULT NULL,
  p_seller_id uuid DEFAULT NULL
)
RETURNS TABLE(stage text, stage_order integer, entered_count bigint, exited_count bigint, conversion_rate numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_admin boolean := public.bi_is_admin_or_dev();
  v_tenants uuid[] := public.get_user_tenant_ids(auth.uid());
BEGIN
  IF p_legal_entity_id IS NOT NULL AND NOT v_admin AND NOT public.user_has_legal_entity_access(p_legal_entity_id) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH stage_entries AS (
    SELECT h.to_stage::TEXT AS stage_key,
           COALESCE(NULLIF(ps.name,''), h.to_stage)::TEXT AS stage_label,
           COALESCE(ps.sort_order, 99)::INT AS sort_order,
           COUNT(*)::BIGINT AS entries
    FROM public.deal_stage_history h
    JOIN public.deals d ON d.id = h.deal_id
    LEFT JOIN public.companies c ON c.id = d.company_id
    LEFT JOIN public.pipelines p ON p.id = d.pipeline_id
    LEFT JOIN LATERAL (
      SELECT s.name, s.sort_order FROM public.pipeline_stages s
      WHERE (s.pipeline_id = d.pipeline_id AND s.stage = h.to_stage)
      ORDER BY s.sort_order NULLS LAST LIMIT 1) ps ON TRUE
    WHERE h.changed_at >= p_start_date AND h.changed_at < p_end_date + INTERVAL '1 day'
      AND d.tenant_id = ANY(v_tenants)
      AND COALESCE(p.type,'sales')='sales'
      AND (p_legal_entity_id IS NULL OR d.legal_entity_id = p_legal_entity_id)
      AND (p_pipeline_id IS NULL OR d.pipeline_id = p_pipeline_id)
      AND (p_seller_id IS NULL OR COALESCE(c.sales_rep_id, d.owner_id) = p_seller_id)
      AND (v_admin OR public.bi_can_see_rep(COALESCE(c.sales_rep_id, d.owner_id)))
    GROUP BY h.to_stage, COALESCE(NULLIF(ps.name,''), h.to_stage), COALESCE(ps.sort_order,99)
  ),
  stage_exits AS (
    SELECT h.from_stage::TEXT AS stage_key,
           COALESCE(NULLIF(ps.name,''), h.from_stage)::TEXT AS stage_label,
           COALESCE(ps.sort_order, 99)::INT AS sort_order,
           COUNT(*)::BIGINT AS exits
    FROM public.deal_stage_history h
    JOIN public.deals d ON d.id = h.deal_id
    LEFT JOIN public.companies c ON c.id = d.company_id
    LEFT JOIN public.pipelines p ON p.id = d.pipeline_id
    LEFT JOIN LATERAL (
      SELECT s.name, s.sort_order FROM public.pipeline_stages s
      WHERE (s.pipeline_id = d.pipeline_id AND s.stage = h.from_stage)
      ORDER BY s.sort_order NULLS LAST LIMIT 1) ps ON TRUE
    WHERE h.changed_at >= p_start_date AND h.changed_at < p_end_date + INTERVAL '1 day'
      AND h.from_stage IS NOT NULL
      AND d.tenant_id = ANY(v_tenants)
      AND COALESCE(p.type,'sales')='sales'
      AND (p_legal_entity_id IS NULL OR d.legal_entity_id = p_legal_entity_id)
      AND (p_pipeline_id IS NULL OR d.pipeline_id = p_pipeline_id)
      AND (p_seller_id IS NULL OR COALESCE(c.sales_rep_id, d.owner_id) = p_seller_id)
      AND (v_admin OR public.bi_can_see_rep(COALESCE(c.sales_rep_id, d.owner_id)))
    GROUP BY h.from_stage, COALESCE(NULLIF(ps.name,''), h.from_stage), COALESCE(ps.sort_order,99)
  )
  SELECT COALESCE(se.stage_label, sx.stage_label),
         COALESCE(se.sort_order, sx.sort_order),
         COALESCE(se.entries,0), COALESCE(sx.exits,0),
         CASE WHEN COALESCE(se.entries,0)>0 THEN ROUND((COALESCE(sx.exits,0)::NUMERIC/se.entries)*100,1) ELSE 0 END
  FROM stage_entries se
  FULL OUTER JOIN stage_exits sx ON se.stage_key = sx.stage_key
  ORDER BY COALESCE(se.sort_order, sx.sort_order) NULLS LAST, COALESCE(se.stage_label, sx.stage_label);
END;
$$;

-- 5) get_bi_anomalies
DROP FUNCTION IF EXISTS public.get_bi_anomalies();
CREATE OR REPLACE FUNCTION public.get_bi_anomalies(p_legal_entity_id uuid DEFAULT NULL)
RETURNS TABLE(anomaly_type text, severity text, title text, description text,
              affected_count bigint, affected_value numeric, action_label text, filter_params jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_admin boolean := public.bi_is_admin_or_dev();
  v_tenants uuid[] := public.get_user_tenant_ids(auth.uid());
BEGIN
  IF p_legal_entity_id IS NOT NULL AND NOT v_admin AND NOT public.user_has_legal_entity_access(p_legal_entity_id) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH anomalies AS (
    SELECT 'critical_stalled'::TEXT AS anomaly_type,
      CASE WHEN COUNT(*) >= 5 THEN 'critical' ELSE 'warning' END::TEXT AS severity,
      'Negócios de alto valor parados'::TEXT AS title,
      (COUNT(*)||' negócios acima de R$50k parados há mais de 14 dias')::TEXT AS description,
      COUNT(*)::BIGINT AS affected_count,
      COALESCE(SUM(d.value),0)::NUMERIC AS affected_value,
      'Ver negócios parados'::TEXT AS action_label,
      '{"minValue":50000,"stalledDays":14}'::JSONB AS filter_params
    FROM public.deals d
    LEFT JOIN public.pipelines p ON p.id = d.pipeline_id
    LEFT JOIN public.companies c ON c.id = d.company_id
    WHERE d.tenant_id = ANY(v_tenants)
      AND lower(translate(COALESCE(d.stage,''), 'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç','AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'))
          NOT IN ('fechado_ganho','fechado ganho','ganho','fechado_perdido','fechado perdido','perdido')
      AND COALESCE(p.type,'sales')='sales'
      AND COALESCE(d.value,0) >= 50000
      AND EXTRACT(EPOCH FROM (NOW()-d.updated_at))/86400 > 14
      AND (p_legal_entity_id IS NULL OR d.legal_entity_id = p_legal_entity_id)
      AND (v_admin OR public.bi_can_see_rep(COALESCE(c.sales_rep_id, d.owner_id)))
    HAVING COUNT(*) > 0
  )
  SELECT a.anomaly_type, a.severity, a.title, a.description, a.affected_count, a.affected_value, a.action_label, a.filter_params
  FROM anomalies a
  ORDER BY CASE a.severity WHEN 'critical' THEN 1 ELSE 2 END, a.affected_count DESC;
END;
$$;

-- 6) Nova RPC: report_atividades_vendedor (Relatório 360°)
CREATE OR REPLACE FUNCTION public.report_atividades_vendedor(
  p_sales_rep_id uuid,
  p_start_date date DEFAULT (CURRENT_DATE - INTERVAL '30 days')::date,
  p_end_date date DEFAULT CURRENT_DATE,
  p_legal_entity_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_admin boolean := public.bi_is_admin_or_dev();
  v_tenants uuid[] := public.get_user_tenant_ids(auth.uid());
  v_user_ids uuid[];
  v_result jsonb;
BEGIN
  IF p_sales_rep_id IS NULL OR NOT public.bi_can_see_rep(p_sales_rep_id) THEN
    RETURN '{"kpis":{},"empty":true,"reason":"acesso_negado"}'::jsonb;
  END IF;
  IF p_legal_entity_id IS NOT NULL AND NOT v_admin AND NOT public.user_has_legal_entity_access(p_legal_entity_id) THEN
    RETURN '{"kpis":{},"empty":true,"reason":"sem_acesso_entidade"}'::jsonb;
  END IF;

  -- Usuários vinculados ao sales_rep (para tarefas/atividades que não têm sales_rep_id)
  SELECT COALESCE(array_agg(DISTINCT usr.user_id), '{}'::uuid[]) INTO v_user_ids
  FROM public.user_sales_reps usr WHERE usr.sales_rep_id = p_sales_rep_id;

  WITH base_companies AS (
    SELECT id FROM public.companies
    WHERE tenant_id = ANY(v_tenants)
      AND sales_rep_id = p_sales_rep_id
      AND (p_legal_entity_id IS NULL OR legal_entity_id = p_legal_entity_id)
  ),
  tasks_agg AS (
    SELECT
      COUNT(*) FILTER (WHERE t.created_at::date BETWEEN p_start_date AND p_end_date) AS criadas,
      COUNT(*) FILTER (WHERE t.completed_at::date BETWEEN p_start_date AND p_end_date) AS concluidas,
      COUNT(*) FILTER (WHERE t.status::text <> 'completed' AND t.due_date IS NOT NULL AND t.due_date < NOW()) AS atrasadas,
      COUNT(*) FILTER (WHERE t.status::text <> 'completed' AND t.due_date IS NOT NULL AND t.due_date >= NOW() AND t.due_date < NOW() + INTERVAL '7 days') AS prox_7d
    FROM public.tasks t
    WHERE t.tenant_id = ANY(v_tenants)
      AND (
        (array_length(v_user_ids,1) > 0 AND (t.assigned_to = ANY(v_user_ids) OR t.created_by = ANY(v_user_ids)))
        OR t.company_id IN (SELECT id FROM base_companies)
      )
  ),
  acts_agg AS (
    SELECT COUNT(*) AS interacoes,
           MAX(a.created_at) AS ultima
    FROM public.activities a
    WHERE a.tenant_id = ANY(v_tenants)
      AND a.created_at::date BETWEEN p_start_date AND p_end_date
      AND (
        (array_length(v_user_ids,1) > 0 AND a.created_by = ANY(v_user_ids))
        OR a.company_id IN (SELECT id FROM base_companies)
      )
  ),
  deals_agg AS (
    SELECT
      COUNT(*) FILTER (WHERE d.stage NOT IN ('fechado_ganho','fechado_perdido')
        AND EXTRACT(EPOCH FROM (NOW()-d.updated_at))/86400 > 14) AS parados_14d,
      COUNT(*) FILTER (WHERE d.stage NOT IN ('fechado_ganho','fechado_perdido')
        AND EXTRACT(EPOCH FROM (NOW()-d.updated_at))/86400 > 30) AS parados_30d,
      MAX(d.updated_at) AS ultimo_deal
    FROM public.deals d
    LEFT JOIN public.companies c ON c.id = d.company_id
    LEFT JOIN public.pipelines pl ON pl.id = d.pipeline_id
    WHERE d.tenant_id = ANY(v_tenants)
      AND COALESCE(pl.type,'sales')='sales'
      AND COALESCE(c.sales_rep_id, d.owner_id) = p_sales_rep_id
      AND (p_legal_entity_id IS NULL OR d.legal_entity_id = p_legal_entity_id)
  ),
  props_agg AS (
    SELECT
      COUNT(*) FILTER (WHERE pr.status::text IN ('sent','pending','aguardando','enviada')
        AND EXTRACT(EPOCH FROM (NOW()-pr.created_at))/86400 > 7) AS sem_retorno_7d,
      COUNT(*) FILTER (WHERE pr.created_at::date BETWEEN p_start_date AND p_end_date) AS emitidas_periodo
    FROM public.proposals pr
    LEFT JOIN public.companies c ON c.id = pr.company_id
    WHERE pr.tenant_id = ANY(v_tenants)
      AND (
        c.sales_rep_id = p_sales_rep_id
        OR (array_length(v_user_ids,1) > 0 AND pr.created_by = ANY(v_user_ids))
      )
      AND (p_legal_entity_id IS NULL OR pr.legal_entity_id = p_legal_entity_id)
  ),
  clientes_sem_acao AS (
    SELECT COUNT(*) AS qtd
    FROM base_companies bc
    WHERE NOT EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.company_id = bc.id AND t.status::text <> 'completed' AND t.due_date >= NOW()
    )
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_object(
      'tarefas_criadas', COALESCE(ta.criadas,0),
      'tarefas_concluidas', COALESCE(ta.concluidas,0),
      'tarefas_atrasadas', COALESCE(ta.atrasadas,0),
      'tarefas_proximas_7d', COALESCE(ta.prox_7d,0),
      'interacoes', COALESCE(aa.interacoes,0),
      'ultima_atividade', aa.ultima,
      'negocios_parados_14d', COALESCE(da.parados_14d,0),
      'negocios_parados_30d', COALESCE(da.parados_30d,0),
      'ultimo_negocio_atualizado', da.ultimo_deal,
      'propostas_sem_retorno_7d', COALESCE(pa.sem_retorno_7d,0),
      'propostas_emitidas_periodo', COALESCE(pa.emitidas_periodo,0),
      'clientes_sem_proxima_acao', COALESCE(csa.qtd,0)
    ),
    'empty', false
  ) INTO v_result
  FROM tasks_agg ta, acts_agg aa, deals_agg da, props_agg pa, clientes_sem_acao csa;

  RETURN COALESCE(v_result, '{"kpis":{},"empty":true}'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_pipeline_health(uuid, date, date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_seller_performance(date, date, boolean, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_stalled_deals_by_seller(uuid, integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_conversion_by_stage(date, date, uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_bi_anomalies(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_atividades_vendedor(uuid, date, date, uuid) TO authenticated;
