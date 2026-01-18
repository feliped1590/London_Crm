-- Add approval token fields to proposals table
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS approval_token UUID UNIQUE;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS approval_token_expires_at TIMESTAMPTZ;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS approved_by_name TEXT;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS approved_by_ip TEXT;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Create index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_proposals_approval_token ON public.proposals(approval_token) WHERE approval_token IS NOT NULL;