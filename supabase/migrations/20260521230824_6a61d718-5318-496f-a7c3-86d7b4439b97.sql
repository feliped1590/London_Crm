CREATE OR REPLACE FUNCTION public.get_activity_status_counts()
RETURNS TABLE(activity_status text, total bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(activity_status::text, 'unknown') AS activity_status, count(*) AS total
    FROM public.companies
   GROUP BY activity_status;
$$;
GRANT EXECUTE ON FUNCTION public.get_activity_status_counts() TO authenticated;