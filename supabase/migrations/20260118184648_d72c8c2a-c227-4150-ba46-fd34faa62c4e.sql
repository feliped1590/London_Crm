-- Add 'atendente' to app_role enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'atendente';

-- Create access_level enum
CREATE TYPE access_level AS ENUM ('restrito', 'total');

-- Create system_modules table
CREATE TABLE public.system_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  name text NOT NULL,
  icon text,
  path text NOT NULL,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create role_module_permissions table
CREATE TABLE public.role_module_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL,
  module_id uuid REFERENCES public.system_modules(id) ON DELETE CASCADE,
  can_access boolean DEFAULT true,
  access_type access_level DEFAULT 'restrito',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(role, module_id)
);

-- Enable RLS
ALTER TABLE public.system_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_module_permissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for system_modules
CREATE POLICY "Authenticated users can view modules"
ON public.system_modules FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage modules"
ON public.system_modules FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for role_module_permissions
CREATE POLICY "Authenticated users can view permissions"
ON public.role_module_permissions FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage permissions"
ON public.role_module_permissions FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Function to check if user has access to a module
CREATE OR REPLACE FUNCTION public.has_module_access(_user_id uuid, _module_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.role_module_permissions rmp
    JOIN public.system_modules sm ON sm.id = rmp.module_id
    JOIN public.user_roles ur ON ur.role = rmp.role
    WHERE ur.user_id = _user_id
      AND sm.key = _module_key
      AND rmp.can_access = true
      AND sm.is_active = true
  )
  OR public.has_role(_user_id, 'admin')
$$;

-- Function to get module access type
CREATE OR REPLACE FUNCTION public.get_module_access_type(_user_id uuid, _module_key text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE 
    WHEN public.has_role(_user_id, 'admin') THEN 'total'
    ELSE COALESCE(
      (SELECT rmp.access_type::text
       FROM public.role_module_permissions rmp
       JOIN public.system_modules sm ON sm.id = rmp.module_id
       JOIN public.user_roles ur ON ur.role = rmp.role
       WHERE ur.user_id = _user_id
         AND sm.key = _module_key
         AND rmp.can_access = true
         AND sm.is_active = true
       ORDER BY 
         CASE rmp.access_type WHEN 'total' THEN 1 ELSE 2 END
       LIMIT 1),
      'none'
    )
  END
$$;

-- Function to get all modules user can access
CREATE OR REPLACE FUNCTION public.get_user_modules(_user_id uuid)
RETURNS TABLE(module_key text, module_name text, module_path text, module_icon text, access_type text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT
    sm.key,
    sm.name,
    sm.path,
    sm.icon,
    CASE 
      WHEN public.has_role(_user_id, 'admin') THEN 'total'
      ELSE rmp.access_type::text
    END as access_type
  FROM public.system_modules sm
  LEFT JOIN public.role_module_permissions rmp ON rmp.module_id = sm.id
  LEFT JOIN public.user_roles ur ON ur.role = rmp.role AND ur.user_id = _user_id
  WHERE sm.is_active = true
    AND (public.has_role(_user_id, 'admin') OR (rmp.can_access = true AND ur.user_id IS NOT NULL))
  ORDER BY sm.key
$$;

-- Insert default modules
INSERT INTO public.system_modules (key, name, icon, path, sort_order) VALUES
  ('dashboard', 'Dashboard', 'LayoutDashboard', '/', 1),
  ('companies', 'Empresas', 'Building2', '/companies', 2),
  ('contacts', 'Contatos', 'Users', '/contacts', 3),
  ('pipeline', 'Pipeline', 'Kanban', '/pipeline', 4),
  ('products', 'Produtos', 'Package', '/products', 5),
  ('orders', 'Pedidos', 'ShoppingCart', '/orders', 6),
  ('tasks', 'Tarefas', 'CheckSquare', '/tasks', 7),
  ('whatsapp', 'WhatsApp', 'MessageCircle', '/whatsapp', 8),
  ('emails', 'Emails', 'Mail', '/emails', 9),
  ('reports', 'Relatórios', 'BarChart3', '/reports', 10),
  ('iniflex', 'Iniflex', 'Database', '/iniflex', 11),
  ('settings', 'Configurações', 'Settings', '/settings', 12);

-- Insert default permissions for vendedor only (atendente will be added in a separate migration)
INSERT INTO public.role_module_permissions (role, module_id, can_access, access_type)
SELECT 'vendedor', id, true, 'total' FROM public.system_modules WHERE key IN ('dashboard', 'companies', 'contacts', 'pipeline', 'orders', 'tasks', 'whatsapp', 'emails');

INSERT INTO public.role_module_permissions (role, module_id, can_access, access_type)
SELECT 'vendedor', id, true, 'restrito' FROM public.system_modules WHERE key IN ('products', 'reports');

INSERT INTO public.role_module_permissions (role, module_id, can_access, access_type)
SELECT 'vendedor', id, false, 'restrito' FROM public.system_modules WHERE key IN ('iniflex', 'settings');

-- Trigger to update updated_at
CREATE TRIGGER update_role_module_permissions_updated_at
BEFORE UPDATE ON public.role_module_permissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();