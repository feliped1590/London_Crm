-- Create enum types for automation triggers and actions
CREATE TYPE automation_trigger AS ENUM ('stage_enter', 'stage_exit');
CREATE TYPE automation_action AS ENUM ('send_whatsapp', 'create_task', 'add_tag', 'send_email');

-- Create deal_stage_history table to record stage changes
CREATE TABLE public.deal_stage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  from_stage deal_stage,
  to_stage deal_stage NOT NULL,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now(),
  duration_seconds integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create pipeline_automations table for automation rules
CREATE TABLE public.pipeline_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  trigger_type automation_trigger NOT NULL,
  trigger_stage deal_stage NOT NULL,
  action_type automation_action NOT NULL,
  action_config jsonb NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on deal_stage_history
ALTER TABLE public.deal_stage_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view stage history"
  ON public.deal_stage_history FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert stage history"
  ON public.deal_stage_history FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Enable RLS on pipeline_automations
ALTER TABLE public.pipeline_automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view automations"
  ON public.pipeline_automations FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage automations"
  ON public.pipeline_automations FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create indexes for better query performance
CREATE INDEX idx_deal_stage_history_deal_id ON public.deal_stage_history(deal_id);
CREATE INDEX idx_deal_stage_history_changed_at ON public.deal_stage_history(changed_at DESC);
CREATE INDEX idx_pipeline_automations_trigger ON public.pipeline_automations(trigger_type, trigger_stage) WHERE is_active = true;