CREATE OR REPLACE FUNCTION public.audit_role_module_permission_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  module_key_value TEXT;
  fields TEXT[] := ARRAY['can_view', 'can_create', 'can_edit', 'can_delete'];
  field_name TEXT;
  old_value BOOLEAN;
  new_value BOOLEAN;
  actor_id UUID;
BEGIN
  SELECT key INTO module_key_value
  FROM public.system_modules
  WHERE id = COALESCE(NEW.module_id, OLD.module_id);

  actor_id := auth.uid();

  FOREACH field_name IN ARRAY fields LOOP
    IF field_name = 'can_view' THEN
      old_value := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.can_view END;
      new_value := NEW.can_view;
    ELSIF field_name = 'can_create' THEN
      old_value := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.can_create END;
      new_value := NEW.can_create;
    ELSIF field_name = 'can_edit' THEN
      old_value := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.can_edit END;
      new_value := NEW.can_edit;
    ELSIF field_name = 'can_delete' THEN
      old_value := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.can_delete END;
      new_value := NEW.can_delete;
    END IF;

    IF TG_OP = 'INSERT' THEN
      IF new_value IS TRUE THEN
        INSERT INTO public.user_permission_changes (
          changed_by,
          target_role,
          module_id,
          module_key,
          action,
          change_type,
          old_value,
          new_value,
          metadata
        ) VALUES (
          actor_id,
          NEW.role,
          NEW.module_id,
          module_key_value,
          replace(field_name, 'can_', '')::public.permission_action,
          'permission_created',
          NULL,
          new_value,
          jsonb_build_object(
            'source', 'database_trigger',
            'access_type', NEW.access_type
          )
        );
      END IF;
    ELSIF old_value IS DISTINCT FROM new_value THEN
      INSERT INTO public.user_permission_changes (
        changed_by,
        target_role,
        module_id,
        module_key,
        action,
        change_type,
        old_value,
        new_value,
        metadata
      ) VALUES (
        actor_id,
        NEW.role,
        NEW.module_id,
        module_key_value,
        replace(field_name, 'can_', '')::public.permission_action,
        'permission_updated',
        old_value,
        new_value,
        jsonb_build_object(
          'source', 'database_trigger',
          'previous_access_type', OLD.access_type,
          'access_type', NEW.access_type
        )
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_role_module_permissions_changes ON public.role_module_permissions;
CREATE TRIGGER audit_role_module_permissions_changes
AFTER INSERT OR UPDATE ON public.role_module_permissions
FOR EACH ROW
EXECUTE FUNCTION public.audit_role_module_permission_changes();