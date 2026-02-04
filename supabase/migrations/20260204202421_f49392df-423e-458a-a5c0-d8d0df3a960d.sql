-- =============================================
-- GOVERNANÇA DE CARTEIRA DE CLIENTES
-- =============================================

-- 1. Tabela de Log de Intervenções Administrativas
-- Registra ações autorizadas de admins em clientes de outros vendedores
CREATE TABLE public.admin_intervention_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID NOT NULL REFERENCES auth.users(id),
    action_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    entity_name TEXT,
    client_id UUID,
    client_name TEXT,
    client_owner_id UUID,
    client_owner_name TEXT,
    justification TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para consultas
CREATE INDEX idx_admin_intervention_log_admin ON admin_intervention_log(admin_user_id);
CREATE INDEX idx_admin_intervention_log_created ON admin_intervention_log(created_at DESC);
CREATE INDEX idx_admin_intervention_log_client ON admin_intervention_log(client_id);
CREATE INDEX idx_admin_intervention_log_action ON admin_intervention_log(action_type);

-- RLS: apenas admins podem ver
ALTER TABLE admin_intervention_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all interventions"
    ON admin_intervention_log FOR SELECT
    USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can insert interventions"
    ON admin_intervention_log FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- Comentários
COMMENT ON TABLE admin_intervention_log IS 'Registra ações autorizadas de administradores em clientes fora de sua própria carteira';
COMMENT ON COLUMN admin_intervention_log.action_type IS 'Tipo da ação: CREATE_DEAL, UPDATE_DEAL, MOVE_STAGE, CREATE_TASK, UPDATE_TASK, CREATE_ORDER, UPDATE_ORDER';
COMMENT ON COLUMN admin_intervention_log.entity_type IS 'Tipo da entidade: deal, task, order';
COMMENT ON COLUMN admin_intervention_log.justification IS 'Motivo obrigatório informado pelo administrador';

-- 2. Trigger para Governança em Tasks
CREATE OR REPLACE FUNCTION public.check_task_owner_consistency()
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
    
    -- Se for admin, permite qualquer operação (justificativa é tratada no frontend)
    IF v_is_admin THEN
        RETURN NEW;
    END IF;
    
    -- Verificar se task está vinculada a uma empresa
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
                CASE WHEN TG_OP = 'INSERT' THEN 'CREATE_TASK' ELSE 'UPDATE_TASK' END,
                'task',
                COALESCE(NEW.id, gen_random_uuid()),
                v_company_owner_id,
                v_company_owner_name,
                jsonb_build_object(
                    'task_title', NEW.title,
                    'company_id', NEW.company_id,
                    'attempted_operation', TG_OP
                )
            );
            
            -- Bloquear operação
            RAISE EXCEPTION 'Este cliente pertence ao vendedor %. Você não pode criar ou editar tarefas para clientes de outros vendedores.', 
                COALESCE(v_company_owner_name, 'outro vendedor');
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Criar trigger para tasks
DROP TRIGGER IF EXISTS check_task_owner_consistency_trigger ON tasks;
CREATE TRIGGER check_task_owner_consistency_trigger
    BEFORE INSERT OR UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION check_task_owner_consistency();

-- 3. Trigger para Governança em Orders
CREATE OR REPLACE FUNCTION public.check_order_owner_consistency()
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
    
    -- Verificar se order está vinculada a uma empresa
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
                CASE WHEN TG_OP = 'INSERT' THEN 'CREATE_ORDER' ELSE 'UPDATE_ORDER' END,
                'order',
                COALESCE(NEW.id, gen_random_uuid()),
                v_company_owner_id,
                v_company_owner_name,
                jsonb_build_object(
                    'order_number', NEW.number,
                    'company_id', NEW.company_id,
                    'attempted_operation', TG_OP
                )
            );
            
            -- Bloquear operação
            RAISE EXCEPTION 'Este cliente pertence ao vendedor %. Você não pode criar ou editar pedidos para clientes de outros vendedores.', 
                COALESCE(v_company_owner_name, 'outro vendedor');
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Criar trigger para orders
DROP TRIGGER IF EXISTS check_order_owner_consistency_trigger ON orders;
CREATE TRIGGER check_order_owner_consistency_trigger
    BEFORE INSERT OR UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION check_order_owner_consistency();