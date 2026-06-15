
-- =========================================================================
-- Phase 2A: Padronização do filtro por legal_entity_id em todas as RPCs report_*
-- =========================================================================

-- R0 Dashboard Executivo
CREATE OR REPLACE FUNCTION public.report_dashboard_executivo(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_from date := COALESCE((p_filters->>'start_date')::date, (p_filters->>'from')::date, (now() - interval '30 days')::date);
  v_to   date := COALESCE((p_filters->>'end_date')::date, (p_filters->>'to')::date, now()::date);
  v_rep_filter uuid := NULLIF(p_filters->>'sales_rep_id','')::uuid;
  v_le_id uuid := NULLIF(p_filters->>'legal_entity_id','')::uuid;
  v_admin boolean := public.bi_is_admin_or_dev();
  v_my_rep uuid := public.bi_my_sales_rep_id();
  v_result jsonb;
BEGIN
  IF v_le_id IS NOT NULL AND NOT v_admin AND NOT public.user_has_legal_entity_access(v_le_id) THEN
    RETURN jsonb_build_object('kpis', '{}'::jsonb, 'top_clientes','[]'::jsonb, 'top_produtos','[]'::jsonb,
      'top_vendedores','[]'::jsonb, 'evolucao','[]'::jsonb,
      'period', jsonb_build_object('from', v_from, 'to', v_to));
  END IF;
  WITH base AS (
    SELECT * FROM public.bi_sales_fact
    WHERE order_date BETWEEN v_from AND v_to
      AND (v_admin OR sales_rep_id = v_my_rep)
      AND (v_rep_filter IS NULL OR sales_rep_id = v_rep_filter)
      AND (v_le_id IS NULL OR legal_entity_id = v_le_id)
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
          AND (v_admin OR d.owner_id = auth.uid())
          AND (v_le_id IS NULL OR d.legal_entity_id = v_le_id)) AS valor_perdido_negocio,
      (SELECT COALESCE(SUM(total_value),0) FROM public.proposals pr
        WHERE pr.status = 'recusada' AND pr.updated_at::date BETWEEN v_from AND v_to
          AND (v_admin OR pr.created_by = auth.uid())
          AND (v_le_id IS NULL OR pr.legal_entity_id = v_le_id)) AS valor_perdido_cotacao
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
END $$;

-- R01 Conversão
CREATE OR REPLACE FUNCTION public.report_conversao(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_from date := COALESCE((p_filters->>'start_date')::date, (p_filters->>'from')::date, (now() - interval '30 days')::date);
  v_to   date := COALESCE((p_filters->>'end_date')::date, (p_filters->>'to')::date, now()::date);
  v_le_id uuid := NULLIF(p_filters->>'legal_entity_id','')::uuid;
  v_admin boolean := public.bi_is_admin_or_dev();
BEGIN
  IF v_le_id IS NOT NULL AND NOT v_admin AND NOT public.user_has_legal_entity_access(v_le_id) THEN
    RETURN jsonb_build_object('kpis','{}'::jsonb,'taxa_conversao_venda',0,'por_vendedor','[]'::jsonb);
  END IF;
  RETURN (
    WITH base AS (
      SELECT * FROM public.deals
      WHERE created_at::date BETWEEN v_from AND v_to
        AND (v_admin OR owner_id = auth.uid())
        AND (v_le_id IS NULL OR legal_entity_id = v_le_id)
    ),
    agg AS (
      SELECT
        COUNT(*) AS leads_criados,
        COUNT(*) FILTER (WHERE stage NOT IN ('fechado_perdido')) AS negocios_criados,
        COUNT(*) FILTER (WHERE stage = 'fechado_ganho') AS ganhos,
        COUNT(*) FILTER (WHERE stage = 'fechado_perdido') AS perdidos,
        COALESCE(SUM(value) FILTER (WHERE stage = 'fechado_ganho'),0) AS valor_ganho
      FROM base
    ),
    por_vendedor AS (
      SELECT p.full_name AS vendedor, COUNT(*) AS total,
        COUNT(*) FILTER (WHERE b.stage = 'fechado_ganho') AS ganhos
      FROM base b LEFT JOIN public.profiles p ON p.user_id = b.owner_id
      GROUP BY p.full_name ORDER BY ganhos DESC
    )
    SELECT jsonb_build_object(
      'kpis', to_jsonb(agg.*),
      'taxa_conversao_venda', CASE WHEN agg.negocios_criados > 0 THEN agg.ganhos::numeric / agg.negocios_criados * 100 ELSE 0 END,
      'por_vendedor', COALESCE((SELECT jsonb_agg(pv) FROM por_vendedor pv), '[]'::jsonb)
    ) FROM agg
  );
END $$;

-- R02 Perdas de atendimento
CREATE OR REPLACE FUNCTION public.report_perdas_atendimento(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_from date := COALESCE((p_filters->>'start_date')::date, (p_filters->>'from')::date, (now() - interval '90 days')::date);
  v_to   date := COALESCE((p_filters->>'end_date')::date, (p_filters->>'to')::date, now()::date);
  v_le_id uuid := NULLIF(p_filters->>'legal_entity_id','')::uuid;
  v_admin boolean := public.bi_is_admin_or_dev();
BEGIN
  IF v_le_id IS NOT NULL AND NOT v_admin AND NOT public.user_has_legal_entity_access(v_le_id) THEN
    RETURN jsonb_build_object('total_perdas',0,'valor_perdido',0,'por_motivo','[]'::jsonb);
  END IF;
  RETURN (
    WITH base AS (
      SELECT d.*, lrc.label AS motivo_label
      FROM public.deals d
      LEFT JOIN public.lost_reason_categories lrc ON lrc.id = d.lost_reason_id
      WHERE d.stage = 'fechado_perdido'
        AND d.closed_at::date BETWEEN v_from AND v_to
        AND (v_admin OR d.owner_id = auth.uid())
        AND (v_le_id IS NULL OR d.legal_entity_id = v_le_id)
    ),
    por_motivo AS (
      SELECT COALESCE(motivo_label, lost_reason, 'Não informado') AS motivo,
        COUNT(*) AS qtd, COALESCE(SUM(value),0) AS valor,
        AVG(EXTRACT(EPOCH FROM (closed_at - created_at))/86400)::numeric(10,1) AS tempo_medio_dias
      FROM base GROUP BY 1 ORDER BY qtd DESC
    )
    SELECT jsonb_build_object(
      'total_perdas', (SELECT COUNT(*) FROM base),
      'valor_perdido', (SELECT COALESCE(SUM(value),0) FROM base),
      'por_motivo', COALESCE((SELECT jsonb_agg(pm) FROM por_motivo pm), '[]'::jsonb)
    )
  );
END $$;

-- R03 Perdas de cotação
CREATE OR REPLACE FUNCTION public.report_perdas_cotacao(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_from date := COALESCE((p_filters->>'start_date')::date, (p_filters->>'from')::date, (now() - interval '90 days')::date);
  v_to   date := COALESCE((p_filters->>'end_date')::date, (p_filters->>'to')::date, now()::date);
  v_le_id uuid := NULLIF(p_filters->>'legal_entity_id','')::uuid;
  v_admin boolean := public.bi_is_admin_or_dev();
BEGIN
  IF v_le_id IS NOT NULL AND NOT v_admin AND NOT public.user_has_legal_entity_access(v_le_id) THEN
    RETURN jsonb_build_object('kpis','{}'::jsonb,'taxa_aproveitamento',0,'por_motivo','[]'::jsonb);
  END IF;
  RETURN (
    WITH base AS (
      SELECT pr.*, lrc.label AS motivo_label
      FROM public.proposals pr
      LEFT JOIN public.lost_reason_categories lrc ON lrc.id = pr.lost_reason_id
      WHERE pr.created_at::date BETWEEN v_from AND v_to
        AND (v_admin OR pr.created_by = auth.uid())
        AND (v_le_id IS NULL OR pr.legal_entity_id = v_le_id)
    ),
    kpis AS (
      SELECT
        COUNT(*) AS emitidas,
        COUNT(*) FILTER (WHERE status='aprovada') AS aprovadas,
        COUNT(*) FILTER (WHERE status='recusada') AS recusadas,
        COUNT(*) FILTER (WHERE status='expirada') AS expiradas,
        COALESCE(SUM(total_value) FILTER (WHERE status='aprovada'),0) AS valor_aprovado,
        COALESCE(SUM(total_value) FILTER (WHERE status='recusada'),0) AS valor_perdido
      FROM base
    ),
    por_motivo AS (
      SELECT COALESCE(motivo_label, rejection_reason, 'Não informado') AS motivo,
        COUNT(*) AS qtd, COALESCE(SUM(total_value),0) AS valor
      FROM base WHERE status='recusada'
      GROUP BY 1 ORDER BY qtd DESC
    )
    SELECT jsonb_build_object(
      'kpis', to_jsonb(kpis.*),
      'taxa_aproveitamento', CASE WHEN (kpis.aprovadas + kpis.recusadas) > 0
        THEN kpis.aprovadas::numeric / (kpis.aprovadas + kpis.recusadas) * 100 ELSE 0 END,
      'por_motivo', COALESCE((SELECT jsonb_agg(pm) FROM por_motivo pm), '[]'::jsonb)
    ) FROM kpis
  );
END $$;

-- R04 Metas
CREATE OR REPLACE FUNCTION public.report_metas(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_from date := COALESCE((p_filters->>'start_date')::date, (p_filters->>'from')::date, date_trunc('month', now())::date);
  v_to   date := COALESCE((p_filters->>'end_date')::date, (p_filters->>'to')::date, (date_trunc('month', now()) + interval '1 month - 1 day')::date);
  v_le_id uuid := NULLIF(p_filters->>'legal_entity_id','')::uuid;
  v_admin boolean := public.bi_is_admin_or_dev();
BEGIN
  IF v_le_id IS NOT NULL AND NOT v_admin AND NOT public.user_has_legal_entity_access(v_le_id) THEN
    RETURN '[]'::jsonb;
  END IF;
  RETURN (
    WITH metas AS (
      SELECT sg.*, COALESCE(p.full_name, t.name, le.name) AS alvo_nome
      FROM public.sales_goals sg
      LEFT JOIN public.profiles p ON p.user_id = sg.user_id
      LEFT JOIN public.teams t ON t.id = sg.team_id
      LEFT JOIN public.legal_entities le ON le.id = sg.legal_entity_id
      WHERE sg.period_start <= v_to AND sg.period_end >= v_from
        AND (v_le_id IS NULL OR sg.legal_entity_id IS NULL OR sg.legal_entity_id = v_le_id)
    ),
    realizado AS (
      SELECT sg.id AS goal_id, COALESCE(SUM(b.net_value), 0) AS valor_realizado
      FROM metas sg
      LEFT JOIN public.bi_sales_fact b ON b.order_date BETWEEN sg.period_start AND sg.period_end
        AND (v_le_id IS NULL OR b.legal_entity_id = v_le_id)
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
END $$;

-- R05 Vendas por entidade
CREATE OR REPLACE FUNCTION public.report_vendas_entidade(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_from date := COALESCE((p_filters->>'start_date')::date, (p_filters->>'from')::date, (now() - interval '30 days')::date);
  v_to   date := COALESCE((p_filters->>'end_date')::date, (p_filters->>'to')::date, now()::date);
  v_le_id uuid := NULLIF(p_filters->>'legal_entity_id','')::uuid;
  v_admin boolean := public.bi_is_admin_or_dev();
  v_my_rep uuid := public.bi_my_sales_rep_id();
BEGIN
  IF v_le_id IS NOT NULL AND NOT v_admin AND NOT public.user_has_legal_entity_access(v_le_id) THEN
    RETURN '[]'::jsonb;
  END IF;
  RETURN COALESCE((
    WITH agg AS (
      SELECT le.id AS legal_entity_id, le.name AS nome,
             COALESCE(SUM(b.net_value),0) AS valor_vendido,
             COUNT(DISTINCT b.order_id) AS qtd_pedidos
      FROM public.bi_sales_fact b
      LEFT JOIN public.legal_entities le ON le.id = b.legal_entity_id
      WHERE b.order_date BETWEEN v_from AND v_to
        AND (v_admin OR b.sales_rep_id = v_my_rep)
        AND (v_le_id IS NULL OR b.legal_entity_id = v_le_id)
      GROUP BY le.id, le.name
    )
    SELECT jsonb_agg(jsonb_build_object(
      'legal_entity_id', legal_entity_id, 'nome', nome,
      'valor_vendido', valor_vendido, 'qtd_pedidos', qtd_pedidos,
      'ticket_medio', CASE WHEN qtd_pedidos > 0 THEN valor_vendido / qtd_pedidos ELSE 0 END
    ) ORDER BY valor_vendido DESC) FROM agg
  ), '[]'::jsonb);
END $$;

-- R06 Vendas por vendedor
CREATE OR REPLACE FUNCTION public.report_vendas_vendedor(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_from date := COALESCE((p_filters->>'start_date')::date, (p_filters->>'from')::date, (now() - interval '30 days')::date);
  v_to   date := COALESCE((p_filters->>'end_date')::date, (p_filters->>'to')::date, now()::date);
  v_le_id uuid := NULLIF(p_filters->>'legal_entity_id','')::uuid;
  v_rep_filter uuid := NULLIF(p_filters->>'sales_rep_id','')::uuid;
  v_admin boolean := public.bi_is_admin_or_dev();
  v_my_rep uuid := public.bi_my_sales_rep_id();
BEGIN
  IF v_le_id IS NOT NULL AND NOT v_admin AND NOT public.user_has_legal_entity_access(v_le_id) THEN
    RETURN '[]'::jsonb;
  END IF;
  RETURN COALESCE((
    WITH agg AS (
      SELECT sr.id AS sales_rep_id, sr.name AS nome,
             COALESCE(SUM(b.net_value),0) AS valor_vendido,
             COUNT(DISTINCT b.order_id) AS qtd_pedidos
      FROM public.bi_sales_fact b
      LEFT JOIN public.sales_reps sr ON sr.id = b.sales_rep_id
      WHERE b.order_date BETWEEN v_from AND v_to
        AND (v_admin OR b.sales_rep_id = v_my_rep)
        AND (v_le_id IS NULL OR b.legal_entity_id = v_le_id)
        AND (v_rep_filter IS NULL OR b.sales_rep_id = v_rep_filter)
      GROUP BY sr.id, sr.name
    )
    SELECT jsonb_agg(jsonb_build_object(
      'sales_rep_id', sales_rep_id, 'nome', nome,
      'valor_vendido', valor_vendido, 'qtd_pedidos', qtd_pedidos,
      'ticket_medio', CASE WHEN qtd_pedidos > 0 THEN valor_vendido / qtd_pedidos ELSE 0 END
    ) ORDER BY valor_vendido DESC) FROM agg
  ), '[]'::jsonb);
END $$;

-- R07 Vendas por cliente
CREATE OR REPLACE FUNCTION public.report_vendas_cliente(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_from date := COALESCE((p_filters->>'start_date')::date, (p_filters->>'from')::date, (now() - interval '90 days')::date);
  v_to   date := COALESCE((p_filters->>'end_date')::date, (p_filters->>'to')::date, now()::date);
  v_le_id uuid := NULLIF(p_filters->>'legal_entity_id','')::uuid;
  v_rep_filter uuid := NULLIF(p_filters->>'sales_rep_id','')::uuid;
  v_admin boolean := public.bi_is_admin_or_dev();
  v_my_rep uuid := public.bi_my_sales_rep_id();
BEGIN
  IF v_le_id IS NOT NULL AND NOT v_admin AND NOT public.user_has_legal_entity_access(v_le_id) THEN
    RETURN '[]'::jsonb;
  END IF;
  RETURN COALESCE((
    WITH base AS (
      SELECT b.company_id, c.name,
        COALESCE(SUM(b.net_value),0) AS valor,
        COUNT(DISTINCT b.order_id) AS qtd_pedidos,
        MAX(b.order_date) AS ultima_compra
      FROM public.bi_sales_fact b
      LEFT JOIN public.companies c ON c.id = b.company_id
      WHERE b.order_date BETWEEN v_from AND v_to
        AND (v_admin OR b.sales_rep_id = v_my_rep)
        AND (v_le_id IS NULL OR b.legal_entity_id = v_le_id)
        AND (v_rep_filter IS NULL OR b.sales_rep_id = v_rep_filter)
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
END $$;

-- R08 Vendas por produto
CREATE OR REPLACE FUNCTION public.report_vendas_produto(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_from date := COALESCE((p_filters->>'start_date')::date, (p_filters->>'from')::date, (now() - interval '90 days')::date);
  v_to   date := COALESCE((p_filters->>'end_date')::date, (p_filters->>'to')::date, now()::date);
  v_le_id uuid := NULLIF(p_filters->>'legal_entity_id','')::uuid;
  v_rep_filter uuid := NULLIF(p_filters->>'sales_rep_id','')::uuid;
  v_admin boolean := public.bi_is_admin_or_dev();
  v_my_rep uuid := public.bi_my_sales_rep_id();
  v_group_by text := COALESCE(p_filters->>'group_by', 'produto');
BEGIN
  IF v_le_id IS NOT NULL AND NOT v_admin AND NOT public.user_has_legal_entity_access(v_le_id) THEN
    RETURN '[]'::jsonb;
  END IF;
  RETURN COALESCE((
    WITH agg AS (
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
      WHERE b.order_date BETWEEN v_from AND v_to
        AND (v_admin OR b.sales_rep_id = v_my_rep)
        AND (v_le_id IS NULL OR b.legal_entity_id = v_le_id)
        AND (v_rep_filter IS NULL OR b.sales_rep_id = v_rep_filter)
      GROUP BY 1, 2
    ),
    with_pct AS (
      SELECT grp_id, grp_nome, qtd, valor,
        CASE WHEN SUM(valor) OVER () > 0 THEN valor / SUM(valor) OVER () * 100 ELSE 0 END AS participacao_pct
      FROM agg
    )
    SELECT jsonb_agg(jsonb_build_object(
      'id', grp_id, 'nome', grp_nome,
      'quantidade', qtd, 'valor_vendido', valor,
      'participacao_pct', participacao_pct
    ) ORDER BY valor DESC) FROM with_pct
  ), '[]'::jsonb);
END $$;

-- R10 Clientes Atendidos
CREATE OR REPLACE FUNCTION public.report_clientes_atendidos(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_from date := COALESCE((p_filters->>'start_date')::date, (p_filters->>'from')::date, (now() - interval '90 days')::date);
  v_to   date := COALESCE((p_filters->>'end_date')::date, (p_filters->>'to')::date, now()::date);
  v_le_id uuid := NULLIF(p_filters->>'legal_entity_id','')::uuid;
  v_rep_filter uuid := NULLIF(p_filters->>'sales_rep_id','')::uuid;
  v_admin boolean := public.bi_is_admin_or_dev();
  v_my_rep uuid := public.bi_my_sales_rep_id();
BEGIN
  IF v_le_id IS NOT NULL AND NOT v_admin AND NOT public.user_has_legal_entity_access(v_le_id) THEN
    RETURN jsonb_build_object('novos',0,'recorrentes',0,'total',0);
  END IF;
  RETURN (
    WITH primeira AS (
      SELECT company_id, MIN(order_date) AS primeira_compra
      FROM public.bi_sales_fact
      WHERE (v_le_id IS NULL OR legal_entity_id = v_le_id)
      GROUP BY company_id
    ),
    base AS (
      SELECT DISTINCT b.company_id, p.primeira_compra
      FROM public.bi_sales_fact b
      JOIN primeira p ON p.company_id = b.company_id
      WHERE b.order_date BETWEEN v_from AND v_to
        AND (v_admin OR b.sales_rep_id = v_my_rep)
        AND (v_le_id IS NULL OR b.legal_entity_id = v_le_id)
        AND (v_rep_filter IS NULL OR b.sales_rep_id = v_rep_filter)
    ),
    classificado AS (
      SELECT
        COUNT(*) FILTER (WHERE primeira_compra BETWEEN v_from AND v_to) AS novos,
        COUNT(*) FILTER (WHERE primeira_compra < v_from) AS recorrentes,
        COUNT(*) AS total
      FROM base
    )
    SELECT to_jsonb(classificado.*) FROM classificado
  );
END $$;

-- R11 Pipeline Comercial
CREATE OR REPLACE FUNCTION public.report_pipeline_comercial(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_le_id uuid := NULLIF(p_filters->>'legal_entity_id','')::uuid;
  v_admin boolean := public.bi_is_admin_or_dev();
BEGIN
  IF v_le_id IS NOT NULL AND NOT v_admin AND NOT public.user_has_legal_entity_access(v_le_id) THEN
    RETURN jsonb_build_object('por_etapa','[]'::jsonb,'tempo_medio_etapa','[]'::jsonb);
  END IF;
  RETURN (
    WITH por_etapa AS (
      SELECT d.stage,
        COUNT(*) AS qtd,
        COALESCE(SUM(d.value),0) AS valor,
        COALESCE(AVG(EXTRACT(EPOCH FROM (now() - d.created_at))/86400),0)::numeric(10,1) AS dias_medio
      FROM public.deals d
      WHERE d.stage NOT IN ('fechado_ganho','fechado_perdido')
        AND (v_admin OR d.owner_id = auth.uid())
        AND (v_le_id IS NULL OR d.legal_entity_id = v_le_id)
      GROUP BY d.stage
    ),
    tempo_etapa AS (
      SELECT from_stage AS stage,
        AVG(duration_seconds)/86400.0 AS dias_medio
      FROM public.deal_stage_history
      WHERE duration_seconds IS NOT NULL AND from_stage IS NOT NULL
      GROUP BY from_stage
    )
    SELECT jsonb_build_object(
      'por_etapa', COALESCE((SELECT jsonb_agg(pe) FROM por_etapa pe), '[]'::jsonb),
      'tempo_medio_etapa', COALESCE((SELECT jsonb_agg(te) FROM tempo_etapa te), '[]'::jsonb)
    )
  );
END $$;

-- R12 Forecast
CREATE OR REPLACE FUNCTION public.report_forecast_vendas(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_from date := COALESCE((p_filters->>'start_date')::date, (p_filters->>'from')::date, date_trunc('month', now())::date);
  v_to   date := COALESCE((p_filters->>'end_date')::date, (p_filters->>'to')::date, (date_trunc('month', now()) + interval '1 month - 1 day')::date);
  v_le_id uuid := NULLIF(p_filters->>'legal_entity_id','')::uuid;
  v_admin boolean := public.bi_is_admin_or_dev();
  v_my_rep uuid := public.bi_my_sales_rep_id();
BEGIN
  IF v_le_id IS NOT NULL AND NOT v_admin AND NOT public.user_has_legal_entity_access(v_le_id) THEN
    RETURN jsonb_build_object('meta',0,'fechado',0,'aberto',0,'forecast',0,'percent_meta',0);
  END IF;
  RETURN (
    WITH fechado AS (
      SELECT COALESCE(SUM(net_value),0) AS valor
      FROM public.bi_sales_fact
      WHERE order_date BETWEEN v_from AND v_to
        AND (v_admin OR sales_rep_id = v_my_rep)
        AND (v_le_id IS NULL OR legal_entity_id = v_le_id)
    ),
    pipeline AS (
      SELECT COALESCE(SUM(d.value * COALESCE(fsp.probability_pct,0)/100),0) AS valor_ponderado,
             COALESCE(SUM(d.value),0) AS valor_aberto
      FROM public.deals d
      LEFT JOIN public.forecast_stage_probabilities fsp ON fsp.stage = d.stage AND fsp.pipeline_id IS NULL
      WHERE d.stage NOT IN ('fechado_ganho','fechado_perdido')
        AND (v_admin OR d.owner_id = auth.uid())
        AND (v_le_id IS NULL OR d.legal_entity_id = v_le_id)
    ),
    meta AS (
      SELECT COALESCE(SUM(target_value),0) AS valor
      FROM public.sales_goals
      WHERE period_start <= v_to AND period_end >= v_from
        AND (v_le_id IS NULL OR legal_entity_id IS NULL OR legal_entity_id = v_le_id)
    )
    SELECT jsonb_build_object(
      'meta', (SELECT valor FROM meta),
      'fechado', (SELECT valor FROM fechado),
      'aberto', (SELECT valor_aberto FROM pipeline),
      'forecast', (SELECT valor FROM fechado) + (SELECT valor_ponderado FROM pipeline),
      'percent_meta', CASE WHEN (SELECT valor FROM meta) > 0
        THEN ((SELECT valor FROM fechado) + (SELECT valor_ponderado FROM pipeline)) / (SELECT valor FROM meta) * 100
        ELSE 0 END
    )
  );
END $$;

-- R09 Rankings (composto) — herda p_filters, sem alteração necessária.
-- A função já delega para as funções acima.
