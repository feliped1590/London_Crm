-- Fix task_reminders permissive INSERT policy (restrict to service role only)
DROP POLICY IF EXISTS "Service role can insert reminders" ON public.task_reminders;

-- Recreate policy for service_role only
CREATE POLICY "Service role can insert reminders"
  ON public.task_reminders FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Create proposal access logging table for rate limiting
CREATE TABLE IF NOT EXISTS public.proposal_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID REFERENCES public.proposals(id) ON DELETE SET NULL,
  ip_address TEXT NOT NULL,
  action TEXT NOT NULL, -- 'view', 'approve', 'reject', 'invalid_token'
  success BOOLEAN NOT NULL DEFAULT false,
  token_prefix TEXT, -- First 8 chars of token for debugging (safe to log)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on proposal_access_logs
ALTER TABLE public.proposal_access_logs ENABLE ROW LEVEL SECURITY;

-- Only service role can insert logs (edge functions use service role)
CREATE POLICY "Service role can insert access logs"
  ON public.proposal_access_logs FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Only admins can read access logs (for audit purposes)
CREATE POLICY "Admins can view access logs"
  ON public.proposal_access_logs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Add index for efficient rate limiting queries
CREATE INDEX idx_proposal_access_logs_ip_time 
  ON public.proposal_access_logs(ip_address, created_at DESC);

CREATE INDEX idx_proposal_access_logs_created 
  ON public.proposal_access_logs(created_at DESC);