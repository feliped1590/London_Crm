
-- =============================================
-- FASE 5A-1: Delegação de Gestão de Carteira
-- =============================================

-- 1. Tabela de delegações
CREATE TABLE public.user_portfolio_delegations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  manager_user_id UUID NOT NULL REFERENCES profiles(user_id),
  portfolio_owner_id UUID NOT NULL REFERENCES profiles(user_id),
  can_manage_companies BOOLEAN NOT NULL DEFAULT true,
  can_manage_contacts BOOLEAN NOT NULL DEFAULT true,
  can_manage_deals BOOLEAN NOT NULL DEFAULT true,
  can_manage_orders BOOLEAN NOT NULL DEFAULT true,
  can_manage_pipeline BOOLEAN NOT NULL DEFAULT true,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES profiles(user_id),
  CONSTRAINT no_self_delegation CHECK (manager_user_id != portfolio_owner_id),
  CONSTRAINT unique_delegation UNIQUE (tenant_id, manager_user_id, portfolio_owner_id)
);

-- 2. Índices parciais para performance
CREATE INDEX idx_delegations_manager ON user_portfolio_delegations(manager_user_id) WHERE active = true;
CREATE INDEX idx_delegations_owner ON user_portfolio_delegations(portfolio_owner_id) WHERE active = true;
CREATE INDEX idx_delegations_tenant_active ON user_portfolio_delegations(tenant_id, active) WHERE active = true;

-- 3. Trigger de validação cross-tenant
CREATE OR REPLACE FUNCTION public.validate_delegation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_tenants WHERE user_id = NEW.manager_user_id AND tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'Gestor não pertence ao tenant informado';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM user_tenants WHERE user_id = NEW.portfolio_owner_id AND tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'Dono da carteira não pertence ao tenant informado';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_delegation
  BEFORE INSERT OR UPDATE ON user_portfolio_delegations
  FOR EACH ROW EXECUTE FUNCTION validate_delegation();

-- 4. Função can_manage_portfolio (sem redundância de tenant)
CREATE OR REPLACE FUNCTION public.can_manage_portfolio(
  p_user_id UUID,
  p_owner_id UUID,
  p_entity_type TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id = p_owner_id THEN
    RETURN TRUE;
  END IF;

  IF public.has_role(p_user_id, 'admin') THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM user_portfolio_delegations
    WHERE manager_user_id = p_user_id
      AND portfolio_owner_id = p_owner_id
      AND active = true
      AND (
        p_entity_type IS NULL
        OR (p_entity_type = 'company' AND can_manage_companies)
        OR (p_entity_type = 'contact' AND can_manage_contacts)
        OR (p_entity_type = 'deal' AND can_manage_deals)
        OR (p_entity_type = 'order' AND can_manage_orders)
        OR (p_entity_type = 'pipeline' AND can_manage_pipeline)
      )
  );
END;
$$;

-- 5. Função auxiliar get_company_owner (para policies de orders)
CREATE OR REPLACE FUNCTION public.get_company_owner(p_company_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT owner_id FROM companies WHERE id = p_company_id;
$$;

-- 6. RLS da tabela de delegações (separada por operação)
ALTER TABLE user_portfolio_delegations ENABLE ROW LEVEL SECURITY;

-- Tenant isolation
CREATE POLICY "tenant_isolation_delegations" ON user_portfolio_delegations
  FOR ALL TO public
  USING (tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()));

-- SELECT: admin vê tudo do tenant, manager vê suas delegações
CREATE POLICY "admin_view_delegations" ON user_portfolio_delegations
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "manager_view_own_delegations" ON user_portfolio_delegations
  FOR SELECT TO authenticated
  USING (manager_user_id = auth.uid());

-- Owner pode ver delegações sobre sua carteira
CREATE POLICY "owner_view_delegations" ON user_portfolio_delegations
  FOR SELECT TO authenticated
  USING (portfolio_owner_id = auth.uid());

-- INSERT: apenas admin
CREATE POLICY "admin_insert_delegations" ON user_portfolio_delegations
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- UPDATE: apenas admin
CREATE POLICY "admin_update_delegations" ON user_portfolio_delegations
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- DELETE: apenas admin
CREATE POLICY "admin_delete_delegations" ON user_portfolio_delegations
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));
