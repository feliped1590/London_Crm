
-- ============================================================
-- 1. AUDITORIA DE MUDANÇAS EM stage_category / stage_phase
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_pipeline_stage_classification_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_changes jsonb := '{}'::jsonb;
BEGIN
  IF NEW.stage_category IS DISTINCT FROM OLD.stage_category THEN
    v_changes := v_changes || jsonb_build_object(
      'stage_category',
      jsonb_build_object('old', OLD.stage_category, 'new', NEW.stage_category)
    );
  END IF;

  IF NEW.stage_phase IS DISTINCT FROM OLD.stage_phase THEN
    v_changes := v_changes || jsonb_build_object(
      'stage_phase',
      jsonb_build_object('old', OLD.stage_phase, 'new', NEW.stage_phase)
    );
  END IF;

  IF v_changes <> '{}'::jsonb THEN
    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, metadata)
    VALUES (
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
      'pipeline_stage.classification_changed',
      'pipeline_stage',
      NEW.id,
      jsonb_build_object(
        'pipeline_id', NEW.pipeline_id,
        'stage_name', NEW.name,
        'changes', v_changes
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_pipeline_stage_classification ON public.pipeline_stages;
CREATE TRIGGER trg_log_pipeline_stage_classification
  AFTER UPDATE OF stage_category, stage_phase ON public.pipeline_stages
  FOR EACH ROW
  EXECUTE FUNCTION public.log_pipeline_stage_classification_change();

-- ============================================================
-- 2. RESTRIÇÃO: só admin/desenvolvedor altera classificação
-- ============================================================
CREATE OR REPLACE FUNCTION public.protect_pipeline_stage_classification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_privileged boolean := false;
BEGIN
  -- Se nada mudou na classificação, libera
  IF NEW.stage_category IS NOT DISTINCT FROM OLD.stage_category
     AND NEW.stage_phase IS NOT DISTINCT FROM OLD.stage_phase THEN
    RETURN NEW;
  END IF;

  -- Sem usuário (jobs/migrations) → permitir
  IF v_uid IS NULL THEN
    RETURN NEW;
  END IF;

  -- Apenas admin ou developer pode alterar classificação
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_uid
      AND role IN ('admin'::app_role, 'developer'::app_role)
  ) INTO v_is_privileged;

  IF NOT v_is_privileged THEN
    RAISE EXCEPTION 'Apenas administradores ou desenvolvedores podem alterar a classificação (categoria/fase) das etapas.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_pipeline_stage_classification ON public.pipeline_stages;
CREATE TRIGGER trg_protect_pipeline_stage_classification
  BEFORE UPDATE OF stage_category, stage_phase ON public.pipeline_stages
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_pipeline_stage_classification();

-- ============================================================
-- 3. WARNINGS DE CONSISTÊNCIA (não-bloqueante, apenas analítico)
-- ============================================================
CREATE OR REPLACE FUNCTION public.analyze_pipeline_consistency(p_pipeline_id uuid)
RETURNS TABLE (
  stage_id uuid,
  stage_name text,
  sort_order integer,
  stage_category text,
  stage_phase text,
  warning_code text,
  warning_message text,
  severity text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH ordered AS (
    SELECT
      ps.id,
      ps.name,
      ps.sort_order,
      ps.stage_category,
      ps.stage_phase,
      ps.stage_status,
      MIN(ps.sort_order) FILTER (WHERE ps.stage_category = 'commercial')
        OVER () AS first_commercial_order,
      MAX(ps.sort_order) FILTER (WHERE ps.stage_category = 'commercial')
        OVER () AS last_commercial_order,
      MAX(ps.sort_order) FILTER (WHERE ps.stage_phase = 'sale')
        OVER () AS last_sale_order,
      MAX(ps.sort_order) OVER () AS max_order
    FROM public.pipeline_stages ps
    WHERE ps.pipeline_id = p_pipeline_id
      AND ps.is_active = true
  )
  -- Operacional ANTES de qualquer comercial
  SELECT
    o.id, o.name, o.sort_order, o.stage_category, o.stage_phase,
    'operational_before_commercial'::text,
    format('Etapa operacional "%s" aparece antes de qualquer etapa comercial.', o.name),
    'warning'::text
  FROM ordered o
  WHERE o.stage_category = 'operational'
    AND o.first_commercial_order IS NOT NULL
    AND o.sort_order < o.first_commercial_order

  UNION ALL
  -- Loss no meio (não no final)
  SELECT
    o.id, o.name, o.sort_order, o.stage_category, o.stage_phase,
    'loss_in_middle'::text,
    format('Etapa de perda "%s" está no meio do funil — geralmente perdas devem ficar ao final.', o.name),
    'warning'::text
  FROM ordered o
  WHERE o.stage_category = 'loss'
    AND o.sort_order < o.max_order
    AND EXISTS (
      SELECT 1 FROM ordered o2
      WHERE o2.sort_order > o.sort_order
        AND o2.stage_category <> 'loss'
    )

  UNION ALL
  -- Pós-venda antes de venda
  SELECT
    o.id, o.name, o.sort_order, o.stage_category, o.stage_phase,
    'post_sale_before_sale'::text,
    format('Etapa pós-venda "%s" aparece antes de etapas de venda concluída.', o.name),
    'warning'::text
  FROM ordered o
  WHERE o.stage_phase = 'post_sale'
    AND o.last_sale_order IS NOT NULL
    AND o.sort_order < o.last_sale_order

  UNION ALL
  -- Comercial DEPOIS de operacional (volta atrás)
  SELECT
    o.id, o.name, o.sort_order, o.stage_category, o.stage_phase,
    'commercial_after_operational'::text,
    format('Etapa comercial "%s" aparece depois de etapas operacionais — pode indicar fluxo invertido.', o.name),
    'info'::text
  FROM ordered o
  WHERE o.stage_category = 'commercial'
    AND EXISTS (
      SELECT 1 FROM ordered o2
      WHERE o2.stage_category = 'operational'
        AND o2.sort_order < o.sort_order
    )

  ORDER BY 3;
END;
$$;

GRANT EXECUTE ON FUNCTION public.analyze_pipeline_consistency(uuid) TO authenticated;
