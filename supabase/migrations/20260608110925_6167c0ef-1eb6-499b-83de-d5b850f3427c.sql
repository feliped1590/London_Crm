
-- Fix report_vendas_vendedor: nested aggregates + accept start_date/end_date
CREATE OR REPLACE FUNCTION public.report_vendas_vendedor(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_from date := COALESCE((p_filters->>'start_date')::date, (p_filters->>'from')::date, (now() - interval '30 days')::date);
  v_to   date := COALESCE((p_filters->>'end_date')::date,   (p_filters->>'to')::date,   now()::date);
  v_admin boolean := public.bi_is_admin_or_dev();
  v_my_rep uuid := public.bi_my_sales_rep_id();
BEGIN
  RETURN COALESCE((
    WITH agg AS (
      SELECT sr.id AS sales_rep_id, sr.name AS nome,
             COALESCE(SUM(b.net_value),0) AS valor_vendido,
             COUNT(DISTINCT b.order_id) AS qtd_pedidos
      FROM public.bi_sales_fact b
      LEFT JOIN public.sales_reps sr ON sr.id = b.sales_rep_id
      WHERE b.order_date BETWEEN v_from AND v_to AND (v_admin OR b.sales_rep_id = v_my_rep)
      GROUP BY sr.id, sr.name
    )
    SELECT jsonb_agg(jsonb_build_object(
      'sales_rep_id', sales_rep_id, 'nome', nome,
      'valor_vendido', valor_vendido, 'qtd_pedidos', qtd_pedidos,
      'ticket_medio', CASE WHEN qtd_pedidos > 0 THEN valor_vendido / qtd_pedidos ELSE 0 END
    ) ORDER BY valor_vendido DESC) FROM agg
  ), '[]'::jsonb);
END $function$;

-- Fix report_vendas_entidade: nested aggregates + le.name + start_date/end_date
CREATE OR REPLACE FUNCTION public.report_vendas_entidade(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_from date := COALESCE((p_filters->>'start_date')::date, (p_filters->>'from')::date, (now() - interval '30 days')::date);
  v_to   date := COALESCE((p_filters->>'end_date')::date,   (p_filters->>'to')::date,   now()::date);
  v_admin boolean := public.bi_is_admin_or_dev();
  v_my_rep uuid := public.bi_my_sales_rep_id();
BEGIN
  RETURN COALESCE((
    WITH agg AS (
      SELECT le.id AS legal_entity_id, le.name AS nome,
             COALESCE(SUM(b.net_value),0) AS valor_vendido,
             COUNT(DISTINCT b.order_id) AS qtd_pedidos
      FROM public.bi_sales_fact b
      LEFT JOIN public.legal_entities le ON le.id = b.legal_entity_id
      WHERE b.order_date BETWEEN v_from AND v_to AND (v_admin OR b.sales_rep_id = v_my_rep)
      GROUP BY le.id, le.name
    )
    SELECT jsonb_agg(jsonb_build_object(
      'legal_entity_id', legal_entity_id, 'nome', nome,
      'valor_vendido', valor_vendido, 'qtd_pedidos', qtd_pedidos,
      'ticket_medio', CASE WHEN qtd_pedidos > 0 THEN valor_vendido / qtd_pedidos ELSE 0 END
    ) ORDER BY valor_vendido DESC) FROM agg
  ), '[]'::jsonb);
END $function$;

-- Fix report_vendas_produto: pf.label / pg.label
CREATE OR REPLACE FUNCTION public.report_vendas_produto(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_from date := COALESCE((p_filters->>'start_date')::date, (p_filters->>'from')::date, (now() - interval '90 days')::date);
  v_to   date := COALESCE((p_filters->>'end_date')::date,   (p_filters->>'to')::date,   now()::date);
  v_admin boolean := public.bi_is_admin_or_dev();
  v_my_rep uuid := public.bi_my_sales_rep_id();
  v_group_by text := COALESCE(p_filters->>'group_by', 'produto');
BEGIN
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', grp_id, 'nome', grp_nome,
      'quantidade', qtd, 'valor_vendido', valor,
      'participacao_pct', CASE WHEN SUM(valor) OVER () > 0 THEN valor / SUM(valor) OVER () * 100 ELSE 0 END
    ) ORDER BY valor DESC)
    FROM (
      SELECT
        CASE WHEN v_group_by='familia' THEN b.product_family_id
             WHEN v_group_by='grupo' THEN b.product_group_id
             ELSE b.product_id END AS grp_id,
        CASE WHEN v_group_by='familia' THEN COALESCE(pf.label,'(sem família)')
             WHEN v_group_by='grupo' THEN COALESCE(pg.label,'(sem grupo)')
             ELSE COALESCE(p.name,'(sem produto)') END AS grp_nome,
        SUM(b.quantity) AS qtd,
        SUM(b.net_value) AS valor
      FROM public.bi_sales_fact b
      LEFT JOIN public.products p ON p.id = b.product_id
      LEFT JOIN public.product_families pf ON pf.id = b.product_family_id
      LEFT JOIN public.product_groups pg ON pg.id = b.product_group_id
      WHERE b.order_date BETWEEN v_from AND v_to AND (v_admin OR b.sales_rep_id = v_my_rep)
      GROUP BY 1, 2
    ) t
  ), '[]'::jsonb);
