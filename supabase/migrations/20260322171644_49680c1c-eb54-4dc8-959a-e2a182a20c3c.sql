-- RPC para busca performática de produtos disponíveis por cliente,
-- respeitando tenant e excluindo vínculos ativos existentes.
CREATE OR REPLACE FUNCTION public.get_available_company_products(
  p_company_id uuid,
  p_search text DEFAULT NULL,
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  name text,
  sku text,
  unit_price numeric,
  active boolean,
  tenant_id uuid
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tenant_id uuid;
  v_limit integer;
BEGIN
  SELECT c.tenant_id
    INTO v_tenant_id
  FROM public.companies c
  WHERE c.id = p_company_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Cliente % não encontrado.', p_company_id;
  END IF;

  v_limit := GREATEST(COALESCE(p_limit, 50), 1);

  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.sku,
    p.unit_price,
    p.active,
    p.tenant_id
  FROM public.products p
  WHERE p.tenant_id = v_tenant_id
    AND p.active = true
    AND (
      p_search IS NULL
      OR btrim(p_search) = ''
      OR p.name ILIKE '%' || btrim(p_search) || '%'
      OR p.sku ILIKE '%' || btrim(p_search) || '%'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.company_products cp
      WHERE cp.tenant_id = v_tenant_id
        AND cp.company_id = p_company_id
        AND cp.product_id = p.id
        AND cp.archived_at IS NULL
    )
  ORDER BY p.name
  LIMIT v_limit;
END;
$$;