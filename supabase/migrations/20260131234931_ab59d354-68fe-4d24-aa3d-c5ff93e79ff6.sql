-- Table for sandbox test logs (optional, for debugging)
CREATE TABLE public.iniflex_sandbox_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_payload JSONB NOT NULL,
  response_payload JSONB,
  http_status INTEGER,
  latency_ms INTEGER,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- Enable RLS
ALTER TABLE public.iniflex_sandbox_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view sandbox logs
CREATE POLICY "Admins can view sandbox logs"
  ON public.iniflex_sandbox_logs
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can insert sandbox logs
CREATE POLICY "Admins can insert sandbox logs"
  ON public.iniflex_sandbox_logs
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Comment for documentation
COMMENT ON TABLE public.iniflex_sandbox_logs IS 'Logs de teste do sandbox Iniflex - apenas para desenvolvimento/debugging';