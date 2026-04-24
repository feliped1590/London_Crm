DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'permission_action') THEN
    CREATE TYPE public.permission_action AS ENUM ('view', 'create', 'edit', 'delete');
  END IF;
END $$;

ALTER TABLE public.role_module_permissions
  ADD COLUMN IF NOT EXISTS can_view boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_create boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_edit boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_delete boolean NOT NULL DEFAULT false;

UPDATE public.role_module_permissions
SET
  can_view = COALESCE(can_access, false),
  can_create = COALESCE(can_access, false) AND access_type = 'total',
  can_edit = COALESCE(can_access, false) AND access_type = 'total',
  can_delete = false
WHERE can_view = false
  AND can_create = false
  AND can_edit = false
  AND can_delete = false;

CREATE OR REPLACE FUNCTION public.normalize_module_permissions()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.can_create, false) OR COALESCE(NEW.can_edit, false) OR COALESCE(NEW.can_delete, false) THEN
    NEW.can_view := true;
  END IF;

  IF NEW.can_view IS false THEN
    NEW.can_create := false;
    NEW.can_edit := false;
    NEW.can_delete := false;
  END IF;

  NEW.can_access := NEW.can_view;

  IF NEW.can_create OR NEW.can_edit OR NEW.can_delete THEN
    NEW.access_type := 'total';
  ELSIF NEW.can_view THEN
    NEW.access_type := 'restrito';
  ELSE
    NEW.access_type := 'restrito';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_role_module_permissions ON public.role_module_permissions;
CREATE TRIGGER normalize_role_module_permissions
BEFORE INSERT OR UPDATE ON public.role_module_permissions
FOR EACH ROW
EXECUTE FUNCTION public.normalize_module_permissions();

CREATE TABLE IF NOT EXISTS public.user_permission_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  changed_by uuid,
  target_role public.app_role,
  module_id uuid,
  module_key text,
  action public.permission_action,
  old_value boolean,
  new_value boolean,
  change_type text NOT NULL DEFAULT 'permission_update',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_permission_changes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and developers can view permission changes" ON public.user_permission_changes;
CREATE POLICY "Admins and developers can view permission changes"
ON public.user_permission_changes
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'desenvolvedor'::public.app_role)
);

DROP POLICY IF EXISTS "Admins and developers can create permission changes" ON public.user_permission_changes;
CREATE POLICY "Admins and developers can create permission changes"
ON public.user_permission_changes
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'desenvolvedor'::public.app_role)
);

CREATE OR REPLACE FUNCTION public.audit_role_module_permission_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_module_key text;
BEGIN
  SELECT key INTO v_module_key
  FROM public.system_modules
  WHERE id = COALESCE(NEW.module_id, OLD.module_id);

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.user_permission_changes(target_role, module_id, module_key, action, old_value, new_value, change_type, metadata)
    VALUES
      (NEW.role, NEW.module_id, v_module_key, 'view', NULL, NEW.can_view, 'permission_insert', jsonb_build_object('source', 'trigger')),
      (NEW.role, NEW.module_id, v_module_key, 'create', NULL, NEW.can_create, 'permission_insert', jsonb_build_object('source', 'trigger')),
      (NEW.role, NEW.module_id, v_module_key, 'edit', NULL, NEW.can_edit, 'permission_insert', jsonb_build_object('source', 'trigger')),
      (NEW.role, NEW.module_id, v_module_key, 'delete', NULL, NEW.can_delete, 'permission_insert', jsonb_build_object('source', 'trigger'));
    RETURN NEW;
  END IF;

  IF OLD.can_view IS DISTINCT FROM NEW.can_view THEN
    INSERT INTO public.user_permission_changes(target_role, module_id, module_key, action, old_value, new_value, metadata)
    VALUES (NEW.role, NEW.module_id, v_module_key, 'view', OLD.can_view, NEW.can_view, jsonb_build_object('source', 'trigger'));
  END IF;

  IF OLD.can_create IS DISTINCT FROM NEW.can_create THEN
    INSERT INTO public.user_permission_changes(target_role, module_id, module_key, action, old_value, new_value, metadata)
    VALUES (NEW.role, NEW.module_id, v_module_key, 'create', OLD.can_create, NEW.can_create, jsonb_build_object('source', 'trigger'));
  END IF;

  IF OLD.can_edit IS DISTINCT FROM NEW.can_edit THEN
    INSERT INTO public.user_permission_changes(target_role, module_id, module_key, action, old_value, new_value, metadata)
    VALUES (NEW.role, NEW.module_id, v_module_key, 'edit', OLD.can_edit, NEW.can_edit, jsonb_build_object('source', 'trigger'));
  END IF;

  IF OLD.can_delete IS DISTINCT FROM NEW.can_delete THEN
    INSERT INTO public.user_permission_changes(target_role, module_id, module_key, action, old_value, new_value, metadata)
    VALUES (NEW.role, NEW.module_id, v_module_key, 'delete', OLD.can_delete, NEW.can_delete, jsonb_build_object('source', 'trigger'));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_role_module_permission_changes ON public.role_module_permissions;
