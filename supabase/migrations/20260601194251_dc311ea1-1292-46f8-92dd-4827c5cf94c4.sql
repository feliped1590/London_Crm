-- Garante unicidade de codigo_erp por tenant para permitir upsert futuro
ALTER TABLE public.erp_cities
  ADD CONSTRAINT erp_cities_tenant_codigo_unique UNIQUE (tenant_id, codigo_erp);