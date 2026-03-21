CREATE OR REPLACE FUNCTION public.resolve_user_for_sales_rep(
  p_sales_rep_id UUID,
  p_operation_context TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  IF p_sales_rep_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT usr.user_id
  INTO v_user_id
  FROM public.user_sales_reps usr
  WHERE usr.sales_rep_id = p_sales_rep_id
  ORDER BY usr.is_default DESC NULLS LAST, usr.created_at ASC NULLS LAST, usr.user_id ASC
  LIMIT 1;

  IF v_user_id IS NULL AND p_operation_context IS NOT NULL THEN
    RAISE WARNING 'Sales_rep sem usuário vinculado durante operação crítica. sales_rep_id=%, contexto=%', p_sales_rep_id, p_operation_context;
  END IF;

  RETURN v_user_id;
END;
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
      )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_transfer_request(
  p_request_id UUID,
  p_review_note TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_request RECORD;
  v_company_name TEXT;
  v_from_rep_name TEXT;
  v_to_rep_name TEXT;
  v_new_owner_user_id UUID;
  v_previous_owner_user_id UUID;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') AND NOT public.has_role(auth.uid(), 'desenvolvedor') THEN
    RAISE EXCEPTION 'Apenas administradores podem aprovar transferências';
  END IF;

  SELECT * INTO v_request
  FROM public.customer_transfer_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF v_request IS NULL THEN
    RAISE EXCEPTION 'Solicitação não encontrada';
  END IF;

  IF v_request.status != 'pending' THEN
    RAISE EXCEPTION 'Solicitação já foi processada';
  END IF;

  SELECT COALESCE(c.fantasia, c.name)
  INTO v_company_name
  FROM public.companies c
  WHERE c.id = v_request.company_id;

  SELECT sr.name INTO v_from_rep_name
  FROM public.sales_reps sr
  WHERE sr.id = v_request.from_sales_rep_id;

  SELECT sr.name INTO v_to_rep_name
  FROM public.sales_reps sr
  WHERE sr.id = v_request.to_sales_rep_id;

  v_new_owner_user_id := public.resolve_user_for_sales_rep(
    v_request.to_sales_rep_id,
    'approve_transfer_request:to_sales_rep'
  );

  v_previous_owner_user_id := public.resolve_user_for_sales_rep(
    v_request.from_sales_rep_id,
    'approve_transfer_request:from_sales_rep'
  );

  UPDATE public.customer_transfer_requests
  SET status = 'approved',
      reviewed_by = auth.uid(),
      review_note = p_review_note,
      reviewed_at = now()
  WHERE id = p_request_id;

  UPDATE public.companies
  SET sales_rep_id = v_request.to_sales_rep_id,
      owner_id = CASE
        WHEN v_new_owner_user_id IS NOT NULL THEN v_new_owner_user_id
        ELSE owner_id
      END,
      updated_at = now()
  WHERE id = v_request.company_id;

  INSERT INTO public.portfolio_transfers (
    entity_type, entity_id, entity_name,
    from_sales_rep_id, to_sales_rep_id,
    from_user_id, to_user_id,
    requested_by, approved_by, approved_at,
    reason, transferred_by, transfer_request_id,
    notes
  ) VALUES (
    'company',
    v_request.company_id,
    COALESCE(v_company_name, ''),
    v_request.from_sales_rep_id,
    v_request.to_sales_rep_id,
    v_previous_owner_user_id,
    v_new_owner_user_id,
    v_request.requested_by,
    auth.uid(),
    now(),
    v_request.reason,
    auth.uid(),
    p_request_id,
    'Transferência via solicitação formal. De: ' || COALESCE(v_from_rep_name, '?') || ' → Para: ' || COALESCE(v_to_rep_name, '?')
  );

  RETURN json_build_object(
    'success', true,
    'message', 'Transferência aprovada com sucesso',
    'company_name', v_company_name,
    'from_rep', v_from_rep_name,
    'to_rep', v_to_rep_name,
    'owner_synced', v_new_owner_user_id IS NOT NULL,
    'owner_user_id', v_new_owner_user_id
  );
END;
$$;