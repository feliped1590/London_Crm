
CREATE OR REPLACE FUNCTION public.get_session_idle_timeout_minutes()
RETURNS INTEGER
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT COALESCE(
    (SELECT (value->>'session_idle_timeout_minutes')::INTEGER
     FROM public.system_settings
     WHERE key = 'session_config'
     LIMIT 1),
    60
  );
$$;

CREATE OR REPLACE FUNCTION public.check_existing_session(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_session RECORD;
BEGIN
  UPDATE public.app_sessions
  SET is_valid = false, invalidated_at = now(), invalidated_reason = 'idle_timeout'
  WHERE user_id = p_user_id AND is_valid = true AND expires_at < now();

  SELECT started_at, device_info, ip_address
  INTO v_session
  FROM public.app_sessions
  WHERE user_id = p_user_id AND is_valid = true
  ORDER BY started_at DESC LIMIT 1;

  IF v_session IS NULL THEN
    RETURN json_build_object('has_active', false);
  ELSE
    RETURN json_build_object(
      'has_active', true,
      'session', json_build_object(
        'started_at', v_session.started_at,
        'device_info', v_session.device_info,
        'ip_address', v_session.ip_address
      )
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_app_session(
  p_user_id UUID, p_device_info TEXT DEFAULT NULL, p_ip_address TEXT DEFAULT NULL, p_user_agent TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_timeout INT; v_session_id UUID; v_tenant_id UUID;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text));
  v_timeout := public.get_session_idle_timeout_minutes();

  IF EXISTS (SELECT 1 FROM public.app_sessions WHERE user_id = p_user_id AND is_valid = true AND expires_at > now()) THEN
    RETURN json_build_object('success', false, 'error', 'ACTIVE_SESSION_EXISTS');
  END IF;

  SELECT ut.tenant_id INTO v_tenant_id FROM public.user_tenants ut WHERE ut.user_id = p_user_id LIMIT 1;

  INSERT INTO public.app_sessions (user_id, tenant_id, expires_at, device_info, ip_address, user_agent)
  VALUES (p_user_id, v_tenant_id, now() + (v_timeout || ' minutes')::INTERVAL, p_device_info, p_ip_address, p_user_agent)
  RETURNING id INTO v_session_id;

  RETURN json_build_object('success', true, 'session_id', v_session_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.force_replace_session(
  p_user_id UUID, p_device_info TEXT DEFAULT NULL, p_ip_address TEXT DEFAULT NULL, p_user_agent TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_timeout INT; v_session_id UUID; v_tenant_id UUID;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text));
  v_timeout := public.get_session_idle_timeout_minutes();

  UPDATE public.app_sessions
  SET is_valid = false, invalidated_at = now(), invalidated_reason = 'replaced_by_new_login'
  WHERE user_id = p_user_id AND is_valid = true;

  SELECT ut.tenant_id INTO v_tenant_id FROM public.user_tenants ut WHERE ut.user_id = p_user_id LIMIT 1;

  INSERT INTO public.app_sessions (user_id, tenant_id, expires_at, device_info, ip_address, user_agent)
  VALUES (p_user_id, v_tenant_id, now() + (v_timeout || ' minutes')::INTERVAL, p_device_info, p_ip_address, p_user_agent)
  RETURNING id INTO v_session_id;

  RETURN json_build_object('success', true, 'session_id', v_session_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.touch_app_session(p_session_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE v_count INT;
BEGIN
  UPDATE public.app_sessions
  SET last_activity_at = now(),
      expires_at = now() + (public.get_session_idle_timeout_minutes() || ' minutes')::INTERVAL
  WHERE id = p_session_id AND is_valid = true AND expires_at > now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_app_session(p_session_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE v_session RECORD;
BEGIN
  SELECT is_valid, expires_at, invalidated_reason INTO v_session
  FROM public.app_sessions WHERE id = p_session_id;

  IF v_session IS NULL THEN
    RETURN json_build_object('valid', false, 'reason', 'session_not_found');
  END IF;
  IF NOT v_session.is_valid THEN
    RETURN json_build_object('valid', false, 'reason', COALESCE(v_session.invalidated_reason, 'invalidated'));
  END IF;
  IF v_session.expires_at < now() THEN
    UPDATE public.app_sessions SET is_valid = false, invalidated_at = now(), invalidated_reason = 'idle_timeout' WHERE id = p_session_id;
    RETURN json_build_object('valid', false, 'reason', 'idle_timeout');
  END IF;
  RETURN json_build_object('valid', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_kill_session(p_session_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem encerrar sessões';
  END IF;
  UPDATE public.app_sessions SET is_valid = false, invalidated_at = now(), invalidated_reason = 'admin_kick'
  WHERE id = p_session_id AND is_valid = true;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.invalidate_own_session(p_session_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  UPDATE public.app_sessions SET is_valid = false, invalidated_at = now(), invalidated_reason = 'manual_logout'
  WHERE id = p_session_id AND user_id = auth.uid() AND is_valid = true;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE v_count INTEGER;
BEGIN
  UPDATE public.app_sessions SET is_valid = false, invalidated_at = now(), invalidated_reason = 'idle_timeout'
  WHERE is_valid = true AND expires_at < now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_active_sessions_admin()
RETURNS TABLE(
  session_id UUID, user_id UUID, user_name TEXT, user_email TEXT,
  started_at TIMESTAMPTZ, last_activity_at TIMESTAMPTZ, expires_at TIMESTAMPTZ,
  device_info TEXT, ip_address TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem visualizar sessões';
  END IF;
  RETURN QUERY
  SELECT s.id, s.user_id, p.full_name, u.email, s.started_at, s.last_activity_at, s.expires_at, s.device_info, s.ip_address
  FROM public.app_sessions s
  JOIN auth.users u ON u.id = s.user_id
  LEFT JOIN public.profiles p ON p.user_id = s.user_id
  WHERE s.is_valid = true AND s.expires_at > now()
  ORDER BY s.started_at DESC;
END;
$$;

-- Habilitar realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_sessions;
