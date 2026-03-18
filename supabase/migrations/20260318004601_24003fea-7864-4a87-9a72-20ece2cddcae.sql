
CREATE OR REPLACE FUNCTION public.reset_orders()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_deleted_items INT;
  v_deleted_orders INT;
  v_deleted_approvals INT;
  v_deleted_audit INT;
  v_deleted_fiscal INT;
BEGIN
  -- Only admins and developers can execute
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'desenvolvedor')) THEN
    RAISE EXCEPTION 'Apenas administradores podem resetar pedidos';
  END IF;

  -- Delete dependent tables first (respecting FK constraints)
  DELETE FROM public.order_item_fiscal_snapshots;
  GET DIAGNOSTICS v_deleted_fiscal = ROW_COUNT;

  DELETE FROM public.order_approvals;
  GET DIAGNOSTICS v_deleted_approvals = ROW_COUNT;

  DELETE FROM public.order_audit_log;
  GET DIAGNOSTICS v_deleted_audit = ROW_COUNT;

  DELETE FROM public.order_items;
  GET DIAGNOSTICS v_deleted_items = ROW_COUNT;

  -- Delete main orders table
  DELETE FROM public.orders;
  GET DIAGNOSTICS v_deleted_orders = ROW_COUNT;

  RETURN json_build_object(
    'success', true,
    'deleted_orders', v_deleted_orders,
    'deleted_items', v_deleted_items,
    'deleted_approvals', v_deleted_approvals,
    'deleted_audit', v_deleted_audit,
    'deleted_fiscal', v_deleted_fiscal,
    'timestamp', now()
  );
END;
$$;
