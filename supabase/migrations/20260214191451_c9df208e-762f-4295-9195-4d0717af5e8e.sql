
-- ============================================================
-- FASE 4C: Integração de Produtos (ERP 9 – MATERIAL)
-- ============================================================

-- 1. Adicionar colunas comerciais e rastreio ERP em products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS subcategory TEXT,
  ADD COLUMN IF NOT EXISTS reference TEXT,
  ADD COLUMN IF NOT EXISTS weight NUMERIC(15,5),
  ADD COLUMN IF NOT EXISTS price_cash NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS price_term NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS warranty_months INTEGER,
  ADD COLUMN IF NOT EXISTS erp_status TEXT,
  ADD COLUMN IF NOT EXISTS unit_sale TEXT,
  ADD COLUMN IF NOT EXISTS abc_classification CHAR(1),
  ADD COLUMN IF NOT EXISTS erp_product_code TEXT,
  ADD COLUMN IF NOT EXISTS erp_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS erp_last_update_date TIMESTAMPTZ;

-- 2. Constraints
ALTER TABLE public.products
  ADD CONSTRAINT chk_products_abc_classification
    CHECK (abc_classification IS NULL OR abc_classification IN ('A','B','C'));

ALTER TABLE public.products
  ADD CONSTRAINT chk_products_erp_status
    CHECK (erp_status IS NULL OR erp_status IN ('ATIVO','INATIVO','SERVICO','OBSOLETO','MODELO'));

-- 3. Índices para products
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_tenant_erp_code
  ON public.products (tenant_id, erp_product_code)
  WHERE erp_product_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_tenant_category
  ON public.products (tenant_id, category);

CREATE INDEX IF NOT EXISTS idx_products_tenant_active
  ON public.products (tenant_id, active);

-- ============================================================
-- 4. Criar tabela product_erp_data
-- ============================================================
CREATE TABLE public.product_erp_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  center_control TEXT,
  parent_child_qty NUMERIC(15,6),
  cost_price NUMERIC(15,5),
  freight_pct NUMERIC(5,2),
  packaging_pct NUMERIC(5,2),
  commission_pct NUMERIC(5,2),
  readjust_pct NUMERIC(5,2),
  readjust_date DATE,
  erp_product_type_id INTEGER,
  manufacturer_code TEXT,
  factory_code TEXT,
  short_code INTEGER,
  purchase_converter NUMERIC(15,7),
  sale_converter NUMERIC(15,7),
  finance_charges_pct NUMERIC(5,3),
  freight_value NUMERIC(15,2),
  volume NUMERIC(15,6),
  purchase_unit TEXT,
  packaging_weight NUMERIC(15,5),
  purchase_warranty INTEGER,
  business_unit TEXT,
  erp_price_table_code TEXT,
  erp_registered_at DATE,
  erp_modified_at DATE,
  extra_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_product_erp_data_product UNIQUE (product_id)
);

-- 5. RLS para product_erp_data
ALTER TABLE public.product_erp_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation select" ON public.product_erp_data
  FOR SELECT USING (
    tenant_id IN (SELECT ut.tenant_id FROM public.user_tenants ut WHERE ut.user_id = auth.uid())
  );

CREATE POLICY "Tenant isolation insert" ON public.product_erp_data
  FOR INSERT WITH CHECK (
    tenant_id IN (SELECT ut.tenant_id FROM public.user_tenants ut WHERE ut.user_id = auth.uid())
  );

CREATE POLICY "Tenant isolation update" ON public.product_erp_data
  FOR UPDATE USING (
    tenant_id IN (SELECT ut.tenant_id FROM public.user_tenants ut WHERE ut.user_id = auth.uid())
  );

CREATE POLICY "Tenant isolation delete" ON public.product_erp_data
  FOR DELETE USING (
    tenant_id IN (SELECT ut.tenant_id FROM public.user_tenants ut WHERE ut.user_id = auth.uid())
  );

-- 6. Trigger updated_at
CREATE TRIGGER update_product_erp_data_updated_at
  BEFORE UPDATE ON public.product_erp_data
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Índice para product_erp_data
CREATE INDEX IF NOT EXISTS idx_product_erp_data_product
  ON public.product_erp_data (product_id);
