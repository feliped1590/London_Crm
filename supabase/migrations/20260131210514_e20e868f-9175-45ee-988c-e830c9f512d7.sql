-- =============================================
-- SPRINT 4: Tabelas de Qualidade de Processo
-- =============================================

-- 1. ENTITY NOTES (Notas rápidas multi-registro)
CREATE TABLE public.entity_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('deal', 'contact', 'company')),
  entity_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_by UUID REFERENCES auth.users,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_entity_notes_entity ON public.entity_notes(entity_type, entity_id);
CREATE INDEX idx_entity_notes_created_at ON public.entity_notes(created_at DESC);

-- RLS para entity_notes
ALTER TABLE public.entity_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view notes"
  ON public.entity_notes FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert notes"
  ON public.entity_notes FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own notes"
  ON public.entity_notes FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "Users can delete their own notes or admins"
  ON public.entity_notes FOR DELETE
  USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'));

-- 2. WHATSAPP TEMPLATES
CREATE TABLE public.whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb,
  category TEXT DEFAULT 'geral',
  is_shared BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para busca
CREATE INDEX idx_whatsapp_templates_category ON public.whatsapp_templates(category);

-- RLS para whatsapp_templates
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view shared templates or own templates"
  ON public.whatsapp_templates FOR SELECT
  USING (is_shared = true OR created_by = auth.uid());

CREATE POLICY "Authenticated users can insert templates"
  ON public.whatsapp_templates FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own templates"
  ON public.whatsapp_templates FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "Users can delete own templates"
  ON public.whatsapp_templates FOR DELETE
  USING (created_by = auth.uid());

-- Trigger para updated_at
CREATE TRIGGER update_whatsapp_templates_updated_at
  BEFORE UPDATE ON public.whatsapp_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 3. NOTIFICATION PREFERENCES
CREATE TABLE public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL UNIQUE,
  task_reminder_email BOOLEAN DEFAULT true,
  task_reminder_hours INTEGER DEFAULT 1,
  deal_stagnant_alert BOOLEAN DEFAULT true,
  deal_stagnant_days INTEGER DEFAULT 7,
  proposal_expiring_alert BOOLEAN DEFAULT true,
  proposal_expiring_days INTEGER DEFAULT 2,
  daily_summary_email BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS para notification_preferences
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own preferences"
  ON public.notification_preferences FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own preferences"
  ON public.notification_preferences FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own preferences"
  ON public.notification_preferences FOR UPDATE
  USING (user_id = auth.uid());

-- Trigger para updated_at
CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();