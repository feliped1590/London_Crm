REVOKE EXECUTE ON FUNCTION public.get_pipeline_health(UUID, DATE, DATE) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_seller_performance(DATE, DATE, BOOLEAN) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_bi_anomalies() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_stalled_deals_by_seller(UUID, INT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_conversion_by_stage(DATE, DATE) FROM anon;

GRANT EXECUTE ON FUNCTION public.get_pipeline_health(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_seller_performance(DATE, DATE, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_bi_anomalies() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_stalled_deals_by_seller(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_conversion_by_stage(DATE, DATE) TO authenticated;