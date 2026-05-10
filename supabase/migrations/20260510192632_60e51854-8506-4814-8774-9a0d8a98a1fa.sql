
-- ============================================================
-- FASE 1 — Fundação Operacional Qualyvac
-- Aditiva, isolada, com triggers de proteção
-- ============================================================

-- 1) pipelines.is_operational
ALTER TABLE public.pipelines
  ADD COLUMN IF NOT EXISTS is_operational boolean NOT NULL DEFAULT false;

-- Backfill: 3 pipelines Qualyvac
UPDATE public.pipelines
SET is_operational = true
WHERE id IN (
  '7d0e431a-47a4-40d9-8184-8ad61f73c949', -- OPERAÇÃO QUALYVAC
  '8a4febb1-249c-4f81-b371-bb90e5adbbab', -- QUALYVAC - PCP
  '5fe162bf-a992-4e47-8340-18325a750017'  -- QUALYVAC - Qualidade
);

-- Trigger guard: bloquear is_operational=true para Vendas e para pipelines
-- comerciais não vinculados à entidade Qualyvac
CREATE OR REPLACE FUNCTION public.pipelines_operational_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qualyvac_entity uuid := '0379445a-811b-4842-8d1c-d0b326fed307';
  v_vendas_pipeline uuid := 'bdb23ee4-4bd6-41e7-909a-aab4af832c99';
  v_qualyvac_allowed uuid[] := ARRAY[
    '7d0e431a-47a4-40d9-8184-8ad61f73c949',
    '8a4febb1-249c-4f81-b371-bb90e5adbbab',
    '5fe162bf-a992-4e47-8340-18325a750017'
  ]::uuid[];
  v_has_qualyvac_link boolean;
BEGIN
  IF NEW.is_operational IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- Bloqueia pipeline Vendas explicitamente
  IF NEW.id = v_vendas_pipeline THEN
    RAISE EXCEPTION 'Pipeline "Vendas" não pode ser marcado como operacional';
  END IF;

  -- Exceção controlada: 3 IDs Qualyvac sempre liberados
  IF NEW.id = ANY (v_qualyvac_allowed) THEN
    RETURN NEW;
  END IF;

  -- Demais: exige vínculo com entidade Qualyvac
  SELECT EXISTS (
    SELECT 1 FROM public.pipeline_legal_entities ple
    WHERE ple.pipeline_id = NEW.id
      AND ple.legal_entity_id = v_qualyvac_entity
  ) INTO v_has_qualyvac_link;

  IF NOT v_has_qualyvac_link THEN
    RAISE EXCEPTION 'Pipeline operacional requer vínculo com a entidade QUALYVAC EMBALAGENS EIRELI';
  END IF;

  -- Bloqueia pipelines puramente comerciais (sales) fora da exceção Qualyvac
  IF NEW.pipeline_mode = 'sales' THEN
    RAISE EXCEPTION 'Pipelines comerciais (mode=sales) não podem ser operacionais';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pipelines_operational_guard_trg ON public.pipelines;
CREATE TRIGGER pipelines_operational_guard_trg
  BEFORE INSERT OR UPDATE OF is_operational, pipeline_mode ON public.pipelines
  FOR EACH ROW EXECUTE FUNCTION public.pipelines_operational_guard();

