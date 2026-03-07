
CREATE OR REPLACE FUNCTION public.get_portfolio_items(
  p_sales_rep_id uuid,
  p_entity_type text DEFAULT 'company'
)
RETURNS TABLE(
  item_id uuid,
  item_name text,
  item_type text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF p_entity_type = 'company' THEN
    RETURN QUERY
    SELECT c.id, c.name, 'company'::text
    FROM public.companies c
    WHERE c.sales_rep_id = p_sales_rep_id
    ORDER BY c.name;
  ELSIF p_entity_type = 'contact' THEN
    RETURN QUERY
    SELECT ct.id, (ct.first_name || COALESCE(' ' || ct.last_name, ''))::text, 'contact'::text
    FROM public.contacts ct
    JOIN public.companies c ON c.id = ct.company_id
    WHERE c.sales_rep_id = p_sales_rep_id
    ORDER BY ct.first_name;
  ELSIF p_entity_type = 'deal' THEN
    RETURN QUERY
    SELECT d.id, d.name, 'deal'::text
    FROM public.deals d
    JOIN public.companies c ON c.id = d.company_id
    WHERE c.sales_rep_id = p_sales_rep_id
    ORDER BY d.name;
  END IF;
END;
$function$;
