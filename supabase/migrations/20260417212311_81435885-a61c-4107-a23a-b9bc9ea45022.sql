CREATE UNIQUE INDEX IF NOT EXISTS products_erp_product_code_unique
ON public.products (tenant_id, erp_product_code)
WHERE erp_product_code IS NOT NULL AND erp_product_code <> '';