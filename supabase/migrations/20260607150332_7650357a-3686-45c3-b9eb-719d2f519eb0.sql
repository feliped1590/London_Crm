-- ============================================================
-- 1. JUNCTION TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.commission_rule_sales_reps (
  rule_id      uuid NOT NULL REFERENCES public.commission_rules(id) ON DELETE CASCADE,
  sales_rep_id uuid NOT NULL REFERENCES public.sales_reps(id) ON DELETE CASCADE,
  tenant_id    uuid NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (rule_id, sales_rep_id)
);
CREATE INDEX IF NOT EXISTS idx_crsr_sales_rep ON public.commission_rule_sales_reps(sales_rep_id, rule_id);
CREATE INDEX IF NOT EXISTS idx_crsr_tenant ON public.commission_rule_sales_reps(tenant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.commission_rule_sales_reps TO authenticated;
GRANT ALL ON public.commission_rule_sales_reps TO service_role;

ALTER TABLE public.commission_rule_sales_reps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crsr_read_tenant" ON public.commission_rule_sales_reps FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE POLICY "crsr_write_admin" ON public.commission_rule_sales_reps FOR ALL TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())) AND public.is_governance_admin(auth.uid()))
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())) AND public.is_governance_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.commission_rule_legal_entities (
  rule_id         uuid NOT NULL REFERENCES public.commission_rules(id) ON DELETE CASCADE,
  legal_entity_id uuid NOT NULL REFERENCES public.legal_entities(id) ON DELETE CASCADE,
  tenant_id       uuid NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (rule_id, legal_entity_id)
);
CREATE INDEX IF NOT EXISTS idx_crle_le ON public.commission_rule_legal_entities(legal_entity_id, rule_id);
CREATE INDEX IF NOT EXISTS idx_crle_tenant ON public.commission_rule_legal_entities(tenant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.commission_rule_legal_entities TO authenticated;
GRANT ALL ON public.commission_rule_legal_entities TO service_role;

ALTER TABLE public.commission_rule_legal_entities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crle_read_tenant" ON public.commission_rule_legal_entities FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE POLICY "crle_write_admin" ON public.commission_rule_legal_entities FOR ALL TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())) AND public.is_governance_admin(auth.uid()))
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())) AND public.is_governance_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.payment_terms_rule_sales_reps (
  rule_id      uuid NOT NULL REFERENCES public.payment_terms_rules(id) ON DELETE CASCADE,
  sales_rep_id uuid NOT NULL REFERENCES public.sales_reps(id) ON DELETE CASCADE,
  tenant_id    uuid NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (rule_id, sales_rep_id)
);
CREATE INDEX IF NOT EXISTS idx_ptrsr_sales_rep ON public.payment_terms_rule_sales_reps(sales_rep_id, rule_id);
CREATE INDEX IF NOT EXISTS idx_ptrsr_tenant ON public.payment_terms_rule_sales_reps(tenant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_terms_rule_sales_reps TO authenticated;
GRANT ALL ON public.payment_terms_rule_sales_reps TO service_role;

ALTER TABLE public.payment_terms_rule_sales_reps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ptrsr_read_tenant" ON public.payment_terms_rule_sales_reps FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE POLICY "ptrsr_write_admin" ON public.payment_terms_rule_sales_reps FOR ALL TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())) AND public.is_governance_admin(auth.uid()))
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())) AND public.is_governance_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.payment_terms_rule_legal_entities (
  rule_id         uuid NOT NULL REFERENCES public.payment_terms_rules(id) ON DELETE CASCADE,
  legal_entity_id uuid NOT NULL REFERENCES public.legal_entities(id) ON DELETE CASCADE,
  tenant_id       uuid NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (rule_id, legal_entity_id)
);
CREATE INDEX IF NOT EXISTS idx_ptrle_le ON public.payment_terms_rule_legal_entities(legal_entity_id, rule_id);
CREATE INDEX IF NOT EXISTS idx_ptrle_tenant ON public.payment_terms_rule_legal_entities(tenant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_terms_rule_legal_entities TO authenticated;
GRANT ALL ON public.payment_terms_rule_legal_entities TO service_role;

ALTER TABLE public.payment_terms_rule_legal_entities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ptrle_read_tenant" ON public.payment_terms_rule_legal_entities FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE POLICY "ptrle_write_admin" ON public.payment_terms_rule_legal_entities FOR ALL TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())) AND public.is_governance_admin(auth.uid()))
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())) AND public.is_governance_admin(auth.uid()));

-- ============================================================
-- 2. BACKFILL
-- ============================================================

