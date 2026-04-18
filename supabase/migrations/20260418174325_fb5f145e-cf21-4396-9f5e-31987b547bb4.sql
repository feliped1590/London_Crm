-- ============================================================================
-- PIPELINES N:N COM LEGAL ENTITIES
-- Fase 1: tabela junção + RLS + triggers de sync e integridade
-- ============================================================================

-- 1. Tabela de junção
CREATE TABLE IF NOT EXISTS public.pipeline_legal_entities (
  pipeline_id uuid NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
  legal_entity_id uuid NOT NULL REFERENCES public.legal_entities(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  PRIMARY KEY (pipeline_id, legal_entity_id)
);

CREATE INDEX IF NOT EXISTS idx_ple_pipeline ON public.pipeline_legal_entities(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_ple_entity ON public.pipeline_legal_entities(legal_entity_id);
CREATE INDEX IF NOT EXISTS idx_ple_pipeline_entity ON public.pipeline_legal_entities(pipeline_id, legal_entity_id);

ALTER TABLE public.pipeline_legal_entities ENABLE ROW LEVEL SECURITY;

-- 2. Backfill idempotente
INSERT INTO public.pipeline_legal_entities (pipeline_id, legal_entity_id)
SELECT id, legal_entity_id 
FROM public.pipelines 
WHERE legal_entity_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 3. Helper SECURITY DEFINER para verificar acesso a pipeline
CREATE OR REPLACE FUNCTION public.has_pipeline_access(_pipeline_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    -- Pipeline global (sem vínculos) → qualquer usuário autenticado
    NOT EXISTS (
      SELECT 1 FROM public.pipeline_legal_entities WHERE pipeline_id = _pipeline_id
    )
    -- Privilegiados
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'desenvolvedor'::app_role)
    -- Compat legado: usuário sem vínculos vê tudo
    OR public.user_has_no_legal_entity_links()
    -- Tem acesso a pelo menos uma das entidades vinculadas
    OR EXISTS (
      SELECT 1 FROM public.pipeline_legal_entities ple
      WHERE ple.pipeline_id = _pipeline_id
        AND public.user_has_legal_entity_access(ple.legal_entity_id)
    );
$$;

-- 4. RLS na tabela junção (segue o pipeline pai)
DROP POLICY IF EXISTS "ple_select" ON public.pipeline_legal_entities;
CREATE POLICY "ple_select" ON public.pipeline_legal_entities
  FOR SELECT TO authenticated
  USING (public.has_pipeline_access(pipeline_id));

DROP POLICY IF EXISTS "ple_admin_write" ON public.pipeline_legal_entities;
CREATE POLICY "ple_admin_write" ON public.pipeline_legal_entities
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'desenvolvedor'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'desenvolvedor'::app_role)
  );

-- 5. Atualizar policy SELECT de pipelines para usar o novo helper
DROP POLICY IF EXISTS "Users can view pipelines based on legal entity links" ON public.pipelines;
DROP POLICY IF EXISTS "pipelines_select_by_access" ON public.pipelines;
CREATE POLICY "pipelines_select_by_access" ON public.pipelines
  FOR SELECT TO authenticated
  USING (public.has_pipeline_access(id));

-- 6. Trigger de sync: mantém pipelines.legal_entity_id consistente (Fase 1)
CREATE OR REPLACE FUNCTION public.sync_pipeline_legal_entity_legacy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pipeline_id uuid;
  v_count int;
  v_single_entity uuid;
BEGIN
  v_pipeline_id := COALESCE(NEW.pipeline_id, OLD.pipeline_id);

  SELECT count(*), MAX(legal_entity_id)
  INTO v_count, v_single_entity
  FROM public.pipeline_legal_entities
  WHERE pipeline_id = v_pipeline_id;

  IF v_count = 1 THEN
    UPDATE public.pipelines SET legal_entity_id = v_single_entity WHERE id = v_pipeline_id;
  ELSE
    -- 0 ou >1 vínculos → NULL (global ou multi)
    UPDATE public.pipelines SET legal_entity_id = NULL WHERE id = v_pipeline_id;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_pipeline_legal_entity_legacy ON public.pipeline_legal_entities;
CREATE TRIGGER trg_sync_pipeline_legal_entity_legacy
  AFTER INSERT OR DELETE ON public.pipeline_legal_entities
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_pipeline_legal_entity_legacy();

-- 7. Atualizar trigger de integridade de deals/orders (se existir)
-- Valida: pipeline global OU entity do registro está vinculada ao pipeline
CREATE OR REPLACE FUNCTION public.validate_pipeline_legal_entity_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_has_links boolean;
  v_entity_id uuid;
BEGIN
  -- Se não tem pipeline ou não tem entity no registro, nada a validar
  IF NEW.pipeline_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Resolver entity do registro (deals usa execution_legal_entity_id; fallback legal_entity_id)
  v_entity_id := COALESCE(
    NEW.execution_legal_entity_id,
    CASE WHEN TG_TABLE_NAME IN ('deals','orders','proposals') THEN
      (NEW.legal_entity_id)
    ELSE NULL END
  );

  IF v_entity_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Pipeline tem vínculos?
  SELECT EXISTS (
    SELECT 1 FROM public.pipeline_legal_entities WHERE pipeline_id = NEW.pipeline_id
  ) INTO v_has_links;

  -- Pipeline global → sempre permite
  IF NOT v_has_links THEN
    RETURN NEW;
  END IF;

  -- Restrito → entity precisa estar vinculada
  IF NOT EXISTS (
    SELECT 1 FROM public.pipeline_legal_entities
    WHERE pipeline_id = NEW.pipeline_id AND legal_entity_id = v_entity_id
  ) THEN
    RAISE EXCEPTION 'Pipeline % não permite a empresa % (vínculo ausente em pipeline_legal_entities)',
      NEW.pipeline_id, v_entity_id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;