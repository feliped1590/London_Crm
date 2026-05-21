-- Index to support PostgREST default listing: ORDER BY name with tenant filter
CREATE INDEX IF NOT EXISTS idx_companies_tenant_name
  ON public.companies (tenant_id, name);

-- Index to support ORDER BY name alone (used by global listing without tenant filter)
CREATE INDEX IF NOT EXISTS idx_companies_name
  ON public.companies (name);