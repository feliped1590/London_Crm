
ALTER TABLE public.legal_entities DROP CONSTRAINT IF EXISTS uq_legal_entities_tenant_erp_code;

-- Permite mesmo erp_company_code em endpoints distintos. COALESCE garante que NULL
-- vire string vazia para o índice (Postgres trata NULLs como distintos em UNIQUE).
CREATE UNIQUE INDEX IF NOT EXISTS uq_legal_entities_tenant_erp_code_endpoint
  ON public.legal_entities (tenant_id, erp_company_code, COALESCE(order_erp_endpoint, ''))
  WHERE erp_company_code IS NOT NULL;
