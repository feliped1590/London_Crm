-- ============================================================
-- HARDENING — Controle de acesso por calendário
-- ============================================================

-- 1) RLS: separar leitura (livre) de escrita (bloqueada fora da janela)
-- ----------------------------------------------------------------------

DROP POLICY IF EXISTS "access window restrictive on deals" ON public.deals;
DROP POLICY IF EXISTS "access window restrictive on orders" ON public.orders;

-- DEALS: bloqueia apenas INSERT/UPDATE/DELETE
CREATE POLICY "access window blocks insert on deals"
  ON public.deals AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (public.is_within_access_window_for_rls());

CREATE POLICY "access window blocks update on deals"
  ON public.deals AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (public.is_within_access_window_for_rls())
  WITH CHECK (public.is_within_access_window_for_rls());

CREATE POLICY "access window blocks delete on deals"
  ON public.deals AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (public.is_within_access_window_for_rls());

-- ORDERS: idem
CREATE POLICY "access window blocks insert on orders"
  ON public.orders AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (public.is_within_access_window_for_rls());

CREATE POLICY "access window blocks update on orders"
  ON public.orders AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (public.is_within_access_window_for_rls())
  WITH CHECK (public.is_within_access_window_for_rls());

CREATE POLICY "access window blocks delete on orders"
  ON public.orders AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (public.is_within_access_window_for_rls());

-- 2) is_within_access_window: logar admin/dev bypass fora do horário
-- ----------------------------------------------------------------------

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
  v_is_admin boolean;
  v_is_dev boolean;
BEGIN
  v_is_admin := public.has_role(p_user_id, 'admin');
  v_is_dev   := public.has_role(p_user_id, 'desenvolvedor');

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

  -- Sem tenant identificável → fail-safe permite
  IF v_tenant_id IS NULL THEN
    RETURN true;
  END IF;

  v_tz := public.get_tenant_timezone(v_tenant_id);
  v_local_now := (now() AT TIME ZONE v_tz);
  v_local_date := v_local_now::date;
  v_local_time := v_local_now::time;
  v_local_weekday := EXTRACT(DOW FROM v_local_now)::smallint;

  -- Calcula se está DENTRO da janela "real" (independente de role)
  -- 1) Exceções pontuais
  SELECT is_allowed INTO v_exception_allowed
  FROM public.tenant_access_exceptions
  WHERE tenant_id = v_tenant_id AND exception_date = v_local_date
  LIMIT 1;

  IF FOUND THEN
    v_match := v_exception_allowed;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM public.tenant_access_schedules
      WHERE tenant_id = v_tenant_id AND is_active = true
    ) INTO v_has_schedule;

    IF NOT v_has_schedule THEN
      v_match := true;
    ELSE
      SELECT EXISTS (
        SELECT 1 FROM public.tenant_access_schedules
        WHERE tenant_id = v_tenant_id
          AND is_active = true
          AND weekday  = v_local_weekday
          AND v_local_time >= start_time
          AND v_local_time <  end_time
      ) INTO v_match;
    END IF;
  END IF;

  -- Admin/Dev: sempre passam, mas logam quando estão FORA da janela
  -- (best-effort; a função é STABLE — se o INSERT falhar, ignoramos)
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
          'role', CASE WHEN v_is_admin THEN 'admin' ELSE 'desenvolvedor' END,
          'local_time', v_local_now,
          'context', 'rls_or_session_check'
        )
      );
    EXCEPTION WHEN OTHERS THEN
      -- silencioso: bypass logging não pode derrubar a chamada
      NULL;
    END;
    RETURN true;
  END IF;

  IF v_is_admin OR v_is_dev THEN
    RETURN true;
  END IF;

  RETURN v_match;
END;
$$;