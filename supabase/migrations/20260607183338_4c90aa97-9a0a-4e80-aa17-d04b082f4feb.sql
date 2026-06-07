-- Cron job para drenar bi_sales_fact_queue a cada 5 minutos
SELECT cron.schedule(
  'bi-refresh-sales-fact',
  '*/5 * * * *',
  $$ SELECT public.refresh_bi_sales_fact(); $$
);