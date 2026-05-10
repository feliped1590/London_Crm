
-- ============================================================
-- FASE 2: Maturidade Operacional Qualyvac
-- 100% aditivo, idempotente, sem impacto em comerciais/Vendas
-- ============================================================

-- ---------- 1) ORDERS: novos campos operacionais ----------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS operational_owner_id uuid,
  ADD COLUMN IF NOT EXISTS operational_priority text NOT NULL DEFAULT 'media',
  ADD COLUMN IF NOT EXISTS operational_entered_stage_at timestamptz,
  ADD COLUMN IF NOT EXISTS operational_entered_pipeline_at timestamptz;

DO $$ BEGIN
  ALTER TABLE public.orders
    ADD CONSTRAINT orders_operational_priority_check
    CHECK (operational_priority IN ('baixa','media','alta','urgente','bloqueado'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_orders_op_pipeline_stage
  ON public.orders (operational_pipeline_id, operational_stage_id);
CREATE INDEX IF NOT EXISTS idx_orders_op_owner
  ON public.orders (operational_owner_id) WHERE operational_owner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_op_priority
  ON public.orders (operational_priority) WHERE operational_pipeline_id IS NOT NULL;

-- ---------- 2) HISTORY: campos expandidos ----------
ALTER TABLE public.order_operational_stage_history
  ADD COLUMN IF NOT EXISTS from_pipeline_id uuid REFERENCES public.pipelines(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS to_pipeline_id uuid REFERENCES public.pipelines(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS time_in_stage_seconds integer,
  ADD COLUMN IF NOT EXISTS move_kind text,
  ADD COLUMN IF NOT EXISTS is_non_sequential boolean NOT NULL DEFAULT false;

DO $$ BEGIN
  ALTER TABLE public.order_operational_stage_history
    ADD CONSTRAINT oosh_move_kind_check
    CHECK (move_kind IS NULL OR move_kind IN ('stage','pipeline','both','initial'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- 3) PIPELINE_STAGES: setor + SLA crítico + crítica ----------
ALTER TABLE public.pipeline_stages
  ADD COLUMN IF NOT EXISTS operational_department text,
  ADD COLUMN IF NOT EXISTS sla_critical_hours integer,
  ADD COLUMN IF NOT EXISTS is_critical_stage boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS waiting_for_customer boolean NOT NULL DEFAULT false;

DO $$ BEGIN
  ALTER TABLE public.pipeline_stages
    ADD CONSTRAINT pipeline_stages_op_department_check
    CHECK (operational_department IS NULL OR operational_department IN
      ('PCP','QUALIDADE','LOGISTICA','COMERCIAL','FINANCEIRO','EXPEDICAO','SUPRIMENTOS','OUTROS'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- 4) PERMISSÕES SETORIAIS ----------
CREATE TABLE IF NOT EXISTS public.operational_stage_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
  department text NOT NULL CHECK (department IN
    ('PCP','QUALIDADE','LOGISTICA','COMERCIAL','FINANCEIRO','EXPEDICAO','SUPRIMENTOS','OUTROS')),
  role app_role NOT NULL,
  access_level text NOT NULL DEFAULT 'move' CHECK (access_level IN ('move','observe')),
  tenant_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (pipeline_id, department, role)
);

CREATE INDEX IF NOT EXISTS idx_osp_pipeline ON public.operational_stage_permissions(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_osp_tenant ON public.operational_stage_permissions(tenant_id);

ALTER TABLE public.operational_stage_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "osp_select_by_tenant" ON public.operational_stage_permissions;
CREATE POLICY "osp_select_by_tenant"
  ON public.operational_stage_permissions FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

DROP POLICY IF EXISTS "osp_admin_write" ON public.operational_stage_permissions;
CREATE POLICY "osp_admin_write"
  ON public.operational_stage_permissions FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'desenvolvedor'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'desenvolvedor'));

-- ---------- 5) FUNÇÃO can_move_operational_stage ----------
CREATE OR REPLACE FUNCTION public.can_move_operational_stage(_user_id uuid, _to_stage_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_pipeline uuid;
  v_dept text;
  v_has_perm boolean;
BEGIN
  -- admin/dev sempre podem
  IF has_role(_user_id, 'admin') OR has_role(_user_id, 'desenvolvedor') THEN
    RETURN true;
  END IF;

  SELECT pipeline_id, operational_department
    INTO v_pipeline, v_dept
  FROM public.pipeline_stages
  WHERE id = _to_stage_id;

  -- etapa sem departamento definido: liberado para qualquer role autenticada
  IF v_dept IS NULL THEN RETURN true; END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.operational_stage_permissions p
    JOIN public.user_roles ur ON ur.role = p.role
    WHERE ur.user_id = _user_id
      AND p.pipeline_id = v_pipeline
      AND p.department = v_dept
      AND p.access_level = 'move'
  ) INTO v_has_perm;

  RETURN COALESCE(v_has_perm, false);
END $$;

-- ---------- 6) TRIGGER expandido de histórico + tempos ----------
CREATE OR REPLACE FUNCTION public.log_order_operational_stage_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_stage_changed boolean := false;
  v_pipeline_changed boolean := false;
  v_kind text;
  v_now timestamptz := now();
  v_time_in_stage int;
  v_old_sort int; v_new_sort int;
  v_non_seq boolean := false;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.operational_stage_id IS NOT NULL AND NEW.operational_pipeline_id IS NOT NULL THEN
      NEW.operational_entered_stage_at := COALESCE(NEW.operational_entered_stage_at, v_now);
      NEW.operational_entered_pipeline_at := COALESCE(NEW.operational_entered_pipeline_at, v_now);
      INSERT INTO public.order_operational_stage_history
        (order_id, pipeline_id, from_stage_id, to_stage_id, from_pipeline_id, to_pipeline_id,
         move_kind, moved_by, tenant_id)
      VALUES
        (NEW.id, NEW.operational_pipeline_id, NULL, NEW.operational_stage_id,
         NULL, NEW.operational_pipeline_id, 'initial', auth.uid(), NEW.tenant_id);
    END IF;
    RETURN NEW;
  END IF;

  v_stage_changed := NEW.operational_stage_id IS DISTINCT FROM OLD.operational_stage_id;
  v_pipeline_changed := NEW.operational_pipeline_id IS DISTINCT FROM OLD.operational_pipeline_id;

  IF NOT v_stage_changed AND NOT v_pipeline_changed THEN
    RETURN NEW;
  END IF;

  IF v_stage_changed AND v_pipeline_changed THEN v_kind := 'both';
  ELSIF v_pipeline_changed THEN v_kind := 'pipeline';
  ELSE v_kind := 'stage';
  END IF;

  -- tempo na etapa anterior
  IF OLD.operational_entered_stage_at IS NOT NULL THEN
    v_time_in_stage := GREATEST(0, EXTRACT(EPOCH FROM (v_now - OLD.operational_entered_stage_at))::int);
  END IF;

  -- detecta salto não sequencial (mesma pipeline, mesmo sort_order +/- 1)
  IF v_kind = 'stage' AND OLD.operational_stage_id IS NOT NULL AND NEW.operational_stage_id IS NOT NULL THEN
    SELECT sort_order INTO v_old_sort FROM public.pipeline_stages WHERE id = OLD.operational_stage_id;
    SELECT sort_order INTO v_new_sort FROM public.pipeline_stages WHERE id = NEW.operational_stage_id;
    IF v_old_sort IS NOT NULL AND v_new_sort IS NOT NULL THEN
      v_non_seq := ABS(v_new_sort - v_old_sort) > 1;
    END IF;
  ELSIF v_kind IN ('pipeline','both') THEN
    v_non_seq := true; -- troca de pipeline é sempre crítica
  END IF;

  -- atualiza instantes
  IF v_stage_changed THEN
    NEW.operational_entered_stage_at := v_now;
  END IF;
  IF v_pipeline_changed THEN
    NEW.operational_entered_pipeline_at := v_now;
  END IF;

  IF NEW.operational_pipeline_id IS NOT NULL AND NEW.operational_stage_id IS NOT NULL THEN
    INSERT INTO public.order_operational_stage_history
      (order_id, pipeline_id, from_stage_id, to_stage_id,
       from_pipeline_id, to_pipeline_id,
       move_kind, time_in_stage_seconds, is_non_sequential,
       moved_by, tenant_id)
    VALUES
      (NEW.id, NEW.operational_pipeline_id, OLD.operational_stage_id, NEW.operational_stage_id,
       OLD.operational_pipeline_id, NEW.operational_pipeline_id,
       v_kind, v_time_in_stage, v_non_seq,
       auth.uid(), NEW.tenant_id);
  END IF;

  RETURN NEW;
END $$;

-- recria trigger como BEFORE para permitir setar entered_*_at no NEW
DROP TRIGGER IF EXISTS orders_log_operational_stage_change_trg ON public.orders;
CREATE TRIGGER orders_log_operational_stage_change_trg
  BEFORE INSERT OR UPDATE OF operational_stage_id, operational_pipeline_id ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.log_order_operational_stage_change();

-- ---------- 7) BACKFILL ----------
UPDATE public.orders
   SET operational_entered_stage_at = COALESCE(operational_entered_stage_at, updated_at, now()),
       operational_entered_pipeline_at = COALESCE(operational_entered_pipeline_at, updated_at, now())
 WHERE operational_stage_id IS NOT NULL
   AND (operational_entered_stage_at IS NULL OR operational_entered_pipeline_at IS NULL);
