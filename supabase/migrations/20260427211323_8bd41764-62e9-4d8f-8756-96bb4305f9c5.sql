CREATE OR REPLACE FUNCTION public.get_user_module_permissions(_user_id uuid)
RETURNS TABLE(
  module_key text,
  module_name text,
  module_path text,
  module_icon text,
  access_type public.access_level,
  can_view boolean,
  can_create boolean,
  can_edit boolean,
  can_delete boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    sm.key AS module_key,
    sm.name AS module_name,
    sm.path AS module_path,
    sm.icon AS module_icon,
    'total'::public.access_level AS access_type,
    true AS can_view,
    true AS can_create,
    true AS can_edit,
    false AS can_delete
  FROM public.system_modules sm
  WHERE sm.is_active = true
    AND (
      public.has_role(_user_id, 'admin'::public.app_role)
      OR public.has_role(_user_id, 'desenvolvedor'::public.app_role)
    )

  UNION ALL

  SELECT
    sm.key AS module_key,
    sm.name AS module_name,
    sm.path AS module_path,
    sm.icon AS module_icon,
    CASE
      WHEN bool_or(COALESCE(rmp.can_view, COALESCE(rmp.can_access, false)))
        AND bool_or(COALESCE(rmp.can_create, COALESCE(rmp.can_access, false) AND rmp.access_type = 'total'))
        AND bool_or(COALESCE(rmp.can_edit, COALESCE(rmp.can_access, false) AND rmp.access_type = 'total'))
        AND bool_or(COALESCE(rmp.can_delete, false) AND COALESCE(rmp.can_edit, false))
        THEN 'total'::public.access_level
      WHEN bool_or(COALESCE(rmp.can_view, COALESCE(rmp.can_access, false))) THEN 'restrito'::public.access_level
      ELSE 'restrito'::public.access_level
    END AS access_type,
    bool_or(COALESCE(rmp.can_view, COALESCE(rmp.can_access, false))) AS can_view,
    bool_or(COALESCE(rmp.can_create, COALESCE(rmp.can_access, false) AND rmp.access_type = 'total')) AS can_create,
    bool_or(COALESCE(rmp.can_edit, COALESCE(rmp.can_access, false) AND rmp.access_type = 'total')) AS can_edit,
    bool_or(COALESCE(rmp.can_delete, false) AND COALESCE(rmp.can_edit, false)) AS can_delete
  FROM public.system_modules sm
  JOIN public.role_module_permissions rmp ON rmp.module_id = sm.id
  JOIN public.user_roles ur ON ur.role = rmp.role
  WHERE ur.user_id = _user_id
    AND sm.is_active = true
    AND COALESCE(rmp.can_view, COALESCE(rmp.can_access, false)) = true
    AND NOT (
      public.has_role(_user_id, 'admin'::public.app_role)
      OR public.has_role(_user_id, 'desenvolvedor'::public.app_role)
    )
  GROUP BY sm.key, sm.name, sm.path, sm.icon, sm.sort_order
  ORDER BY module_key;
$$;