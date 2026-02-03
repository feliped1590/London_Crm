-- =====================================================
-- Sprint 11: IA Copiloto - Tabela de Logs de Sugestões
-- =====================================================

-- Tabela para registrar todas as sugestões feitas pela IA
-- Permite auditoria completa e análise de efetividade
CREATE TABLE public.ai_copilot_suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  
  -- Contexto da sugestão
  context_type TEXT NOT NULL, -- 'deal', 'company', 'contact', 'pipeline', 'seller', 'general'
  context_entity_id UUID, -- ID da entidade relacionada (se aplicável)
  context_data JSONB NOT NULL DEFAULT '{}', -- Dados contextuais usados para gerar a sugestão
  
  -- Sugestão gerada
  suggestion_type TEXT NOT NULL, -- 'follow_up', 'review_proposal', 'redistribute_portfolio', 'schedule_contact', etc.
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  reasoning TEXT, -- Explicação do "porquê" (transparência)
  priority TEXT NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  
  -- Ação sugerida
  action_type TEXT, -- 'create_task', 'update_deal', 'send_message', etc.
  action_payload JSONB, -- Dados pré-preenchidos para a ação
  action_url TEXT, -- URL para onde direcionar o usuário
  
  -- Status e interação
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'dismissed', 'expired'
  user_feedback TEXT, -- Feedback opcional do usuário
  accepted_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  
  -- Metadados
  model_used TEXT, -- Qual modelo de IA foi usado
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days')
);

-- Índices para performance
CREATE INDEX idx_copilot_suggestions_user_id ON public.ai_copilot_suggestions(user_id);
CREATE INDEX idx_copilot_suggestions_status ON public.ai_copilot_suggestions(status);
CREATE INDEX idx_copilot_suggestions_context ON public.ai_copilot_suggestions(context_type, context_entity_id);
CREATE INDEX idx_copilot_suggestions_created_at ON public.ai_copilot_suggestions(created_at DESC);

-- Enable RLS
ALTER TABLE public.ai_copilot_suggestions ENABLE ROW LEVEL SECURITY;

-- Políticas: usuário só vê suas próprias sugestões
CREATE POLICY "Users can view their own suggestions"
  ON public.ai_copilot_suggestions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own suggestions"
  ON public.ai_copilot_suggestions
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Somente edge functions podem inserir (via service role)
CREATE POLICY "Service role can insert suggestions"
  ON public.ai_copilot_suggestions
  FOR INSERT
  WITH CHECK (true);

-- Comentários para documentação
COMMENT ON TABLE public.ai_copilot_suggestions IS 'Logs de sugestões geradas pela IA Copiloto para auditoria e análise';
COMMENT ON COLUMN public.ai_copilot_suggestions.reasoning IS 'Explicação transparente do porquê a sugestão foi gerada';
COMMENT ON COLUMN public.ai_copilot_suggestions.action_payload IS 'Dados pré-preenchidos para facilitar a execução da ação sugerida';