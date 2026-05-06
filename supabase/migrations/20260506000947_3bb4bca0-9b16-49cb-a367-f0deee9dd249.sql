CREATE UNIQUE INDEX IF NOT EXISTS products_tenant_erp_code_unique
  ON public.products (tenant_id, erp_product_code)
  WHERE erp_product_code IS NOT NULL AND erp_product_code <> '';

ALTER TABLE public.products
  ALTER COLUMN erp_empresa SET DEFAULT 1;