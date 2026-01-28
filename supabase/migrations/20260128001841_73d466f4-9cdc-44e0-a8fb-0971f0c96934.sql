-- Atualizar função has_role para tratar desenvolvedor como admin
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
        AND (
          role = _role 
          OR (role = 'desenvolvedor' AND _role = 'admin')
        )
    )
$$;

-- Atualizar função get_license_status para excluir desenvolvedores da contagem
CREATE OR REPLACE FUNCTION public.get_license_status()
RETURNS TABLE(current_users integer, max_users integer, plan_name text, can_add_user boolean, usage_percentage numeric, valid_until timestamp with time zone)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
    SELECT 
        (SELECT COUNT(*)::INTEGER 
         FROM auth.users u
         WHERE NOT EXISTS (
           SELECT 1 FROM public.user_roles ur 
           WHERE ur.user_id = u.id AND ur.role = 'desenvolvedor'
         )) as current_users,
        ls.max_users,
        ls.plan_name,
        (SELECT COUNT(*) 
         FROM auth.users u
         WHERE NOT EXISTS (
           SELECT 1 FROM public.user_roles ur 
           WHERE ur.user_id = u.id AND ur.role = 'desenvolvedor'
         )) < ls.max_users as can_add_user,
        ROUND((SELECT COUNT(*) 
         FROM auth.users u
         WHERE NOT EXISTS (
           SELECT 1 FROM public.user_roles ur 
           WHERE ur.user_id = u.id AND ur.role = 'desenvolvedor'
         ))::NUMERIC / ls.max_users * 100, 1) as usage_percentage,
        ls.valid_until
    FROM license_settings ls
    LIMIT 1;
$$;