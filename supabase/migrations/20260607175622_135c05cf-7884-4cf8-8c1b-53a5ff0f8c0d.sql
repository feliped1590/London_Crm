
-- =========== REPORT DEFINITIONS / SNAPSHOTS / FAVORITES ===========
CREATE TABLE IF NOT EXISTS public.report_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  category text NOT NULL CHECK (category IN ('executivo','comercial','funil','metas','clientes','produtos','rankings','forecast')),
  chart_type text,
  default_filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  required_roles text[] NOT NULL DEFAULT ARRAY['admin','desenvolvedor','vendedor'],
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.report_definitions TO authenticated;
GRANT ALL ON public.report_definitions TO service_role;
ALTER TABLE public.report_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rd_read" ON public.report_definitions FOR SELECT TO authenticated USING (true);
CREATE POLICY "rd_write" ON public.report_definitions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'desenvolvedor'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'desenvolvedor'::app_role));
DROP TRIGGER IF EXISTS trg_rd_updated ON public.report_definitions;
CREATE TRIGGER trg_rd_updated BEFORE UPDATE ON public.report_definitions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.report_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.report_definitions(id) ON DELETE CASCADE,
  tenant_id uuid,
  generated_by uuid,
  generated_at timestamptz NOT NULL DEFAULT now(),
  filters_used jsonb NOT NULL DEFAULT '{}'::jsonb,
  json_result jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_rs_report_generated ON public.report_snapshots(report_id, generated_at DESC);
GRANT SELECT, INSERT ON public.report_snapshots TO authenticated;
GRANT ALL ON public.report_snapshots TO service_role;
ALTER TABLE public.report_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rs_read" ON public.report_snapshots FOR SELECT TO authenticated
  USING (tenant_id IS NULL OR tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE POLICY "rs_insert" ON public.report_snapshots FOR INSERT TO authenticated
  WITH CHECK (tenant_id IS NULL OR tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE TABLE IF NOT EXISTS public.report_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  report_id uuid NOT NULL REFERENCES public.report_definitions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, report_id)
);
GRANT SELECT, INSERT, DELETE ON public.report_favorites TO authenticated;
GRANT ALL ON public.report_favorites TO service_role;
ALTER TABLE public.report_favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rf_own" ON public.report_favorites FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- =========== SEEDS DE DEFINIÇÕES ===========
INSERT INTO public.report_definitions (code, name, description, category, chart_type, sort_order) VALUES
  ('dashboard_executivo','Dashboard Executivo','KPIs e visão geral comercial','executivo','dashboard',1),
  ('conversao','Taxa de Conversão','Funil de leads, negócios e ganhos','comercial','funnel',10),
  ('perdas_atendimento','Perdas de Atendimento','Motivos e tempo médio até perda','comercial','pie',20),
  ('perdas_cotacao','Perdas de Cotação','Aproveitamento de propostas','comercial','funnel',30),
  ('metas','Metas de Vendas','Meta vs realizado','metas','gauge',40),
  ('vendas_entidade','Vendas por Entidade Jurídica','Faturamento por CNPJ','produtos','bar',50),
  ('vendas_vendedor','Vendas por Vendedor','Performance individual','rankings','bar',60),
  ('vendas_cliente','Vendas por Cliente','Curva ABC e última compra','clientes','bar',70),
  ('vendas_produto','Vendas por Produto','Família, grupo e produto','produtos','bar',80),
  ('rankings','Rankings Dinâmicos','Clientes, vendedores e produtos','rankings','table',90),
  ('clientes_atendidos','Clientes Atendidos','Novos, recorrentes e reativados','clientes','line',100),
  ('pipeline_comercial','Pipeline Comercial','Funil e tempo por etapa','funil','funnel',110),
  ('forecast_vendas','Forecast de Vendas','Projeção pelo pipeline','forecast','gauge',120)
ON CONFLICT (code) DO NOTHING;

-- =========== HELPERS ===========
CREATE OR REPLACE FUNCTION public.bi_is_admin_or_dev()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'desenvolvedor'::app_role);
$$;

