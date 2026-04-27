CREATE OR REPLACE FUNCTION public.get_pipeline_health(
  p_pipeline_id UUID DEFAULT NULL,
  p_start_date DATE DEFAULT (CURRENT_DATE - INTERVAL '30 days')::DATE,
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  stage TEXT,
  stage_order INT,
  total_deals BIGINT,
  total_value NUMERIC,
  avg_days_in_stage NUMERIC,
  sla_hours INT,
  deals_over_sla BIGINT,
  sla_violation_rate NUMERIC,
  advancement_rate NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH scoped_deals AS (
    SELECT
      d.*,
      COALESCE(NULLIF(ps.name, ''), d.stage)::TEXT AS stage_label,
      COALESCE(ps.sort_order, 99)::INT AS stage_sort_order,
      ps.sla_hours AS stage_sla_hours
    FROM public.deals d
    LEFT JOIN public.pipelines p ON p.id = d.pipeline_id
    LEFT JOIN LATERAL (
      SELECT s.name, s.sort_order, s.sla_hours
      FROM public.pipeline_stages s
      WHERE (s.id = d.pipeline_stage_id)
         OR (s.pipeline_id = d.pipeline_id AND s.stage = d.stage)
      ORDER BY CASE WHEN s.id = d.pipeline_stage_id THEN 0 ELSE 1 END, s.sort_order NULLS LAST
      LIMIT 1
    ) ps ON TRUE
    WHERE d.created_at >= p_start_date
      AND d.created_at < p_end_date + INTERVAL '1 day'
      AND (p_pipeline_id IS NULL OR d.pipeline_id = p_pipeline_id)
      AND (p_pipeline_id IS NOT NULL OR COALESCE(p.type, 'sales') = 'sales')
  ),
  stage_metrics AS (
    SELECT
      sd.stage::TEXT AS stage_key,
      sd.stage_label,
      sd.stage_sort_order,
      sd.stage_sla_hours,
      COUNT(sd.id)::BIGINT AS deal_count,
      COALESCE(SUM(sd.value), 0)::NUMERIC AS total_val,
      AVG(
        CASE WHEN sd.stage NOT IN ('fechado_ganho', 'fechado_perdido') THEN
          EXTRACT(EPOCH FROM (NOW() - COALESCE(
            (SELECT MAX(h.changed_at) FROM public.deal_stage_history h WHERE h.deal_id = sd.id AND h.to_stage = sd.stage),
            sd.created_at
          ))) / 86400
        END
      ) AS avg_days,
      COUNT(
        CASE WHEN sd.stage_sla_hours IS NOT NULL
          AND sd.stage NOT IN ('fechado_ganho', 'fechado_perdido')
          AND EXTRACT(EPOCH FROM (NOW() - COALESCE(
            (SELECT MAX(h.changed_at) FROM public.deal_stage_history h WHERE h.deal_id = sd.id AND h.to_stage = sd.stage),
            sd.created_at
          ))) / 3600 > sd.stage_sla_hours
        THEN 1 END
      )::BIGINT AS over_sla
    FROM scoped_deals sd
    GROUP BY sd.stage, sd.stage_label, sd.stage_sort_order, sd.stage_sla_hours
  ),
  stage_transitions AS (
    SELECT
      h.from_stage::TEXT AS stage_key,
      COUNT(*)::BIGINT AS total_transitions,
      COUNT(CASE WHEN h.to_stage <> 'fechado_perdido' THEN 1 END)::BIGINT AS advanced
    FROM public.deal_stage_history h
    JOIN public.deals d ON d.id = h.deal_id
    LEFT JOIN public.pipelines p ON p.id = d.pipeline_id
    WHERE h.changed_at >= p_start_date
      AND h.changed_at < p_end_date + INTERVAL '1 day'
      AND h.from_stage IS NOT NULL
      AND (p_pipeline_id IS NULL OR d.pipeline_id = p_pipeline_id)
      AND (p_pipeline_id IS NOT NULL OR COALESCE(p.type, 'sales') = 'sales')
    GROUP BY h.from_stage
  )
  SELECT
    sm.stage_label,
    sm.stage_sort_order,
    sm.deal_count,
    sm.total_val,
    ROUND(COALESCE(sm.avg_days, 0)::NUMERIC, 1),
    sm.stage_sla_hours,
    sm.over_sla,
    CASE WHEN sm.deal_count > 0 THEN ROUND((sm.over_sla::NUMERIC / sm.deal_count) * 100, 1) ELSE 0 END,
    CASE WHEN COALESCE(st.total_transitions, 0) > 0 THEN ROUND((st.advanced::NUMERIC / st.total_transitions) * 100, 1) ELSE 0 END
  FROM stage_metrics sm
  LEFT JOIN stage_transitions st ON st.stage_key = sm.stage_key
  ORDER BY sm.stage_sort_order NULLS LAST, sm.stage_label;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_seller_performance(
  p_start_date DATE DEFAULT (CURRENT_DATE - INTERVAL '30 days')::DATE,
  p_end_date DATE DEFAULT CURRENT_DATE,
  p_compare_previous BOOLEAN DEFAULT TRUE
)
RETURNS TABLE (
  seller_id UUID,
  seller_name TEXT,
  deals_created BIGINT,
  deals_won BIGINT,
  deals_lost BIGINT,
  total_value_won NUMERIC,
  conversion_rate NUMERIC,
  avg_cycle_days NUMERIC,
  deals_stalled BIGINT,
  prev_deals_created BIGINT,
  prev_deals_won BIGINT,
  prev_conversion_rate NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH period_days AS (
    SELECT (p_end_date - p_start_date + 1) AS days
  ),
  current_period AS (
    SELECT
      COALESCE(c.sales_rep_id, d.owner_id) AS responsible_id,
      COALESCE(sr.name, p.full_name, 'Sem vendedor')::TEXT AS responsible_name,
      COUNT(d.id)::BIGINT AS created,
      COUNT(CASE WHEN d.stage = 'fechado_ganho' THEN 1 END)::BIGINT AS won,
      COUNT(CASE WHEN d.stage = 'fechado_perdido' THEN 1 END)::BIGINT AS lost,
      COALESCE(SUM(CASE WHEN d.stage = 'fechado_ganho' THEN d.value END), 0)::NUMERIC AS value_won,
      AVG(CASE WHEN d.closed_at IS NOT NULL THEN EXTRACT(EPOCH FROM (d.closed_at - d.created_at)) / 86400 END) AS avg_cycle,
      COUNT(CASE WHEN d.stage NOT IN ('fechado_ganho', 'fechado_perdido') AND EXTRACT(EPOCH FROM (NOW() - d.updated_at)) / 86400 > 7 THEN 1 END)::BIGINT AS stalled
    FROM public.deals d
    LEFT JOIN public.companies c ON c.id = d.company_id
    LEFT JOIN public.sales_reps sr ON sr.id = c.sales_rep_id
    LEFT JOIN public.profiles p ON p.user_id = d.owner_id
    LEFT JOIN public.pipelines pl ON pl.id = d.pipeline_id
    WHERE d.created_at >= p_start_date
      AND d.created_at < p_end_date + INTERVAL '1 day'
      AND COALESCE(pl.type, 'sales') = 'sales'
      AND COALESCE(c.sales_rep_id, d.owner_id) IS NOT NULL
    GROUP BY COALESCE(c.sales_rep_id, d.owner_id), COALESCE(sr.name, p.full_name, 'Sem vendedor')
  ),
  previous_period AS (
    SELECT
      COALESCE(c.sales_rep_id, d.owner_id) AS responsible_id,
      COUNT(d.id)::BIGINT AS created,
      COUNT(CASE WHEN d.stage = 'fechado_ganho' THEN 1 END)::BIGINT AS won
    FROM public.deals d
    LEFT JOIN public.companies c ON c.id = d.company_id
    LEFT JOIN public.pipelines pl ON pl.id = d.pipeline_id
    WHERE d.created_at >= p_start_date - (SELECT days FROM period_days) * INTERVAL '1 day'
      AND d.created_at < p_start_date
      AND COALESCE(pl.type, 'sales') = 'sales'
      AND COALESCE(c.sales_rep_id, d.owner_id) IS NOT NULL
    GROUP BY COALESCE(c.sales_rep_id, d.owner_id)
  )
  SELECT
    cp.responsible_id,
    cp.responsible_name,
    cp.created,
    cp.won,
    cp.lost,
    cp.value_won,
    CASE WHEN cp.created > 0 THEN ROUND((cp.won::NUMERIC / cp.created) * 100, 1) ELSE 0 END,
    ROUND(COALESCE(cp.avg_cycle, 0)::NUMERIC, 1),
    cp.stalled,
    COALESCE(pp.created, 0),
    COALESCE(pp.won, 0),
    CASE WHEN COALESCE(pp.created, 0) > 0 THEN ROUND((pp.won::NUMERIC / pp.created) * 100, 1) ELSE 0 END
  FROM current_period cp
  LEFT JOIN previous_period pp ON pp.responsible_id = cp.responsible_id
  ORDER BY cp.value_won DESC, cp.created DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_bi_anomalies()
RETURNS TABLE (
  anomaly_type TEXT,
  severity TEXT,
  title TEXT,
  description TEXT,
  affected_count BIGINT,
  affected_value NUMERIC,
  action_label TEXT,
  filter_params JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM (
    SELECT
      'critical_stalled'::TEXT,
      CASE WHEN COUNT(*) >= 5 THEN 'critical' ELSE 'warning' END::TEXT,
      'Negócios de alto valor parados'::TEXT,
      (COUNT(*) || ' negócios acima de R$50k parados há mais de 14 dias')::TEXT,
      COUNT(*)::BIGINT,
      COALESCE(SUM(d.value), 0)::NUMERIC,
      'Ver negócios parados'::TEXT,
      '{"minValue": 50000, "stalledDays": 14}'::JSONB
    FROM public.deals d
    LEFT JOIN public.pipelines p ON p.id = d.pipeline_id
    WHERE d.stage NOT IN ('fechado_ganho', 'fechado_perdido')
      AND COALESCE(p.type, 'sales') = 'sales'
      AND d.value >= 50000
      AND EXTRACT(EPOCH FROM (NOW() - d.updated_at)) / 86400 > 14
    HAVING COUNT(*) > 0

    UNION ALL

    SELECT
      'pipeline_bloat'::TEXT,
      CASE WHEN created_30d > closed_30d * 3 THEN 'critical' ELSE 'warning' END::TEXT,
      'Pipeline crescendo sem fechar'::TEXT,
      (open_deals || ' negócios abertos, apenas ' || closed_30d || ' fechados no mês')::TEXT,
      open_deals::BIGINT,
      0::NUMERIC,
      'Revisar pipeline'::TEXT,
      '{"stage": "open"}'::JSONB
    FROM (
      SELECT
        (SELECT COUNT(*) FROM public.deals d LEFT JOIN public.pipelines p ON p.id = d.pipeline_id WHERE d.stage NOT IN ('fechado_ganho', 'fechado_perdido') AND COALESCE(p.type, 'sales') = 'sales') AS open_deals,
        (SELECT COUNT(*) FROM public.deals d LEFT JOIN public.pipelines p ON p.id = d.pipeline_id WHERE d.closed_at >= CURRENT_DATE - INTERVAL '30 days' AND COALESCE(p.type, 'sales') = 'sales') AS closed_30d,
        (SELECT COUNT(*) FROM public.deals d LEFT JOIN public.pipelines p ON p.id = d.pipeline_id WHERE d.created_at >= CURRENT_DATE - INTERVAL '30 days' AND COALESCE(p.type, 'sales') = 'sales') AS created_30d
    ) pg
    WHERE open_deals > 10 AND created_30d > closed_30d * 2
  ) all_anomalies
  ORDER BY CASE all_anomalies.severity WHEN 'critical' THEN 1 ELSE 2 END, all_anomalies.affected_count DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_stalled_deals_by_seller(
  p_seller_id UUID DEFAULT NULL,
  p_min_days INT DEFAULT 7
)
RETURNS TABLE (
  deal_id UUID,
  deal_name TEXT,
  company_name TEXT,
  stage TEXT,
  value NUMERIC,
  days_stalled INT,
  owner_id UUID,
  owner_name TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.name,
    c.name,
    COALESCE(NULLIF(ps.name, ''), d.stage)::TEXT,
    d.value,
    (EXTRACT(EPOCH FROM (NOW() - d.updated_at)) / 86400)::INT,
    COALESCE(c.sales_rep_id, d.owner_id),
    COALESCE(sr.name, p.full_name, 'Sem vendedor')::TEXT
  FROM public.deals d
  LEFT JOIN public.companies c ON c.id = d.company_id
  LEFT JOIN public.sales_reps sr ON sr.id = c.sales_rep_id
  LEFT JOIN public.profiles p ON p.user_id = d.owner_id
  LEFT JOIN public.pipelines pl ON pl.id = d.pipeline_id
  LEFT JOIN LATERAL (
    SELECT s.name
    FROM public.pipeline_stages s
    WHERE (s.id = d.pipeline_stage_id)
       OR (s.pipeline_id = d.pipeline_id AND s.stage = d.stage)
    ORDER BY CASE WHEN s.id = d.pipeline_stage_id THEN 0 ELSE 1 END, s.sort_order NULLS LAST
    LIMIT 1
  ) ps ON TRUE
  WHERE d.stage NOT IN ('fechado_ganho', 'fechado_perdido')
    AND COALESCE(pl.type, 'sales') = 'sales'
    AND EXTRACT(EPOCH FROM (NOW() - d.updated_at)) / 86400 >= p_min_days
    AND (p_seller_id IS NULL OR COALESCE(c.sales_rep_id, d.owner_id) = p_seller_id)
  ORDER BY EXTRACT(EPOCH FROM (NOW() - d.updated_at)) DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_conversion_by_stage(
  p_start_date DATE DEFAULT (CURRENT_DATE - INTERVAL '30 days')::DATE,
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  stage TEXT,
  stage_order INT,
  entered_count BIGINT,
  exited_count BIGINT,
  conversion_rate NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH stage_entries AS (
    SELECT
      h.to_stage::TEXT AS stage_key,
      COALESCE(NULLIF(ps.name, ''), h.to_stage)::TEXT AS stage_label,
      COALESCE(ps.sort_order, 99)::INT AS sort_order,
      COUNT(*)::BIGINT AS entries
    FROM public.deal_stage_history h
    JOIN public.deals d ON d.id = h.deal_id
    LEFT JOIN public.pipelines p ON p.id = d.pipeline_id
    LEFT JOIN LATERAL (
      SELECT s.name, s.sort_order
      FROM public.pipeline_stages s
      WHERE (s.pipeline_id = d.pipeline_id AND s.stage = h.to_stage)
      ORDER BY s.sort_order NULLS LAST
      LIMIT 1
    ) ps ON TRUE
    WHERE h.changed_at >= p_start_date
      AND h.changed_at < p_end_date + INTERVAL '1 day'
      AND COALESCE(p.type, 'sales') = 'sales'
    GROUP BY h.to_stage, COALESCE(NULLIF(ps.name, ''), h.to_stage), COALESCE(ps.sort_order, 99)
  ),
  stage_exits AS (
    SELECT
      h.from_stage::TEXT AS stage_key,
      COALESCE(NULLIF(ps.name, ''), h.from_stage)::TEXT AS stage_label,
      COALESCE(ps.sort_order, 99)::INT AS sort_order,
      COUNT(*)::BIGINT AS exits
    FROM public.deal_stage_history h
    JOIN public.deals d ON d.id = h.deal_id
    LEFT JOIN public.pipelines p ON p.id = d.pipeline_id
    LEFT JOIN LATERAL (
      SELECT s.name, s.sort_order
      FROM public.pipeline_stages s
      WHERE (s.pipeline_id = d.pipeline_id AND s.stage = h.from_stage)
      ORDER BY s.sort_order NULLS LAST
      LIMIT 1
    ) ps ON TRUE
    WHERE h.changed_at >= p_start_date
      AND h.changed_at < p_end_date + INTERVAL '1 day'
      AND h.from_stage IS NOT NULL
      AND COALESCE(p.type, 'sales') = 'sales'
    GROUP BY h.from_stage, COALESCE(NULLIF(ps.name, ''), h.from_stage), COALESCE(ps.sort_order, 99)
  )
  SELECT
    COALESCE(se.stage_label, sx.stage_label),
    COALESCE(se.sort_order, sx.sort_order),
    COALESCE(se.entries, 0),
    COALESCE(sx.exits, 0),
    CASE WHEN COALESCE(se.entries, 0) > 0 THEN ROUND((COALESCE(sx.exits, 0)::NUMERIC / se.entries) * 100, 1) ELSE 0 END
  FROM stage_entries se
  FULL OUTER JOIN stage_exits sx ON se.stage_key = sx.stage_key
  ORDER BY COALESCE(se.sort_order, sx.sort_order) NULLS LAST, COALESCE(se.stage_label, sx.stage_label);
END;
$$;

COMMENT ON FUNCTION public.get_pipeline_health IS 'BI Avançado: retorna métricas de saúde do pipeline comercial por etapa';
COMMENT ON FUNCTION public.get_seller_performance IS 'BI Avançado: retorna performance comercial por vendedor com comparativo';
COMMENT ON FUNCTION public.get_bi_anomalies IS 'BI Avançado: detecta anomalias e alertas de negócios comerciais';
COMMENT ON FUNCTION public.get_stalled_deals_by_seller IS 'BI Avançado: lista negócios comerciais parados para drill-down';
COMMENT ON FUNCTION public.get_conversion_by_stage IS 'BI Avançado: taxa de conversão entre etapas comerciais do funil';