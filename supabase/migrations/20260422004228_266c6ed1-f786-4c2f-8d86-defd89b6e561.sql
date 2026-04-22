
-- =====================================================================
-- 1. Tabelas de configuração por CNPJ
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.legal_entity_access_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL REFERENCES public.legal_entities(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT legal_entity_schedule_time_order CHECK (end_time > start_time),
  CONSTRAINT legal_entity_schedule_unique UNIQUE (legal_entity_id, weekday, start_time, end_time)
);

CREATE INDEX IF NOT EXISTS idx_legal_entity_access_schedules_lookup
  ON public.legal_entity_access_schedules (legal_entity_id, weekday)
  WHERE is_active = true;

CREATE TABLE IF NOT EXISTS public.legal_entity_access_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL REFERENCES public.legal_entities(id) ON DELETE CASCADE,
  exception_date date NOT NULL,
  is_allowed boolean NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT legal_entity_exception_unique UNIQUE (legal_entity_id, exception_date)
);

CREATE INDEX IF NOT EXISTS idx_legal_entity_access_exceptions_lookup
  ON public.legal_entity_access_exceptions (legal_entity_id, exception_date);

-- =====================================================================
-- 2. RLS
-- =====================================================================

ALTER TABLE public.legal_entity_access_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_entity_access_exceptions ENABLE ROW LEVEL SECURITY;

-- SELECT: qualquer usuário autenticado pode ler (UI de Settings + diagnóstico).
DROP POLICY IF EXISTS "le_access_schedules_select" ON public.legal_entity_access_schedules;
CREATE POLICY "le_access_schedules_select"
  ON public.legal_entity_access_schedules
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "le_access_exceptions_select" ON public.legal_entity_access_exceptions;
CREATE POLICY "le_access_exceptions_select"
  ON public.legal_entity_access_exceptions
  FOR SELECT
  TO authenticated
  USING (true);

-- WRITE: apenas admin ou desenvolvedor.
DROP POLICY IF EXISTS "le_access_schedules_write" ON public.legal_entity_access_schedules;
CREATE POLICY "le_access_schedules_write"
  ON public.legal_entity_access_schedules
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'desenvolvedor'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'desenvolvedor'::app_role)
  );

DROP POLICY IF EXISTS "le_access_exceptions_write" ON public.legal_entity_access_exceptions;
CREATE POLICY "le_access_exceptions_write"
  ON public.legal_entity_access_exceptions
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'desenvolvedor'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'desenvolvedor'::app_role)
  );

-- =====================================================================
-- 3. Função is_within_access_window — agora com prioridade por CNPJ
-- =====================================================================

CREATE OR REPLACE FUNCTION public.is_within_access_window(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id uuid;
  v_legal_entity_id uuid;
  v_tz text;
  v_local_now timestamp;
  v_local_date date;
  v_local_time time;
  v_local_weekday smallint;
  v_exception_allowed boolean;
  v_has_le_schedule boolean;
  v_has_tenant_schedule boolean;
  v_match boolean;
  v_is_admin boolean;
  v_is_dev boolean;
  v_scope text;  -- 'legal_entity' | 'tenant' | 'open'
BEGIN
  v_is_admin := public.has_role(p_user_id, 'admin');
  v_is_dev   := public.has_role(p_user_id, 'desenvolvedor');

  -- Resolve tenant ativo do usuário
  SELECT active_tenant_id, active_legal_entity_id
    INTO v_tenant_id, v_legal_entity_id
  FROM public.profiles
  WHERE user_id = p_user_id;

  IF v_tenant_id IS NULL THEN
    SELECT tenant_id INTO v_tenant_id
    FROM public.user_tenants
    WHERE user_id = p_user_id
    LIMIT 1;
  END IF;

  -- Sem tenant identificável → fail-safe permite
  IF v_tenant_id IS NULL THEN
    RETURN true;
  END IF;

  v_tz := public.get_tenant_timezone(v_tenant_id);
  v_local_now := (now() AT TIME ZONE v_tz);
  v_local_date := v_local_now::date;
  v_local_time := v_local_now::time;
  v_local_weekday := EXTRACT(DOW FROM v_local_now)::smallint;

  -- =================================================================
  -- 1) PRIORIDADE: regra do CNPJ ATIVO (se existir)
  -- =================================================================
  v_match := NULL;
  v_scope := 'open';

  IF v_legal_entity_id IS NOT NULL THEN
    -- Exceção pontual por CNPJ?
    SELECT is_allowed INTO v_exception_allowed
    FROM public.legal_entity_access_exceptions
    WHERE legal_entity_id = v_legal_entity_id
      AND exception_date = v_local_date
    LIMIT 1;

    IF FOUND THEN
      v_match := v_exception_allowed;
      v_scope := 'legal_entity';
    ELSE
      SELECT EXISTS (
        SELECT 1 FROM public.legal_entity_access_schedules
        WHERE legal_entity_id = v_legal_entity_id AND is_active = true
      ) INTO v_has_le_schedule;

      IF v_has_le_schedule THEN
        SELECT EXISTS (
          SELECT 1 FROM public.legal_entity_access_schedules
          WHERE legal_entity_id = v_legal_entity_id
            AND is_active = true
            AND weekday = v_local_weekday
            AND v_local_time >= start_time
            AND v_local_time <  end_time
        ) INTO v_match;
        v_scope := 'legal_entity';
      END IF;
    END IF;
  END IF;

  -- =================================================================
  -- 2) FALLBACK: regra do TENANT (se CNPJ não tem regra própria)
  -- =================================================================
  IF v_match IS NULL THEN
    SELECT is_allowed INTO v_exception_allowed
    FROM public.tenant_access_exceptions
    WHERE tenant_id = v_tenant_id AND exception_date = v_local_date
    LIMIT 1;

    IF FOUND THEN
      v_match := v_exception_allowed;
      v_scope := 'tenant';
    ELSE
      SELECT EXISTS (
        SELECT 1 FROM public.tenant_access_schedules
        WHERE tenant_id = v_tenant_id AND is_active = true
      ) INTO v_has_tenant_schedule;

      IF NOT v_has_tenant_schedule THEN
        v_match := true;
        v_scope := 'open';
      ELSE
        SELECT EXISTS (
          SELECT 1 FROM public.tenant_access_schedules
          WHERE tenant_id = v_tenant_id
            AND is_active = true
            AND weekday  = v_local_weekday
            AND v_local_time >= start_time
            AND v_local_time <  end_time
        ) INTO v_match;
        v_scope := 'tenant';
      END IF;
    END IF;
  END IF;

  -- =================================================================
  -- 3) Admin/Dev: sempre passam, mas logam quando estão FORA da janela
  -- =================================================================
  IF (v_is_admin OR v_is_dev) AND NOT v_match THEN
    BEGIN
      INSERT INTO public.access_violation_log (
        user_id, action, entity_type, details
      ) VALUES (
        p_user_id,
        'admin_bypass',
        'access_window',
        jsonb_build_object(
          'tenant_id', v_tenant_id,
          'legal_entity_id', v_legal_entity_id,
          'scope', v_scope,
          'role', CASE WHEN v_is_admin THEN 'admin' ELSE 'desenvolvedor' END,
          'local_time', v_local_now,
          'context', 'rls_or_session_check'
        )
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    RETURN true;
  END IF;

  IF v_is_admin OR v_is_dev THEN
    RETURN true;
  END IF;

  RETURN v_match;
END;
$function$;
