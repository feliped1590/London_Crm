
-- =============================================
-- FASE 4E: MULTI-CNPJ (legal_entities)
-- =============================================

-- 1. Tabela legal_entities
CREATE TABLE public.legal_entities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  name TEXT NOT NULL,
  trade_name TEXT,
  cnpj TEXT NOT NULL,
  is_headquarters BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  erp_company_code TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  phone TEXT,
  email TEXT,
  inscricao_estadual TEXT,
  inscricao_municipal TEXT,
  regime_tributario TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_legal_entities_tenant_cnpj UNIQUE (tenant_id, cnpj)
);

-- Índice parcial único para erp_company_code por tenant
CREATE UNIQUE INDEX uq_legal_entities_tenant_erp_code
  ON public.legal_entities (tenant_id, erp_company_code)
  WHERE erp_company_code IS NOT NULL;

-- Índice para listagem rápida
CREATE INDEX idx_legal_entities_tenant_active
  ON public.legal_entities (tenant_id) WHERE active = true;

-- Trigger updated_at
CREATE TRIGGER update_legal_entities_updated_at
  BEFORE UPDATE ON public.legal_entities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.legal_entities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view legal entities of their tenants"
  ON public.legal_entities FOR SELECT
  USING (tenant_id IN (SELECT ut.tenant_id FROM public.user_tenants ut WHERE ut.user_id = auth.uid()));

CREATE POLICY "Admins can insert legal entities"
  ON public.legal_entities FOR INSERT
  WITH CHECK (
    tenant_id IN (SELECT ut.tenant_id FROM public.user_tenants ut WHERE ut.user_id = auth.uid())
    AND public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins can update legal entities"
  ON public.legal_entities FOR UPDATE
  USING (
    tenant_id IN (SELECT ut.tenant_id FROM public.user_tenants ut WHERE ut.user_id = auth.uid())
    AND public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins can delete legal entities"
  ON public.legal_entities FOR DELETE
  USING (
    tenant_id IN (SELECT ut.tenant_id FROM public.user_tenants ut WHERE ut.user_id = auth.uid())
    AND public.has_role(auth.uid(), 'admin')
  );

-- 2. ALTER orders: adicionar legal_entity_id (nullable - Etapa 1)
ALTER TABLE public.orders
  ADD COLUMN legal_entity_id UUID REFERENCES public.legal_entities(id);

-- Índice tenant-scoped
CREATE INDEX idx_orders_tenant_legal_entity
  ON public.orders (tenant_id, legal_entity_id)
  WHERE legal_entity_id IS NOT NULL;

-- 3. ALTER profiles: adicionar active_legal_entity_id
ALTER TABLE public.profiles
  ADD COLUMN active_legal_entity_id UUID REFERENCES public.legal_entities(id);

-- 4. ALTER proposals: adicionar legal_entity_id
ALTER TABLE public.proposals
  ADD COLUMN legal_entity_id UUID REFERENCES public.legal_entities(id);

-- 5. Trigger: validar que legal_entity_id pertence ao mesmo tenant do pedido
CREATE OR REPLACE FUNCTION public.validate_order_legal_entity_tenant()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_le_tenant UUID;
BEGIN
  IF NEW.legal_entity_id IS NOT NULL THEN
    SELECT tenant_id INTO v_le_tenant
    FROM public.legal_entities
    WHERE id = NEW.legal_entity_id;

    IF v_le_tenant IS NULL THEN
      RAISE EXCEPTION 'Entidade jurídica % não encontrada.', NEW.legal_entity_id;
    END IF;

    IF v_le_tenant != NEW.tenant_id THEN
      RAISE EXCEPTION 'Entidade jurídica % não pertence ao tenant do pedido.', NEW.legal_entity_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_order_legal_entity
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.validate_order_legal_entity_tenant();

-- 6. Trigger: validar active_legal_entity_id em profiles pertence ao tenant do usuário
CREATE OR REPLACE FUNCTION public.validate_profile_legal_entity()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_le_tenant UUID;
  v_user_has_tenant BOOLEAN;
BEGIN
  IF NEW.active_legal_entity_id IS NOT NULL THEN
    SELECT tenant_id INTO v_le_tenant
    FROM public.legal_entities
    WHERE id = NEW.active_legal_entity_id;

    IF v_le_tenant IS NULL THEN
      RAISE EXCEPTION 'Entidade jurídica % não encontrada.', NEW.active_legal_entity_id;
    END IF;

    SELECT EXISTS(
      SELECT 1 FROM public.user_tenants
      WHERE user_id = NEW.user_id AND tenant_id = v_le_tenant
    ) INTO v_user_has_tenant;

    IF NOT v_user_has_tenant THEN
      RAISE EXCEPTION 'Entidade jurídica % não pertence a nenhum tenant do usuário.', NEW.active_legal_entity_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_profile_legal_entity
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.validate_profile_legal_entity();

-- 7. Comentários arquiteturais
COMMENT ON COLUMN public.orders.legal_entity_id IS 
  'CNPJ emissor do pedido. Nullable na Etapa 1 (retrocompatibilidade). Etapa 2: ALTER COLUMN legal_entity_id SET NOT NULL após migração manual dos pedidos legados e atualização da UI.';

COMMENT ON TABLE public.legal_entities IS 
  'Entidades jurídicas (CNPJs) do grupo econômico dentro de um tenant. Nota futura: se regras de comissão variarem por CNPJ emissor, o campo legal_entity_id em orders deve ser considerado nas consultas de comissão.';
