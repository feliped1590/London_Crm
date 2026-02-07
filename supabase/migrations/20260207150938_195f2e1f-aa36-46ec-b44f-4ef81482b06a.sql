-- ==============================================
-- GO-LIVE Migration 1: Licenciamento e Auditoria
-- ==============================================

-- 1. Atualizar limite de usuários para 25
UPDATE public.license_settings 
SET max_users = 25, 
    plan_name = 'professional',
    updated_at = now();

-- 2. Criar tabela de auditoria de usuários (se não existir)
CREATE TABLE IF NOT EXISTS public.user_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL, -- 'created', 'deleted', 'role_changed'
    target_user_id UUID NOT NULL,
    target_user_email TEXT,
    performed_by UUID,
    old_value JSONB,
    new_value JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.user_audit_log ENABLE ROW LEVEL SECURITY;

-- Política: Admins podem visualizar logs
CREATE POLICY "Admins can view user audit log"
    ON public.user_audit_log
    FOR SELECT
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));

-- Política: Sistema pode inserir logs
CREATE POLICY "Authenticated users can insert user audit log"
    ON public.user_audit_log
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Impedir modificação/exclusão de logs de auditoria
CREATE TRIGGER prevent_user_audit_modification
    BEFORE UPDATE OR DELETE ON public.user_audit_log
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_audit_modification();