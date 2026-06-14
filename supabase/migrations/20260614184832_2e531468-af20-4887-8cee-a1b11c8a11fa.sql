
CREATE TYPE public.quick_quote_status AS ENUM (
  'draft','sent','approved','rejected','expired','converted'
);

-- Sequência por (tenant_id, legal_entity_id)
CREATE TABLE public.quick_quote_sequences (
  tenant_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  last_number integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, legal_entity_id)
);
GRANT SELECT ON public.quick_quote_sequences TO authenticated;
GRANT ALL ON public.quick_quote_sequences TO service_role;
ALTER TABLE public.quick_quote_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qq_seq_select_own_tenant" ON public.quick_quote_sequences
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- =====================================================
-- quick_quotes (cabeçalho)
-- =====================================================
CREATE TABLE public.quick_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL REFERENCES public.legal_entities(id) ON DELETE RESTRICT,
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE RESTRICT,
  number text,
  status public.quick_quote_status NOT NULL DEFAULT 'draft',
  validity_date date,

  client_name text NOT NULL,
  client_cnpj text,
  client_contact text,
  client_phone text,
  client_email text,
  client_notes text,

  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,

  payment_terms_free text,
  delivery_terms_free text,
  observations text,

  total_value numeric(14,2) NOT NULL DEFAULT 0,

  converted_company_id uuid,
  converted_proposal_id uuid,
  converted_at timestamptz,

  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  approved_at timestamptz,
  rejected_at timestamptz
);

CREATE INDEX idx_quick_quotes_deal_id ON public.quick_quotes(deal_id);
CREATE INDEX idx_quick_quotes_tenant ON public.quick_quotes(tenant_id);
CREATE INDEX idx_quick_quotes_company_id ON public.quick_quotes(company_id);
CREATE INDEX idx_quick_quotes_status ON public.quick_quotes(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quick_quotes TO authenticated;
GRANT ALL ON public.quick_quotes TO service_role;
ALTER TABLE public.quick_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quick_quotes_select_tenant" ON public.quick_quotes
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "quick_quotes_insert_own" ON public.quick_quotes
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    AND created_by = auth.uid()
  );

CREATE POLICY "quick_quotes_update_owner_or_admin" ON public.quick_quotes
  FOR UPDATE TO authenticated
  USING (
    tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    AND (
      created_by = auth.uid()
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'desenvolvedor')
      OR EXISTS (
        SELECT 1 FROM public.deals d
        WHERE d.id = deal_id AND d.owner_id = auth.uid()
      )
    )
  );

CREATE POLICY "quick_quotes_delete_owner_or_admin" ON public.quick_quotes
  FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'desenvolvedor')
  );

-- =====================================================
-- quick_quote_items
-- =====================================================
CREATE TABLE public.quick_quote_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quick_quotes(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,

  family_id uuid REFERENCES public.product_families(id) ON DELETE SET NULL,
  class_id  uuid REFERENCES public.product_classes(id)  ON DELETE SET NULL,
  tipo_id   uuid REFERENCES public.product_types(id)    ON DELETE SET NULL,
  grupo_id  uuid REFERENCES public.product_groups(id)   ON DELETE SET NULL,
  subgrupo_id uuid REFERENCES public.product_subgroups(id) ON DELETE SET NULL,

  description text NOT NULL,
  quantity numeric(14,4) NOT NULL DEFAULT 1,
  unit text,
  unit_price numeric(14,4) NOT NULL DEFAULT 0,
  total_price numeric(14,2) NOT NULL DEFAULT 0,
  notes text,

  converted_product_id uuid,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_quick_quote_items_quote ON public.quick_quote_items(quote_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quick_quote_items TO authenticated;
GRANT ALL ON public.quick_quote_items TO service_role;
ALTER TABLE public.quick_quote_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qq_items_select_via_parent" ON public.quick_quote_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.quick_quotes q
    WHERE q.id = quote_id
      AND q.tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  ));

CREATE POLICY "qq_items_write_via_parent" ON public.quick_quote_items
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.quick_quotes q
    WHERE q.id = quote_id
      AND q.tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
      AND (
        q.created_by = auth.uid()
        OR public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'desenvolvedor')
        OR EXISTS (SELECT 1 FROM public.deals d WHERE d.id = q.deal_id AND d.owner_id = auth.uid())
      )
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.quick_quotes q
    WHERE q.id = quote_id
      AND q.tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  ));

-- =====================================================
-- TRIGGERS
-- =====================================================
CREATE OR REPLACE FUNCTION public.quick_quote_item_compute_total()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.total_price := ROUND(COALESCE(NEW.quantity,0) * COALESCE(NEW.unit_price,0), 2);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_qq_item_compute_total
  BEFORE INSERT OR UPDATE ON public.quick_quote_items
  FOR EACH ROW EXECUTE FUNCTION public.quick_quote_item_compute_total();

CREATE OR REPLACE FUNCTION public.quick_quote_recompute_total()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_quote_id uuid;
BEGIN
  v_quote_id := COALESCE(NEW.quote_id, OLD.quote_id);
  UPDATE public.quick_quotes
  SET total_value = COALESCE((
    SELECT ROUND(SUM(total_price)::numeric, 2)
    FROM public.quick_quote_items
    WHERE quote_id = v_quote_id
  ), 0),
  updated_at = now()
  WHERE id = v_quote_id;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_qq_recompute_total
  AFTER INSERT OR UPDATE OR DELETE ON public.quick_quote_items
  FOR EACH ROW EXECUTE FUNCTION public.quick_quote_recompute_total();

CREATE OR REPLACE FUNCTION public.quick_quote_before_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_next integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.number IS NULL OR NEW.number = '' THEN
      INSERT INTO public.quick_quote_sequences (tenant_id, legal_entity_id, last_number)
      VALUES (NEW.tenant_id, NEW.legal_entity_id, 1)
      ON CONFLICT (tenant_id, legal_entity_id)
      DO UPDATE SET last_number = public.quick_quote_sequences.last_number + 1,
                    updated_at = now()
      RETURNING last_number INTO v_next;
      NEW.number := 'ORC-' || LPAD(v_next::text, 6, '0');
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status = 'sent' AND OLD.status <> 'sent' AND NEW.sent_at IS NULL THEN
    NEW.sent_at := now();
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.status = 'approved' AND OLD.status <> 'approved' AND NEW.approved_at IS NULL THEN
    NEW.approved_at := now();
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.status = 'rejected' AND OLD.status <> 'rejected' AND NEW.rejected_at IS NULL THEN
    NEW.rejected_at := now();
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_qq_before_write
  BEFORE INSERT OR UPDATE ON public.quick_quotes
  FOR EACH ROW EXECUTE FUNCTION public.quick_quote_before_write();
