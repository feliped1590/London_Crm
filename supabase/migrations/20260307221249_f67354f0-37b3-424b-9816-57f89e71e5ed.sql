
CREATE OR REPLACE FUNCTION public.get_portfolio_summary()
RETURNS TABLE(
  sales_rep_id uuid,
  sales_rep_name text,
  sales_rep_type text,
  linked_user_id uuid,
  companies_count bigint,
  contacts_count bigint,
  deals_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    sr.id as sales_rep_id,
    sr.name as sales_rep_name,
    sr.type as sales_rep_type,
    (SELECT usr.user_id FROM public.user_sales_reps usr 
     WHERE usr.sales_rep_id = sr.id AND usr.is_default = true 
     LIMIT 1) as linked_user_id,
    (SELECT COUNT(*) FROM public.companies c WHERE c.sales_rep_id = sr.id) as companies_count,
    (SELECT COUNT(*) FROM public.contacts ct 
     JOIN public.companies c2 ON c2.id = ct.company_id 
     WHERE c2.sales_rep_id = sr.id) as contacts_count,
    (SELECT COUNT(*) FROM public.deals d 
     JOIN public.companies c3 ON c3.id = d.company_id 
     WHERE c3.sales_rep_id = sr.id) as deals_count
  FROM public.sales_reps sr
  WHERE sr.active = true
  ORDER BY sr.name;
END;
$function$;
