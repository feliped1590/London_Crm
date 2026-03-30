
-- =========================================================================
-- TABELA DE AUDITORIA CENTRALIZADA
-- =========================================================================
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  metadata jsonb DEFAULT '{}',
  ip_address text,
  created_at timestamptz DEFAULT now()
);

-- Índices para consultas frequentes
CREATE INDEX idx_audit_logs_user ON public.audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action, created_at DESC);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- RLS: logs são imutáveis
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- SELECT: apenas admin
CREATE POLICY "admin_select_audit" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- INSERT: qualquer usuário autenticado (user_id deve ser o próprio)
CREATE POLICY "authenticated_insert_audit" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- UPDATE/DELETE: ninguém (logs imutáveis)
-- Não criar policies = bloqueado por padrão com RLS habilitado
