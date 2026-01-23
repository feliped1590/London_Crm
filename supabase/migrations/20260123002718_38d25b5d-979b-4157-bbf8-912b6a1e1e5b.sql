-- Add insights module to system_modules
INSERT INTO public.system_modules (key, name, path, icon, is_active, sort_order)
VALUES ('insights', 'Insights', '/insights', 'Lightbulb', true, 12)
ON CONFLICT (key) DO NOTHING;

-- Give all roles access to insights by default
INSERT INTO public.role_module_permissions (role, module_id, can_access, access_type)
SELECT 
  r.role,
  (SELECT id FROM public.system_modules WHERE key = 'insights'),
  true,
  'total'::access_level
FROM (VALUES ('admin'::app_role), ('vendedor'::app_role), ('atendente'::app_role)) AS r(role)
WHERE NOT EXISTS (
  SELECT 1 FROM public.role_module_permissions rmp
  WHERE rmp.role = r.role 
  AND rmp.module_id = (SELECT id FROM public.system_modules WHERE key = 'insights')
);