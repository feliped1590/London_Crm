-- ============================================================
-- Multi-Empresa Pipeline Architecture
-- pipelines.legal_entity_id + pipeline_mode + pipeline_scope
-- pipeline_stages.stage_category + stage_phase
-- deals.execution_legal_entity_id
-- Trigger de integridade pipeline ↔ legal_entity em deals/orders/proposals
-- ============================================================

-- 1) PIPELINES: novos campos
ALTER TABLE public.pipelines
  ADD COLUMN IF NOT EXISTS legal_entity_id uuid REFERENCES public.legal_entities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pipeline_mode text NOT NULL DEFAULT 'sales',
  ADD COLUMN IF NOT EXISTS pipeline_scope text NOT NULL DEFAULT 'global';

-- Backfill pipeline_mode a partir de type existente
UPDATE public.pipelines SET pipeline_mode = 
  CASE 
    WHEN type = 'support' THEN 'support'
    WHEN type = 'post_sales' THEN 'operational'
    ELSE 'sales'
  END
WHERE pipeline_mode = 'sales';

-- OPERAÇÃO QUALYVAC é claramente híbrido (29 etapas: COM + SUP + PROD + FIN + EST + FAT + DIS)
UPDATE public.pipelines 
SET pipeline_mode = 'hybrid'
WHERE name = 'OPERAÇÃO QUALYVAC';

-- Constraints
ALTER TABLE public.pipelines
  DROP CONSTRAINT IF EXISTS pipelines_pipeline_mode_check;
ALTER TABLE public.pipelines
  ADD CONSTRAINT pipelines_pipeline_mode_check
  CHECK (pipeline_mode IN ('sales','operational','hybrid','support'));

ALTER TABLE public.pipelines
  DROP CONSTRAINT IF EXISTS pipelines_pipeline_scope_check;
ALTER TABLE public.pipelines
  ADD CONSTRAINT pipelines_pipeline_scope_check
  CHECK (pipeline_scope IN ('global','restricted'));

CREATE INDEX IF NOT EXISTS idx_pipelines_legal_entity ON public.pipelines(legal_entity_id);
CREATE INDEX IF NOT EXISTS idx_pipelines_mode ON public.pipelines(pipeline_mode);

-- ============================================================
-- 2) PIPELINE_STAGES: stage_category + stage_phase
-- ============================================================
ALTER TABLE public.pipeline_stages
  ADD COLUMN IF NOT EXISTS stage_category text NOT NULL DEFAULT 'commercial',
  ADD COLUMN IF NOT EXISTS stage_phase text NOT NULL DEFAULT 'sale';

ALTER TABLE public.pipeline_stages
  DROP CONSTRAINT IF EXISTS pipeline_stages_stage_category_check;
ALTER TABLE public.pipeline_stages
  ADD CONSTRAINT pipeline_stages_stage_category_check
  CHECK (stage_category IN ('commercial','operational','loss','quality'));

ALTER TABLE public.pipeline_stages
  DROP CONSTRAINT IF EXISTS pipeline_stages_stage_phase_check;
ALTER TABLE public.pipeline_stages
  ADD CONSTRAINT pipeline_stages_stage_phase_check
  CHECK (stage_phase IN ('pre_sale','sale','post_sale'));

-- Backfill stage_category baseado em prefixo do nome + stage_status
UPDATE public.pipeline_stages SET stage_category = 'loss'
WHERE stage_status = 'lost'
   OR name ILIKE '%cancelad%'
   OR name ILIKE '%reprovad%'
   OR name ILIKE '%perda%'
   OR name ILIKE '%sem perfil%';

UPDATE public.pipeline_stages SET stage_category = 'quality'
WHERE name ILIKE '%( RNC )%' AND stage_category <> 'loss';

UPDATE public.pipeline_stages SET stage_category = 'operational'
WHERE stage_category = 'commercial'
  AND (
    name ILIKE '%( SUP )%' OR
    name ILIKE '%( PROD )%' OR
    name ILIKE '%( FIN )%' OR
    name ILIKE '%( EST )%' OR
    name ILIKE '%( FAT )%' OR
    name ILIKE '%( DIS )%'
  );

-- stage_phase backfill: pré-venda (prospec/qualif), venda (orç/pedido/produção/faturamento), pós (entrega/qualidade)
UPDATE public.pipeline_stages SET stage_phase = 'pre_sale'
WHERE name ILIKE '%prospec%'
   OR name ILIKE '%qualific%'
   OR name ILIKE '%lead%';

