
-- Helper admin/dev
CREATE OR REPLACE FUNCTION public.is_governance_admin(_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(_user, 'admin'::app_role)
      OR public.has_role(_user, 'desenvolvedor'::app_role);
$$;

-- ============ 1. commission_rules ============
CREATE TABLE public.commission_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 0,
  valid_from date,
  valid_until date,
  sales_rep_id uuid,
  company_id uuid,
  economic_group_id uuid,
  product_id uuid,
  product_group_id uuid,
  product_subgroup_id uuid,
  base text NOT NULL DEFAULT 'liquido' CHECK (base IN ('liquido','bruto')),
  default_pct numeric(6,3) NOT NULL CHECK (default_pct >= 0 AND default_pct <= 100),
  max_pct numeric(6,3) NOT NULL CHECK (max_pct >= 0 AND max_pct <= 100),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commission_rules_max_gte_default CHECK (max_pct >= default_pct)
);
CREATE INDEX idx_commission_rules_tenant_active ON public.commission_rules(tenant_id, is_active);
CREATE INDEX idx_commission_rules_resolution ON public.commission_rules(tenant_id, sales_rep_id, company_id, product_id, priority DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commission_rules TO authenticated;
GRANT ALL ON public.commission_rules TO service_role;
ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "commission_rules_read_tenant" ON public.commission_rules FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE POLICY "commission_rules_write_admin" ON public.commission_rules FOR ALL TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())) AND public.is_governance_admin(auth.uid()))
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())) AND public.is_governance_admin(auth.uid()));
CREATE TRIGGER trg_commission_rules_updated_at BEFORE UPDATE ON public.commission_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ 2. payment_terms_templates ============
CREATE TABLE public.payment_terms_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  rank integer NOT NULL CHECK (rank >= 0),
  is_active boolean NOT NULL DEFAULT true,
  valid_from date,
  valid_until date,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payment_terms_templates_tenant ON public.payment_terms_templates(tenant_id, is_active, rank);
CREATE UNIQUE INDEX uq_payment_terms_templates_tenant_name ON public.payment_terms_templates(tenant_id, lower(name)) WHERE is_active;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_terms_templates TO authenticated;
GRANT ALL ON public.payment_terms_templates TO service_role;
ALTER TABLE public.payment_terms_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ptt_read_tenant" ON public.payment_terms_templates FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE POLICY "ptt_write_admin" ON public.payment_terms_templates FOR ALL TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())) AND public.is_governance_admin(auth.uid()))
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())) AND public.is_governance_admin(auth.uid()));
CREATE TRIGGER trg_ptt_updated_at BEFORE UPDATE ON public.payment_terms_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ 3. payment_terms_template_items ============
CREATE TABLE public.payment_terms_template_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.payment_terms_templates(id) ON DELETE CASCADE,
  parcela integer NOT NULL CHECK (parcela > 0),
  dias integer NOT NULL CHECK (dias >= 0),
  payment_method_default text,
  tipo text NOT NULL DEFAULT 'P' CHECK (tipo IN ('V','P')),
  percentual numeric(6,3),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, parcela)
);
CREATE INDEX idx_ptti_template ON public.payment_terms_template_items(template_id, parcela);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_terms_template_items TO authenticated;
GRANT ALL ON public.payment_terms_template_items TO service_role;
ALTER TABLE public.payment_terms_template_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ptti_read_tenant" ON public.payment_terms_template_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.payment_terms_templates t WHERE t.id = template_id
    AND t.tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))));
CREATE POLICY "ptti_write_admin" ON public.payment_terms_template_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.payment_terms_templates t WHERE t.id = template_id
    AND t.tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())) AND public.is_governance_admin(auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.payment_terms_templates t WHERE t.id = template_id
    AND t.tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())) AND public.is_governance_admin(auth.uid())));

