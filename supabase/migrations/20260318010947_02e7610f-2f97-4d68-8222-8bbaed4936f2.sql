
CREATE OR REPLACE FUNCTION public.reset_orders()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_deleted_orders INTEGER;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') AND NOT public.has_role(auth.uid(), 'desenvolvedor') THEN
    RAISE EXCEPTION 'Apenas administradores ou desenvolvedores podem executar esta ação';
  END IF;

  DELETE FROM public.order_approvals;
  DELETE FROM public.order_audit_log;
  DELETE FROM public.order_items;
  DELETE FROM public.orders;
  GET DIAGNOSTICS v_deleted_orders = ROW_COUNT;

  RETURN json_build_object(
    'success', true,
    'deleted_orders', v_deleted_orders,
    'timestamp', now()
  );
END;
$$;
