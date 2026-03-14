
-- RPC to get lifecycle stage counts
CREATE OR REPLACE FUNCTION public.get_lifecycle_counts()
RETURNS TABLE(lifecycle_stage text, total bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    COALESCE(c.lifecycle_stage::text, 'lead') as lifecycle_stage,
    COUNT(*) as total
  FROM public.companies c
  WHERE c.active = true
  GROUP BY c.lifecycle_stage
  ORDER BY 
    CASE c.lifecycle_stage
      WHEN 'lead' THEN 1
      WHEN 'prospect' THEN 2
      WHEN 'customer_active' THEN 3
      WHEN 'customer_inactive' THEN 4
      WHEN 'customer_lost' THEN 5
      ELSE 6
    END;
$$;
