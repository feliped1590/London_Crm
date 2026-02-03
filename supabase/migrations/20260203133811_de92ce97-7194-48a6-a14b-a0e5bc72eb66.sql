-- Add Google Calendar fields to tasks table
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS google_event_id TEXT,
ADD COLUMN IF NOT EXISTS calendar_source TEXT DEFAULT 'crm' CHECK (calendar_source IN ('crm', 'google')),
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- Create index for google_event_id lookups
CREATE INDEX IF NOT EXISTS idx_tasks_google_event_id ON public.tasks(google_event_id) WHERE google_event_id IS NOT NULL;

-- Create table for storing Google Calendar OAuth connections per user
CREATE TABLE IF NOT EXISTS public.google_calendar_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ,
  calendar_id TEXT DEFAULT 'primary',
  sync_enabled BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  webhook_channel_id TEXT,
  webhook_expiration TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.google_calendar_connections ENABLE ROW LEVEL SECURITY;

-- RLS policies - users can only see/manage their own connection
CREATE POLICY "Users can view their own Google Calendar connection"
  ON public.google_calendar_connections
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own Google Calendar connection"
  ON public.google_calendar_connections
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own Google Calendar connection"
  ON public.google_calendar_connections
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own Google Calendar connection"
  ON public.google_calendar_connections
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create sync log table for debugging and conflict resolution
CREATE TABLE IF NOT EXISTS public.google_calendar_sync_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  google_event_id TEXT,
  action TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('crm_to_google', 'google_to_crm')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'error', 'conflict')),
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.google_calendar_sync_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own sync logs"
  ON public.google_calendar_sync_logs
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert sync logs"
  ON public.google_calendar_sync_logs
  FOR INSERT
  WITH CHECK (true);

-- Create updated_at trigger for google_calendar_connections
CREATE TRIGGER update_google_calendar_connections_updated_at
  BEFORE UPDATE ON public.google_calendar_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();