-- Add 'task' branch to can_manage_portfolio and use it in tasks trigger; relax unlock_order rule

CREATE OR REPLACE FUNCTION public.can_manage_portfolio(p_user_id uuid, p_owner_id uuid, p_entity_type text DEFAULT NULL::text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_resolved_owner_user_id UUID;
BEGIN
  IF public.user_has_sales_rep_access(p_user_id, p_owner_id) THEN
    RETURN TRUE;
  END IF;

  IF public.has_role(p_user_id, 'admin') THEN
    RETURN TRUE;
  END IF;

  v_resolved_owner_user_id := public.resolve_user_for_sales_rep(
    p_owner_id,
    COALESCE('can_manage_portfolio:' || p_entity_type, 'can_manage_portfolio')
  );

  IF v_resolved_owner_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.user_portfolio_delegations upd
    WHERE upd.manager_user_id = p_user_id
      AND upd.active = true
      AND upd.portfolio_owner_id = v_resolved_owner_user_id
      AND (
        p_entity_type IS NULL
        OR (p_entity_type = 'company' AND upd.can_manage_companies)
        OR (p_entity_type = 'contact' AND upd.can_manage_contacts)
        OR (p_entity_type = 'deal' AND upd.can_manage_deals)
        OR (p_entity_type = 'order' AND upd.can_manage_orders)
        OR (p_entity_type = 'pipeline' AND upd.can_manage_pipeline)
        OR (p_entity_type = 'task' AND upd.can_manage_companies)
      )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_task_owner_consistency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_company_sales_rep_id UUID;
    v_company_owner_name TEXT;
    v_is_admin BOOLEAN;
BEGIN
    v_is_admin := public.has_role(auth.uid(), 'admin');

    IF v_is_admin THEN
        RETURN NEW;
    END IF;

    IF NEW.company_id IS NOT NULL THEN
        SELECT c.sales_rep_id, public.get_sales_rep_name(c.sales_rep_id)
        INTO v_company_sales_rep_id, v_company_owner_name
        FROM public.companies c
        WHERE c.id = NEW.company_id;

        IF v_company_sales_rep_id IS NOT NULL
           AND NOT public.can_manage_portfolio(auth.uid(), v_company_sales_rep_id, 'task') THEN
            INSERT INTO public.access_violation_log (
                user_id, action, entity_type, entity_id,
                target_owner_id, target_owner_name, details
            ) VALUES (
                auth.uid(),
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

CREATE OR REPLACE FUNCTION public.unlock_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_is_admin BOOLEAN;
  v_locked BOOLEAN;
  v_order_number TEXT;
  v_company_id UUID;
  v_company_sales_rep UUID;
  v_has_full_orders_access BOOLEAN := FALSE;
  v_can_manage BOOLEAN := FALSE;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT is_locked, number, company_id INTO v_locked, v_order_number, v_company_id
  FROM public.orders WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;

  SELECT public.has_role(v_user_id, 'admin'::app_role) INTO v_is_admin;

  IF NOT v_is_admin THEN
    -- Verifica acesso total ao módulo Pedidos
    SELECT EXISTS (
      SELECT 1 FROM public.get_user_module_permissions(v_user_id) p
      WHERE p.module_key = 'orders' AND p.access_type = 'total'
    ) INTO v_has_full_orders_access;

    IF NOT v_has_full_orders_access THEN
      RAISE EXCEPTION 'Você não tem permissão para desbloquear pedidos';
    END IF;

    -- Verifica ownership/delegação via cliente do pedido
    IF v_company_id IS NOT NULL THEN
      SELECT c.sales_rep_id INTO v_company_sales_rep
      FROM public.companies c WHERE c.id = v_company_id;

      IF v_company_sales_rep IS NOT NULL THEN
        v_can_manage := public.can_manage_portfolio(v_user_id, v_company_sales_rep, 'order');
      ELSE
        v_can_manage := TRUE; -- sem sales_rep definido, libera para quem tem acesso total
      END IF;
    ELSE
      v_can_manage := TRUE;
    END IF;

    IF NOT v_can_manage THEN
      RAISE EXCEPTION 'Você só pode desbloquear pedidos de clientes da sua carteira ou delegados a você';
    END IF;
  END IF;

  IF v_locked = false THEN
    RETURN jsonb_build_object('success', true, 'already_unlocked', true);
  END IF;

  UPDATE public.orders
  SET is_locked = false, locked_at = NULL, locked_by = NULL
  WHERE id = p_order_id;

  INSERT INTO public.order_audit_log (order_id, field_name, field_label, old_value, new_value, changed_by)
  VALUES (p_order_id, 'is_locked', 'Desbloqueio', 'true', 'false', v_user_id);

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'order_number', v_order_number,
    'unlocked_by', v_user_id
  );
END;
$function$;