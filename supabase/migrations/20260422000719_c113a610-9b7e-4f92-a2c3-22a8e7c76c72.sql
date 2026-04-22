-- ============================================================
-- 1) Helper para edge functions sem userId (cron/batch ERP)
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_tenant_within_access_window(p_tenant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tz text;
  v_local_now timestamp;
  v_local_date date;
  v_local_time time;
  v_local_weekday smallint;
  v_exception_allowed boolean;
  v_has_schedule boolean;
  v_match boolean;
BEGIN
  IF p_tenant_id IS NULL THEN
    RETURN true;
  END IF;

  v_tz := public.get_tenant_timezone(p_tenant_id);
  v_local_now := (now() AT TIME ZONE v_tz);
  v_local_date := v_local_now::date;
  v_local_time := v_local_now::time;
  v_local_weekday := EXTRACT(DOW FROM v_local_now)::smallint;

  -- Exceções pontuais
  SELECT is_allowed INTO v_exception_allowed
  FROM public.tenant_access_exceptions
  WHERE tenant_id = p_tenant_id AND exception_date = v_local_date
  LIMIT 1;

  IF FOUND THEN
    RETURN v_exception_allowed;
  END IF;

  -- Regra semanal
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_access_schedules
    WHERE tenant_id = p_tenant_id AND is_active = true
  ) INTO v_has_schedule;

  IF NOT v_has_schedule THEN
    RETURN true; -- fail-safe
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.tenant_access_schedules
    WHERE tenant_id = p_tenant_id
      AND is_active = true
      AND weekday  = v_local_weekday
      AND v_local_time >= start_time
      AND v_local_time <  end_time
  ) INTO v_match;

  RETURN v_match;
END;
$$;

-- ============================================================
-- 2) Resumo consolidado de violações (admin-only)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_access_violations_summary(
  p_days int DEFAULT 30
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_total int;
  v_by_user json;
  v_by_day json;
  v_by_action json;
  v_recent json;
  v_since timestamptz;
BEGIN
  -- Apenas admin/desenvolvedor podem ver
  IF NOT (public.has_role(v_caller, 'admin') OR public.has_role(v_caller, 'desenvolvedor')) THEN
    RETURN json_build_object('error', 'forbidden');
  END IF;

  v_since := now() - (p_days || ' days')::interval;

  SELECT count(*) INTO v_total
  FROM public.access_violation_log
  WHERE attempted_at >= v_since
    AND action IN ('outside_allowed_hours', 'admin_bypass');

  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) INTO v_by_user
  FROM (
    SELECT
      avl.user_id,
      COALESCE(p.full_name, 'Desconhecido') AS user_name,
      count(*) AS total
    FROM public.access_violation_log avl
    LEFT JOIN public.profiles p ON p.user_id = avl.user_id
    WHERE avl.attempted_at >= v_since
      AND avl.action IN ('outside_allowed_hours', 'admin_bypass')
    GROUP BY avl.user_id, p.full_name
    ORDER BY count(*) DESC
    LIMIT 20
  ) t;

  SELECT COALESCE(json_agg(row_to_json(t) ORDER BY day DESC), '[]'::json) INTO v_by_day
  FROM (
    SELECT
      date_trunc('day', attempted_at)::date AS day,
      count(*) AS total
    FROM public.access_violation_log
    WHERE attempted_at >= v_since
      AND action IN ('outside_allowed_hours', 'admin_bypass')
    GROUP BY day
  ) t;

  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) INTO v_by_action
  FROM (
    SELECT
      action,
      count(*) AS total
    FROM public.access_violation_log
    WHERE attempted_at >= v_since
      AND action IN ('outside_allowed_hours', 'admin_bypass')
    GROUP BY action
  ) t;

  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) INTO v_recent
  FROM (
    SELECT
      avl.id,
      avl.user_id,
      COALESCE(p.full_name, 'Desconhecido') AS user_name,
      avl.action,
      avl.entity_type,
      avl.attempted_at,
      avl.details
    FROM public.access_violation_log avl
    LEFT JOIN public.profiles p ON p.user_id = avl.user_id
    WHERE avl.attempted_at >= v_since
      AND avl.action IN ('outside_allowed_hours', 'admin_bypass')
    ORDER BY avl.attempted_at DESC
    LIMIT 20
  ) t;

  RETURN json_build_object(
    'total', v_total,
    'period_days', p_days,
    'by_user', v_by_user,
    'by_day', v_by_day,
    'by_action', v_by_action,
    'recent', v_recent
  );
END;
$$;