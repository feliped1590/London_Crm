-- ============================================================
-- CONTROLE DE ACESSO POR CALENDÁRIO (janela de acesso por tenant)
-- ============================================================

-- 1) TABELAS -------------------------------------------------

CREATE TABLE IF NOT EXISTS public.tenant_access_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6), -- 0=domingo
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_access_schedules_time_order CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_tenant_access_schedules_tenant_weekday
  ON public.tenant_access_schedules (tenant_id, weekday)
  WHERE is_active = true;

CREATE TABLE IF NOT EXISTS public.tenant_access_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  exception_date date NOT NULL,
  is_allowed boolean NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, exception_date)
);

CREATE INDEX IF NOT EXISTS idx_tenant_access_exceptions_tenant_date
  ON public.tenant_access_exceptions (tenant_id, exception_date);

-- 2) RLS NAS NOVAS TABELAS -----------------------------------

ALTER TABLE public.tenant_access_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_access_exceptions ENABLE ROW LEVEL SECURITY;

-- Leitura: qualquer usuário autenticado do tenant pode ver as regras dele
CREATE POLICY "tenant members can read access schedules"
  ON public.tenant_access_schedules FOR SELECT
  TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "tenant members can read access exceptions"
  ON public.tenant_access_exceptions FOR SELECT
  TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- Mutações: apenas admin/desenvolvedor
CREATE POLICY "admins manage access schedules"
  ON public.tenant_access_schedules FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins manage access exceptions"
  ON public.tenant_access_exceptions FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3) HELPER: timezone do tenant ------------------------------

CREATE OR REPLACE FUNCTION public.get_tenant_timezone(p_tenant_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(NULLIF(t.settings->>'timezone', ''), 'UTC')
  FROM public.tenants t
  WHERE t.id = p_tenant_id
$$;

-- 4) FUNÇÃO CENTRAL: is_within_access_window -----------------

CREATE OR REPLACE FUNCTION public.is_within_access_window(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tenant_id uuid;
  v_tz text;
  v_local_now timestamp;
  v_local_date date;
  v_local_time time;
  v_local_weekday smallint;
  v_exception_allowed boolean;
  v_has_schedule boolean;
  v_match boolean;
BEGIN
  -- Imunes: admin e desenvolvedor sempre passam
  IF public.has_role(p_user_id, 'admin')
     OR public.has_role(p_user_id, 'desenvolvedor') THEN
    RETURN true;
  END IF;

  -- Resolve tenant ativo do usuário
  SELECT active_tenant_id INTO v_tenant_id
  FROM public.profiles
  WHERE user_id = p_user_id;

  IF v_tenant_id IS NULL THEN
    SELECT tenant_id INTO v_tenant_id
    FROM public.user_tenants
    WHERE user_id = p_user_id
    LIMIT 1;
  END IF;

  -- Sem tenant identificável → fail-safe permite (compatibilidade)
  IF v_tenant_id IS NULL THEN
    RETURN true;
  END IF;

  v_tz := public.get_tenant_timezone(v_tenant_id);
  v_local_now := (now() AT TIME ZONE v_tz);
  v_local_date := v_local_now::date;
  v_local_time := v_local_now::time;
  -- Postgres: 0=domingo .. 6=sábado (igual ao requisito)
  v_local_weekday := EXTRACT(DOW FROM v_local_now)::smallint;

  -- 1) Exceções pontuais têm prioridade absoluta
  SELECT is_allowed INTO v_exception_allowed
  FROM public.tenant_access_exceptions
  WHERE tenant_id = v_tenant_id
    AND exception_date = v_local_date
  LIMIT 1;

  IF FOUND THEN
    RETURN v_exception_allowed;
  END IF;

  -- 2) Regra semanal
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_access_schedules
    WHERE tenant_id = v_tenant_id AND is_active = true
  ) INTO v_has_schedule;

  -- Fail-safe: tenant sem regras = liberado 24/7
  IF NOT v_has_schedule THEN
    RETURN true;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.tenant_access_schedules
    WHERE tenant_id = v_tenant_id
      AND is_active = true
      AND weekday = v_local_weekday
      AND v_local_time >= start_time
      AND v_local_time <  end_time
  ) INTO v_match;

  RETURN v_match;
END;
$$;

-- 5) WRAPPER PARA RLS (usa auth.uid()) -----------------------

CREATE OR REPLACE FUNCTION public.is_within_access_window_for_rls()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN true  -- não bloqueia contexto de service_role / anon
    ELSE public.is_within_access_window(auth.uid())
  END
