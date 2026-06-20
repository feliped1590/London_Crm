-- Fase 10L.2 - Migration controlada (arquivo local)
-- Objetivo: criar tabela dedicada de links publicos para propostas em modelo sales_*
-- Importante: NUNCA persistir token bruto nesta tabela. Apenas hash do token.

CREATE TABLE IF NOT EXISTS public.sales_proposal_public_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_proposal_id uuid NOT NULL REFERENCES public.sales_proposals(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  token_hash_alg text NOT NULL DEFAULT 'sha256',
  scope text NOT NULL DEFAULT 'view',
  status text NOT NULL DEFAULT 'active',
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz NULL,
  revoked_by uuid NULL REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  created_by uuid NULL REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  last_accessed_at timestamptz NULL,
  access_count integer NOT NULL DEFAULT 0,
  max_access_count integer NULL,
  tenant_id uuid NULL,
  legal_entity_id uuid NULL REFERENCES public.legal_entities(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT uq_sales_proposal_public_links_token_hash UNIQUE (token_hash),
  CONSTRAINT chk_sales_proposal_public_links_scope CHECK (scope IN ('view', 'approve', 'view_approve')),
  CONSTRAINT chk_sales_proposal_public_links_status CHECK (status IN ('active', 'revoked', 'used', 'expired')),
  CONSTRAINT chk_sales_proposal_public_links_expiration CHECK (expires_at > created_at),
  CONSTRAINT chk_sales_proposal_public_links_access_count CHECK (access_count >= 0),
  CONSTRAINT chk_sales_proposal_public_links_max_access_count CHECK (max_access_count IS NULL OR max_access_count >= 1)
);

COMMENT ON TABLE public.sales_proposal_public_links IS 'Links publicos de proposta. Armazena apenas hash do token, nunca token bruto.';
COMMENT ON COLUMN public.sales_proposal_public_links.token_hash IS 'Hash do token publico (nao armazenar token em texto puro).';
COMMENT ON COLUMN public.sales_proposal_public_links.tenant_id IS 'Reservado para futura compatibilidade multi-tenant (sem FK nesta fase).';

CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_proposal_public_links_token_hash
  ON public.sales_proposal_public_links(token_hash);

CREATE INDEX IF NOT EXISTS idx_sales_proposal_public_links_proposal_id
  ON public.sales_proposal_public_links(sales_proposal_id);

CREATE INDEX IF NOT EXISTS idx_sales_proposal_public_links_expires_at
  ON public.sales_proposal_public_links(expires_at);

CREATE INDEX IF NOT EXISTS idx_sales_proposal_public_links_status
  ON public.sales_proposal_public_links(status);

CREATE INDEX IF NOT EXISTS idx_sales_proposal_public_links_active_lookup
  ON public.sales_proposal_public_links(status, expires_at, sales_proposal_id)
  WHERE revoked_at IS NULL AND status = 'active';

ALTER TABLE public.sales_proposal_public_links ENABLE ROW LEVEL SECURITY;

-- Nenhuma policy publica/anonymous e criada nesta fase.
