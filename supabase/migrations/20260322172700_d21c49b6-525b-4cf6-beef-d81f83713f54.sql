CREATE OR REPLACE FUNCTION public.get_available_company_products_v2(
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
  tenant_id uuid,
  is_already_ordered boolean,
  last_order_at timestamptz
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

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_tenants ut
    WHERE ut.user_id = auth.uid()
      AND ut.tenant_id = v_tenant_id
  ) THEN
    RAISE EXCEPTION 'Acesso negado ao tenant do cliente informado.';
  END IF;

  v_limit := GREATEST(COALESCE(p_limit, 50), 1);

  RETURN QUERY
  WITH ordered_products AS (
    SELECT
      oi.product_id,
      MAX(COALESCE(o.updated_at, o.created_at, o.order_date::timestamptz)) AS last_order_at
    FROM public.order_items oi
    JOIN public.orders o
      ON o.id = oi.order_id
    WHERE o.company_id = p_company_id
      AND oi.product_id IS NOT NULL
      AND o.tenant_id = v_tenant_id
      AND oi.tenant_id = v_tenant_id
    GROUP BY oi.product_id
  )
  SELECT
    p.id,
    p.name,
    p.sku,
    p.unit_price,
    p.active,
    p.tenant_id,
    (op.product_id IS NOT NULL) AS is_already_ordered,
    op.last_order_at
  FROM public.products p
  LEFT JOIN ordered_products op
    ON op.product_id = p.id
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
      WHERE cp.company_id = p_company_id
        AND cp.product_id = p.id
        AND cp.archived_at IS NULL
    )
  ORDER BY
    (op.product_id IS NOT NULL) DESC,
    op.last_order_at DESC NULLS LAST,
    p.name
  LIMIT v_limit;
END;
$$;