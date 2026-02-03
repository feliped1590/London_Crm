-- ========================================
-- SPRINT 10: BI AVANÇADO - FUNÇÕES FINAIS
-- ========================================

-- 1. Função: Pipeline Health
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
  WITH stage_metrics AS (
    SELECT 
      d.stage::TEXT as stage_name,
      ps.sort_order,
      ps.sla_hours,
      COUNT(d.id) as deal_count,
      COALESCE(SUM(d.value), 0) as total_val,
      AVG(
        CASE WHEN d.stage NOT IN ('fechado_ganho'::deal_stage, 'fechado_perdido'::deal_stage) THEN
          EXTRACT(EPOCH FROM (NOW() - COALESCE(
            (SELECT MAX(changed_at) FROM deal_stage_history WHERE deal_id = d.id AND to_stage = d.stage),
            d.created_at
          ))) / 86400
        END
      ) as avg_days,
      COUNT(
        CASE WHEN ps.sla_hours IS NOT NULL 
          AND d.stage NOT IN ('fechado_ganho'::deal_stage, 'fechado_perdido'::deal_stage)
          AND EXTRACT(EPOCH FROM (NOW() - COALESCE(
            (SELECT MAX(changed_at) FROM deal_stage_history WHERE deal_id = d.id AND to_stage = d.stage),
            d.created_at
          ))) / 3600 > ps.sla_hours
        THEN 1 END
      ) as over_sla
    FROM deals d
    LEFT JOIN pipeline_stages ps ON ps.stage = d.stage 
      AND (p_pipeline_id IS NULL OR ps.pipeline_id = p_pipeline_id)
    WHERE d.created_at >= p_start_date
      AND d.created_at <= p_end_date + INTERVAL '1 day'
      AND (p_pipeline_id IS NULL OR d.pipeline_id = p_pipeline_id)
    GROUP BY d.stage, ps.sort_order, ps.sla_hours
  ),
  stage_transitions AS (
    SELECT 
      from_stage::TEXT as stage_name,
      COUNT(*) as total_transitions,
      COUNT(CASE WHEN to_stage != 'fechado_perdido'::deal_stage THEN 1 END) as advanced
    FROM deal_stage_history
    WHERE changed_at >= p_start_date
      AND changed_at <= p_end_date + INTERVAL '1 day'
      AND from_stage IS NOT NULL
    GROUP BY from_stage
  )
  SELECT 
    sm.stage_name,
    COALESCE(sm.sort_order, 99)::INT,
    sm.deal_count,
    sm.total_val,
    ROUND(COALESCE(sm.avg_days, 0)::NUMERIC, 1),
    sm.sla_hours,
    sm.over_sla,
    CASE WHEN sm.deal_count > 0 
      THEN ROUND((sm.over_sla::NUMERIC / sm.deal_count) * 100, 1)
      ELSE 0 
    END,
    CASE WHEN COALESCE(st.total_transitions, 0) > 0 
      THEN ROUND((st.advanced::NUMERIC / st.total_transitions) * 100, 1)
      ELSE 0 
    END
  FROM stage_metrics sm
  LEFT JOIN stage_transitions st ON st.stage_name = sm.stage_name
  ORDER BY sm.sort_order NULLS LAST;
END;
$$;

-- 2. Função: Performance por Vendedor
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
    SELECT (p_end_date - p_start_date + 1) as days
  ),
  current_period AS (
    SELECT 
      d.owner_id,
      p.full_name,
      COUNT(d.id) as created,
      COUNT(CASE WHEN d.stage = 'fechado_ganho'::deal_stage THEN 1 END) as won,
      COUNT(CASE WHEN d.stage = 'fechado_perdido'::deal_stage THEN 1 END) as lost,
      COALESCE(SUM(CASE WHEN d.stage = 'fechado_ganho'::deal_stage THEN d.value END), 0) as value_won,
      AVG(
        CASE WHEN d.closed_at IS NOT NULL THEN
          EXTRACT(EPOCH FROM (d.closed_at - d.created_at)) / 86400
        END
      ) as avg_cycle,
      COUNT(
        CASE WHEN d.stage NOT IN ('fechado_ganho'::deal_stage, 'fechado_perdido'::deal_stage)
          AND EXTRACT(EPOCH FROM (NOW() - d.updated_at)) / 86400 > 7
        THEN 1 END
      ) as stalled
    FROM deals d
    JOIN profiles p ON p.user_id = d.owner_id
    WHERE d.created_at >= p_start_date
      AND d.created_at <= p_end_date + INTERVAL '1 day'
    GROUP BY d.owner_id, p.full_name
  ),
  previous_period AS (
    SELECT 
      d.owner_id,
      COUNT(d.id) as created,
      COUNT(CASE WHEN d.stage = 'fechado_ganho'::deal_stage THEN 1 END) as won
    FROM deals d
    WHERE d.created_at >= p_start_date - (SELECT days FROM period_days) * INTERVAL '1 day'
      AND d.created_at < p_start_date
    GROUP BY d.owner_id
  )
  SELECT 
    cp.owner_id,
    cp.full_name,
    cp.created,
    cp.won,
    cp.lost,
    cp.value_won,
    CASE WHEN cp.created > 0 
      THEN ROUND((cp.won::NUMERIC / cp.created) * 100, 1)
      ELSE 0 
    END,
    ROUND(COALESCE(cp.avg_cycle, 0)::NUMERIC, 1),
    cp.stalled,
    COALESCE(pp.created, 0),
    COALESCE(pp.won, 0),
    CASE WHEN COALESCE(pp.created, 0) > 0 
      THEN ROUND((pp.won::NUMERIC / pp.created) * 100, 1)
      ELSE 0 
    END
  FROM current_period cp
  LEFT JOIN previous_period pp ON pp.owner_id = cp.owner_id
  ORDER BY cp.value_won DESC;
