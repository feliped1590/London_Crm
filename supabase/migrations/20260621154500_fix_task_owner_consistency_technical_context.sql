CREATE OR REPLACE FUNCTION public.check_task_owner_consistency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_current_user_id UUID := auth.uid();
    v_company_sales_rep_id UUID;
    v_company_owner_name TEXT;
    v_is_admin BOOLEAN;
BEGIN
    -- Contexto tecnico (seed/batch) sem usuario autenticado.
    -- Mantem compatibilidade sem inserir user_id nulo em access_violation_log.
    IF v_current_user_id IS NULL THEN
        RETURN NEW;
    END IF;

    v_is_admin := public.has_role(v_current_user_id, 'admin');

    IF v_is_admin THEN
        RETURN NEW;
    END IF;

    IF NEW.company_id IS NOT NULL THEN
        SELECT c.sales_rep_id, public.get_sales_rep_name(c.sales_rep_id)
        INTO v_company_sales_rep_id, v_company_owner_name
        FROM public.companies c
        WHERE c.id = NEW.company_id;

        IF v_company_sales_rep_id IS NOT NULL
           AND NOT public.can_manage_portfolio(v_current_user_id, v_company_sales_rep_id, 'task') THEN
            INSERT INTO public.access_violation_log (
                user_id, action, entity_type, entity_id,
                target_owner_id, target_owner_name, details
            ) VALUES (
                v_current_user_id,
                CASE WHEN TG_OP = 'INSERT' THEN 'CREATE_TASK' ELSE 'UPDATE_TASK' END,
                'task',
                COALESCE(NEW.id, gen_random_uuid()),
                v_company_sales_rep_id,
                v_company_owner_name,
                jsonb_build_object(
                    'task_title', NEW.title,
                    'company_id', NEW.company_id,
                    'attempted_operation', TG_OP,
                    'ownership_source', 'sales_rep_id'
                )
            );

            RAISE EXCEPTION 'Este cliente pertence ao vendedor %. Você não pode criar ou editar tarefas para clientes de outros vendedores.',
                COALESCE(v_company_owner_name, 'outro vendedor');
        END IF;
    END IF;

    RETURN NEW;
END;
$function$;