CREATE OR REPLACE FUNCTION public.bi_my_sales_rep_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.sales_reps WHERE active = true AND email = (SELECT email FROM public.profiles WHERE user_id = auth.uid()) LIMIT 1;
$$;

-- Aplica filtro de visibilidade: admin/dev = todos; vendedor = só seu sales_rep_id
CREATE OR REPLACE FUNCTION public.bi_can_see_rep(p_rep uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.bi_is_admin_or_dev() OR p_rep = public.bi_my_sales_rep_id();
$$;

-- =========== RPCs ===========

-- Dashboard Executivo
CREATE OR REPLACE FUNCTION public.report_dashboard_executivo(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_from date := COALESCE((p_filters->>'from')::date, (now() - interval '30 days')::date);
  v_to date := COALESCE((p_filters->>'to')::date, now()::date);
  v_rep_filter uuid := (p_filters->>'sales_rep_id')::uuid;
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
END $$;
GRANT EXECUTE ON FUNCTION public.report_dashboard_executivo TO authenticated;

-- R01 Conversão
CREATE OR REPLACE FUNCTION public.report_conversao(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_from date := COALESCE((p_filters->>'from')::date, (now() - interval '30 days')::date);
  v_to date := COALESCE((p_filters->>'to')::date, now()::date);
  v_admin boolean := public.bi_is_admin_or_dev();
BEGIN
  RETURN (
    WITH base AS (
      SELECT * FROM public.deals
      WHERE created_at::date BETWEEN v_from AND v_to
        AND (v_admin OR owner_id = auth.uid())
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
GRANT EXECUTE ON FUNCTION public.report_conversao TO authenticated;

-- R02 Perdas de atendimento
CREATE OR REPLACE FUNCTION public.report_perdas_atendimento(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_from date := COALESCE((p_filters->>'from')::date, (now() - interval '90 days')::date);
  v_to date := COALESCE((p_filters->>'to')::date, now()::date);
  v_admin boolean := public.bi_is_admin_or_dev();
BEGIN
  RETURN (
    WITH base AS (
      SELECT d.*, lrc.label AS motivo_label
      FROM public.deals d
      LEFT JOIN public.lost_reason_categories lrc ON lrc.id = d.lost_reason_id
      WHERE d.stage = 'fechado_perdido'
        AND d.closed_at::date BETWEEN v_from AND v_to
        AND (v_admin OR d.owner_id = auth.uid())
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
GRANT EXECUTE ON FUNCTION public.report_perdas_atendimento TO authenticated;

-- R03 Perdas de cotação
CREATE OR REPLACE FUNCTION public.report_perdas_cotacao(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_from date := COALESCE((p_filters->>'from')::date, (now() - interval '90 days')::date);
  v_to date := COALESCE((p_filters->>'to')::date, now()::date);
  v_admin boolean := public.bi_is_admin_or_dev();
BEGIN
  RETURN (
    WITH base AS (
      SELECT pr.*, lrc.label AS motivo_label
      FROM public.proposals pr
      LEFT JOIN public.lost_reason_categories lrc ON lrc.id = pr.lost_reason_id
      WHERE pr.created_at::date BETWEEN v_from AND v_to
        AND (v_admin OR pr.created_by = auth.uid())
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
GRANT EXECUTE ON FUNCTION public.report_perdas_cotacao TO authenticated;

-- R04 Metas
CREATE OR REPLACE FUNCTION public.report_metas(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_from date := COALESCE((p_filters->>'from')::date, date_trunc('month', now())::date);
  v_to date := COALESCE((p_filters->>'to')::date, (date_trunc('month', now()) + interval '1 month - 1 day')::date);
  v_admin boolean := public.bi_is_admin_or_dev();
  v_my_rep uuid := public.bi_my_sales_rep_id();
BEGIN
  RETURN (
    WITH metas AS (
      SELECT sg.*, COALESCE(p.full_name, t.name, le.razao_social) AS alvo_nome
      FROM public.sales_goals sg
      LEFT JOIN public.profiles p ON p.user_id = sg.user_id
      LEFT JOIN public.teams t ON t.id = sg.team_id
      LEFT JOIN public.legal_entities le ON le.id = sg.legal_entity_id
      WHERE sg.period_start <= v_to AND sg.period_end >= v_from
    ),
    realizado AS (
      SELECT sg.id AS goal_id,
        COALESCE(SUM(b.net_value), 0) AS valor_realizado
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
END $$;
GRANT EXECUTE ON FUNCTION public.report_metas TO authenticated;

-- R05 Vendas por entidade
CREATE OR REPLACE FUNCTION public.report_vendas_entidade(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_from date := COALESCE((p_filters->>'from')::date, (now() - interval '30 days')::date);
  v_to date := COALESCE((p_filters->>'to')::date, now()::date);
  v_admin boolean := public.bi_is_admin_or_dev();
  v_my_rep uuid := public.bi_my_sales_rep_id();
BEGIN
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'legal_entity_id', le.id,
      'nome', le.razao_social,
      'valor_vendido', COALESCE(SUM(b.net_value),0),
      'qtd_pedidos', COUNT(DISTINCT b.order_id),
      'ticket_medio', CASE WHEN COUNT(DISTINCT b.order_id) > 0
        THEN COALESCE(SUM(b.net_value),0) / COUNT(DISTINCT b.order_id) ELSE 0 END
    ) ORDER BY COALESCE(SUM(b.net_value),0) DESC)
    FROM public.bi_sales_fact b
    LEFT JOIN public.legal_entities le ON le.id = b.legal_entity_id
    WHERE b.order_date BETWEEN v_from AND v_to AND (v_admin OR b.sales_rep_id = v_my_rep)
    GROUP BY le.id, le.razao_social
  ), '[]'::jsonb);
END $$;
GRANT EXECUTE ON FUNCTION public.report_vendas_entidade TO authenticated;

-- R06 Vendas por vendedor
CREATE OR REPLACE FUNCTION public.report_vendas_vendedor(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_from date := COALESCE((p_filters->>'from')::date, (now() - interval '30 days')::date);
  v_to date := COALESCE((p_filters->>'to')::date, now()::date);
  v_admin boolean := public.bi_is_admin_or_dev();
  v_my_rep uuid := public.bi_my_sales_rep_id();
BEGIN
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'sales_rep_id', sr.id, 'nome', sr.name,
      'valor_vendido', COALESCE(SUM(b.net_value),0),
      'qtd_pedidos', COUNT(DISTINCT b.order_id),
      'ticket_medio', CASE WHEN COUNT(DISTINCT b.order_id) > 0
        THEN COALESCE(SUM(b.net_value),0) / COUNT(DISTINCT b.order_id) ELSE 0 END
    ) ORDER BY COALESCE(SUM(b.net_value),0) DESC)
    FROM public.bi_sales_fact b
    LEFT JOIN public.sales_reps sr ON sr.id = b.sales_rep_id
    WHERE b.order_date BETWEEN v_from AND v_to AND (v_admin OR b.sales_rep_id = v_my_rep)
    GROUP BY sr.id, sr.name
  ), '[]'::jsonb);
END $$;
GRANT EXECUTE ON FUNCTION public.report_vendas_vendedor TO authenticated;

-- R07 Vendas por cliente
CREATE OR REPLACE FUNCTION public.report_vendas_cliente(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_from date := COALESCE((p_filters->>'from')::date, (now() - interval '90 days')::date);
  v_to date := COALESCE((p_filters->>'to')::date, now()::date);
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
END $$;
GRANT EXECUTE ON FUNCTION public.report_vendas_cliente TO authenticated;

-- R08 Vendas por produto
CREATE OR REPLACE FUNCTION public.report_vendas_produto(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_from date := COALESCE((p_filters->>'from')::date, (now() - interval '90 days')::date);
  v_to date := COALESCE((p_filters->>'to')::date, now()::date);
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
        CASE WHEN v_group_by='familia' THEN COALESCE(pf.nome,'(sem família)')
             WHEN v_group_by='grupo' THEN COALESCE(pg.nome,'(sem grupo)')
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
END $$;
GRANT EXECUTE ON FUNCTION public.report_vendas_produto TO authenticated;

-- R10 Clientes Atendidos
CREATE OR REPLACE FUNCTION public.report_clientes_atendidos(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_from date := COALESCE((p_filters->>'from')::date, (now() - interval '90 days')::date);
  v_to date := COALESCE((p_filters->>'to')::date, now()::date);
  v_admin boolean := public.bi_is_admin_or_dev();
  v_my_rep uuid := public.bi_my_sales_rep_id();
BEGIN
  RETURN (
    WITH primeira AS (
      SELECT company_id, MIN(order_date) AS primeira_compra
      FROM public.bi_sales_fact GROUP BY company_id
    ),
    base AS (
      SELECT DISTINCT b.company_id, p.primeira_compra
      FROM public.bi_sales_fact b
      JOIN primeira p ON p.company_id = b.company_id
      WHERE b.order_date BETWEEN v_from AND v_to AND (v_admin OR b.sales_rep_id = v_my_rep)
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
GRANT EXECUTE ON FUNCTION public.report_clientes_atendidos TO authenticated;

-- R11 Pipeline Comercial
CREATE OR REPLACE FUNCTION public.report_pipeline_comercial(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_admin boolean := public.bi_is_admin_or_dev();
BEGIN
  RETURN (
    WITH por_etapa AS (
      SELECT d.stage,
        COUNT(*) AS qtd,
        COALESCE(SUM(d.value),0) AS valor,
        COALESCE(AVG(EXTRACT(EPOCH FROM (now() - d.created_at))/86400),0)::numeric(10,1) AS dias_medio
      FROM public.deals d
      WHERE d.stage NOT IN ('fechado_ganho','fechado_perdido')
        AND (v_admin OR d.owner_id = auth.uid())
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
GRANT EXECUTE ON FUNCTION public.report_pipeline_comercial TO authenticated;

-- R12 Forecast
CREATE OR REPLACE FUNCTION public.report_forecast_vendas(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_from date := COALESCE((p_filters->>'from')::date, date_trunc('month', now())::date);
  v_to date := COALESCE((p_filters->>'to')::date, (date_trunc('month', now()) + interval '1 month - 1 day')::date);
  v_admin boolean := public.bi_is_admin_or_dev();
  v_my_rep uuid := public.bi_my_sales_rep_id();
BEGIN
  RETURN (
    WITH fechado AS (
      SELECT COALESCE(SUM(net_value),0) AS valor
      FROM public.bi_sales_fact
      WHERE order_date BETWEEN v_from AND v_to AND (v_admin OR sales_rep_id = v_my_rep)
    ),
    pipeline AS (
      SELECT COALESCE(SUM(d.value * COALESCE(fsp.probability_pct,0)/100),0) AS valor_ponderado,
             COALESCE(SUM(d.value),0) AS valor_aberto
      FROM public.deals d
      LEFT JOIN public.forecast_stage_probabilities fsp ON fsp.stage = d.stage AND fsp.pipeline_id IS NULL
      WHERE d.stage NOT IN ('fechado_ganho','fechado_perdido')
        AND (v_admin OR d.owner_id = auth.uid())
    ),
    meta AS (
      SELECT COALESCE(SUM(target_value),0) AS valor
      FROM public.sales_goals
      WHERE period_start <= v_to AND period_end >= v_from
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
GRANT EXECUTE ON FUNCTION public.report_forecast_vendas TO authenticated;

-- R09 Rankings (compostos)
CREATE OR REPLACE FUNCTION public.report_rankings(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN jsonb_build_object(
    'clientes', public.report_vendas_cliente(p_filters),
    'vendedores', public.report_vendas_vendedor(p_filters),
    'produtos', public.report_vendas_produto(p_filters)
  );
END $$;
GRANT EXECUTE ON FUNCTION public.report_rankings TO authenticated;
