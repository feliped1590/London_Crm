
-- Tabela de condições de pagamento dos pedidos
CREATE TABLE public.order_payment_conditions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  parcela INTEGER NOT NULL CHECK (parcela > 0),
  dias INTEGER NOT NULL DEFAULT 0 CHECK (dias >= 0),
  payment_method TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('V','P')),
  valor NUMERIC(14,2),
  percentual NUMERIC(7,4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (order_id, parcela)
);

CREATE INDEX idx_order_payment_conditions_order ON public.order_payment_conditions(order_id);
CREATE INDEX idx_order_payment_conditions_tenant ON public.order_payment_conditions(tenant_id);

ALTER TABLE public.order_payment_conditions ENABLE ROW LEVEL SECURITY;

-- SELECT: qualquer um do tenant que enxergue o pedido
CREATE POLICY "select_order_payment_conditions"
  ON public.order_payment_conditions FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id)
  );

-- INSERT/UPDATE/DELETE: quem puder editar o pedido
CREATE POLICY "insert_order_payment_conditions"
  ON public.order_payment_conditions FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id
        AND public.can_access_legal_entity(auth.uid(), o.legal_entity_id)
    )
  );

CREATE POLICY "update_order_payment_conditions"
  ON public.order_payment_conditions FOR UPDATE
  TO authenticated
  USING (
    tenant_id IN (SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id
        AND public.can_access_legal_entity(auth.uid(), o.legal_entity_id)
    )
  );

CREATE POLICY "delete_order_payment_conditions"
  ON public.order_payment_conditions FOR DELETE
  TO authenticated
  USING (
    tenant_id IN (SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id
        AND public.can_access_legal_entity(auth.uid(), o.legal_entity_id)
    )
  );

CREATE TRIGGER trg_order_payment_conditions_updated_at
  BEFORE UPDATE ON public.order_payment_conditions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de condições de pagamento das propostas
CREATE TABLE public.proposal_payment_conditions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  parcela INTEGER NOT NULL CHECK (parcela > 0),
  dias INTEGER NOT NULL DEFAULT 0 CHECK (dias >= 0),
  payment_method TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('V','P')),
  valor NUMERIC(14,2),
  percentual NUMERIC(7,4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (proposal_id, parcela)
);

CREATE INDEX idx_proposal_payment_conditions_proposal ON public.proposal_payment_conditions(proposal_id);
CREATE INDEX idx_proposal_payment_conditions_tenant ON public.proposal_payment_conditions(tenant_id);

ALTER TABLE public.proposal_payment_conditions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_proposal_payment_conditions"
  ON public.proposal_payment_conditions FOR ALL
  TO authenticated
  USING (
    tenant_id IN (SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid())
  );

CREATE TRIGGER trg_proposal_payment_conditions_updated_at
  BEFORE UPDATE ON public.proposal_payment_conditions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
