CREATE OR REPLACE FUNCTION public.report_atividades_vendedor(
  p_sales_rep_id uuid,
  p_start_date date DEFAULT ((CURRENT_DATE - INTERVAL '30 days')::date),
  p_end_date date DEFAULT CURRENT_DATE,
  p_legal_entity_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_admin boolean := public.bi_is_admin_or_dev();
  v_tenants uuid[] := ARRAY(SELECT public.get_user_tenant_ids(auth.uid()));
  v_user_ids uuid[];
  v_result jsonb;
BEGIN
  IF p_sales_rep_id IS NULL OR NOT public.bi_can_see_rep(p_sales_rep_id) THEN
    RETURN '{"kpis":{},"empty":true,"reason":"acesso_negado"}'::jsonb;
  END IF;
  IF p_legal_entity_id IS NOT NULL AND NOT v_admin AND NOT public.user_has_legal_entity_access(p_legal_entity_id) THEN
    RETURN '{"kpis":{},"empty":true,"reason":"sem_acesso_entidade"}'::jsonb;
  END IF;

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
$function$;