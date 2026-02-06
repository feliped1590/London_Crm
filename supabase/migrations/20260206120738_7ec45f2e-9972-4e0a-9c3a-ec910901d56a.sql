-- Atualiza a função get_companies_for_reallocation para suportar filtro "sem vendedor"
CREATE OR REPLACE FUNCTION public.get_companies_for_reallocation(
  p_states text[] DEFAULT NULL::text[], 
  p_regions text[] DEFAULT NULL::text[], 
  p_owner_id uuid DEFAULT NULL::uuid, 
  p_min_days_no_interaction integer DEFAULT NULL::integer, 
  p_min_days_no_order integer DEFAULT NULL::integer, 
  p_search text DEFAULT NULL::text, 
  p_limit integer DEFAULT 1000, 
  p_offset integer DEFAULT 0,
  p_no_owner boolean DEFAULT NULL::boolean
)
RETURNS TABLE(
  company_id uuid, 
  company_name text, 
  cnpj text, 
  state text, 
  city text, 
  owner_id uuid, 
  owner_name text, 
  regiao text, 
  subregiao text, 
  last_interaction_at timestamp with time zone, 
  days_since_interaction integer, 
  last_order_at timestamp with time zone, 
  days_since_order integer, 
  total_orders bigint, 
  total_order_value numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    cas.company_id,
    cas.company_name,
    cas.cnpj,
    cas.state,
    cas.city,
    cas.owner_id,
    COALESCE(p.full_name, 'Sem responsável') AS owner_name,
    cas.regiao,
    cas.subregiao,
    cas.last_interaction_at,
    COALESCE(EXTRACT(DAY FROM NOW() - cas.last_interaction_at)::int, 9999) AS days_since_interaction,
    cas.last_order_at,
    COALESCE(EXTRACT(DAY FROM NOW() - cas.last_order_at)::int, 9999) AS days_since_order,
    cas.total_orders,
    cas.total_order_value
  FROM public.company_activity_summary cas
  LEFT JOIN public.profiles p ON cas.owner_id = p.user_id
  WHERE 
    cas.active = true
    AND (p_states IS NULL OR cas.state = ANY(p_states))
    AND (p_regions IS NULL OR cas.regiao = ANY(p_regions))
    -- Filtro de owner: pode ser por ID específico ou buscar sem vendedor
    AND (
      (p_no_owner = true AND cas.owner_id IS NULL)
      OR (p_no_owner IS NULL AND p_owner_id IS NULL)
      OR (p_no_owner IS NULL AND p_owner_id IS NOT NULL AND cas.owner_id = p_owner_id)
    )
    AND (p_min_days_no_interaction IS NULL 
         OR COALESCE(EXTRACT(DAY FROM NOW() - cas.last_interaction_at)::int, 9999) >= p_min_days_no_interaction)
    AND (p_min_days_no_order IS NULL 
         OR COALESCE(EXTRACT(DAY FROM NOW() - cas.last_order_at)::int, 9999) >= p_min_days_no_order)
    AND (p_search IS NULL OR p_search = '' 
         OR cas.company_name ILIKE '%' || p_search || '%'
         OR cas.cnpj ILIKE '%' || p_search || '%')
  ORDER BY 
    COALESCE(EXTRACT(DAY FROM NOW() - cas.last_interaction_at)::int, 9999) DESC,
    cas.company_name ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$function$;