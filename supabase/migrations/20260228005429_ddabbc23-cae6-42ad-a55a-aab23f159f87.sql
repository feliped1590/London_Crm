
-- Tabela app_sessions
CREATE TABLE public.app_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  is_valid BOOLEAN NOT NULL DEFAULT true,
  invalidated_at TIMESTAMPTZ,
  invalidated_reason TEXT,
  device_info TEXT,
  ip_address TEXT,
  user_agent TEXT
);

CREATE INDEX idx_app_sessions_user_valid ON public.app_sessions(user_id) WHERE is_valid = true;
CREATE INDEX idx_app_sessions_expires ON public.app_sessions(expires_at) WHERE is_valid = true;

ALTER TABLE public.app_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions"
  ON public.app_sessions FOR SELECT
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "No direct insert"
  ON public.app_sessions FOR INSERT
  WITH CHECK (false);

CREATE POLICY "No direct update"
  ON public.app_sessions FOR UPDATE
  USING (false);

CREATE POLICY "No direct delete"
  ON public.app_sessions FOR DELETE
  USING (false);
