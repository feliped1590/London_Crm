
-- Tabela de preferências de cards do dashboard por usuário
CREATE TABLE public.user_dashboard_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_key TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, card_key)
);

-- RLS
ALTER TABLE public.user_dashboard_cards ENABLE ROW LEVEL SECURITY;

-- Cada usuário só vê/edita suas próprias preferências
CREATE POLICY "Users can view own dashboard cards"
  ON public.user_dashboard_cards FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own dashboard cards"
  ON public.user_dashboard_cards FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own dashboard cards"
  ON public.user_dashboard_cards FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own dashboard cards"
  ON public.user_dashboard_cards FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
