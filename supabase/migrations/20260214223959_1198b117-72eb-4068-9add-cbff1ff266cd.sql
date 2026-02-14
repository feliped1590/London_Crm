
-- 1. Fix check_company_edit_permission: add delegation check + fix jsonb diff
CREATE OR REPLACE FUNCTION public.check_company_edit_permission()
RETURNS TRIGGER AS $$
DECLARE
    v_is_admin BOOLEAN;
    v_has_delegation BOOLEAN;
    v_owner_name TEXT;
BEGIN
    v_is_admin := public.has_role(auth.uid(), 'admin');
    IF v_is_admin THEN RETURN NEW; END IF;

    IF OLD.owner_id IS NOT NULL AND OLD.owner_id != auth.uid() THEN
        v_has_delegation := public.can_manage_portfolio(auth.uid(), OLD.owner_id, 'company');
        IF v_has_delegation THEN RETURN NEW; END IF;

        SELECT full_name INTO v_owner_name FROM public.profiles WHERE user_id = OLD.owner_id;

        INSERT INTO public.access_violation_log (user_id, action, entity_type, entity_id, target_owner_id, target_owner_name, details)
        VALUES (auth.uid(), 'UPDATE_COMPANY', 'company', OLD.id, OLD.owner_id, v_owner_name,
            jsonb_build_object('company_name', OLD.name, 'attempted_field_change', 'update_blocked'));

        RAISE EXCEPTION 'Este cliente pertence ao vendedor %. Você não pode editar clientes de outros vendedores.',
            COALESCE(v_owner_name, 'outro vendedor');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Fix check_deal_owner_consistency: add delegation check
CREATE OR REPLACE FUNCTION public.check_deal_owner_consistency()
RETURNS TRIGGER AS $$
DECLARE
    v_company_owner_id UUID;
    v_company_owner_name TEXT;
    v_is_admin BOOLEAN;
    v_has_delegation BOOLEAN;
BEGIN
    v_is_admin := public.has_role(auth.uid(), 'admin');
    IF v_is_admin THEN RETURN NEW; END IF;

    IF NEW.company_id IS NOT NULL THEN
        SELECT c.owner_id, p.full_name
        INTO v_company_owner_id, v_company_owner_name
        FROM public.companies c
        LEFT JOIN public.profiles p ON p.user_id = c.owner_id
        WHERE c.id = NEW.company_id;

        IF v_company_owner_id IS NOT NULL AND v_company_owner_id != auth.uid() THEN
            v_has_delegation := public.can_manage_portfolio(auth.uid(), v_company_owner_id, 'deal');
            IF v_has_delegation THEN RETURN NEW; END IF;

            INSERT INTO public.access_violation_log (user_id, action, entity_type, entity_id, target_owner_id, target_owner_name, details)
            VALUES (auth.uid(),
                CASE WHEN TG_OP = 'INSERT' THEN 'CREATE_DEAL' ELSE 'UPDATE_DEAL' END,
                'deal', COALESCE(NEW.id, gen_random_uuid()), v_company_owner_id, v_company_owner_name,
                jsonb_build_object('deal_name', NEW.name, 'company_id', NEW.company_id, 'attempted_operation', TG_OP));

            RAISE EXCEPTION 'Este cliente pertence ao vendedor %. Você não pode criar ou editar negócios para clientes de outros vendedores.',
                COALESCE(v_company_owner_name, 'outro vendedor');
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Fix check_order_owner_consistency: add delegation check
CREATE OR REPLACE FUNCTION public.check_order_owner_consistency()
RETURNS TRIGGER AS $$
DECLARE
    v_company_owner_id UUID;
    v_company_owner_name TEXT;
    v_is_admin BOOLEAN;
    v_has_delegation BOOLEAN;
BEGIN
    v_is_admin := public.has_role(auth.uid(), 'admin');
    IF v_is_admin THEN RETURN NEW; END IF;

    IF NEW.company_id IS NOT NULL THEN
        SELECT c.owner_id, p.full_name
        INTO v_company_owner_id, v_company_owner_name
        FROM public.companies c
        LEFT JOIN public.profiles p ON p.user_id = c.owner_id
        WHERE c.id = NEW.company_id;

        IF v_company_owner_id IS NOT NULL AND v_company_owner_id != auth.uid() THEN
            v_has_delegation := public.can_manage_portfolio(auth.uid(), v_company_owner_id, 'order');
            IF v_has_delegation THEN RETURN NEW; END IF;

            INSERT INTO public.access_violation_log (user_id, action, entity_type, entity_id, target_owner_id, target_owner_name, details)
            VALUES (auth.uid(),
                CASE WHEN TG_OP = 'INSERT' THEN 'CREATE_ORDER' ELSE 'UPDATE_ORDER' END,
                'order', COALESCE(NEW.id, gen_random_uuid()), v_company_owner_id, v_company_owner_name,
                jsonb_build_object('order_number', NEW.number, 'company_id', NEW.company_id, 'attempted_operation', TG_OP));

            RAISE EXCEPTION 'Este cliente pertence ao vendedor %. Você não pode criar ou editar pedidos para clientes de outros vendedores.',
                COALESCE(v_company_owner_name, 'outro vendedor');
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
