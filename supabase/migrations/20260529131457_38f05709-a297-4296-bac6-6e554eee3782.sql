
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Reagendar dispatchers pelo nome (mantém o mesmo command)
SELECT cron.unschedule('dispatch-company-sync-2min');
SELECT cron.unschedule('dispatch-order-sync-2min');
SELECT cron.unschedule('dispatch-product-sync-2min');

SELECT cron.schedule(
  'dispatch-company-sync-15min',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://lusyhkizwoihixcvcgap.supabase.co/functions/v1/process-company-sync',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1c3loa2l6d29paGl4Y3ZjZ2FwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyNDU1NDQsImV4cCI6MjA4MzgyMTU0NH0.2UFkWF_nNR8BbPPy8kH83iwHB2rEEOAWpTZ8RXej29s'),
    body := '{}'::jsonb
  ) WHERE EXISTS (SELECT 1 FROM public.company_sync_queue WHERE status = 'pending' LIMIT 1);
  $$
);

SELECT cron.schedule(
  'dispatch-order-sync-15min',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://lusyhkizwoihixcvcgap.supabase.co/functions/v1/process-order-sync',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1c3loa2l6d29paGl4Y3ZjZ2FwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyNDU1NDQsImV4cCI6MjA4MzgyMTU0NH0.2UFkWF_nNR8BbPPy8kH83iwHB2rEEOAWpTZ8RXej29s'),
    body := '{}'::jsonb
  ) WHERE EXISTS (SELECT 1 FROM public.order_sync_queue WHERE status = 'pending' LIMIT 1);
  $$
);

SELECT cron.schedule(
  'dispatch-product-sync-15min',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://lusyhkizwoihixcvcgap.supabase.co/functions/v1/process-product-sync',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1c3loa2l6d29paGl4Y3ZjZ2FwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyNDU1NDQsImV4cCI6MjA4MzgyMTU0NH0.2UFkWF_nNR8BbPPy8kH83iwHB2rEEOAWpTZ8RXej29s'),
    body := '{}'::jsonb
  ) WHERE EXISTS (SELECT 1 FROM public.product_sync_queue WHERE status = 'pending' LIMIT 1);
  $$
);