-- Backfill vendedores a partir da coluna singular legada
INSERT INTO public.commission_rule_sales_reps (rule_id, sales_rep_id, tenant_id)
SELECT id, sales_rep_id, tenant_id FROM public.commission_rules WHERE sales_rep_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.payment_terms_rule_sales_reps (rule_id, sales_rep_id, tenant_id)
SELECT id, sales_rep_id, tenant_id FROM public.payment_terms_rules WHERE sales_rep_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Backfill entidades jurídicas: regras existentes ficam vinculadas a todas as entidades ativas do tenant
INSERT INTO public.commission_rule_legal_entities (rule_id, legal_entity_id, tenant_id)
SELECT r.id, le.id, r.tenant_id
FROM public.commission_rules r
JOIN public.legal_entities le ON le.tenant_id = r.tenant_id AND le.active = true
ON CONFLICT DO NOTHING;

INSERT INTO public.payment_terms_rule_legal_entities (rule_id, legal_entity_id, tenant_id)
SELECT r.id, le.id, r.tenant_id
FROM public.payment_terms_rules r
JOIN public.legal_entities le ON le.tenant_id = r.tenant_id AND le.active = true
ON CONFLICT DO NOTHING;

-- ============================================================
-- 3. INTEGRITY TRIGGERS
-- ============================================================

-- Bloqueia delete da última entidade vinculada de uma regra ativa
CREATE OR REPLACE FUNCTION public.governance_block_last_legal_entity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rule_active boolean;
  v_remaining int;
BEGIN
  IF TG_TABLE_NAME = 'commission_rule_legal_entities' THEN
    SELECT is_active INTO v_rule_active FROM public.commission_rules WHERE id = OLD.rule_id;
    IF v_rule_active IS NULL THEN RETURN OLD; END IF;
    SELECT count(*) INTO v_remaining FROM public.commission_rule_legal_entities
      WHERE rule_id = OLD.rule_id AND legal_entity_id <> OLD.legal_entity_id;
  ELSE
    SELECT is_active INTO v_rule_active FROM public.payment_terms_rules WHERE id = OLD.rule_id;
    IF v_rule_active IS NULL THEN RETURN OLD; END IF;
    SELECT count(*) INTO v_remaining FROM public.payment_terms_rule_legal_entities
      WHERE rule_id = OLD.rule_id AND legal_entity_id <> OLD.legal_entity_id;
  END IF;

  IF v_rule_active AND v_remaining = 0 THEN
    RAISE EXCEPTION 'Regra ativa precisa ter ao menos uma entidade jurídica vinculada (rule_id=%)', OLD.rule_id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_crle_block_last ON public.commission_rule_legal_entities;
CREATE TRIGGER trg_crle_block_last
  BEFORE DELETE ON public.commission_rule_legal_entities
  FOR EACH ROW EXECUTE FUNCTION public.governance_block_last_legal_entity();

DROP TRIGGER IF EXISTS trg_ptrle_block_last ON public.payment_terms_rule_legal_entities;
CREATE TRIGGER trg_ptrle_block_last
  BEFORE DELETE ON public.payment_terms_rule_legal_entities
  FOR EACH ROW EXECUTE FUNCTION public.governance_block_last_legal_entity();

-- Bloqueia ativar regra sem entidade vinculada
CREATE OR REPLACE FUNCTION public.governance_require_legal_entity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  IF NEW.is_active IS DISTINCT FROM true THEN
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME = 'commission_rules' THEN
    SELECT count(*) INTO v_count FROM public.commission_rule_legal_entities WHERE rule_id = NEW.id;
  ELSE
    SELECT count(*) INTO v_count FROM public.payment_terms_rule_legal_entities WHERE rule_id = NEW.id;
  END IF;
  IF v_count = 0 THEN
    RAISE EXCEPTION 'Regra ativa precisa ter ao menos uma entidade jurídica vinculada (rule_id=%)', NEW.id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

-- AFTER trigger para permitir INSERT da regra + INSERT na junction na mesma transação;
-- ativamos depois de update e em insert quando is_active=true.
DROP TRIGGER IF EXISTS trg_cr_require_le ON public.commission_rules;
CREATE CONSTRAINT TRIGGER trg_cr_require_le
  AFTER INSERT OR UPDATE OF is_active ON public.commission_rules
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.governance_require_legal_entity();

DROP TRIGGER IF EXISTS trg_ptr_require_le ON public.payment_terms_rules;
CREATE CONSTRAINT TRIGGER trg_ptr_require_le
  AFTER INSERT OR UPDATE OF is_active ON public.payment_terms_rules
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.governance_require_legal_entity();

-- ============================================================
-- 4. RESOLVERS (drop + recreate com novo arg)
-- ============================================================

