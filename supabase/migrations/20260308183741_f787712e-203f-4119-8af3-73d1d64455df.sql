
-- =============================================
-- LOGÍSTICA COMERCIAL
-- =============================================

-- 1. Tabela carriers
CREATE TABLE public.carriers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id),
  name TEXT NOT NULL,
  trade_name TEXT,
  cnpj TEXT,
  ie TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  address_number TEXT,
  neighborhood TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_carriers_tenant ON public.carriers(tenant_id);
CREATE INDEX idx_carriers_active ON public.carriers(active);

ALTER TABLE public.carriers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "carriers_select" ON public.carriers FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid()));

CREATE POLICY "carriers_insert" ON public.carriers FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "carriers_update" ON public.carriers FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "carriers_delete" ON public.carriers FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2. Transportadora padrão do cliente
ALTER TABLE public.companies ADD COLUMN default_carrier_id UUID REFERENCES public.carriers(id) ON DELETE SET NULL;

-- 3. Campos de logística em proposals (freight_type as TEXT)
ALTER TABLE public.proposals
  ADD COLUMN carrier_id UUID REFERENCES public.carriers(id),
  ADD COLUMN freight_type TEXT,
  ADD COLUMN delivery_same_as_company BOOLEAN DEFAULT true,
  ADD COLUMN delivery_name TEXT,
  ADD COLUMN delivery_address TEXT,
  ADD COLUMN delivery_number TEXT,
  ADD COLUMN delivery_neighborhood TEXT,
  ADD COLUMN delivery_city TEXT,
  ADD COLUMN delivery_state TEXT,
  ADD COLUMN delivery_zip_code TEXT,
  ADD COLUMN delivery_contact TEXT;

-- 4. Campos de logística em orders (freight_type already exists as TEXT)
ALTER TABLE public.orders
  ADD COLUMN carrier_id UUID REFERENCES public.carriers(id),
  ADD COLUMN delivery_same_as_company BOOLEAN DEFAULT true,
  ADD COLUMN delivery_name TEXT,
  ADD COLUMN delivery_address TEXT,
  ADD COLUMN delivery_number TEXT,
  ADD COLUMN delivery_neighborhood TEXT,
  ADD COLUMN delivery_city TEXT,
  ADD COLUMN delivery_state TEXT,
  ADD COLUMN delivery_zip_code TEXT,
  ADD COLUMN delivery_contact TEXT;