-- ============ 4. payment_terms_rules ============
CREATE TABLE public.payment_terms_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  level integer NOT NULL CHECK (level BETWEEN 1 AND 4),
  priority integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  valid_from date,
  valid_until date,
  amount_min numeric(14,2) NOT NULL DEFAULT 0,
  amount_max numeric(14,2),
  company_id uuid,
  economic_group_id uuid,
  sales_rep_id uuid,
  default_template_id uuid NOT NULL REFERENCES public.payment_terms_templates(id) ON DELETE RESTRICT,
  max_template_rank integer NOT NULL CHECK (max_template_rank >= 0),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ptr_amount_range CHECK (amount_max IS NULL OR amount_max >= amount_min),
  CONSTRAINT ptr_level_target CHECK (
    (level = 1 AND company_id IS NOT NULL) OR
    (level = 2 AND economic_group_id IS NOT NULL) OR
    (level = 3 AND sales_rep_id IS NOT NULL) OR
    (level = 4)
  )
);
CREATE INDEX idx_ptr_tenant_level ON public.payment_terms_rules(tenant_id, is_active, level, priority DESC);
CREATE INDEX idx_ptr_company ON public.payment_terms_rules(tenant_id, company_id) WHERE company_id IS NOT NULL;
CREATE INDEX idx_ptr_econ_group ON public.payment_terms_rules(tenant_id, economic_group_id) WHERE economic_group_id IS NOT NULL;
CREATE INDEX idx_ptr_sales_rep ON public.payment_terms_rules(tenant_id, sales_rep_id) WHERE sales_rep_id IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_terms_rules TO authenticated;
GRANT ALL ON public.payment_terms_rules TO service_role;
ALTER TABLE public.payment_terms_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ptr_read_tenant" ON public.payment_terms_rules FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE POLICY "ptr_write_admin" ON public.payment_terms_rules FOR ALL TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())) AND public.is_governance_admin(auth.uid()))
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())) AND public.is_governance_admin(auth.uid()));
CREATE TRIGGER trg_ptr_updated_at BEFORE UPDATE ON public.payment_terms_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ 5. order_item_commission_snapshot ============
CREATE TABLE public.order_item_commission_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  order_item_id uuid NOT NULL,
  rule_id uuid,
  default_pct numeric(6,3),
  max_pct numeric(6,3),
  applied_pct numeric(6,3),
  base_value numeric(14,2),
  commission_value numeric(14,2),
  needs_approval boolean NOT NULL DEFAULT false,
  approval_request_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_oics_order_item ON public.order_item_commission_snapshot(order_item_id, created_at DESC);
CREATE INDEX idx_oics_tenant_needs ON public.order_item_commission_snapshot(tenant_id) WHERE needs_approval;
GRANT SELECT ON public.order_item_commission_snapshot TO authenticated;
GRANT ALL ON public.order_item_commission_snapshot TO service_role;
ALTER TABLE public.order_item_commission_snapshot ENABLE ROW LEVEL SECURITY;
CREATE POLICY "oics_read_tenant" ON public.order_item_commission_snapshot FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- ============ 6. order_payment_terms_snapshot ============
CREATE TABLE public.order_payment_terms_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  order_id uuid NOT NULL,
  rule_id uuid,
  default_template_id uuid,
  max_template_rank integer,
  applied_template_id uuid,
  applied_rank integer,
  needs_approval boolean NOT NULL DEFAULT false,
  approval_request_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_opts_order ON public.order_payment_terms_snapshot(order_id, created_at DESC);
CREATE INDEX idx_opts_tenant_needs ON public.order_payment_terms_snapshot(tenant_id) WHERE needs_approval;
GRANT SELECT ON public.order_payment_terms_snapshot TO authenticated;
GRANT ALL ON public.order_payment_terms_snapshot TO service_role;
ALTER TABLE public.order_payment_terms_snapshot ENABLE ROW LEVEL SECURITY;
CREATE POLICY "opts_read_tenant" ON public.order_payment_terms_snapshot FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- ============ 7. order_approval_requests ============
CREATE TABLE public.order_approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  order_id uuid NOT NULL,
  order_item_id uuid,
  request_type text NOT NULL CHECK (request_type IN ('commission','payment_terms')),
  requested_by uuid NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  justification text NOT NULL,
  requested_value jsonb NOT NULL,
  max_allowed jsonb NOT NULL,
  rule_id uuid,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_notes text,
  approved_value jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_oar_tenant_status ON public.order_approval_requests(tenant_id, status, requested_at DESC);
CREATE INDEX idx_oar_order ON public.order_approval_requests(order_id);
CREATE INDEX idx_oar_pending ON public.order_approval_requests(tenant_id, requested_at) WHERE status = 'pending';
GRANT SELECT, INSERT, UPDATE ON public.order_approval_requests TO authenticated;
GRANT ALL ON public.order_approval_requests TO service_role;
ALTER TABLE public.order_approval_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "oar_read_tenant" ON public.order_approval_requests FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE POLICY "oar_insert_self" ON public.order_approval_requests FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    AND requested_by = auth.uid()
    AND status = 'pending'
  );
CREATE POLICY "oar_update_admin" ON public.order_approval_requests FOR UPDATE TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())) AND public.is_governance_admin(auth.uid()))
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())) AND public.is_governance_admin(auth.uid()));
CREATE TRIGGER trg_oar_updated_at BEFORE UPDATE ON public.order_approval_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
