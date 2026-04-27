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
  WITH anomalies AS (
    SELECT
      'critical_stalled'::TEXT AS anomaly_type,
      CASE WHEN COUNT(*) >= 5 THEN 'critical' ELSE 'warning' END::TEXT AS severity,
      'Negócios de alto valor parados'::TEXT AS title,
      (COUNT(*) || ' negócios acima de R$50k parados há mais de 14 dias')::TEXT AS description,
      COUNT(*)::BIGINT AS affected_count,
      COALESCE(SUM(d.value), 0)::NUMERIC AS affected_value,
      'Ver negócios parados'::TEXT AS action_label,
      '{"minValue": 50000, "stalledDays": 14}'::JSONB AS filter_params
    FROM public.deals d
    LEFT JOIN public.pipelines p ON p.id = d.pipeline_id
    WHERE lower(translate(COALESCE(d.stage, ''), 'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç', 'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc')) NOT IN ('fechado_ganho', 'fechado ganho', 'ganho', 'fechado_perdido', 'fechado perdido', 'perdido')
      AND COALESCE(p.type, 'sales') = 'sales'
      AND COALESCE(d.value, 0) >= 50000
      AND EXTRACT(EPOCH FROM (NOW() - d.updated_at)) / 86400 > 14
    HAVING COUNT(*) > 0

    UNION ALL

    SELECT
      'pipeline_bloat'::TEXT AS anomaly_type,
      CASE WHEN created_30d > closed_30d * 3 THEN 'critical' ELSE 'warning' END::TEXT AS severity,
      'Pipeline crescendo sem fechar'::TEXT AS title,
      (open_deals || ' negócios abertos, apenas ' || closed_30d || ' fechados no mês')::TEXT AS description,
      open_deals::BIGINT AS affected_count,
      0::NUMERIC AS affected_value,
      'Revisar pipeline'::TEXT AS action_label,
      '{"stage": "open"}'::JSONB AS filter_params
    FROM (
      SELECT
        (
          SELECT COUNT(*)
          FROM public.deals d
          LEFT JOIN public.pipelines p ON p.id = d.pipeline_id
          WHERE lower(translate(COALESCE(d.stage, ''), 'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç', 'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc')) NOT IN ('fechado_ganho', 'fechado ganho', 'ganho', 'fechado_perdido', 'fechado perdido', 'perdido')
            AND COALESCE(p.type, 'sales') = 'sales'
        ) AS open_deals,
        (
          SELECT COUNT(*)
          FROM public.deals d
          LEFT JOIN public.pipelines p ON p.id = d.pipeline_id
          WHERE d.closed_at >= CURRENT_DATE - INTERVAL '30 days'
            AND COALESCE(p.type, 'sales') = 'sales'
        ) AS closed_30d,
        (
          SELECT COUNT(*)
          FROM public.deals d
          LEFT JOIN public.pipelines p ON p.id = d.pipeline_id
          WHERE d.created_at >= CURRENT_DATE - INTERVAL '30 days'
            AND COALESCE(p.type, 'sales') = 'sales'
        ) AS created_30d
    ) pg
    WHERE open_deals > 10 AND created_30d > closed_30d * 2
  )
  SELECT
    anomalies.anomaly_type,
    anomalies.severity,
    anomalies.title,
    anomalies.description,
    anomalies.affected_count,
    anomalies.affected_value,
    anomalies.action_label,
    anomalies.filter_params
  FROM anomalies
  ORDER BY CASE anomalies.severity WHEN 'critical' THEN 1 ELSE 2 END, anomalies.affected_count DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_bi_anomalies() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_bi_anomalies() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_bi_anomalies() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_bi_anomalies() TO sandbox_exec;
GRANT EXECUTE ON FUNCTION public.get_bi_anomalies() TO sandbox_exec_lusyhkizwoihixcvcgap;