CREATE OR REPLACE FUNCTION public.check_order_owner_consistency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_company_sales_rep_id UUID;
    v_company_owner_name TEXT;
    v_is_admin BOOLEAN;
    v_has_delegation BOOLEAN;
BEGIN
    -- Service role (Edge Functions) bypasses ownership check
    IF auth.uid() IS NULL THEN RETURN NEW; END IF;

    v_is_admin := public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'desenvolvedor');
    IF v_is_admin THEN RETURN NEW; END IF;

    IF NEW.company_id IS NOT NULL THEN
        SELECT c.sales_rep_id, public.get_sales_rep_name(c.sales_rep_id)
        INTO v_company_sales_rep_id, v_company_owner_name
        FROM public.companies c
        WHERE c.id = NEW.company_id;

        IF v_company_sales_rep_id IS NOT NULL AND NOT public.user_has_sales_rep_access(auth.uid(), v_company_sales_rep_id) THEN
            v_has_delegation := public.can_manage_portfolio(auth.uid(), v_company_sales_rep_id, 'order');
            IF v_has_delegation THEN RETURN NEW; END IF;

            INSERT INTO public.access_violation_log (user_id, action, entity_type, entity_id, target_owner_id, target_owner_name, details)
            VALUES (auth.uid(),
                CASE WHEN TG_OP = 'INSERT' THEN 'CREATE_ORDER' ELSE 'UPDATE_ORDER' END,
                'order', COALESCE(NEW.id, gen_random_uuid()), v_company_sales_rep_id, v_company_owner_name,
                jsonb_build_object('order_number', NEW.number, 'company_id', NEW.company_id, 'attempted_operation', TG_OP, 'ownership_source', 'sales_rep_id'));

            RAISE EXCEPTION 'Este cliente pertence ao vendedor %. Voce nao pode criar ou editar pedidos para clientes de outros vendedores.',
                COALESCE(v_company_owner_name, 'outro vendedor');
        END IF;
    END IF;
    RETURN NEW;
END;
$$;