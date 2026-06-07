
-- Fix da fase 0
ALTER FUNCTION public.touch_updated_at() SET search_path = public;

-- =========== TEAMS ===========
CREATE TABLE IF NOT EXISTS public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  legal_entity_id uuid,
  name text NOT NULL,
  manager_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT ALL ON public.teams TO service_role;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teams_read" ON public.teams FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE POLICY "teams_write" ON public.teams FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'desenvolvedor'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'desenvolvedor'::app_role));
DROP TRIGGER IF EXISTS trg_teams_updated ON public.teams;
CREATE TRIGGER trg_teams_updated BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========== SALES_TEAM_HISTORY ===========
CREATE TABLE IF NOT EXISTS public.sales_team_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  sales_rep_id uuid NOT NULL,
  team_id uuid REFERENCES public.teams(id),
  legal_entity_id uuid,
  manager_id uuid,
  start_date timestamptz NOT NULL DEFAULT now(),
  end_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sth_active_per_rep ON public.sales_team_history(sales_rep_id) WHERE end_date IS NULL;
CREATE INDEX IF NOT EXISTS idx_sth_rep_period ON public.sales_team_history(sales_rep_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_sth_team_period ON public.sales_team_history(team_id, start_date, end_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_team_history TO authenticated;
GRANT ALL ON public.sales_team_history TO service_role;
ALTER TABLE public.sales_team_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sth_read" ON public.sales_team_history FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE POLICY "sth_write" ON public.sales_team_history FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'desenvolvedor'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'desenvolvedor'::app_role));

-- Backfill: 1 registro vigente por vendedor
INSERT INTO public.sales_team_history (tenant_id, sales_rep_id, team_id, legal_entity_id, manager_id, start_date)
SELECT sr.tenant_id, sr.id, NULL, NULL, NULL, COALESCE(sr.created_at, now())
FROM public.sales_reps sr
WHERE NOT EXISTS (
  SELECT 1 FROM public.sales_team_history h WHERE h.sales_rep_id = sr.id AND h.end_date IS NULL
);

-- Função para reconstrução histórica
CREATE OR REPLACE FUNCTION public.get_sales_rep_org_at(p_sales_rep_id uuid, p_ref_date timestamptz)
RETURNS TABLE (team_id uuid, legal_entity_id uuid, manager_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT h.team_id, h.legal_entity_id, h.manager_id
  FROM public.sales_team_history h
  WHERE h.sales_rep_id = p_sales_rep_id
    AND h.start_date <= p_ref_date
    AND (h.end_date IS NULL OR h.end_date > p_ref_date)
  ORDER BY h.start_date DESC
  LIMIT 1;
$$;

-- =========== ESTRUTURA DE MARGEM ===========
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS unit_cost numeric,
  ADD COLUMN IF NOT EXISTS total_cost numeric,
  ADD COLUMN IF NOT EXISTS gross_margin_value numeric,
  ADD COLUMN IF NOT EXISTS gross_margin_percent numeric;
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS cost_value numeric,
  ADD COLUMN IF NOT EXISTS gross_margin_value numeric,
  ADD COLUMN IF NOT EXISTS gross_margin_percent numeric;
ALTER TABLE public.proposal_items
  ADD COLUMN IF NOT EXISTS unit_cost numeric,
  ADD COLUMN IF NOT EXISTS total_cost numeric,
  ADD COLUMN IF NOT EXISTS gross_margin_value numeric,
  ADD COLUMN IF NOT EXISTS gross_margin_percent numeric;
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS cost_value numeric,
  ADD COLUMN IF NOT EXISTS gross_margin_value numeric,
  ADD COLUMN IF NOT EXISTS gross_margin_percent numeric;

CREATE OR REPLACE FUNCTION public.calc_item_margin()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.unit_cost IS NOT NULL AND NEW.quantity IS NOT NULL THEN
    NEW.total_cost := NEW.unit_cost * NEW.quantity;
    IF COALESCE(NEW.total_item, NEW.subtotal_item, NEW.subtotal, 0) > 0 THEN
      NEW.gross_margin_value := COALESCE(NEW.total_item, NEW.subtotal_item, NEW.subtotal) - NEW.total_cost;
      NEW.gross_margin_percent := NEW.gross_margin_value / COALESCE(NEW.total_item, NEW.subtotal_item, NEW.subtotal) * 100;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_order_items_margin ON public.order_items;
CREATE TRIGGER trg_order_items_margin BEFORE INSERT OR UPDATE OF unit_cost, quantity, total_item, subtotal_item
  ON public.order_items FOR EACH ROW EXECUTE FUNCTION public.calc_item_margin();
DROP TRIGGER IF EXISTS trg_proposal_items_margin ON public.proposal_items;
CREATE TRIGGER trg_proposal_items_margin BEFORE INSERT OR UPDATE OF unit_cost, quantity, total_item, subtotal_item
  ON public.proposal_items FOR EACH ROW EXECUTE FUNCTION public.calc_item_margin();

-- =========== BI_SALES_FACT ===========
CREATE TABLE IF NOT EXISTS public.bi_sales_fact (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  order_id uuid NOT NULL,
  order_item_id uuid NOT NULL UNIQUE,
  order_date date,
  sales_rep_id uuid,
  team_id uuid,
  company_id uuid,
  legal_entity_id uuid,
  product_id uuid,
  product_family_id uuid,
  product_group_id uuid,
  quantity numeric,
  unit_price numeric,
  gross_value numeric,
  discount_value numeric,
  net_value numeric,
  ipi_value numeric,
  cost_value numeric,
  gross_margin_value numeric,
  gross_margin_percent numeric,
  order_status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bsf_tenant_date ON public.bi_sales_fact(tenant_id, order_date);
CREATE INDEX IF NOT EXISTS idx_bsf_tenant_rep_date ON public.bi_sales_fact(tenant_id, sales_rep_id, order_date);
CREATE INDEX IF NOT EXISTS idx_bsf_tenant_le_date ON public.bi_sales_fact(tenant_id, legal_entity_id, order_date);
CREATE INDEX IF NOT EXISTS idx_bsf_tenant_company_date ON public.bi_sales_fact(tenant_id, company_id, order_date);
CREATE INDEX IF NOT EXISTS idx_bsf_tenant_product_date ON public.bi_sales_fact(tenant_id, product_id, order_date);
CREATE INDEX IF NOT EXISTS idx_bsf_tenant_team_date ON public.bi_sales_fact(tenant_id, team_id, order_date);

GRANT SELECT ON public.bi_sales_fact TO authenticated;
GRANT ALL ON public.bi_sales_fact TO service_role;
ALTER TABLE public.bi_sales_fact ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bsf_read" ON public.bi_sales_fact FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- Fila
CREATE TABLE IF NOT EXISTS public.bi_sales_fact_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('upsert','delete')),
  enqueued_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_bsfq_pending ON public.bi_sales_fact_queue(enqueued_at) WHERE processed_at IS NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bi_sales_fact_queue TO authenticated;
GRANT ALL ON public.bi_sales_fact_queue TO service_role;
ALTER TABLE public.bi_sales_fact_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bsfq_admin" ON public.bi_sales_fact_queue FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'desenvolvedor'::app_role))
  WITH CHECK (true);

-- Triggers de enfileiramento
CREATE OR REPLACE FUNCTION public.enqueue_bi_sales_fact()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_order_id uuid; v_action text;
BEGIN
  IF TG_TABLE_NAME = 'orders' THEN
    IF TG_OP = 'DELETE' THEN v_order_id := OLD.id; v_action := 'delete';
    ELSE v_order_id := NEW.id; v_action := 'upsert'; END IF;
  ELSE
    IF TG_OP = 'DELETE' THEN v_order_id := OLD.order_id;
    ELSE v_order_id := NEW.order_id; END IF;
    v_action := 'upsert';
  END IF;
  INSERT INTO public.bi_sales_fact_queue (order_id, action) VALUES (v_order_id, v_action);
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_bsf_orders ON public.orders;
CREATE TRIGGER trg_bsf_orders AFTER INSERT OR UPDATE OR DELETE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_bi_sales_fact();
DROP TRIGGER IF EXISTS trg_bsf_order_items ON public.order_items;
CREATE TRIGGER trg_bsf_order_items AFTER INSERT OR UPDATE OR DELETE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_bi_sales_fact();

-- Função de recálculo de um order_id
CREATE OR REPLACE FUNCTION public.refresh_bi_sales_fact(p_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r_order public.orders%ROWTYPE;
BEGIN
  DELETE FROM public.bi_sales_fact WHERE order_id = p_order_id;
  SELECT * INTO r_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN RETURN; END IF;

  INSERT INTO public.bi_sales_fact (
    tenant_id, order_id, order_item_id, order_date,
    sales_rep_id, team_id, company_id, legal_entity_id,
    product_id, product_family_id, product_group_id,
    quantity, unit_price, gross_value, discount_value, net_value, ipi_value,
    cost_value, gross_margin_value, gross_margin_percent, order_status
  )
  SELECT
    r_order.tenant_id, r_order.id, oi.id, r_order.order_date,
    r_order.sales_rep_id,
    (SELECT team_id FROM public.get_sales_rep_org_at(r_order.sales_rep_id, COALESCE(r_order.order_date::timestamptz, r_order.created_at))),
    r_order.company_id, r_order.legal_entity_id,
    oi.product_id, p.family_id, p.grupo_id,
    oi.quantity, oi.unit_price,
    COALESCE(oi.subtotal, oi.quantity * oi.unit_price),
    COALESCE(oi.quantity * oi.unit_price * COALESCE(oi.discount_percent,0)/100, 0),
    COALESCE(oi.subtotal_item, oi.subtotal, oi.quantity * oi.unit_price),
    COALESCE(oi.ipi_value, 0),
    oi.total_cost, oi.gross_margin_value, oi.gross_margin_percent,
    r_order.status::text
  FROM public.order_items oi
  LEFT JOIN public.products p ON p.id = oi.product_id
  WHERE oi.order_id = p_order_id;
END $$;

-- Backfill
INSERT INTO public.bi_sales_fact_queue (order_id, action)
SELECT id, 'upsert' FROM public.orders
WHERE NOT EXISTS (SELECT 1 FROM public.bi_sales_fact_queue q WHERE q.order_id = orders.id AND q.processed_at IS NULL);

-- =========== FORECAST PROBABILITIES ===========
CREATE TABLE IF NOT EXISTS public.forecast_stage_probabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  pipeline_id uuid,
  stage text NOT NULL,
  probability_pct numeric NOT NULL CHECK (probability_pct >= 0 AND probability_pct <= 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, pipeline_id, stage)
);
GRANT SELECT ON public.forecast_stage_probabilities TO authenticated;
GRANT ALL ON public.forecast_stage_probabilities TO service_role;
ALTER TABLE public.forecast_stage_probabilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fsp_read" ON public.forecast_stage_probabilities FOR SELECT TO authenticated
  USING (tenant_id IS NULL OR tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE POLICY "fsp_write" ON public.forecast_stage_probabilities FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'desenvolvedor'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'desenvolvedor'::app_role));
DROP TRIGGER IF EXISTS trg_fsp_updated ON public.forecast_stage_probabilities;
CREATE TRIGGER trg_fsp_updated BEFORE UPDATE ON public.forecast_stage_probabilities
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.forecast_stage_probabilities (stage, probability_pct) VALUES
  ('prospeccao', 10), ('qualificacao', 25), ('proposta', 50),
  ('negociacao', 75), ('fechado_ganho', 100), ('fechado_perdido', 0)
ON CONFLICT DO NOTHING;
