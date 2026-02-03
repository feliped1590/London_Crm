-- =====================================================
-- SPRINT 1: GOVERNANÇA DE CARTEIRA
-- =====================================================

-- 1. Tabela de log de violações de acesso (com campo action para reuso futuro)
CREATE TABLE IF NOT EXISTS public.access_violation_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    action TEXT NOT NULL, -- 'CREATE_DEAL', 'UPDATE_COMPANY', 'DELETE_DEAL', etc.
    entity_type TEXT NOT NULL, -- 'deal', 'company', 'contact'
    entity_id UUID,
    target_owner_id UUID NOT NULL, -- dono do cliente/entidade alvo
    target_owner_name TEXT, -- nome do vendedor para exibição
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ip_address TEXT,
    user_agent TEXT,
    details JSONB DEFAULT '{}'::jsonb
);

-- Índices para consultas de auditoria
CREATE INDEX IF NOT EXISTS idx_access_violation_log_user_id ON public.access_violation_log(user_id);
CREATE INDEX IF NOT EXISTS idx_access_violation_log_attempted_at ON public.access_violation_log(attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_violation_log_action ON public.access_violation_log(action);

-- RLS para access_violation_log (apenas admin pode ver)
ALTER TABLE public.access_violation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all violation logs"
    ON public.access_violation_log
    FOR SELECT
    USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert violation logs"
    ON public.access_violation_log
    FOR INSERT
    WITH CHECK (true);

-- 2. Função para verificar consistência de carteira ao criar/editar deal
CREATE OR REPLACE FUNCTION public.check_deal_owner_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_company_owner_id UUID;
    v_company_owner_name TEXT;
    v_is_admin BOOLEAN;
BEGIN
    -- Verificar se usuário é admin
    v_is_admin := public.has_role(auth.uid(), 'admin');
    
    -- Se for admin, permite qualquer operação
    IF v_is_admin THEN
        RETURN NEW;
    END IF;
    
    -- Buscar owner_id da empresa vinculada ao deal
    IF NEW.company_id IS NOT NULL THEN
        SELECT c.owner_id, p.full_name
        INTO v_company_owner_id, v_company_owner_name
        FROM public.companies c
        LEFT JOIN public.profiles p ON p.user_id = c.owner_id
        WHERE c.id = NEW.company_id;
        
        -- Se a empresa tem dono e não é o usuário atual
        IF v_company_owner_id IS NOT NULL AND v_company_owner_id != auth.uid() THEN
            -- Registrar tentativa de violação
            INSERT INTO public.access_violation_log (
                user_id,
                action,
                entity_type,
                entity_id,
                target_owner_id,
                target_owner_name,
                details
            ) VALUES (
                auth.uid(),
                CASE WHEN TG_OP = 'INSERT' THEN 'CREATE_DEAL' ELSE 'UPDATE_DEAL' END,
                'deal',
                COALESCE(NEW.id, gen_random_uuid()),
                v_company_owner_id,
                v_company_owner_name,
                jsonb_build_object(
                    'deal_name', NEW.name,
                    'company_id', NEW.company_id,
                    'attempted_operation', TG_OP
                )
            );
            
            -- Bloquear operação com mensagem clara
            RAISE EXCEPTION 'Este cliente pertence ao vendedor %. Você não pode criar ou editar negócios para clientes de outros vendedores.', 
                COALESCE(v_company_owner_name, 'outro vendedor');
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- 3. Trigger para validar deals
DROP TRIGGER IF EXISTS check_deal_owner_consistency_trigger ON public.deals;
CREATE TRIGGER check_deal_owner_consistency_trigger
    BEFORE INSERT OR UPDATE ON public.deals
    FOR EACH ROW
    EXECUTE FUNCTION public.check_deal_owner_consistency();

-- 4. Função para verificar edição de empresa
CREATE OR REPLACE FUNCTION public.check_company_edit_permission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_is_admin BOOLEAN;
    v_owner_name TEXT;
BEGIN
    -- Verificar se usuário é admin
    v_is_admin := public.has_role(auth.uid(), 'admin');
    
    -- Se for admin, permite qualquer operação
    IF v_is_admin THEN
        RETURN NEW;
    END IF;
    
    -- Se a empresa tem dono e não é o usuário atual
    IF OLD.owner_id IS NOT NULL AND OLD.owner_id != auth.uid() THEN
        -- Buscar nome do dono para mensagem
        SELECT full_name INTO v_owner_name
        FROM public.profiles
        WHERE user_id = OLD.owner_id;
        
        -- Registrar tentativa de violação
        INSERT INTO public.access_violation_log (
            user_id,
            action,
            entity_type,
            entity_id,
            target_owner_id,
            target_owner_name,
            details
        ) VALUES (
            auth.uid(),
            'UPDATE_COMPANY',
            'company',
            OLD.id,
            OLD.owner_id,
            v_owner_name,
            jsonb_build_object(
                'company_name', OLD.name,
                'attempted_changes', to_jsonb(NEW) - to_jsonb(OLD)
            )
        );
        
        -- Bloquear operação
        RAISE EXCEPTION 'Este cliente pertence ao vendedor %. Você não pode editar clientes de outros vendedores.', 
            COALESCE(v_owner_name, 'outro vendedor');
    END IF;
    
    RETURN NEW;
END;
$$;

-- 5. Trigger para validar edição de empresas
DROP TRIGGER IF EXISTS check_company_edit_permission_trigger ON public.companies;
CREATE TRIGGER check_company_edit_permission_trigger
    BEFORE UPDATE ON public.companies
    FOR EACH ROW
    EXECUTE FUNCTION public.check_company_edit_permission();

-- 6. Índice para performance nas consultas de carteira
CREATE INDEX IF NOT EXISTS idx_companies_owner_id ON public.companies(owner_id);
CREATE INDEX IF NOT EXISTS idx_deals_company_id ON public.deals(company_id);