UPDATE public.pipeline_stages SET stage_phase = 'post_sale'
WHERE name ILIKE '%( DIS )%'
   OR name ILIKE '%( RNC )%'
   OR name ILIKE '%entrega%';

-- 'sale' permanece como default para o restante (orçamento, produção, faturamento, etc)

CREATE INDEX IF NOT EXISTS idx_pipeline_stages_category ON public.pipeline_stages(stage_category);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_phase ON public.pipeline_stages(stage_phase);

-- ============================================================
-- 3) DEALS: execution_legal_entity_id
-- ============================================================
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS execution_legal_entity_id uuid REFERENCES public.legal_entities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_deals_execution_legal_entity ON public.deals(execution_legal_entity_id);

-- ============================================================
-- 4) Trigger de integridade pipeline ↔ legal_entity
-- ============================================================
CREATE OR REPLACE FUNCTION public.validate_pipeline_legal_entity_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pipeline_le uuid;
  v_pipeline_name text;
BEGIN
  IF NEW.pipeline_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT legal_entity_id, name INTO v_pipeline_le, v_pipeline_name
  FROM public.pipelines
  WHERE id = NEW.pipeline_id;

  -- Pipeline global (legal_entity_id NULL) é aceito por qualquer legal_entity
  IF v_pipeline_le IS NULL THEN
    RETURN NEW;
  END IF;

  -- Se o registro tem legal_entity_id e diverge do pipeline, bloqueia
  IF NEW.legal_entity_id IS NOT NULL AND NEW.legal_entity_id <> v_pipeline_le THEN
    RAISE EXCEPTION 'Pipeline "%" pertence a outra empresa emissora. Selecione um pipeline compatível.', v_pipeline_name
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- DEALS
DROP TRIGGER IF EXISTS trg_validate_deal_pipeline_le ON public.deals;
CREATE TRIGGER trg_validate_deal_pipeline_le
  BEFORE INSERT OR UPDATE OF pipeline_id, legal_entity_id ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.validate_pipeline_legal_entity_match();

-- ORDERS (se possuir pipeline_id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='orders' AND column_name='pipeline_id'
  ) THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_validate_order_pipeline_le ON public.orders';
    EXECUTE 'CREATE TRIGGER trg_validate_order_pipeline_le
      BEFORE INSERT OR UPDATE OF pipeline_id, legal_entity_id ON public.orders
      FOR EACH ROW EXECUTE FUNCTION public.validate_pipeline_legal_entity_match()';
  END IF;
END $$;

-- PROPOSALS (se possuir pipeline_id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='proposals' AND column_name='pipeline_id'
  ) THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_validate_proposal_pipeline_le ON public.proposals';
    EXECUTE 'CREATE TRIGGER trg_validate_proposal_pipeline_le
      BEFORE INSERT OR UPDATE OF pipeline_id, legal_entity_id ON public.proposals
      FOR EACH ROW EXECUTE FUNCTION public.validate_pipeline_legal_entity_match()';
  END IF;
END $$;

COMMENT ON COLUMN public.pipelines.legal_entity_id IS 'CNPJ emissor proprietário do pipeline. NULL = pipeline global (compartilhado entre todas as empresas).';
COMMENT ON COLUMN public.pipelines.pipeline_mode IS 'Natureza do fluxo: sales | operational | hybrid | support. Substitui semanticamente o campo type para análise.';
COMMENT ON COLUMN public.pipelines.pipeline_scope IS 'Escopo de visibilidade: global (acessível a todas legal_entities) | restricted (futuro: apenas legal_entity_id e usuários explicitamente autorizados).';
COMMENT ON COLUMN public.pipeline_stages.stage_category IS 'Classificação operacional da etapa para BI: commercial | operational | loss | quality. Independente do nome da etapa.';
COMMENT ON COLUMN public.pipeline_stages.stage_phase IS 'Fase analítica da jornada: pre_sale | sale | post_sale. Permite agregações sem depender da nomenclatura.';
COMMENT ON COLUMN public.deals.execution_legal_entity_id IS 'CNPJ executor da operação (produção/faturamento). Pode divergir de legal_entity_id (CNPJ comercial). NULL = mesma da comercial.';