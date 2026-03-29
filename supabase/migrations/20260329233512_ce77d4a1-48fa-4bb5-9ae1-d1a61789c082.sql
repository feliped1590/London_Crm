
-- Table for rate limiting edge function requests
CREATE TABLE public.request_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  function_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups by user + function + time
CREATE INDEX idx_request_logs_rate_limit 
  ON public.request_logs (user_id, function_name, created_at DESC);

-- Auto-cleanup: delete logs older than 1 hour
CREATE OR REPLACE FUNCTION public.cleanup_request_logs()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.request_logs WHERE created_at < now() - interval '1 hour';
$$;

-- RLS: only service role should access this table
ALTER TABLE public.request_logs ENABLE ROW LEVEL SECURITY;