END $function$;

-- Fix report_metas: le.name
CREATE OR REPLACE FUNCTION public.report_metas(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_from date := COALESCE((p_filters->>'start_date')::date, (p_filters->>'from')::date, date_trunc('month', now())::date);
  v_to   date := COALESCE((p_filters->>'end_date')::date,   (p_filters->>'to')::date,   (date_trunc('month', now()) + interval '1 month - 1 day')::date);
BEGIN
  RETURN (
    WITH metas AS (
      SELECT sg.*, COALESCE(p.full_name, t.name, le.name) AS alvo_nome
      FROM public.sales_goals sg
      LEFT JOIN public.profiles p ON p.user_id = sg.user_id
      LEFT JOIN public.teams t ON t.id = sg.team_id
      LEFT JOIN public.legal_entities le ON le.id = sg.legal_entity_id
      WHERE sg.period_start <= v_to AND sg.period_end >= v_from
    ),
    realizado AS (
      SELECT sg.id AS goal_id, COALESCE(SUM(b.net_value), 0) AS valor_realizado
      FROM metas sg
      LEFT JOIN public.bi_sales_fact b ON b.order_date BETWEEN sg.period_start AND sg.period_end
        AND (
          (sg.user_id IS NOT NULL AND b.sales_rep_id IN (
            SELECT id FROM public.sales_reps WHERE email = (SELECT email FROM public.profiles WHERE user_id = sg.user_id)))
          OR (sg.team_id IS NOT NULL AND b.team_id = sg.team_id)
          OR (sg.legal_entity_id IS NOT NULL AND b.legal_entity_id = sg.legal_entity_id)
        )
      GROUP BY sg.id
    )
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', m.id, 'alvo', m.alvo_nome, 'scope', m.scope,
      'meta', m.target_value, 'realizado', COALESCE(r.valor_realizado,0),
      'percent', CASE WHEN m.target_value > 0 THEN COALESCE(r.valor_realizado,0) / m.target_value * 100 ELSE 0 END,
      'faltante', GREATEST(0, m.target_value - COALESCE(r.valor_realizado,0)),
      'periodo', jsonb_build_object('inicio', m.period_start, 'fim', m.period_end)
    )), '[]'::jsonb) FROM metas m LEFT JOIN realizado r ON r.goal_id = m.id
  );
END $function$;