END;
$$;

-- 3. Função: Detectar Anomalias (PL/pgSQL)
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
    -- Anomalia: Negócios de alto valor parados
    SELECT 
      'critical_stalled'::TEXT,
      CASE WHEN COUNT(*) >= 5 THEN 'critical' ELSE 'warning' END::TEXT,
      'Negócios de alto valor parados'::TEXT,
      (COUNT(*) || ' negócios acima de R$50k parados há mais de 14 dias')::TEXT,
      COUNT(*)::BIGINT,
      COALESCE(SUM(d.value), 0)::NUMERIC,
      'Ver negócios parados'::TEXT,
      '{"minValue": 50000, "stalledDays": 14}'::JSONB
    FROM deals d
    WHERE d.stage NOT IN ('fechado_ganho'::deal_stage, 'fechado_perdido'::deal_stage)
      AND d.value >= 50000
      AND EXTRACT(EPOCH FROM (NOW() - d.updated_at)) / 86400 > 14
    HAVING COUNT(*) > 0
    
    UNION ALL
    
    -- Anomalia: Pipeline crescendo sem fechar
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
        (SELECT COUNT(*) FROM deals WHERE stage NOT IN ('fechado_ganho'::deal_stage, 'fechado_perdido'::deal_stage)) as open_deals,
        (SELECT COUNT(*) FROM deals WHERE closed_at >= CURRENT_DATE - INTERVAL '30 days') as closed_30d,
        (SELECT COUNT(*) FROM deals WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as created_30d
    ) pg
    WHERE open_deals > 10 AND created_30d > closed_30d * 2
  ) all_anomalies
  ORDER BY 
    CASE all_anomalies.severity WHEN 'critical' THEN 1 ELSE 2 END,
    all_anomalies.affected_count DESC;
END;
$$;

-- 4. Função: Negócios parados por vendedor
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
    d.stage::TEXT,
    d.value,
    (EXTRACT(EPOCH FROM (NOW() - d.updated_at)) / 86400)::INT,
    d.owner_id,
    p.full_name
  FROM deals d
  LEFT JOIN companies c ON c.id = d.company_id
  LEFT JOIN profiles p ON p.user_id = d.owner_id
  WHERE d.stage NOT IN ('fechado_ganho'::deal_stage, 'fechado_perdido'::deal_stage)
    AND EXTRACT(EPOCH FROM (NOW() - d.updated_at)) / 86400 >= p_min_days
    AND (p_seller_id IS NULL OR d.owner_id = p_seller_id)
  ORDER BY EXTRACT(EPOCH FROM (NOW() - d.updated_at)) DESC;
END;
$$;

-- 5. Função: Taxa de conversão por etapa
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
      to_stage::TEXT as stage_name,
      COUNT(*) as entries
    FROM deal_stage_history
    WHERE changed_at >= p_start_date
      AND changed_at <= p_end_date + INTERVAL '1 day'
    GROUP BY to_stage
  ),
  stage_exits AS (
    SELECT 
      from_stage::TEXT as stage_name,
      COUNT(*) as exits
    FROM deal_stage_history
    WHERE changed_at >= p_start_date
      AND changed_at <= p_end_date + INTERVAL '1 day'
      AND from_stage IS NOT NULL
    GROUP BY from_stage
  )
  SELECT 
    COALESCE(se.stage_name, sx.stage_name),
    ps.sort_order,
    COALESCE(se.entries, 0),
    COALESCE(sx.exits, 0),
    CASE WHEN COALESCE(se.entries, 0) > 0 
      THEN ROUND((COALESCE(sx.exits, 0)::NUMERIC / se.entries) * 100, 1)
      ELSE 0 
    END
  FROM stage_entries se
  FULL OUTER JOIN stage_exits sx ON se.stage_name = sx.stage_name
  LEFT JOIN pipeline_stages ps ON ps.stage::TEXT = COALESCE(se.stage_name, sx.stage_name)
  ORDER BY ps.sort_order NULLS LAST;
END;
$$;

-- 6. Comentários
COMMENT ON FUNCTION public.get_pipeline_health IS 'Sprint 10: Retorna métricas de saúde do pipeline por etapa';
COMMENT ON FUNCTION public.get_seller_performance IS 'Sprint 10: Retorna performance de vendedores com comparativo';
COMMENT ON FUNCTION public.get_bi_anomalies IS 'Sprint 10: Detecta anomalias e alertas de negócio';
COMMENT ON FUNCTION public.get_stalled_deals_by_seller IS 'Sprint 10: Lista negócios parados para drill-down';
COMMENT ON FUNCTION public.get_conversion_by_stage IS 'Sprint 10: Taxa de conversão entre etapas do funil';