CREATE TRIGGER audit_role_module_permission_changes
AFTER INSERT OR UPDATE ON public.role_module_permissions
FOR EACH ROW
EXECUTE FUNCTION public.audit_role_module_permission_changes();

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
    CASE
      WHEN bool_or(COALESCE(rmp.can_create, false) OR COALESCE(rmp.can_edit, false) OR COALESCE(rmp.can_delete, false)) THEN 'total'::public.access_level
      WHEN bool_or(COALESCE(rmp.can_view, COALESCE(rmp.can_access, false))) THEN 'restrito'::public.access_level
      ELSE 'restrito'::public.access_level
    END AS access_type,
    bool_or(COALESCE(rmp.can_view, COALESCE(rmp.can_access, false))) AS can_view,
    bool_or(COALESCE(rmp.can_create, COALESCE(rmp.can_access, false) AND rmp.access_type = 'total')) AS can_create,
    bool_or(COALESCE(rmp.can_edit, COALESCE(rmp.can_access, false) AND rmp.access_type = 'total')) AS can_edit,
    bool_or(COALESCE(rmp.can_delete, false)) AS can_delete
  FROM public.system_modules sm
  JOIN public.role_module_permissions rmp ON rmp.module_id = sm.id
  JOIN public.user_roles ur ON ur.role = rmp.role
  WHERE ur.user_id = _user_id
    AND sm.is_active = true
    AND COALESCE(rmp.can_view, COALESCE(rmp.can_access, false)) = true
  GROUP BY sm.key, sm.name, sm.path, sm.icon, sm.sort_order
  ORDER BY sm.sort_order, sm.name;
$$;

CREATE OR REPLACE FUNCTION public.has_module_permission(_user_id uuid, _module_key text, _action public.permission_action)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.has_role(_user_id, 'admin'::public.app_role) OR public.has_role(_user_id, 'desenvolvedor'::public.app_role) THEN true
    WHEN _action = 'view' THEN EXISTS (
      SELECT 1
      FROM public.get_user_module_permissions(_user_id) p
      WHERE p.module_key = _module_key AND p.can_view = true
    )
    WHEN _action = 'create' THEN EXISTS (
      SELECT 1
      FROM public.get_user_module_permissions(_user_id) p
      WHERE p.module_key = _module_key AND p.can_view = true AND p.can_create = true
    )
    WHEN _action = 'edit' THEN EXISTS (
      SELECT 1
      FROM public.get_user_module_permissions(_user_id) p
      WHERE p.module_key = _module_key AND p.can_view = true AND p.can_edit = true
    )
    WHEN _action = 'delete' THEN EXISTS (
      SELECT 1
      FROM public.get_user_module_permissions(_user_id) p
      WHERE p.module_key = _module_key AND p.can_view = true AND p.can_delete = true
    )
    ELSE false
  END;
$$;