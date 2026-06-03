CREATE TABLE IF NOT EXISTS public.cnpj_lookup_cache (
  cnpj         varchar(14) PRIMARY KEY,
  payload      jsonb       NOT NULL,
  source       text        NOT NULL CHECK (source IN ('brasilapi','cnpjws')),
  fetched_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  hit_count    integer     NOT NULL DEFAULT 0,
  last_hit_at  timestamptz
);

CREATE INDEX IF NOT EXISTS idx_cnpj_lookup_cache_expires_at
  ON public.cnpj_lookup_cache(expires_at);

GRANT ALL ON public.cnpj_lookup_cache TO service_role;

ALTER TABLE public.cnpj_lookup_cache ENABLE ROW LEVEL SECURITY;
-- Sem policies: tabela é acessada exclusivamente por edge functions via service_role.