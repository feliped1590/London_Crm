-- Primeiro dropar função com assinatura antiga
DROP FUNCTION IF EXISTS public.get_companies_for_reallocation(text[], text[], uuid, integer, integer, text, integer, integer, boolean);

-- Agora criar a função com nova assinatura (incluindo source)
CREATE FUNCTION public.get_companies_for_reallocation(
  p_states text[] DEFAULT NULL,
  p_regions text[] DEFAULT NULL,
  p_owner_id uuid DEFAULT NULL,
  p_min_days_no_interaction integer DEFAULT NULL,
  p_min_days_no_order integer DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_limit integer DEFAULT 500,
  p_offset integer DEFAULT 0,
  p_no_owner boolean DEFAULT NULL
)
RETURNS TABLE (
  company_id uuid,
  company_name text,
  cnpj text,
  state text,
  city text,
  owner_id uuid,
  owner_name text,
  regiao text,
  subregiao text,
  last_interaction_at timestamptz,
  days_since_interaction integer,
  last_order_at timestamptz,
  days_since_order integer,
  total_orders integer,
  total_order_value numeric,
  source text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.company_id,
    u.company_name,
    u.cnpj,
    u.state,
    u.city,
    u.owner_id,
    COALESCE(p.full_name, 'Sem vendedor') AS owner_name,
    u.regiao,
    u.subregiao,
    u.last_interaction_at,
    COALESCE(EXTRACT(DAY FROM (now() - u.last_interaction_at))::integer, 9999) AS days_since_interaction,
    u.last_order_at,
    COALESCE(EXTRACT(DAY FROM (now() - u.last_order_at))::integer, 9999) AS days_since_order,
    u.total_orders,
    u.total_order_value,
    u.source
  FROM unified_company_for_reallocation u
  LEFT JOIN profiles p ON p.user_id = u.owner_id
  WHERE 
    (p_states IS NULL OR u.state = ANY(p_states))
    AND (p_regions IS NULL OR u.regiao = ANY(p_regions))
    AND (
      (p_no_owner = true AND u.owner_id IS NULL)
      OR (p_no_owner IS NOT TRUE AND (p_owner_id IS NULL OR u.owner_id = p_owner_id))
    )
    AND (
      p_min_days_no_interaction IS NULL 
      OR u.last_interaction_at IS NULL 
      OR EXTRACT(DAY FROM (now() - u.last_interaction_at)) >= p_min_days_no_interaction
    )
    AND (
      p_min_days_no_order IS NULL 
      OR u.last_order_at IS NULL 
      OR EXTRACT(DAY FROM (now() - u.last_order_at)) >= p_min_days_no_order
    )
    AND (
      p_search IS NULL 
      OR p_search = '' 
      OR u.company_name ILIKE '%' || p_search || '%'
      OR u.cnpj ILIKE '%' || p_search || '%'
    )
  ORDER BY 
    CASE WHEN u.owner_id IS NULL THEN 0 ELSE 1 END,
    COALESCE(EXTRACT(DAY FROM (now() - u.last_interaction_at))::integer, 9999) DESC,
    u.company_name
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;