$$;

-- 6) ALTERAR validate_app_session ----------------------------

CREATE OR REPLACE FUNCTION public.validate_app_session(p_session_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_session RECORD;
  v_tenant_id uuid;
BEGIN
  SELECT id, user_id, tenant_id, is_valid, expires_at, invalidated_reason
  INTO v_session
  FROM public.app_sessions
  WHERE id = p_session_id;

  IF v_session IS NULL THEN
    RETURN json_build_object('valid', false, 'reason', 'session_not_found');
  END IF;

  IF NOT v_session.is_valid THEN
    RETURN json_build_object('valid', false, 'reason', COALESCE(v_session.invalidated_reason, 'invalidated'));
  END IF;

  IF v_session.expires_at < now() THEN
    UPDATE public.app_sessions
    SET is_valid = false, invalidated_at = now(), invalidated_reason = 'idle_timeout'
    WHERE id = p_session_id;
    RETURN json_build_object('valid', false, 'reason', 'idle_timeout');
  END IF;

  -- NOVA REGRA: janela de acesso
  IF NOT public.is_within_access_window(v_session.user_id) THEN
    UPDATE public.app_sessions
    SET is_valid = false,
        invalidated_at = now(),
        invalidated_reason = 'outside_allowed_hours'
    WHERE id = p_session_id;

    -- Reuso do access_violation_log
    INSERT INTO public.access_violation_log (
      user_id, action, entity_type, details
    ) VALUES (
      v_session.user_id,
      'outside_allowed_hours',
      'app_session',
      jsonb_build_object(
        'session_id', v_session.id,
        'tenant_id', v_session.tenant_id,
        'context', 'session_validation',
        'checked_at', now()
      )
    );

    RETURN json_build_object('valid', false, 'reason', 'outside_allowed_hours');
  END IF;

  RETURN json_build_object('valid', true);
END;
$function$;

-- 7) ALTERAR create_app_session ------------------------------

CREATE OR REPLACE FUNCTION public.create_app_session(
  p_user_id uuid,
  p_device_info text DEFAULT NULL,
  p_ip_address text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_timeout INT;
  v_session_id UUID;
  v_tenant_id UUID;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text));

  -- NOVA REGRA: bloquear login fora da janela
  IF NOT public.is_within_access_window(p_user_id) THEN
    SELECT ut.tenant_id INTO v_tenant_id
    FROM public.user_tenants ut
    WHERE ut.user_id = p_user_id
    LIMIT 1;

    INSERT INTO public.access_violation_log (
      user_id, action, entity_type, ip_address, user_agent, details
    ) VALUES (
      p_user_id,
      'outside_allowed_hours',
      'login_attempt',
      p_ip_address,
      p_user_agent,
      jsonb_build_object(
        'tenant_id', v_tenant_id,
        'context', 'login',
        'device_info', p_device_info,
        'attempted_at', now()
      )
    );

    RETURN json_build_object(
      'success', false,
      'error', 'OUTSIDE_ALLOWED_HOURS',
      'message', 'Acesso fora do horário permitido'
    );
  END IF;

  v_timeout := public.get_session_idle_timeout_minutes();

  IF EXISTS (
    SELECT 1 FROM public.app_sessions
    WHERE user_id = p_user_id AND is_valid = true AND expires_at > now()
  ) THEN
    RETURN json_build_object('success', false, 'error', 'ACTIVE_SESSION_EXISTS');
  END IF;

  SELECT ut.tenant_id INTO v_tenant_id
  FROM public.user_tenants ut
  WHERE ut.user_id = p_user_id
  LIMIT 1;

  INSERT INTO public.app_sessions (
    user_id, tenant_id, expires_at, device_info, ip_address, user_agent
  )
  VALUES (
    p_user_id, v_tenant_id,
    now() + (v_timeout || ' minutes')::INTERVAL,
    p_device_info, p_ip_address, p_user_agent
  )
  RETURNING id INTO v_session_id;

  RETURN json_build_object('success', true, 'session_id', v_session_id);
END;
$function$;

-- 8) RLS ADICIONAL EM deals E orders -------------------------
-- Política RESTRICTIVE: combina com TODAS as outras (AND), não substitui.

CREATE POLICY "access window restrictive on deals"
  ON public.deals AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (public.is_within_access_window_for_rls())
  WITH CHECK (public.is_within_access_window_for_rls());

CREATE POLICY "access window restrictive on orders"
  ON public.orders AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (public.is_within_access_window_for_rls())
  WITH CHECK (public.is_within_access_window_for_rls());