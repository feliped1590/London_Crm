CREATE OR REPLACE FUNCTION public.check_deal_owner_consistency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_company_sales_rep_id UUID;
    v_company_owner_name TEXT;
    v_is_admin BOOLEAN;
    v_has_delegation BOOLEAN;
    v_uid UUID := auth.uid();
BEGIN
    -- Bypass quando não há usuário autenticado (service role / migrations / triggers internos)
    IF v_uid IS NULL THEN
        RETURN NEW;
    END IF;

    v_is_admin := public.has_role(v_uid, 'admin') OR public.has_role(v_uid, 'desenvolvedor');
    IF v_is_admin THEN RETURN NEW; END IF;

    IF NEW.company_id IS NOT NULL THEN
        SELECT c.sales_rep_id, public.get_sales_rep_name(c.sales_rep_id)
        INTO v_company_sales_rep_id, v_company_owner_name
        FROM public.companies c
        WHERE c.id = NEW.company_id;

        IF v_company_sales_rep_id IS NOT NULL AND NOT public.user_has_sales_rep_access(v_uid, v_company_sales_rep_id) THEN
            v_has_delegation := public.can_manage_portfolio(v_uid, v_company_sales_rep_id, 'deal');
            IF v_has_delegation THEN RETURN NEW; END IF;

            INSERT INTO public.access_violation_log (user_id, action, entity_type, entity_id, target_owner_id, target_owner_name, details)
            VALUES (v_uid,
                CASE WHEN TG_OP = 'INSERT' THEN 'CREATE_DEAL' ELSE 'UPDATE_DEAL' END,
                'deal', COALESCE(NEW.id, gen_random_uuid()), v_company_sales_rep_id, v_company_owner_name,
                jsonb_build_object('deal_name', NEW.name, 'company_id', NEW.company_id, 'attempted_operation', TG_OP, 'ownership_source', 'sales_rep_id'));

            RAISE EXCEPTION 'Este cliente pertence ao vendedor %. Voce nao pode criar ou editar negocios para clientes de outros vendedores.',
                COALESCE(v_company_owner_name, 'outro vendedor');
        END IF;
    END IF;
    RETURN NEW;
END;
$function$;