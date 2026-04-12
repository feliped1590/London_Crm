
-- =============================================
-- FASE 1: Migrar deal_stage enum → text
-- =============================================

-- 1.1 Converter coluna deals.stage
ALTER TABLE deals ALTER COLUMN stage TYPE text USING stage::text;
ALTER TABLE deals ALTER COLUMN stage SET DEFAULT 'prospeccao';

-- 1.2 Converter coluna pipeline_stages.stage
ALTER TABLE pipeline_stages ALTER COLUMN stage TYPE text USING stage::text;

-- 1.3 Converter colunas deal_stage_history
ALTER TABLE deal_stage_history ALTER COLUMN from_stage TYPE text USING from_stage::text;
ALTER TABLE deal_stage_history ALTER COLUMN to_stage TYPE text USING to_stage::text;

-- 1.4 Converter coluna pipeline_automations.trigger_stage
ALTER TABLE pipeline_automations ALTER COLUMN trigger_stage TYPE text USING trigger_stage::text;

-- 1.5 Converter coluna stage_checklist_items.stage
ALTER TABLE stage_checklist_items ALTER COLUMN stage TYPE text USING stage::text;

-- 1.6 Drop do enum antigo (agora não mais referenciado)
DROP TYPE IF EXISTS deal_stage;

-- =============================================
-- FASE 2: Controle de acesso por etapa
-- =============================================

-- 2.1 Adicionar coluna allowed_roles em pipeline_stages
ALTER TABLE pipeline_stages ADD COLUMN IF NOT EXISTS allowed_roles text[] DEFAULT NULL;

-- Comentário para documentação
COMMENT ON COLUMN pipeline_stages.allowed_roles IS 'Lista de perfis (app_role) que podem mover deals para esta etapa. NULL ou vazio = todos podem. Admin tem bypass.';

-- =============================================
-- FASE 3: Novos perfis operacionais
-- =============================================

-- 3.1 Adicionar novos valores ao enum app_role
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'financeiro';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'faturamento';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'logistica';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'qualidade';
