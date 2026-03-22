CREATE OR REPLACE FUNCTION public.check_company_edit_permission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_is_admin BOOLEAN;
    v_has_delegation BOOLEAN;
    v_owner_name TEXT;
BEGIN
    -- Permite operações administrativas/serviço sem contexto JWT (manutenções e rotinas internas)
    IF auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;

    v_is_admin := public.has_role(auth.uid(), 'admin');
    IF v_is_admin THEN RETURN NEW; END IF;

    IF OLD.sales_rep_id IS NOT NULL AND NOT public.user_has_sales_rep_access(auth.uid(), OLD.sales_rep_id) THEN
        v_has_delegation := public.can_manage_portfolio(auth.uid(), OLD.sales_rep_id, 'company');
        IF v_has_delegation THEN RETURN NEW; END IF;

        SELECT public.get_sales_rep_name(OLD.sales_rep_id) INTO v_owner_name;

        INSERT INTO public.access_violation_log (user_id, action, entity_type, entity_id, target_owner_id, target_owner_name, details)
        VALUES (auth.uid(), 'UPDATE_COMPANY', 'company', OLD.id, OLD.sales_rep_id, v_owner_name,
            jsonb_build_object('company_name', OLD.name, 'attempted_field_change', 'update_blocked', 'ownership_source', 'sales_rep_id'));

        RAISE EXCEPTION 'Este cliente pertence ao vendedor %. Você não pode editar clientes de outros vendedores.',
            COALESCE(v_owner_name, 'outro vendedor');
    END IF;
    RETURN NEW;
END;
$function$;