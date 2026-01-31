-- =============================================
-- FASE 1: Sprint 1 - Tabelas pipelines e sales_goals
-- =============================================

-- Tabela de Pipelines (múltiplos funis)
CREATE TABLE public.pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'sales',
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT pipelines_valid_type CHECK (type IN ('sales', 'post_sales', 'support'))
);

-- Índices para pipelines
CREATE INDEX idx_pipelines_type ON public.pipelines(type);
CREATE INDEX idx_pipelines_active ON public.pipelines(is_active);
CREATE INDEX idx_pipelines_default ON public.pipelines(is_default) WHERE is_default = true;

-- RLS para pipelines
ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view pipelines"
  ON public.pipelines FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can insert pipelines"
  ON public.pipelines FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update pipelines"
  ON public.pipelines FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete pipelines"
  ON public.pipelines FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Adicionar pipeline_id aos deals
ALTER TABLE public.deals ADD COLUMN pipeline_id UUID REFERENCES public.pipelines(id);
CREATE INDEX idx_deals_pipeline ON public.deals(pipeline_id);

-- Adicionar default_owner_id às etapas do pipeline (para Fase 2)
ALTER TABLE public.pipeline_stages ADD COLUMN default_owner_id UUID;
ALTER TABLE public.pipeline_stages ADD COLUMN sla_hours INTEGER;
ALTER TABLE public.pipeline_stages ADD COLUMN sla_warning_hours INTEGER;
ALTER TABLE public.pipeline_stages ADD COLUMN pipeline_id UUID REFERENCES public.pipelines(id);

CREATE INDEX idx_pipeline_stages_pipeline ON public.pipeline_stages(pipeline_id);

-- Tabela de Metas de Vendas
CREATE TABLE public.sales_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  period_type TEXT NOT NULL DEFAULT 'monthly',
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  target_value NUMERIC DEFAULT 0,
  target_deals INTEGER DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT sales_goals_valid_period CHECK (period_end > period_start),
  CONSTRAINT sales_goals_valid_type CHECK (period_type IN ('monthly', 'quarterly', 'yearly'))
);

-- Índices para sales_goals
CREATE INDEX idx_sales_goals_user ON public.sales_goals(user_id);
CREATE INDEX idx_sales_goals_period ON public.sales_goals(period_start, period_end);

-- RLS para sales_goals
ALTER TABLE public.sales_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own goals or admins see all"
  ON public.sales_goals FOR SELECT
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert goals"
  ON public.sales_goals FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update goals"
  ON public.sales_goals FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete goals"
  ON public.sales_goals FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Inserir pipeline padrão "Vendas"
INSERT INTO public.pipelines (name, description, type, is_default, is_active)
VALUES ('Vendas', 'Pipeline principal de vendas', 'sales', true, true);

-- Atualizar pipeline_stages existentes para vincular ao pipeline padrão
UPDATE public.pipeline_stages 
SET pipeline_id = (SELECT id FROM public.pipelines WHERE is_default = true LIMIT 1);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_pipelines_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_pipelines_updated_at
  BEFORE UPDATE ON public.pipelines
  FOR EACH ROW
  EXECUTE FUNCTION public.update_pipelines_updated_at();

CREATE TRIGGER update_sales_goals_updated_at
  BEFORE UPDATE ON public.sales_goals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_pipelines_updated_at();