DROP FUNCTION IF EXISTS public.resolve_commission_rule(uuid,uuid,uuid,uuid,date);
CREATE OR REPLACE FUNCTION public.resolve_commission_rule(
  _tenant uuid,
  _sales_rep uuid,
  _company uuid,
  _product uuid,
  _at date DEFAULT CURRENT_DATE,
  _legal_entity uuid DEFAULT NULL
)
RETURNS TABLE(rule_id uuid, default_pct numeric, max_pct numeric, base text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH ctx AS (
    SELECT
      _tenant AS tenant_id,
      _sales_rep AS sales_rep_id,
      _company   AS company_id,
      c.economic_group_id,
      _product   AS product_id,
      p.grupo_id    AS product_group_id,
      p.subgrupo_id AS product_subgroup_id,
      _legal_entity AS legal_entity_id
    FROM (SELECT 1) x
    LEFT JOIN public.companies c ON c.id = _company
    LEFT JOIN public.products  p ON p.id = _product
  )
  SELECT r.id, r.default_pct, r.max_pct, r.base
  FROM public.commission_rules r, ctx
  WHERE r.tenant_id = ctx.tenant_id
    AND r.is_active = true
    AND (r.valid_from  IS NULL OR r.valid_from  <= _at)
    AND (r.valid_until IS NULL OR r.valid_until >= _at)
    AND (r.company_id          IS NULL OR r.company_id          = ctx.company_id)
    AND (r.economic_group_id   IS NULL OR r.economic_group_id   = ctx.economic_group_id)
    AND (r.product_id          IS NULL OR r.product_id          = ctx.product_id)
    AND (r.product_group_id    IS NULL OR r.product_group_id    = ctx.product_group_id)
    AND (r.product_subgroup_id IS NULL OR r.product_subgroup_id = ctx.product_subgroup_id)
    -- vendedor via junction (sem linhas = todos)
    AND (
      NOT EXISTS (SELECT 1 FROM public.commission_rule_sales_reps s WHERE s.rule_id = r.id)
      OR EXISTS (SELECT 1 FROM public.commission_rule_sales_reps s
                 WHERE s.rule_id = r.id AND s.sales_rep_id = ctx.sales_rep_id)
    )
    -- entidade jurídica: filtro só se contexto informou _legal_entity
    AND (
      ctx.legal_entity_id IS NULL
      OR EXISTS (SELECT 1 FROM public.commission_rule_legal_entities x
                 WHERE x.rule_id = r.id AND x.legal_entity_id = ctx.legal_entity_id)
    )
  ORDER BY
    ( (CASE WHEN EXISTS (SELECT 1 FROM public.commission_rule_sales_reps s WHERE s.rule_id = r.id) THEN 1 ELSE 0 END)
    + (CASE WHEN r.company_id          IS NOT NULL THEN 1 ELSE 0 END)
    + (CASE WHEN r.economic_group_id   IS NOT NULL THEN 1 ELSE 0 END)
    + (CASE WHEN r.product_id          IS NOT NULL THEN 2 ELSE 0 END)
    + (CASE WHEN r.product_subgroup_id IS NOT NULL THEN 1 ELSE 0 END)
    + (CASE WHEN r.product_group_id    IS NOT NULL THEN 1 ELSE 0 END)
    ) DESC,
    r.priority DESC,
    r.valid_from DESC NULLS LAST
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_commission_rule(uuid,uuid,uuid,uuid,date,uuid) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.resolve_payment_terms_rule(uuid,uuid,uuid,numeric,date);
CREATE OR REPLACE FUNCTION public.resolve_payment_terms_rule(
  _tenant uuid,
  _company uuid,
  _sales_rep uuid,
  _amount numeric,
  _at date DEFAULT CURRENT_DATE,
  _legal_entity uuid DEFAULT NULL
)
RETURNS TABLE(rule_id uuid, default_template_id uuid, max_template_rank integer, level integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH ctx AS (
    SELECT _tenant AS tenant_id, _company AS company_id,
           _sales_rep AS sales_rep_id, c.economic_group_id,
           _legal_entity AS legal_entity_id
    FROM (SELECT 1) x
    LEFT JOIN public.companies c ON c.id = _company
  )
  SELECT r.id, r.default_template_id, r.max_template_rank, r.level
  FROM public.payment_terms_rules r, ctx
  WHERE r.tenant_id = ctx.tenant_id
    AND r.is_active = true
    AND (r.valid_from  IS NULL OR r.valid_from  <= _at)
    AND (r.valid_until IS NULL OR r.valid_until >= _at)
    AND COALESCE(_amount, 0) >= r.amount_min
    AND (r.amount_max IS NULL OR COALESCE(_amount, 0) <= r.amount_max)
    AND (
      (r.level = 1 AND r.company_id        = ctx.company_id) OR
      (r.level = 2 AND r.economic_group_id = ctx.economic_group_id) OR
      (r.level = 3 AND EXISTS (
        SELECT 1 FROM public.payment_terms_rule_sales_reps s
        WHERE s.rule_id = r.id AND s.sales_rep_id = ctx.sales_rep_id
      )) OR
      (r.level = 4)
    )
    AND (
      ctx.legal_entity_id IS NULL
      OR EXISTS (SELECT 1 FROM public.payment_terms_rule_legal_entities x
                 WHERE x.rule_id = r.id AND x.legal_entity_id = ctx.legal_entity_id)
    )
  ORDER BY r.level ASC, r.priority DESC, r.valid_from DESC NULLS LAST
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_payment_terms_rule(uuid,uuid,uuid,numeric,date,uuid) TO authenticated, service_role;
