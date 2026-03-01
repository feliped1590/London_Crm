CREATE OR REPLACE FUNCTION public.get_active_sessions_admin()
 RETURNS TABLE(session_id uuid, user_id uuid, user_name text, user_email text, started_at timestamp with time zone, last_activity_at timestamp with time zone, expires_at timestamp with time zone, device_info text, ip_address text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem visualizar sessões';
  END IF;
  RETURN QUERY
  SELECT s.id, s.user_id, p.full_name, u.email::text, s.started_at, s.last_activity_at, s.expires_at, s.device_info, s.ip_address
  FROM public.app_sessions s
  JOIN auth.users u ON u.id = s.user_id
  LEFT JOIN public.profiles p ON p.user_id = s.user_id
  WHERE s.is_valid = true AND s.expires_at > now()
  ORDER BY s.started_at DESC;
END;
$function$;