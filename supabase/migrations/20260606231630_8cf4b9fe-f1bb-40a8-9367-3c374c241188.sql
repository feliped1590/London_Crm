
-- ============================================================
-- FASE 3: RESOLUTION FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION public.resolve_commission_rule(
  _tenant uuid,
  _sales_rep uuid,
  _company uuid,
  _product uuid,
  _at date DEFAULT CURRENT_DATE
)
RETURNS TABLE (rule_id uuid, default_pct numeric, max_pct numeric, base text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ctx AS (
    SELECT
      _tenant   AS tenant_id,
      _sales_rep AS sales_rep_id,
      _company   AS company_id,
      c.economic_group_id,
      _product   AS product_id,
      p.grupo_id    AS product_group_id,
      p.subgrupo_id AS product_subgroup_id
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
    -- escopo: cada coluna NULL = wildcard; coluna preenchida = precisa bater
    AND (r.sales_rep_id        IS NULL OR r.sales_rep_id        = ctx.sales_rep_id)
    AND (r.company_id          IS NULL OR r.company_id          = ctx.company_id)
    AND (r.economic_group_id   IS NULL OR r.economic_group_id   = ctx.economic_group_id)
    AND (r.product_id          IS NULL OR r.product_id          = ctx.product_id)
    AND (r.product_group_id    IS NULL OR r.product_group_id    = ctx.product_group_id)
    AND (r.product_subgroup_id IS NULL OR r.product_subgroup_id = ctx.product_subgroup_id)
  ORDER BY
    -- especificidade: mais campos preenchidos = mais específico
    ( (CASE WHEN r.sales_rep_id        IS NOT NULL THEN 1 ELSE 0 END)
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

CREATE OR REPLACE FUNCTION public.resolve_payment_terms_rule(
  _tenant uuid,
  _company uuid,
  _sales_rep uuid,
  _amount numeric,
  _at date DEFAULT CURRENT_DATE
)
RETURNS TABLE (rule_id uuid, default_template_id uuid, max_template_rank integer, level integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ctx AS (
    SELECT _tenant AS tenant_id, _company AS company_id,
           _sales_rep AS sales_rep_id, c.economic_group_id
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
      (r.level = 3 AND r.sales_rep_id      = ctx.sales_rep_id) OR
      (r.level = 4)
    )
  ORDER BY r.level ASC, r.priority DESC, r.valid_from DESC NULLS LAST
  LIMIT 1;
$$;

-- ============================================================
-- TRIGGER: snapshot de comissão por item
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_order_item_commission_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order        public.orders%ROWTYPE;
  v_rule         RECORD;
  v_base_value   numeric;
  v_applied_pct  numeric;
  v_needs        boolean := false;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = NEW.order_id;
  IF v_order.id IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO v_rule FROM public.resolve_commission_rule(
    NEW.tenant_id, v_order.sales_rep_id, v_order.company_id, NEW.product_id,
    COALESCE(NEW.item_date, CURRENT_DATE)
  );

  v_applied_pct := COALESCE(NEW.commission_pct, v_rule.default_pct);
  v_base_value  := CASE
    WHEN v_rule.base = 'bruto' THEN COALESCE(NEW.quantity,0) * COALESCE(NEW.unit_price,0)
    ELSE COALESCE(NEW.subtotal_item, NEW.subtotal, COALESCE(NEW.quantity,0) * COALESCE(NEW.unit_price,0))
  END;

  IF v_rule.max_pct IS NOT NULL AND v_applied_pct IS NOT NULL
     AND v_applied_pct > v_rule.max_pct THEN
    v_needs := true;
  END IF;

  -- Snapshot apenas quando há regra aplicável (compatibilidade com legado)
  IF v_rule.rule_id IS NOT NULL THEN
    INSERT INTO public.order_item_commission_snapshot
      (tenant_id, order_item_id, rule_id, default_pct, max_pct,
       applied_pct, base_value, commission_value, needs_approval)
    VALUES
      (NEW.tenant_id, NEW.id, v_rule.rule_id, v_rule.default_pct, v_rule.max_pct,
       v_applied_pct, v_base_value,
       ROUND(COALESCE(v_base_value,0) * COALESCE(v_applied_pct,0) / 100.0, 2),
       v_needs);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_oic_snapshot ON public.order_items;
CREATE TRIGGER trg_oic_snapshot
AFTER INSERT OR UPDATE OF product_id, quantity, unit_price, commission_pct, subtotal_item, subtotal
ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.trg_order_item_commission_snapshot();

-- ============================================================
-- TRIGGER: snapshot de condição de pagamento por pedido
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_order_payment_terms_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rule        RECORD;
  v_applied_id  uuid;
  v_applied_rk  integer;
  v_needs       boolean := false;
BEGIN
  IF NEW.company_id IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO v_rule FROM public.resolve_payment_terms_rule(
    NEW.tenant_id, NEW.company_id, NEW.sales_rep_id,
    COALESCE(NEW.total_value, 0), COALESCE(NEW.order_date, CURRENT_DATE)
  );

  -- Tentativa de identificar template aplicado pelo nome em orders.payment_terms (legado)
  SELECT id, rank INTO v_applied_id, v_applied_rk
  FROM public.payment_terms_templates
  WHERE tenant_id = NEW.tenant_id
    AND is_active = true
    AND lower(name) = lower(COALESCE(NEW.payment_terms, ''))
  LIMIT 1;

  IF v_rule.max_template_rank IS NOT NULL AND v_applied_rk IS NOT NULL
     AND v_applied_rk > v_rule.max_template_rank THEN
    v_needs := true;
  END IF;

  IF v_rule.rule_id IS NOT NULL THEN
    INSERT INTO public.order_payment_terms_snapshot
      (tenant_id, order_id, rule_id, default_template_id, max_template_rank,
       applied_template_id, applied_rank, needs_approval)
    VALUES
      (NEW.tenant_id, NEW.id, v_rule.rule_id, v_rule.default_template_id, v_rule.max_template_rank,
       v_applied_id, v_applied_rk, v_needs);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_opt_snapshot ON public.orders;
CREATE TRIGGER trg_opt_snapshot
AFTER INSERT OR UPDATE OF company_id, sales_rep_id, total_value, payment_terms, payment_method, order_date
ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.trg_order_payment_terms_snapshot();

-- ============================================================
-- APPROVAL REQUEST RPCs
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_commercial_approval_request(
  _order_id uuid,
  _order_item_id uuid,
  _request_type text,
  _justification text,
  _requested_value jsonb,
  _max_allowed jsonb,
  _rule_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
  v_id uuid;
BEGIN
  IF _request_type NOT IN ('commission','payment_terms') THEN
    RAISE EXCEPTION 'request_type inválido: %', _request_type;
  END IF;
  IF COALESCE(length(trim(_justification)), 0) < 10 THEN
    RAISE EXCEPTION 'Justificativa obrigatória (mínimo 10 caracteres)';
  END IF;

  SELECT tenant_id INTO v_tenant FROM public.orders WHERE id = _order_id;
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;

  INSERT INTO public.order_approval_requests
    (tenant_id, order_id, order_item_id, request_type, requested_by,
     justification, requested_value, max_allowed, rule_id, status)
  VALUES
    (v_tenant, _order_id, _order_item_id, _request_type, auth.uid(),
     _justification, _requested_value, _max_allowed, _rule_id, 'pending')
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_commercial_approval_request(
  _id uuid,
  _decision text,
  _notes text DEFAULT NULL,
  _approved_value jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_governance_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas Admin ou Desenvolvedor podem revisar solicitações';
  END IF;
  IF _decision NOT IN ('approved','rejected','cancelled') THEN
    RAISE EXCEPTION 'decisão inválida: %', _decision;
  END IF;

  UPDATE public.order_approval_requests
     SET status = _decision,
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         review_notes = _notes,
         approved_value = COALESCE(_approved_value, requested_value)
   WHERE id = _id
     AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação não encontrada ou já revisada';
  END IF;
END;
$$;

-- ============================================================
-- STATUS TRANSITION VALIDATOR
-- ============================================================
CREATE OR REPLACE FUNCTION public.validate_order_status_transition(
  _order_id uuid,
  _next_status text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant         uuid;
  v_pending_items  integer := 0;
  v_pending_order  integer := 0;
  v_flag_comm      boolean := true;
  v_flag_pay       boolean := true;
  v_open_requests  integer := 0;
  v_blocks         jsonb := '[]'::jsonb;
BEGIN
  SELECT tenant_id INTO v_tenant FROM public.orders WHERE id = _order_id;
  IF v_tenant IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Pedido não encontrado');
  END IF;

  -- Flags do tenant
  SELECT
    COALESCE((settings->>'commission_allow_exception')::boolean, true),
    COALESCE((settings->>'payment_terms_allow_exception')::boolean, true)
  INTO v_flag_comm, v_flag_pay
  FROM public.tenant_settings
  WHERE tenant_id = v_tenant AND category = 'commercial_governance'
  LIMIT 1;

  -- Pendências: snapshot mais recente por item/pedido com needs_approval=true e sem request aprovado
  SELECT COUNT(*) INTO v_pending_items
  FROM (
    SELECT DISTINCT ON (order_item_id) order_item_id, needs_approval
    FROM public.order_item_commission_snapshot s
    JOIN public.order_items oi ON oi.id = s.order_item_id
    WHERE oi.order_id = _order_id
    ORDER BY order_item_id, created_at DESC
  ) latest WHERE latest.needs_approval;

  SELECT COUNT(*) INTO v_pending_order
  FROM (
    SELECT needs_approval
    FROM public.order_payment_terms_snapshot
    WHERE order_id = _order_id
    ORDER BY created_at DESC
    LIMIT 1
  ) latest WHERE latest.needs_approval;

  -- Requests já abertos ainda pendentes (não bloqueiam, mas informam)
  SELECT COUNT(*) INTO v_open_requests
  FROM public.order_approval_requests
  WHERE order_id = _order_id AND status = 'pending';

  IF v_pending_items > 0 AND NOT v_flag_comm THEN
    v_blocks := v_blocks || jsonb_build_object('type','commission',
      'reason','Comissão excede limite e exceção não é permitida no tenant');
  END IF;
  IF v_pending_order > 0 AND NOT v_flag_pay THEN
    v_blocks := v_blocks || jsonb_build_object('type','payment_terms',
      'reason','Condição de pagamento excede limite e exceção não é permitida no tenant');
  END IF;

  RETURN jsonb_build_object(
    'ok',                jsonb_array_length(v_blocks) = 0,
    'next_status',       _next_status,
    'pending_items',     v_pending_items,
    'pending_order',     v_pending_order,
    'open_requests',     v_open_requests,
    'allow_commission_exception', v_flag_comm,
    'allow_payment_exception',    v_flag_pay,
    'blocks',            v_blocks,
    'requires_approval', (v_pending_items > 0 OR v_pending_order > 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_commission_rule(uuid,uuid,uuid,uuid,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_payment_terms_rule(uuid,uuid,uuid,numeric,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_commercial_approval_request(uuid,uuid,text,text,jsonb,jsonb,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_commercial_approval_request(uuid,text,text,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_order_status_transition(uuid,text) TO authenticated;
