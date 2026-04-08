
-- =============================================
-- 1. freight_type_erp_mapping
-- =============================================
CREATE TABLE public.freight_type_erp_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  crm_freight_type TEXT NOT NULL,
  erp_freight_code TEXT NOT NULL,
  erp_freight_description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, crm_freight_type)
);

ALTER TABLE public.freight_type_erp_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view freight mappings"
  ON public.freight_type_erp_mapping FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can manage freight mappings"
  ON public.freight_type_erp_mapping FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- =============================================
-- 2. sale_type_erp_mapping
-- =============================================
CREATE TABLE public.sale_type_erp_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  crm_sale_type TEXT NOT NULL,
  erp_sale_type_code INTEGER NOT NULL,
  erp_sale_type_description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, crm_sale_type)
);

ALTER TABLE public.sale_type_erp_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view sale type mappings"
  ON public.sale_type_erp_mapping FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can manage sale type mappings"
  ON public.sale_type_erp_mapping FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- =============================================
-- 3. payment_method_erp_mapping
-- =============================================
CREATE TABLE public.payment_method_erp_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  crm_payment_method TEXT NOT NULL,
  erp_payment_code INTEGER NOT NULL,
  erp_payment_description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, crm_payment_method)
);

ALTER TABLE public.payment_method_erp_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view payment method mappings"
  ON public.payment_method_erp_mapping FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can manage payment method mappings"
  ON public.payment_method_erp_mapping FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- =============================================
-- 4. New columns on existing tables
-- =============================================
ALTER TABLE public.sales_reps ADD COLUMN IF NOT EXISTS erp_vendor_code INTEGER;

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_terms TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS sales_rep_id UUID REFERENCES public.sales_reps(id);

ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS sale_type TEXT DEFAULT 'venda_tributada';