-- 2) orders: campos operacionais
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS operational_pipeline_id uuid NULL
    REFERENCES public.pipelines(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS operational_stage_id uuid NULL
    REFERENCES public.pipeline_stages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_operational_pipeline
  ON public.orders(operational_pipeline_id)
  WHERE operational_pipeline_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_operational_stage
  ON public.orders(operational_stage_id)
  WHERE operational_stage_id IS NOT NULL;

-- Trigger guard: integridade dos campos operacionais
CREATE OR REPLACE FUNCTION public.orders_operational_pipeline_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_operational boolean;
  v_stage_pipeline uuid;
  v_entity_linked boolean;
BEGIN
  IF NEW.operational_pipeline_id IS NULL THEN
    IF NEW.operational_stage_id IS NOT NULL THEN
      RAISE EXCEPTION 'operational_stage_id requer operational_pipeline_id';
    END IF;
    RETURN NEW;
  END IF;

  -- Pipeline tem que ser is_operational
  SELECT is_operational INTO v_is_operational
  FROM public.pipelines WHERE id = NEW.operational_pipeline_id;

  IF NOT COALESCE(v_is_operational, false) THEN
    RAISE EXCEPTION 'Pipeline % não é operacional', NEW.operational_pipeline_id;
  END IF;

  -- Stage (se informado) tem que pertencer ao pipeline
  IF NEW.operational_stage_id IS NOT NULL THEN
    SELECT pipeline_id INTO v_stage_pipeline
    FROM public.pipeline_stages WHERE id = NEW.operational_stage_id;

    IF v_stage_pipeline IS DISTINCT FROM NEW.operational_pipeline_id THEN
      RAISE EXCEPTION 'Stage operacional não pertence ao pipeline informado';
    END IF;
  END IF;

  -- Entidade jurídica do pedido tem que estar vinculada ao pipeline
  IF NEW.legal_entity_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.pipeline_legal_entities ple
      WHERE ple.pipeline_id = NEW.operational_pipeline_id
        AND ple.legal_entity_id = NEW.legal_entity_id
    ) INTO v_entity_linked;

    IF NOT v_entity_linked THEN
      RAISE EXCEPTION 'Entidade jurídica do pedido não está vinculada ao pipeline operacional';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_operational_pipeline_guard_trg ON public.orders;
CREATE TRIGGER orders_operational_pipeline_guard_trg
  BEFORE INSERT OR UPDATE OF operational_pipeline_id, operational_stage_id, legal_entity_id ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.orders_operational_pipeline_guard();

-- 3) Histórico operacional
CREATE TABLE IF NOT EXISTS public.order_operational_stage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  pipeline_id uuid NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
  from_stage_id uuid NULL REFERENCES public.pipeline_stages(id) ON DELETE SET NULL,
  to_stage_id uuid NULL REFERENCES public.pipeline_stages(id) ON DELETE SET NULL,
  moved_by uuid NULL,
  moved_at timestamptz NOT NULL DEFAULT now(),
  reason text NULL,
  tenant_id uuid NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_oosh_order_moved
  ON public.order_operational_stage_history(order_id, moved_at DESC);
CREATE INDEX IF NOT EXISTS idx_oosh_pipeline
  ON public.order_operational_stage_history(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_oosh_tenant
  ON public.order_operational_stage_history(tenant_id);

ALTER TABLE public.order_operational_stage_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_oosh_by_tenant" ON public.order_operational_stage_history;
CREATE POLICY "select_oosh_by_tenant"
  ON public.order_operational_stage_history
  FOR SELECT
  TO authenticated
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- Sem policy de INSERT/UPDATE/DELETE: gravação só via trigger SECURITY DEFINER

-- Trigger de log
CREATE OR REPLACE FUNCTION public.log_order_operational_stage_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.operational_stage_id IS DISTINCT FROM OLD.operational_stage_id
     AND NEW.operational_pipeline_id IS NOT NULL THEN
    INSERT INTO public.order_operational_stage_history
      (order_id, pipeline_id, from_stage_id, to_stage_id, moved_by, tenant_id)
    VALUES
      (NEW.id, NEW.operational_pipeline_id, OLD.operational_stage_id,
       NEW.operational_stage_id, auth.uid(), NEW.tenant_id);
  ELSIF TG_OP = 'INSERT'
     AND NEW.operational_stage_id IS NOT NULL
     AND NEW.operational_pipeline_id IS NOT NULL THEN
    INSERT INTO public.order_operational_stage_history
      (order_id, pipeline_id, from_stage_id, to_stage_id, moved_by, tenant_id)
    VALUES
      (NEW.id, NEW.operational_pipeline_id, NULL,
       NEW.operational_stage_id, auth.uid(), NEW.tenant_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_log_operational_stage_change_trg ON public.orders;
CREATE TRIGGER orders_log_operational_stage_change_trg
  AFTER INSERT OR UPDATE OF operational_stage_id ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.log_order_operational_stage_change();

-- 4) Feature flag tenant-level (categoria 'operational_pipelines')
-- Inserção do default p/ tenants existentes (não sobrescreve se já existir)
INSERT INTO public.tenant_settings (tenant_id, category, settings)
SELECT t.id, 'operational_pipelines',
       jsonb_build_object('qualyvac_operational_enabled', false)
FROM public.tenants t
ON CONFLICT (tenant_id, category) DO NOTHING;
