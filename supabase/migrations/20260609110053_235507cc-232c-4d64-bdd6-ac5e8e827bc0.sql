CREATE OR REPLACE FUNCTION public.validate_order_status_transition(_order_id uuid, _next_status text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant         uuid;
  v_pending_items  integer := 0;
  v_pending_order  integer := 0;
  v_flag_comm      boolean := true;
  v_flag_pay       boolean := true;
  v_open_requests  integer := 0;
  v_blocks         jsonb := '[]'::jsonb;
BEGIN
  SELECT tenant_id INTO v_tenant FROM public.orders WHERE id = _order_id;
  IF v_tenant IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Pedido não encontrado');
  END IF;

  SELECT
    COALESCE((settings->>'commission_allow_exception')::boolean, true),
    COALESCE((settings->>'payment_terms_allow_exception')::boolean, true)
  INTO v_flag_comm, v_flag_pay
  FROM public.tenant_settings
  WHERE tenant_id = v_tenant AND category = 'commercial_governance'
  LIMIT 1;

  SELECT COUNT(*) INTO v_pending_items
  FROM (
    SELECT DISTINCT ON (s.order_item_id) s.order_item_id, s.needs_approval
    FROM public.order_item_commission_snapshot s
    JOIN public.order_items oi ON oi.id = s.order_item_id
    WHERE oi.order_id = _order_id
    ORDER BY s.order_item_id, s.created_at DESC
  ) latest WHERE latest.needs_approval;

  SELECT COUNT(*) INTO v_pending_order
  FROM (
    SELECT s.needs_approval
    FROM public.order_payment_terms_snapshot s
    WHERE s.order_id = _order_id
    ORDER BY s.created_at DESC
    LIMIT 1
  ) latest WHERE latest.needs_approval;

  SELECT COUNT(*) INTO v_open_requests
  FROM public.order_approval_requests
  WHERE order_id = _order_id AND status = 'pending';

  IF v_pending_items > 0 AND NOT v_flag_comm THEN
    v_blocks := v_blocks || jsonb_build_object('type','commission',
      'reason','Comissão excede limite e exceção não é permitida no tenant');
  END IF;
  IF v_pending_order > 0 AND NOT v_flag_pay THEN
    v_blocks := v_blocks || jsonb_build_object('type','payment_terms',
      'reason','Condição de pagamento excede limite e exceção não é permitida no tenant');
  END IF;

  RETURN jsonb_build_object(
    'ok',                jsonb_array_length(v_blocks) = 0,
    'next_status',       _next_status,
    'pending_items',     v_pending_items,
    'pending_order',     v_pending_order,
    'open_requests',     v_open_requests,
    'allow_commission_exception', v_flag_comm,
    'allow_payment_exception',    v_flag_pay,
    'blocks',            v_blocks,
    'requires_approval', (v_pending_items > 0 OR v_pending_order > 0)
  );
END;
$function$;