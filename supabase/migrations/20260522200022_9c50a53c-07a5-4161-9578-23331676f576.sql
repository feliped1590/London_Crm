-- Enable unaccent extension
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Normalize function (immutable for index use)
CREATE OR REPLACE FUNCTION public.normalize_city_name(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT lower(public.unaccent('public.unaccent', coalesce(trim(p_text), '')))
$$;

-- Drop old unique index and create normalized one
DROP INDEX IF EXISTS public.idx_erp_cities_tenant_nome_uf;

CREATE UNIQUE INDEX idx_erp_cities_tenant_nome_uf_norm
  ON public.erp_cities (tenant_id, public.normalize_city_name(nome), upper(uf));

-- Lookup helper (returns codigo_erp or 0)
CREATE OR REPLACE FUNCTION public.lookup_erp_city(p_tenant uuid, p_nome text, p_uf text)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT codigo_erp
  FROM public.erp_cities
  WHERE tenant_id = p_tenant
    AND public.normalize_city_name(nome) = public.normalize_city_name(p_nome)
    AND upper(coalesce(uf, '')) = upper(coalesce(p_uf, ''))
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.lookup_erp_city(uuid, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.normalize_city_name(text) TO anon, authenticated, service_role;