-- Also update other report_* functions to accept start_date/end_date (compat fix)
CREATE OR REPLACE FUNCTION public.report_dashboard_executivo(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_from date := COALESCE((p_filters->>'start_date')::date, (p_filters->>'from')::date, (now() - interval '30 days')::date);
  v_to   date := COALESCE((p_filters->>'end_date')::date,   (p_filters->>'to')::date,   now()::date);
  v_rep_filter uuid := NULLIF(p_filters->>'sales_rep_id','')::uuid;
  v_admin boolean := public.bi_is_admin_or_dev();
  v_my_rep uuid := public.bi_my_sales_rep_id();
  v_result jsonb;
BEGIN
  WITH base AS (
    SELECT * FROM public.bi_sales_fact
    WHERE order_date BETWEEN v_from AND v_to
      AND (v_admin OR sales_rep_id = v_my_rep)
      AND (v_rep_filter IS NULL OR sales_rep_id = v_rep_filter)
  ),
  kpis AS (
    SELECT
      COALESCE(SUM(net_value),0) AS valor_vendido,
      COUNT(DISTINCT order_id) AS qtd_pedidos,
      CASE WHEN COUNT(DISTINCT order_id) > 0 THEN COALESCE(SUM(net_value),0) / COUNT(DISTINCT order_id) ELSE 0 END AS ticket_medio,
      COUNT(DISTINCT company_id) AS clientes_atendidos
    FROM base
  ),
  top_clientes AS (
    SELECT c.id, c.name, COALESCE(SUM(b.net_value),0) AS total
    FROM base b JOIN public.companies c ON c.id = b.company_id
    GROUP BY c.id, c.name ORDER BY total DESC LIMIT 10
  ),
  top_produtos AS (
    SELECT p.id, p.name, COALESCE(SUM(b.net_value),0) AS total, COALESCE(SUM(b.quantity),0) AS qtd
    FROM base b JOIN public.products p ON p.id = b.product_id
    GROUP BY p.id, p.name ORDER BY total DESC LIMIT 10
  ),
  top_vendedores AS (
    SELECT sr.id, sr.name, COALESCE(SUM(b.net_value),0) AS total
    FROM base b JOIN public.sales_reps sr ON sr.id = b.sales_rep_id
    GROUP BY sr.id, sr.name ORDER BY total DESC LIMIT 10
  ),
  evolucao AS (
    SELECT order_date AS dia, COALESCE(SUM(net_value),0) AS total
    FROM base GROUP BY order_date ORDER BY order_date
  ),
  perdas AS (
    SELECT
      (SELECT COALESCE(SUM(value),0) FROM public.deals d
        WHERE d.stage = 'fechado_perdido' AND d.closed_at::date BETWEEN v_from AND v_to
          AND (v_admin OR d.owner_id = auth.uid())) AS valor_perdido_negocio,
      (SELECT COALESCE(SUM(total_value),0) FROM public.proposals pr
        WHERE pr.status = 'recusada' AND pr.updated_at::date BETWEEN v_from AND v_to
          AND (v_admin OR pr.created_by = auth.uid())) AS valor_perdido_cotacao
  )
  SELECT jsonb_build_object(
    'kpis', (SELECT to_jsonb(k) FROM kpis k) || (SELECT to_jsonb(p) FROM perdas p),
    'top_clientes', COALESCE((SELECT jsonb_agg(t) FROM top_clientes t), '[]'::jsonb),
    'top_produtos', COALESCE((SELECT jsonb_agg(t) FROM top_produtos t), '[]'::jsonb),
    'top_vendedores', COALESCE((SELECT jsonb_agg(t) FROM top_vendedores t), '[]'::jsonb),
    'evolucao', COALESCE((SELECT jsonb_agg(t) FROM evolucao t), '[]'::jsonb),
    'period', jsonb_build_object('from', v_from, 'to', v_to)
  ) INTO v_result;
  RETURN v_result;
END $function$;

-- report_vendas_cliente: accept start_date/end_date
CREATE OR REPLACE FUNCTION public.report_vendas_cliente(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_from date := COALESCE((p_filters->>'start_date')::date, (p_filters->>'from')::date, (now() - interval '90 days')::date);
  v_to   date := COALESCE((p_filters->>'end_date')::date,   (p_filters->>'to')::date,   now()::date);
  v_admin boolean := public.bi_is_admin_or_dev();
  v_my_rep uuid := public.bi_my_sales_rep_id();
BEGIN
  RETURN COALESCE((
    WITH base AS (
      SELECT b.company_id, c.name,
        COALESCE(SUM(b.net_value),0) AS valor,
        COUNT(DISTINCT b.order_id) AS qtd_pedidos,
        MAX(b.order_date) AS ultima_compra
      FROM public.bi_sales_fact b
      LEFT JOIN public.companies c ON c.id = b.company_id
      WHERE b.order_date BETWEEN v_from AND v_to AND (v_admin OR b.sales_rep_id = v_my_rep)
      GROUP BY b.company_id, c.name
    ),
    total AS (SELECT SUM(valor) AS total FROM base),
    abc AS (
      SELECT b.*, ROW_NUMBER() OVER (ORDER BY valor DESC) AS posicao,
        SUM(valor) OVER (ORDER BY valor DESC) AS acumulado,
        (SELECT total FROM total) AS total_geral
      FROM base b
    )
    SELECT jsonb_agg(jsonb_build_object(
      'company_id', company_id, 'nome', name,
      'valor_vendido', valor, 'qtd_pedidos', qtd_pedidos,
      'ticket_medio', CASE WHEN qtd_pedidos > 0 THEN valor / qtd_pedidos ELSE 0 END,
      'ultima_compra', ultima_compra,
      'posicao', posicao,
      'abc', CASE
        WHEN total_geral > 0 AND acumulado / total_geral <= 0.8 THEN 'A'
        WHEN total_geral > 0 AND acumulado / total_geral <= 0.95 THEN 'B'
        ELSE 'C' END
    ) ORDER BY valor DESC) FROM abc
  ), '[]'::jsonb);
END $function$;
