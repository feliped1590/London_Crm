CREATE OR REPLACE FUNCTION public.force_replace_session(
  p_user_id uuid,
  p_device_info text DEFAULT NULL::text,
  p_ip_address text DEFAULT NULL::text,
  p_user_agent text DEFAULT NULL::text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_timeout INT; v_session_id UUID; v_tenant_id UUID;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text));

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
        'context', 'force_replace_session',
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

  UPDATE public.app_sessions
  SET is_valid = false, invalidated_at = now(), invalidated_reason = 'replaced_by_new_login'
  WHERE user_id = p_user_id AND is_valid = true;

  SELECT ut.tenant_id INTO v_tenant_id
  FROM public.user_tenants ut
  WHERE ut.user_id = p_user_id
  LIMIT 1;

  INSERT INTO public.app_sessions (user_id, tenant_id, expires_at, device_info, ip_address, user_agent)
  VALUES (p_user_id, v_tenant_id, now() + (v_timeout || ' minutes')::INTERVAL, p_device_info, p_ip_address, p_user_agent)
  RETURNING id INTO v_session_id;

  RETURN json_build_object('success', true, 'session_id', v_session_id);
END;
$function$;