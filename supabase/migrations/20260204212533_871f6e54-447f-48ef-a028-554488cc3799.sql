-- =====================================================
-- ANÁLISE DE CRÉDITO - ESTRUTURA COMPLETA
-- =====================================================

-- 1. Tabela credit_analyses (armazena APENAS a última análise por empresa)
-- Campo cnpj duplicado para integridade histórica
CREATE TABLE IF NOT EXISTS public.credit_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  cnpj TEXT NOT NULL,
  credit_score INTEGER,
  risk_classification TEXT CHECK (risk_classification IN ('baixo', 'medio', 'alto')),
  cadastral_status TEXT,
  restrictions_summary TEXT,
  api_provider TEXT DEFAULT 'simulado',
  raw_response_hash TEXT,
  analysis_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  consultation_reason TEXT NOT NULL,
  consulted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_company_analysis UNIQUE (company_id)
);

-- 2. Tabela credit_analysis_audit (histórico imutável)
CREATE TABLE IF NOT EXISTS public.credit_analysis_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  cnpj TEXT NOT NULL,
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  reason TEXT NOT NULL,
  action TEXT NOT NULL DEFAULT 'consulta',
  result_summary JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Trigger para impedir modificação de auditoria
CREATE OR REPLACE FUNCTION public.prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Registros de auditoria são imutáveis e não podem ser alterados ou excluídos';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_credit_audit_changes ON public.credit_analysis_audit;
CREATE TRIGGER prevent_credit_audit_changes
  BEFORE UPDATE OR DELETE ON public.credit_analysis_audit
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_modification();

-- 4. Função para verificar permissão de atualização
CREATE OR REPLACE FUNCTION public.can_update_credit_score(_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
    AND role IN ('admin', 'desenvolvedor')
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- 5. Trigger para updated_at
DROP TRIGGER IF EXISTS update_credit_analyses_updated_at ON public.credit_analyses;
CREATE TRIGGER update_credit_analyses_updated_at
  BEFORE UPDATE ON public.credit_analyses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Índices para performance
CREATE INDEX IF NOT EXISTS idx_credit_analyses_company ON public.credit_analyses(company_id);
CREATE INDEX IF NOT EXISTS idx_credit_audit_company ON public.credit_analysis_audit(company_id);
CREATE INDEX IF NOT EXISTS idx_credit_audit_user ON public.credit_analysis_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_audit_created ON public.credit_analysis_audit(created_at DESC);

-- 7. RLS - Habilitar
ALTER TABLE public.credit_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_analysis_audit ENABLE ROW LEVEL SECURITY;

-- 8. Políticas RLS para credit_analyses
CREATE POLICY "Authenticated users can view credit analyses"
  ON public.credit_analyses
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage credit analyses"
  ON public.credit_analyses
  FOR ALL
  TO authenticated
  USING (public.can_update_credit_score(auth.uid()))
  WITH CHECK (public.can_update_credit_score(auth.uid()));

-- 9. Políticas RLS para credit_analysis_audit
CREATE POLICY "Admins can view credit audit"
  ON public.credit_analysis_audit
  FOR SELECT
  TO authenticated
  USING (public.can_update_credit_score(auth.uid()));

CREATE POLICY "Admins can insert credit audit"
  ON public.credit_analysis_audit
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_update_credit_score(auth.uid()));