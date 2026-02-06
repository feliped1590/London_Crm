-- Fix: get_companies_for_reallocation_count
-- Corrige o calculo de dias de inatividade para usar EXTRACT em vez de colunas inexistentes

CREATE OR REPLACE FUNCTION public.get_companies_for_reallocation_count(
  p_states text[] DEFAULT NULL,
  p_regions text[] DEFAULT NULL,
  p_owner_id uuid DEFAULT NULL,
  p_min_days_no_interaction integer DEFAULT NULL,
  p_min_days_no_order integer DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_no_owner boolean DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result integer;
BEGIN
  SELECT COUNT(*)::integer INTO result
  FROM unified_company_for_reallocation c
  WHERE
    (p_states IS NULL OR c.state = ANY(p_states))
    AND (p_regions IS NULL OR c.regiao = ANY(p_regions))
    AND (
      CASE
        WHEN p_no_owner = true THEN c.owner_id IS NULL
        WHEN p_owner_id IS NOT NULL THEN c.owner_id = p_owner_id
        ELSE true
      END
    )
    AND (
      p_min_days_no_interaction IS NULL 
      OR c.last_interaction_at IS NULL 
      OR EXTRACT(DAY FROM (now() - c.last_interaction_at)) >= p_min_days_no_interaction
    )
    AND (
      p_min_days_no_order IS NULL 
      OR c.last_order_at IS NULL 
      OR EXTRACT(DAY FROM (now() - c.last_order_at)) >= p_min_days_no_order
    )
    AND (
      p_search IS NULL 
      OR p_search = ''
      OR c.company_name ILIKE '%' || p_search || '%'
      OR c.cnpj ILIKE '%' || p_search || '%'
    );
  
  RETURN result;
END;
$$;