CREATE OR REPLACE FUNCTION public.user_has_sales_rep_access(p_user_id UUID, p_sales_rep_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p_sales_rep_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.user_sales_reps usr
      WHERE usr.user_id = p_user_id
        AND usr.sales_rep_id = p_sales_rep_id
    );
$$;

CREATE OR REPLACE FUNCTION public.get_company_owner(p_company_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT sales_rep_id FROM public.companies WHERE id = p_company_id;
$$;

CREATE OR REPLACE FUNCTION public.get_sales_rep_name(p_sales_rep_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT sr.name FROM public.sales_reps sr WHERE sr.id = p_sales_rep_id;
$$;

CREATE OR REPLACE FUNCTION public.can_manage_portfolio(
  p_user_id UUID,
  p_owner_id UUID,
  p_entity_type TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF public.user_has_sales_rep_access(p_user_id, p_owner_id) THEN
    RETURN TRUE;
  END IF;

  IF public.has_role(p_user_id, 'admin') THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.user_portfolio_delegations upd
    WHERE upd.manager_user_id = p_user_id
      AND upd.active = true
      AND upd.portfolio_owner_id IN (
        SELECT usr.user_id
        FROM public.user_sales_reps usr
        WHERE usr.sales_rep_id = p_owner_id
      )
      AND (
        p_entity_type IS NULL
        OR (p_entity_type = 'company' AND upd.can_manage_companies)
        OR (p_entity_type = 'contact' AND upd.can_manage_contacts)
        OR (p_entity_type = 'deal' AND upd.can_manage_deals)
        OR (p_entity_type = 'order' AND upd.can_manage_orders)
        OR (p_entity_type = 'pipeline' AND upd.can_manage_pipeline)
      )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.check_company_edit_permission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_is_admin BOOLEAN;
    v_has_delegation BOOLEAN;
    v_owner_name TEXT;
BEGIN
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
$$;

CREATE OR REPLACE FUNCTION public.check_task_owner_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

        IF v_company_sales_rep_id IS NOT NULL AND NOT public.user_has_sales_rep_access(auth.uid(), v_company_sales_rep_id) THEN
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
$$;

CREATE OR REPLACE FUNCTION public.check_deal_owner_consistency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_company_sales_rep_id UUID;
    v_company_owner_name TEXT;
    v_is_admin BOOLEAN;
    v_has_delegation BOOLEAN;
BEGIN
    v_is_admin := public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'desenvolvedor');
    IF v_is_admin THEN RETURN NEW; END IF;

    IF NEW.company_id IS NOT NULL THEN
        SELECT c.sales_rep_id, public.get_sales_rep_name(c.sales_rep_id)
        INTO v_company_sales_rep_id, v_company_owner_name
        FROM public.companies c
        WHERE c.id = NEW.company_id;

        IF v_company_sales_rep_id IS NOT NULL AND NOT public.user_has_sales_rep_access(auth.uid(), v_company_sales_rep_id) THEN
            v_has_delegation := public.can_manage_portfolio(auth.uid(), v_company_sales_rep_id, 'deal');
            IF v_has_delegation THEN RETURN NEW; END IF;

            INSERT INTO public.access_violation_log (user_id, action, entity_type, entity_id, target_owner_id, target_owner_name, details)
            VALUES (auth.uid(),
                CASE WHEN TG_OP = 'INSERT' THEN 'CREATE_DEAL' ELSE 'UPDATE_DEAL' END,
                'deal', COALESCE(NEW.id, gen_random_uuid()), v_company_sales_rep_id, v_company_owner_name,
                jsonb_build_object('deal_name', NEW.name, 'company_id', NEW.company_id, 'attempted_operation', TG_OP, 'ownership_source', 'sales_rep_id'));

            RAISE EXCEPTION 'Este cliente pertence ao vendedor %. Voce nao pode criar ou editar negocios para clientes de outros vendedores.',
                COALESCE(v_company_owner_name, 'outro vendedor');
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_order_owner_consistency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_company_sales_rep_id UUID;
    v_company_owner_name TEXT;
    v_is_admin BOOLEAN;
    v_has_delegation BOOLEAN;
BEGIN
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

DROP POLICY IF EXISTS "Users can update companies they own or are admin" ON public.companies;
CREATE POLICY "Users can update companies they own or are admin" ON public.companies
FOR UPDATE USING (
  has_role(auth.uid(), 'admin')
  OR created_by = auth.uid()
  OR can_manage_portfolio(auth.uid(), sales_rep_id, 'company')
);

DROP POLICY IF EXISTS "Users can delete companies they own or are admin" ON public.companies;
CREATE POLICY "Users can delete companies they own or are admin" ON public.companies
FOR DELETE USING (
  has_role(auth.uid(), 'admin')
  OR created_by = auth.uid()
  OR can_manage_portfolio(auth.uid(), sales_rep_id, 'company')
);

DROP POLICY IF EXISTS "Users can update contacts they own or are admin" ON public.contacts;
CREATE POLICY "Users can update contacts they own or are admin" ON public.contacts
FOR UPDATE USING (
  has_role(auth.uid(), 'admin')
  OR created_by = auth.uid()
  OR can_manage_portfolio(auth.uid(), get_company_owner(company_id), 'contact')
);

DROP POLICY IF EXISTS "Users can view deals they have access to" ON public.deals;
CREATE POLICY "Users can view deals they have access to" ON public.deals
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin')
  OR created_by = auth.uid()
  OR id IN (SELECT deal_id FROM public.deal_participants WHERE user_id = auth.uid())
  OR can_manage_portfolio(auth.uid(), get_company_owner(company_id), 'deal')
);

DROP POLICY IF EXISTS "Users can update deals they own or are admin" ON public.deals;
CREATE POLICY "Users can update deals they own or are admin" ON public.deals
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin')
  OR created_by = auth.uid()
  OR can_manage_portfolio(auth.uid(), get_company_owner(company_id), 'deal')
);

DROP POLICY IF EXISTS "Users can update orders they created or are admin" ON public.orders;
CREATE POLICY "Users can update orders they created or are admin" ON public.orders
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin')
  OR created_by = auth.uid()
  OR can_manage_portfolio(auth.uid(), get_company_owner(company_id), 'order')
);