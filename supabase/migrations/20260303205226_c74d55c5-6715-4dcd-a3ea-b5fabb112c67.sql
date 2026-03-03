
-- 1. Fix handle_new_user trigger to include user_tenants insertion
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
    -- Create profile
    INSERT INTO public.profiles (user_id, full_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email));
    
    -- Assign default role (vendedor)
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'vendedor');
    
    -- Auto-assign to default tenant
    SELECT id INTO v_tenant_id FROM public.tenants ORDER BY created_at LIMIT 1;
    
    IF v_tenant_id IS NOT NULL THEN
      INSERT INTO public.user_tenants (user_id, tenant_id)
      VALUES (NEW.id, v_tenant_id)
      ON CONFLICT DO NOTHING;
    END IF;
    
    RETURN NEW;
END;
$$;

-- 2. Insert orphan users into user_tenants
INSERT INTO public.user_tenants (user_id, tenant_id)
SELECT u.id, '00000000-0000-0000-0000-000000000001'
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_tenants ut WHERE ut.user_id = u.id
)
ON CONFLICT DO NOTHING;
