-- Tabela para configurações de licença
CREATE TABLE public.license_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    max_users INTEGER NOT NULL DEFAULT 5,
    plan_name TEXT NOT NULL DEFAULT 'starter',
    valid_until TIMESTAMPTZ,
    features JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger para updated_at
CREATE TRIGGER update_license_settings_updated_at
    BEFORE UPDATE ON public.license_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar RLS
ALTER TABLE public.license_settings ENABLE ROW LEVEL SECURITY;

-- Política: apenas leitura para usuários autenticados
CREATE POLICY "Authenticated users can view license settings"
    ON public.license_settings
    FOR SELECT
    TO authenticated
    USING (true);

-- Política: apenas admins podem atualizar
CREATE POLICY "Only admins can update license settings"
    ON public.license_settings
    FOR UPDATE
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));

-- Inserir configuração inicial (limite de 5 usuários)
INSERT INTO public.license_settings (max_users, plan_name) 
VALUES (5, 'starter');

-- Função para verificar status da licença
CREATE OR REPLACE FUNCTION public.get_license_status()
RETURNS TABLE (
    current_users INTEGER,
    max_users INTEGER,
    plan_name TEXT,
    can_add_user BOOLEAN,
    usage_percentage NUMERIC,
    valid_until TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        (SELECT COUNT(*)::INTEGER FROM auth.users) as current_users,
        ls.max_users,
        ls.plan_name,
        (SELECT COUNT(*) FROM auth.users) < ls.max_users as can_add_user,
        ROUND((SELECT COUNT(*) FROM auth.users)::NUMERIC / ls.max_users * 100, 1) as usage_percentage,
        ls.valid_until
    FROM license_settings ls
    LIMIT 1;
$$;