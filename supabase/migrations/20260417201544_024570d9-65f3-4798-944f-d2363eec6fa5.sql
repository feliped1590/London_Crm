-- 1. Adicionar colunas para validação estruturada
ALTER TABLE public.company_sync_queue
  ADD COLUMN IF NOT EXISTS validation_errors JSONB,
  ADD COLUMN IF NOT EXISTS validation_fields TEXT[];

-- 2. Índice GIN para queries por campo de erro
CREATE INDEX IF NOT EXISTS idx_csq_validation_fields_gin
  ON public.company_sync_queue
  USING GIN (validation_fields);

CREATE INDEX IF NOT EXISTS idx_csq_validation_errors_gin
  ON public.company_sync_queue
  USING GIN (validation_errors);

-- 3. Índice para queries de status
CREATE INDEX IF NOT EXISTS idx_csq_status_tenant
  ON public.company_sync_queue (status, tenant_id);

-- 4. RPC: breakdown de pendências de validação por campo
CREATE OR REPLACE FUNCTION public.get_validation_breakdown()
RETURNS TABLE(field TEXT, count BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    err->>'field' AS field,
    COUNT(DISTINCT q.company_id)::BIGINT AS count
  FROM public.company_sync_queue q,
       LATERAL jsonb_array_elements(COALESCE(q.validation_errors, '[]'::jsonb)) AS err
  WHERE q.status = 'blocked_validation'
    AND q.tenant_id IN (
      SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid()
    )
  GROUP BY err->>'field'
  ORDER BY count DESC;
$$;

-- 5. RPC: total de clientes bloqueados (para exibir contador)
CREATE OR REPLACE FUNCTION public.get_blocked_validation_count()
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(DISTINCT company_id)::BIGINT
  FROM public.company_sync_queue
  WHERE status = 'blocked_validation'
    AND tenant_id IN (
      SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid()
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_validation_breakdown() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_blocked_validation_count() TO authenticated;