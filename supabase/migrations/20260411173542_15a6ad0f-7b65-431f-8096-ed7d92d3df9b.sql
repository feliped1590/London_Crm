
CREATE TABLE IF NOT EXISTS public.erp_clients_cache (
  cnpj text PRIMARY KEY,
  codigo_erp text NOT NULL,
  last_seen timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_erp_clients_cache_last_seen ON erp_clients_cache(last_seen);

ALTER TABLE public.erp_clients_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.erp_clients_cache
  FOR ALL TO service_role USING (true) WITH CHECK (true);
